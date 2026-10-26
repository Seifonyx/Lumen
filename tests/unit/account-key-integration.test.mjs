import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';

// Exercise the real Firebase boundary and persistence coordinator. Only SDK IO,
// project configuration and quota accounting are replaced; no provider requests run.
mkdirSync('node_modules/.cache/unit-tests', { recursive: true });
const output = 'node_modules/.cache/unit-tests/account-key-integration-fixture.mjs';
await build({ input: 'src/lib/firebase.ts', output: { file: output, format: 'esm' }, logLevel: 'silent', plugins: [{
  name: 'isolated-account-key-integration',
  resolveId(source, importer) {
    importer = importer?.replaceAll('\\', '/');
    if (['firebase/app', 'firebase/auth', 'firebase/firestore'].includes(source)) return `\0${source}`;
    if (importer?.endsWith('/firebase.ts') && source === '../firebase-config.json') return '\0account-config';
    if (importer?.endsWith('/firebase.ts') && source === './quota') return '\0account-quota';
  },
  load(id) {
    if (id === '\0account-config') return 'export default {projectId:"synthetic-project"};';
    if (id === '\0account-quota') return 'export const quota={count(){}};';
    if (id === '\0firebase/app') return 'export const initializeApp=config=>config;';
    if (id === '\0firebase/auth') return `
      const fixture=globalThis.__accountKeyIntegration;
      export class GoogleAuthProvider { setCustomParameters(){} static credential(value){return value;} }
      export const browserLocalPersistence={};
      export const getAuth=()=>fixture.auth;
      export const getRedirectResult=async()=>null;
      export const setPersistence=async()=>{};
      export const connectAuthEmulator=()=>{};
      export const onAuthStateChanged=(_auth,listener)=>{fixture.authListeners.add(listener);return()=>fixture.authListeners.delete(listener);};
      export const signInWithCredential=async()=>{throw new Error('Unexpected interactive sign-in');};
      export const signInWithPopup=signInWithCredential,signInWithRedirect=signInWithCredential;
      export const signOut=async()=>{};
    `;
    if (id === '\0firebase/firestore') return `
      const fixture=globalThis.__accountKeyIntegration;
      export const initializeFirestore=()=>({});
      export const connectFirestoreEmulator=()=>{};
      export const doc=(_db,...parts)=>parts.join('/');
      export const serverTimestamp=()=>({syntheticTimestamp:true});
      export const getDoc=path=>{fixture.reads.push(path);return fixture.read(path);};
      export const setDoc=(path,data)=>fixture.write(path,data);
    `;
  },
}] });

const denied = () => Object.assign(new Error('Synthetic account access denied'), { code: 'permission-denied' });
const snapshot = (data, fromCache = false) => ({ data: () => structuredClone(data), metadata: { fromCache } });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const accountKey = uid => `mr.account.${uid}`;
let moduleVersion = 0;

async function harness(storage = new Map()) {
  const uid = 'synthetic-account';
  const fixture = {
    auth: { currentUser: { uid } }, authListeners: new Set(), reads: [], writes: [], denials: [],
    read: async () => { throw new Error('Unexpected account read'); },
    write(path, data) {
      const ack = deferred();
      this.writes.push({ path, data: structuredClone(data), ack });
      return ack.promise;
    },
  };
  globalThis.__accountKeyIntegration = fixture;
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
  const api = await import(`${pathToFileURL(resolve(output)).href}?instance=${++moduleVersion}`);
  const stop = api.watchUser(() => {});
  api.watchAccountAccessDenied(account => fixture.denials.push(account));
  const deliver = user => {
    fixture.auth.currentUser = user;
    for (const listener of fixture.authListeners) listener(user);
  };
  deliver({ uid });
  return {
    uid, storage, fixture, api, stop, deliver,
    cache: () => JSON.parse(storage.get(accountKey(uid)) || 'null'),
    seed: value => storage.set(accountKey(uid), JSON.stringify(value)),
  };
}

test('reload replays durable pending keys after a transient read failure while the browser remains online', async () => {
  const first = await harness();
  await first.api.saveKeys(first.uid, { gemini: 'synthetic-pending-key' });
  assert.equal(first.fixture.writes.length, 1);
  assert(first.cache().pendingKeyRevision);
  first.stop();

  // A new module instance loses the SDK's in-memory write queue, retaining only
  // this account's actual saved localStorage record.
  const reloaded = await harness(first.storage);
  reloaded.fixture.read = async () => { throw Object.assign(new Error('Temporary transport failure'), { code: 'unavailable' }); };
  assert.equal((await reloaded.api.loadKeys(reloaded.uid)).gemini, 'synthetic-pending-key');
  assert.equal(reloaded.fixture.writes.length, 1, 'cached fallback must resume pending writes even without an online event');
  assert.equal(reloaded.fixture.writes[0].data.geminiKey, 'synthetic-pending-key');
  reloaded.api.resumePendingAccountKeys(reloaded.uid);
  await reloaded.api.loadRemoteSettings(reloaded.uid);
  assert.equal(reloaded.fixture.writes.length, 1, 'resume and shared account reads deduplicate an outstanding revision');
  reloaded.fixture.writes[0].ack.resolve(); await settle();
  assert.equal(reloaded.cache().pendingKeyRevision, null);
  reloaded.stop();
});

