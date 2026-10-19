import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountSettingsPersistence, type AccountSettingsCache, type AccountSettingsPatch, type SettingsSnapshot } from '../../src/lib/account-settings-persistence';

const deferred = () => {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
};
function harness() {
  const local=new Map<string,AccountSettingsCache>();
  const patches: AccountSettingsPatch[]=[],sends:{uid:string;settings:Readonly<SettingsSnapshot>;ack:ReturnType<typeof deferred>}[]=[];
  const denied=new Set<string>(),denials:string[]=[];
  let uid:string|null='alice',session=1,revision=0,writable=true;
  const dependencies={
    readLocal:(owner:string)=>local.get(owner)||null,
    writeLocal:(owner:string,patch:AccountSettingsPatch)=>{
      if(!writable)return false;
      patches.push(structuredClone(patch));local.set(owner,structuredClone({...local.get(owner),...patch}));return true;
    },
    enqueueRemote:(owner:string,settings:Readonly<SettingsSnapshot>)=>{
      const ack=deferred();sends.push({uid:owner,settings,ack});return ack.promise;
    },
    currentUid:()=>uid,currentSession:()=>session,isDenied:(owner:string)=>denied.has(owner),
    isPreview:(owner:string)=>owner.startsWith('preview-'),onRemoteDenied:(owner:string)=>{denials.push(owner);denied.add(owner);},
    revision:()=>`settings-${++revision}`,
  };
  return {local,patches,sends,denied,denials,dependencies,coordinator:createAccountSettingsPersistence(dependencies),
    setUid:(value:string|null)=>{uid=value;},setSession:(value:number)=>{session=value;},setWritable:(value:boolean)=>{writable=value;}};
}
const settings=(name='Alpha')=>({theme:'dark',layouts:[{id:'custom-layout',name,models:['groq:chat'],requirements:{capabilities:['vision']}}]});
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};

test('stage durably snapshots edits without sending; flush only queues the latest immutable settings',()=>{
  const h=harness(),input=settings();
  const result=h.coordinator.stage('alice',input);
  assert.equal(h.sends.length,0,'the existing debounce owns when remote dispatch begins');
  assert.equal(h.local.get('alice')?.pendingSettingsRevision,h.local.get('alice')?.settingsRevision);
  input.layouts[0].name='mutated';result.theme='mutated';
  assert.equal((h.local.get('alice')?.settings?.layouts as {name:string}[])[0].name,'Alpha');
  h.coordinator.stage('alice',settings('Beta'));
  assert.equal(h.coordinator.flush('alice'),true);
  assert.equal(h.coordinator.flush('alice'),false);
  assert.equal(h.sends.length,1);
  const payload=h.sends[0].settings;
  assert.equal((payload.layouts as {name:string}[])[0].name,'Beta');
  assert(Object.isFrozen(payload));assert(Object.isFrozen(payload.layouts));
  assert(Object.isFrozen((payload.layouts as object[])[0]));
  assert(!('settingsRevision' in payload));assert(!('pendingSettingsRevision' in payload));
});

test('semantic no-op stages preserve revisions and pending state regardless of object key order',async()=>{
  const h=harness();h.coordinator.stage('alice',settings());
  const initial=structuredClone(h.local.get('alice'));
  h.coordinator.stage('alice',{layouts:[{requirements:{capabilities:['vision']},models:['groq:chat'],name:'Alpha',id:'custom-layout'}],theme:'dark'});
  assert.deepEqual(h.local.get('alice'),initial);assert.equal(h.patches.length,1);assert.equal(h.sends.length,0);
  h.coordinator.flush('alice');h.sends[0].ack.resolve();await settle();
  const writes=h.patches.length;h.coordinator.stage('alice',settings());
  assert.equal(h.patches.length,writes);assert.equal(h.coordinator.flush('alice'),false);assert.equal(h.sends.length,1);
  h.local.set('bob',{settings:settings()});h.setUid('bob');h.coordinator.stage('bob',settings());
  assert.equal(h.local.get('bob')?.pendingSettingsRevision,undefined,'legacy unchanged cached settings do not become outbound saves');
});

