import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountKeyPersistence, type AccountKeyCache, type AccountKeyFields } from '../../src/lib/account-key-persistence';
import type { ApiKeys } from '../../src/lib/firebase';

const keys = (gemini = '', extra: Partial<ApiKeys> = {}): ApiKeys => ({gemini,openrouter:'',groq:'',cerebras:'',github:'',...extra});
const deferred = () => {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes,no) => {resolve=yes;reject=no;});
  return {promise,resolve,reject};
};
function harness() {
  const local = new Map<string,AccountKeyCache>();
  const sends: {uid:string;fields:Readonly<AccountKeyFields>;ack:ReturnType<typeof deferred>}[] = [];
  let uid: string | null = 'alice', count = 0, writable = true;
  const dependencies = {
    readLocal:(account: string) => local.get(account) || null,
    writeLocal:(account: string,patch: AccountKeyCache) => {
      if (!writable) return false;
      local.set(account,structuredClone({...local.get(account),...patch}));return true;
    },
    enqueueRemote:(account: string,fields: Readonly<AccountKeyFields>) => {
      const ack=deferred();sends.push({uid:account,fields,ack});return ack.promise;
    },
    currentUid:() => uid,
    isPreview:(account: string) => account.startsWith('preview-'),
    revision:() => `revision-${++count}`,
  };
  return {local,sends,dependencies,coordinator:createAccountKeyPersistence(dependencies),
    setUid:(value: string | null) => {uid=value;},setWritable:(value: boolean) => {writable=value;}};
}
const settle = async () => {await Promise.resolve();await Promise.resolve();await Promise.resolve();};

test('a stalled remote acknowledgement never blocks a durable synchronous save or later SDK enqueue', () => {
  const h=harness(), input=keys(' alpha ',{alibaba:' provider ',providerAccess:{alibaba:true},providerRelayUrl:'https://relay.example/'});
  const saved=h.coordinator.save('alice',input);
  assert.equal(saved.gemini,'alpha');assert.equal(h.local.get('alice')?.geminiKey,'alpha');
  assert.equal(h.sends.length,1,'SDK receives first write before save returns');
  h.coordinator.save('alice',keys('beta'));
  assert.equal(h.sends.length,2,'second SDK write does not wait for the first server acknowledgement');
  assert.deepEqual(h.sends.map(send => send.fields.geminiKey),['alpha','beta']);
  assert.equal(h.local.get('alice')?.pendingKeyRevision,h.local.get('alice')?.keyRevision);
  input.gemini='changed';input.providerAccess!.alibaba=false;
  assert.equal(h.sends[0].fields.geminiKey,'alpha');
  assert.equal(h.sends[0].fields.providerConnections.providerAccess?.alibaba,true);
  assert(Object.isFrozen(h.sends[0].fields));
  assert(Object.isFrozen(h.sends[0].fields.providerConnections));
  assert(Object.isFrozen(h.sends[0].fields.providerConnections.providerAccess));
  assert(!('keyRevision' in h.sends[0].fields));assert(!('pendingKeyRevision' in h.sends[0].fields));
});

test('old acknowledgements never clear a replacement pending revision', async () => {
  const h=harness();h.coordinator.save('alice',keys('alpha'));
  h.coordinator.save('alice',keys('beta'));
  const pending=h.local.get('alice')!.pendingKeyRevision;
  h.sends[0].ack.resolve();await settle();
  assert.equal(h.local.get('alice')?.pendingKeyRevision,pending);
  h.sends[1].ack.resolve();await settle();
  assert.equal(h.local.get('alice')?.pendingKeyRevision,null);
  assert.equal(h.local.get('alice')?.geminiKey,'beta');
});

test('removals explicitly clear every legacy key, extra provider and consent option', () => {
  const h=harness();h.coordinator.save('alice',keys('alpha',{github:'git',alibaba:'provider',providerAccess:{alibaba:true},cloudflareAccountId:'a'.repeat(32)}));
  h.coordinator.save('alice',keys());
  const fields=h.sends[1].fields;
  for (const field of ['geminiKey','openrouterKey','groqKey','cerebrasKey','githubKey'] as const) assert.equal(fields[field],'');
  assert.equal(fields.providerConnections.alibaba,'');
  assert.equal(fields.providerConnections.providerAccess?.alibaba,false);
  assert.equal(fields.providerConnections.cloudflareAccountId,'');
});