test('a permission-denied account read cannot fall back to saved keys and blocks replay', async () => {
  const h = await harness();
  h.seed({ geminiKey: 'synthetic-cached-key', keyRevision: 'pending-read', pendingKeyRevision: 'pending-read' });
  h.fixture.read = async () => { throw denied(); };
  await assert.rejects(h.api.loadKeys(h.uid), { code: 'permission-denied' });
  assert.equal(h.cache(), null, 'denied credentials must be removed from the device cache');
  assert.deepEqual(h.fixture.denials, [h.uid], 'the store must be notified so active credentials can be cleared');
  h.api.resumePendingAccountKeys(h.uid);
  await assert.rejects(h.api.saveKeys(h.uid, { gemini: 'synthetic-refused-key' }), /denied/i);
  assert.equal(h.fixture.writes.length, 0);
  h.stop();
});

test('only the latest current-session write denial revokes access and prevents future replay', async () => {
  const h = await harness();
  await h.api.saveKeys(h.uid, { gemini: 'synthetic-old-key' });
  await h.api.saveKeys(h.uid, { gemini: 'synthetic-latest-key' });
  h.fixture.writes[0].ack.reject(denied()); await settle();
  assert.deepEqual(h.fixture.denials, []);
  assert.equal(h.cache().geminiKey, 'synthetic-latest-key', 'an obsolete save cannot revoke its replacement');
  h.fixture.writes[1].ack.reject(denied()); await settle();
  assert.deepEqual(h.fixture.denials, [h.uid]);
  assert.equal(h.cache(), null);
  h.api.resumePendingAccountKeys(h.uid);
  await assert.rejects(h.api.saveKeys(h.uid, { gemini: 'synthetic-refused-key' }), /denied/i);
  assert.equal(h.fixture.writes.length, 2);
  h.stop();
});

test('a cached Firestore snapshot cannot clear denial; a server-confirmed read can restore access', async () => {
  const h = await harness();
  h.fixture.read = async () => { throw denied(); };
  await assert.rejects(h.api.loadKeys(h.uid), { code: 'permission-denied' });
  h.fixture.read = async () => snapshot({ geminiKey: 'synthetic-stale-server-key' }, true);
  await assert.rejects(h.api.loadKeys(h.uid), { code: 'permission-denied' });
  assert.equal(h.cache(), null);
  await assert.rejects(h.api.saveKeys(h.uid, { gemini: 'synthetic-refused-key' }), /denied/i);
  assert.equal(h.fixture.writes.length, 0);
  h.fixture.read = async () => snapshot({ geminiKey: 'synthetic-restored-key' });
  assert.equal((await h.api.loadKeys(h.uid)).gemini, 'synthetic-restored-key');
  await h.api.saveKeys(h.uid, { gemini: 'synthetic-authorized-new-key' });
  assert.equal(h.fixture.writes.length, 1);
  h.stop();
});

test('a late write denial from an earlier session cannot revoke the same UID after reauthentication', async () => {
  const h = await harness();
  await h.api.saveKeys(h.uid, { gemini: 'synthetic-session-key' });
  const revision = h.cache().pendingKeyRevision;
  h.deliver(null); h.deliver({ uid: h.uid });
  h.fixture.writes[0].ack.reject(denied()); await settle();
  assert.deepEqual(h.fixture.denials, []);
  assert.equal(h.cache().pendingKeyRevision, revision, 'session protection must work even when the key revision is unchanged');
  await h.api.saveKeys(h.uid, { gemini: 'synthetic-reauthenticated-key' });
  assert.equal(h.fixture.writes.length, 2);
  h.stop();
});

test('a new session gets its own account read instead of inheriting an older same-UID denial', async () => {
  const h = await harness(), old = deferred();
  h.seed({ geminiKey: 'synthetic-saved-key' });
  h.fixture.read = () => old.promise;
  const oldRead = h.api.loadKeys(h.uid);
  const oldRejected = assert.rejects(oldRead, { code: 'permission-denied' });
  h.deliver(null); h.deliver({ uid: h.uid });
  h.fixture.read = async () => snapshot({ geminiKey: 'synthetic-new-session-key' });
  const newRead = h.api.loadKeys(h.uid).then(value => ({ value }), error => ({ error }));
  const independentRead = h.fixture.reads.length;
  old.reject(denied());
  await oldRejected;
  const result = await newRead;
  assert.equal(independentRead, 2, 'same-UID account-read deduplication must include the auth session');
  assert.equal(result.error, undefined, 'an old-session permission failure cannot deny a fresh session');
  assert.equal(result.value.gemini, 'synthetic-new-session-key');
  assert.deepEqual(h.fixture.denials, []);
  assert.equal(h.cache().geminiKey, 'synthetic-new-session-key');
  h.stop();
});