test('a stalled ACK cannot block replacement dispatch and cannot clear its newer pending revision',async()=>{
  const h=harness();h.coordinator.stage('alice',settings('Alpha'));h.coordinator.flush('alice');
  h.coordinator.stage('alice',settings('Beta'));h.coordinator.flush('alice');
  assert.equal(h.sends.length,2);
  h.sends[0].ack.resolve();await settle();assert(h.local.get('alice')?.pendingSettingsRevision);
  h.sends[1].ack.resolve();await settle();assert.equal(h.local.get('alice')?.pendingSettingsRevision,null);
});

test('layout removals and intentional array order are full snapshots, never merged with old entries',()=>{
  const h=harness();h.coordinator.stage('alice',settings());h.coordinator.flush('alice');
  h.coordinator.stage('alice',{layouts:[],enabledModels:['groq:other','groq:chat']});h.coordinator.flush('alice');
  assert.deepEqual(h.sends[1].settings,{layouts:[],enabledModels:['groq:other','groq:chat']});
  const revision=h.local.get('alice')?.settingsRevision;
  h.coordinator.stage('alice',{layouts:[],enabledModels:['groq:chat','groq:other']});
  assert.notEqual(h.local.get('alice')?.settingsRevision,revision);
});

test('read begun during pending edits protects them after ACK and only persists settings fields',async()=>{
  const h=harness();h.local.set('alice',{geminiKey:'current-key',keyRevision:'key-new',pendingKeyRevision:'key-new'});
  h.coordinator.stage('alice',settings('Local'));const start=h.coordinator.captureRead('alice');
  h.coordinator.flush('alice');h.sends[0].ack.resolve();await settle();
  const chosen=h.coordinator.reconcileRead('alice',start,settings('Stale remote'));
  assert.deepEqual(chosen,settings('Local'));assert(Object.isFrozen(start));
  assert.equal(start.pending,'settings-1');assert.equal(h.local.get('alice')?.geminiKey,'current-key');
  assert.equal(h.local.get('alice')?.pendingKeyRevision,'key-new');
  for(const patch of h.patches)assert(Object.keys(patch).every(key=>['settings','settingsRevision','pendingSettingsRevision'].includes(key)));
});

test('a read started before staging cannot roll back a newly created layout',()=>{
  const h=harness(),start=h.coordinator.captureRead('alice');
  h.coordinator.stage('alice',settings('New local'));
  assert.deepEqual(h.coordinator.reconcileRead('alice',start,{layouts:[]}),settings('New local'));
});

test('accepted remote changes receive revisions so older overlapping reads cannot restore removed layouts',()=>{
  const h=harness();h.coordinator.reconcileRead('alice',h.coordinator.captureRead('alice'),settings());
  const older=h.coordinator.captureRead('alice'),newer=h.coordinator.captureRead('alice');
  h.coordinator.reconcileRead('alice',newer,{layouts:[]});
  assert.notEqual(h.local.get('alice')?.settingsRevision,older.revision);
  assert.deepEqual(h.coordinator.reconcileRead('alice',older,settings()),{layouts:[]});assert.equal(h.sends.length,0);
});

test('cached pending edits survive reload and resume only for the current allowed UID without duplicate sends',async()=>{
  const h=harness();h.coordinator.stage('alice',settings());
  const reloaded=createAccountSettingsPersistence(h.dependencies);
  h.setUid('bob');assert.equal(reloaded.resume('alice'),false);
  h.setUid('alice');h.denied.add('alice');assert.equal(reloaded.resume('alice'),false);
  h.denied.delete('alice');assert.equal(reloaded.resume('alice'),true);assert.equal(reloaded.resume('alice'),false);
  assert.equal(h.sends.length,1);
  h.sends[0].ack.reject(new Error('offline'));await settle();
  assert.equal(h.sends.length,1);assert(h.local.get('alice')?.pendingSettingsRevision);
  assert.equal(reloaded.resume('alice'),true);assert.equal(h.sends.length,2);
});

test('same UID new session can replay pending edits while old ACK and old read remain invalid',async()=>{
  const h=harness();h.coordinator.stage('alice',settings());const start=h.coordinator.captureRead('alice');h.coordinator.flush('alice');
  h.setSession(3);assert.equal(h.coordinator.resume('alice'),true,'old session in-flight write cannot suppress the new auth session');
  h.sends[0].ack.resolve();await settle();assert(h.local.get('alice')?.pendingSettingsRevision);
  assert.throws(()=>h.coordinator.reconcileRead('alice',start,{layouts:[]}),/account|session/i);
  h.sends[1].ack.resolve();await settle();assert.equal(h.local.get('alice')?.pendingSettingsRevision,null);
});