test('a read started during pending save keeps current keys after acknowledgement and merges remote settings', async () => {
  const h=harness();h.coordinator.save('alice',keys('alpha'));
  const start=h.coordinator.captureRead('alice');
  h.sends[0].ack.resolve();await settle();
  const remote={geminiKey:'obsolete',settings:{theme:'dark',layouts:['remote']}};
  const result=h.coordinator.reconcileRead('alice',start,remote);
  assert.equal(result.geminiKey,'alpha');assert.deepEqual(result.settings,remote.settings);
  assert.equal(result.pendingKeyRevision,null);
  assert.equal(h.local.get('alice')?.geminiKey,'alpha');
  assert.equal(start.pending,'revision-1','capture is immutable scalars, independent of acknowledgements');
  assert(Object.isFrozen(start));
});

test('a remote read started before a local save cannot roll it back', () => {
  const h=harness(), start=h.coordinator.captureRead('alice');
  h.coordinator.save('alice',keys('replacement'));
  const result=h.coordinator.reconcileRead('alice',start,{geminiKey:'old-remote',settings:{newSetting:true}});
  assert.equal(result.geminiKey,'replacement');assert.deepEqual(result.settings,{newSetting:true});
});

test('an accepted remote key change gets a local revision that rejects older out-of-order reads', () => {
  const h=harness();
  const start=h.coordinator.captureRead('alice');
  const first=h.coordinator.reconcileRead('alice',start,{geminiKey:'initial',settings:{version:1}});
  assert.equal(first.pendingKeyRevision,null);
  const older=h.coordinator.captureRead('alice'), newer=h.coordinator.captureRead('alice');
  const changed=h.coordinator.reconcileRead('alice',newer,{geminiKey:'new-remote',settings:{version:3}});
  assert.notEqual(changed.keyRevision,first.keyRevision);
  const stale=h.coordinator.reconcileRead('alice',older,{geminiKey:'initial',settings:{version:2}});
  assert.equal(stale.geminiKey,'new-remote');assert.deepEqual(stale.settings,{version:2},'non-key remote settings still merge');
  assert.equal(h.sends.length,0,'remote reads never create outbound writes');
});

test('reload resumes durable pending keys for the current UID and deduplicates the in-flight revision', async () => {
  const h=harness();h.coordinator.save('alice',keys('alpha'));
  const reloaded=createAccountKeyPersistence(h.dependencies);
  h.setUid('bob');assert.equal(reloaded.resume('alice'),false);assert.equal(h.sends.length,1);
  h.setUid('alice');assert.equal(reloaded.resume('alice'),true);
  assert.equal(reloaded.resume('alice'),false);assert.equal(h.sends.length,2);
  h.sends[1].ack.reject(new Error('offline'));await settle();
  assert.equal(h.sends.length,2,'failure retains pending without an automatic retry loop');
  assert(h.local.get('alice')?.pendingKeyRevision);
  assert.equal(reloaded.resume('alice'),true);assert.equal(h.sends.length,3);
});

test('late acknowledgement and stale reads cannot recreate cleared logout caches', async () => {
  const h=harness();h.coordinator.save('alice',keys('alpha'));
  const start=h.coordinator.captureRead('alice');
  h.local.delete('alice');h.setUid(null);h.sends[0].ack.resolve();await settle();
  assert.equal(h.local.has('alice'),false);
  assert.throws(()=>h.coordinator.reconcileRead('alice',start,{geminiKey:'old'}),/account|cleared/i);
  assert.equal(h.local.has('alice'),false);
  assert.throws(()=>h.coordinator.save('alice',keys('wrong-account')),/account/i);
});

test('clearing the cache before auth settles still prevents a late ACK from recreating it', async () => {
  const h=harness();h.coordinator.save('alice',keys('alpha'));
  const start=h.coordinator.captureRead('alice');h.local.delete('alice');
  h.sends[0].ack.resolve();await settle();
  assert.equal(h.local.has('alice'),false,'cache existence is checked even if currentUid still matches');
  assert.throws(()=>h.coordinator.reconcileRead('alice',start,{geminiKey:'stale'}),/cleared/i);
  assert.equal(h.local.has('alice'),false);
});

