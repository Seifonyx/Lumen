import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';

// Exercise durable settings through the real Firebase boundary. Only SDK IO,
// project configuration and quota accounting are replaced; no provider requests run.
mkdirSync('node_modules/.cache/unit-tests', { recursive: true });
const output = 'node_modules/.cache/unit-tests/account-settings-integration-fixture.mjs';
await build({ input: 'src/lib/firebase.ts', output: { file: output, format: 'esm' }, logLevel: 'silent', plugins: [{
  name: 'isolated-account-settings-integration',
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
      const fixture=globalThis.__accountSettingsIntegration;
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
      const fixture=globalThis.__accountSettingsIntegration;
      export const initializeFirestore=()=>({});
      export const connectFirestoreEmulator=()=>{};
      export const doc=(_db,...parts)=>parts.join('/');
      export const serverTimestamp=()=>({syntheticTimestamp:true});
      export const getDoc=path=>{fixture.reads.push(path);return fixture.read(path);};
      export const setDoc=(path,data,options)=>fixture.write(path,data,options);
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
    write(path, data, options) {
      const ack = deferred();
      this.writes.push({ path, data: structuredClone(data), options:structuredClone(options), ack });
      return ack.promise;
    },
  };
  globalThis.__accountSettingsIntegration = fixture;
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

const layoutSettings = name => ({
  theme: 'dark', enabledModels: ['gemini:synthetic-chat'], defaultModel: 'layout:durable',
  autoSwitch: false, layouts: [{ id: 'durable', name, mode: 'order', models: ['gemini:synthetic-chat'],
    requirements: { minContext: 64000 }, fallback: 'none' }],
});
const submit = (h, settings) => h.api.saveRemoteSettings(h.uid, settings).catch(() => {});

test('reload retains an unacknowledged layout and replays only the latest immutable settings snapshot', async () => {
  const first = await harness();
  submit(first, layoutSettings('Earlier layout'));
  const latest = layoutSettings('Latest layout'), expected = structuredClone(latest);
  submit(first, latest);
  assert.equal(first.fixture.writes.length, 2, 'both SDK submissions are independent of held acknowledgements');
  latest.layouts[0].name = 'Caller mutation after save';
  first.stop();

  const reloaded = await harness(first.storage);
  reloaded.fixture.read = async () => snapshot({ settings: { layouts: [], defaultModel: 'auto' } });
  assert.deepEqual(await reloaded.api.loadRemoteSettings(reloaded.uid), expected,
    'an older remote response cannot erase a locally saved layout after the memory SDK queue is lost');
  assert.equal(reloaded.fixture.writes.length, 1, 'reload submits only the latest durable settings revision');
  assert.deepEqual(reloaded.fixture.writes[0].data.settings, expected);
  assert.deepEqual(reloaded.fixture.writes[0].options,{mergeFields:['settings','updatedAt']},'replace the complete settings map so removed nested keys cannot reappear; preserve account credentials');
  assert.equal('geminiKey' in reloaded.fixture.writes[0].data, false, 'settings replay must not overwrite credentials');
  await reloaded.api.loadRemoteSettings(reloaded.uid);
  assert.equal(reloaded.fixture.writes.length, 1, 'shared reads do not duplicate an outstanding settings write');
  reloaded.fixture.writes[0].ack.resolve(); await settle();
  reloaded.stop();
});

test('a layout cached before the debounce fires survives reload without unconditional writes', async () => {
  const first = await harness(), original = { layouts: [], theme: 'light' };
  first.fixture.read = async () => snapshot({ settings: original });
  assert.deepEqual(await first.api.loadRemoteSettings(first.uid), original);
  first.api.cacheAccountSettings(first.uid, structuredClone(original));
  assert.equal(first.fixture.writes.length, 0, 'caching unchanged settings must not enqueue a cloud write');
  const staged = layoutSettings('Saved before debounce'), expected = structuredClone(staged);
  first.api.cacheAccountSettings(first.uid, staged);
  staged.layouts[0].name = 'Caller mutation after caching';
  assert.equal(first.fixture.writes.length, 0, 'the existing debounce remains the submission owner');
  first.stop();

  const reloaded = await harness(first.storage);
  reloaded.fixture.read = async () => snapshot({ settings: original });
  assert.deepEqual(await reloaded.api.loadRemoteSettings(reloaded.uid), expected,
    'reload must recover the locally staged layout even when no SDK write was submitted before unloading');
  assert.equal(reloaded.fixture.writes.length, 1);
  assert.deepEqual(reloaded.fixture.writes[0].data.settings, expected);
  reloaded.fixture.writes[0].ack.resolve(); await settle();
  reloaded.stop();

  const acknowledged = await harness(reloaded.storage);
  acknowledged.fixture.read = async () => snapshot({ settings: expected });
  assert.deepEqual(await acknowledged.api.loadRemoteSettings(acknowledged.uid), expected);
  acknowledged.api.cacheAccountSettings(acknowledged.uid, structuredClone(expected));
  assert.equal(acknowledged.fixture.writes.length, 0, 'an acknowledged unchanged layout does not trigger a write on every startup');
  acknowledged.stop();
});

test('a remote read started before a layout edit cannot overwrite the staged settings', async () => {
  const h = await harness(), remote = deferred(), expected = layoutSettings('Edited during account read');
  h.seed({ settings: { layouts: [] } });
  h.fixture.read = () => remote.promise;
  const reading = h.api.loadRemoteSettings(h.uid);
  h.api.cacheAccountSettings(h.uid, expected);
  remote.resolve(snapshot({ settings: { layouts: [], theme: 'light' } }));
  assert.deepEqual(await reading, expected);
  assert.deepEqual(h.cache().settings, expected);
  assert.equal(h.fixture.writes.length, 1);
  assert.deepEqual(h.fixture.writes[0].data.settings, expected);
  h.stop();
});

test('pending keys and a staged layout survive the same reload and replay as independent account patches', async () => {
  const first = await harness(), expected = layoutSettings('Layout alongside pending keys');
  await first.api.saveKeys(first.uid, { gemini: 'synthetic-settings-coexistence-key' });
  first.api.cacheAccountSettings(first.uid, expected);
  first.stop();

  const reloaded = await harness(first.storage);
  reloaded.fixture.read = async () => snapshot({ geminiKey: 'synthetic-obsolete-key', settings: { layouts: [] } });
  const [keys, settings] = await Promise.all([
    reloaded.api.loadKeys(reloaded.uid), reloaded.api.loadRemoteSettings(reloaded.uid),
  ]);
  assert.equal(keys.gemini, 'synthetic-settings-coexistence-key');
  assert.deepEqual(settings, expected, 'key reconciliation must preserve the independently pending settings revision');
  assert.equal(reloaded.fixture.reads.length, 1, 'keys and settings retain the shared account-read boundary');
  assert.equal(reloaded.fixture.writes.length, 2);
  const keyWrite = reloaded.fixture.writes.find(write => 'geminiKey' in write.data);
  const settingsWrite = reloaded.fixture.writes.find(write => 'settings' in write.data);
  assert(keyWrite); assert(settingsWrite);
  assert.equal('settings' in keyWrite.data, false);
  assert.equal('geminiKey' in settingsWrite.data, false);
  settingsWrite.ack.resolve(); await settle();
  assert(reloaded.cache().pendingKeyRevision, 'a settings acknowledgement cannot acknowledge credential persistence');
  assert.deepEqual(reloaded.cache().settings, expected);
  keyWrite.ack.resolve(); await settle();
  assert.equal(reloaded.cache().pendingKeyRevision, null);
  reloaded.stop();
});

test('a denied account read cannot recover or replay pending layouts from local storage', async () => {
  const h = await harness();
  h.api.cacheAccountSettings(h.uid, layoutSettings('Must not bypass denial'));
  h.fixture.read = async () => { throw denied(); };
  await assert.rejects(h.api.loadRemoteSettings(h.uid), { code: 'permission-denied' });
  assert.equal(h.cache(), null);
  assert.deepEqual(h.fixture.denials, [h.uid]);
  assert.equal(h.fixture.writes.length, 0);
  h.stop();
});

test('a latest settings write denial clears private cache and notifies the active account', async () => {
  const h = await harness();
  submit(h, layoutSettings('Denied layout'));
  h.fixture.writes[0].ack.reject(denied()); await settle();
  assert.deepEqual(h.fixture.denials, [h.uid], 'settings writes need the same explicit access-denial handling as credential writes');
  assert.equal(h.cache(), null);
  h.stop();
});

test('an old-session settings write denial cannot revoke a reauthenticated session with unchanged local settings', async () => {
  const h = await harness(), expected = layoutSettings('Surviving reauthentication');
  submit(h, expected);
  h.deliver(null); h.deliver({ uid: h.uid });
  h.fixture.writes[0].ack.reject(denied()); await settle();
  assert.deepEqual(h.fixture.denials, []);
  assert.deepEqual(h.cache().settings, expected);
  await h.api.saveKeys(h.uid, { gemini: 'synthetic-authorized-session-key' });
  assert.equal(h.fixture.writes.length, 2, 'the old settings rejection must not block current credential saves');
  h.stop();
});