test('permission denials apply only to the latest current UID, session and revision',async()=>{
  const h=harness(),denial=()=>Object.assign(new Error('denied'),{code:'permission-denied'});
  h.coordinator.stage('alice',settings('Old'));h.coordinator.flush('alice');
  h.coordinator.stage('alice',settings('New'));h.coordinator.flush('alice');
  h.sends[0].ack.reject(denial());await settle();assert.deepEqual(h.denials,[]);
  h.setSession(3);h.sends[1].ack.reject(denial());await settle();assert.deepEqual(h.denials,[]);
  h.coordinator.resume('alice');h.sends[2].ack.reject(denial());await settle();assert.deepEqual(h.denials,['alice']);
  assert.equal(h.coordinator.resume('alice'),false);
  assert.throws(()=>h.coordinator.stage('alice',settings()),/denied/i);
  assert.throws(()=>h.coordinator.reconcileRead('alice',h.coordinator.captureRead('alice'),{}),/denied/i);
});

test('a previous account write denial cannot revoke the newly active account',async()=>{
  const h=harness();h.coordinator.stage('alice',settings());h.coordinator.flush('alice');
  h.setUid('bob');h.sends[0].ack.reject(Object.assign(new Error('denied'),{code:'permission-denied'}));await settle();
  assert.deepEqual(h.denials,[]);assert.equal(h.denied.has('bob'),false);
  assert(h.local.get('alice')?.pendingSettingsRevision);
});

test('absent remote settings are returned as null and reconciled without touching account keys',()=>{
  const h=harness();h.local.set('alice',{geminiKey:'keep-key'});
  assert.equal(h.coordinator.reconcileRead('alice',h.coordinator.captureRead('alice'),undefined),null);
  assert.equal(h.local.get('alice')?.geminiKey,'keep-key');
  assert.equal(h.local.get('alice')?.settings,undefined);assert.equal(h.sends.length,0);
});

test('a cleared logout cache is never recreated by a late ACK or stale read even before UID changes',async()=>{
  const h=harness();h.coordinator.stage('alice',settings());const start=h.coordinator.captureRead('alice');h.coordinator.flush('alice');
  h.local.delete('alice');h.sends[0].ack.resolve();await settle();assert.equal(h.local.has('alice'),false);
  assert.throws(()=>h.coordinator.reconcileRead('alice',start,settings()),/cleared/i);
  assert.equal(h.local.has('alice'),false);h.setUid(null);
  assert.throws(()=>h.coordinator.stage('alice',settings()),/account/i);assert.equal(h.coordinator.flush('alice'),false);
});

test('preview edits remain local and JSON snapshots match durable serialization',()=>{
  const h=harness();h.setUid('preview-alice');
  const saved=h.coordinator.stage('preview-alice',{theme:'dark',omitted:undefined,nested:{optional:undefined},layouts:[]});
  assert.deepEqual(saved,{theme:'dark',nested:{},layouts:[]});assert.equal(h.local.get('preview-alice')?.pendingSettingsRevision,null);
  assert.equal(h.coordinator.flush('preview-alice'),false);assert.equal(h.coordinator.resume('preview-alice'),false);assert.equal(h.sends.length,0);
});

test('storage failure and non-JSON input are explicit and do not produce successful edits or remote writes',()=>{
  const h=harness();h.setWritable(false);
  assert.throws(()=>h.coordinator.stage('alice',settings()),/stor|device|local/i);assert.equal(h.local.has('alice'),false);assert.equal(h.sends.length,0);
  h.setWritable(true);const cyclic:{self?:object}={};cyclic.self=cyclic;
  assert.throws(()=>h.coordinator.stage('alice',cyclic),/JSON|serializ/i);assert.equal(h.local.has('alice'),false);
});

test('synchronous enqueue errors and ACK marker storage failures retain pending edits without retry loops',async()=>{
  const h=harness(),coordinator=createAccountSettingsPersistence({...h.dependencies,enqueueRemote:()=>{throw new Error('offline');}});
  coordinator.stage('alice',settings());assert.equal(coordinator.flush('alice'),true);await settle();
  assert(h.local.get('alice')?.pendingSettingsRevision);
  h.coordinator.resume('alice');h.setWritable(false);h.sends[0].ack.resolve();await settle();
  assert(h.local.get('alice')?.pendingSettingsRevision);assert.equal(h.sends.length,1);
});