test('preview saves are durable locally but never queued remotely or left pending', () => {
  const h=harness();h.setUid('preview-alice');
  h.coordinator.save('preview-alice',keys('preview'));
  assert.equal(h.local.get('preview-alice')?.geminiKey,'preview');
  assert.equal(h.local.get('preview-alice')?.pendingKeyRevision,null);
  assert.equal(h.coordinator.resume('preview-alice'),false);assert.equal(h.sends.length,0);
});

test('local storage failure is explicit and prevents remote enqueue and a successful save result', () => {
  const h=harness();h.setWritable(false);
  assert.throws(()=>h.coordinator.save('alice',keys('alpha')),/stor|device|local/i);
  assert.equal(h.sends.length,0);assert.equal(h.local.has('alice'),false);
});

test('synchronous enqueue failures keep durable pending state without surfacing an unhandled rejection', async () => {
  const h=harness();const coordinator=createAccountKeyPersistence({...h.dependencies,enqueueRemote:() => {throw new Error('network setup');}});
  assert.equal(coordinator.save('alice',keys('alpha')).gemini,'alpha');await settle();
  assert.equal(h.local.get('alice')?.pendingKeyRevision,h.local.get('alice')?.keyRevision);
});

test('an ACK that cannot durably clear its marker leaves a replayable pending save', async () => {
  const h=harness();h.coordinator.save('alice',keys('alpha'));
  h.setWritable(false);h.sends[0].ack.resolve();await settle();
  assert.equal(h.local.get('alice')?.pendingKeyRevision,h.local.get('alice')?.keyRevision);
  h.setWritable(true);assert.equal(h.coordinator.resume('alice'),true);
});


test('only a current matching revision reports terminal remote permission denial', async () => {
  const h=harness(),denied:string[]=[];
  const coordinator=createAccountKeyPersistence({...h.dependencies,onRemoteDenied:(uid:string)=>denied.push(uid)});
  coordinator.save('alice',keys('old'));coordinator.save('alice',keys('new'));
  h.sends[0].ack.reject(Object.assign(new Error('denied'),{code:'permission-denied'}));await settle();
  assert.deepEqual(denied,[],'an old write rejection cannot revoke a newer key scope');
  h.sends[1].ack.reject(Object.assign(new Error('denied'),{code:'permission-denied'}));await settle();
  assert.deepEqual(denied,['alice']);
});


test('an old auth session cannot revoke or reconcile a newly signed-in session with the same UID', async () => {
  const h=harness(),denied:string[]=[];let session=1;
  const coordinator=createAccountKeyPersistence({...h.dependencies,currentSession:()=>session,onRemoteDenied:(uid:string)=>denied.push(uid)});
  coordinator.save('alice',keys('alpha'));const read=coordinator.captureRead('alice');
  session=3;
  h.sends[0].ack.reject(Object.assign(new Error('denied'),{code:'permission-denied'}));await settle();
  assert.deepEqual(denied,[]);
  assert.throws(()=>coordinator.reconcileRead('alice',read,{geminiKey:'stale'}),/account changed/i);
});

test('a new auth session can resume a pending key without waiting for the old session ACK', async () => {
  const h=harness();let session=1;
  const coordinator=createAccountKeyPersistence({...h.dependencies,currentSession:()=>session});
  coordinator.save('alice',keys('alpha'));session=3;
  assert.equal(coordinator.resume('alice'),true,'an old session stalled enqueue cannot suppress current replay');
  assert.equal(h.sends.length,2);assert.equal(coordinator.resume('alice'),false,'same-session replay remains deduped');
  h.sends[0].ack.resolve();await settle();
  assert.equal(h.local.get('alice')?.pendingKeyRevision,h.local.get('alice')?.keyRevision,'old-session ACK cannot clear current replay');
  h.sends[1].ack.resolve();await settle();assert.equal(h.local.get('alice')?.pendingKeyRevision,null);
});
