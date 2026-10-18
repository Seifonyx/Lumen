import assert from 'node:assert/strict';
import { build } from 'rolldown';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Exercise the real tracker against controlled Firestore promises and snapshots.
// No Firebase application, emulator, credentials or provider requests are used.
mkdirSync('node_modules/.cache/unit-tests', { recursive: true });
const file = 'node_modules/.cache/unit-tests/usage-recovery-fixture.mjs';
await build({ input: 'src/lib/usage.ts', output: { file, format: 'esm' }, logLevel: 'silent', plugins: [{
  name: 'isolated-usage-recovery',
  resolveId(source, importer) {
    if (source === 'firebase/firestore') return '\0firestore';
    if (importer?.endsWith('usage.ts') && source === './firebase') return '\0firebase';
    if (importer?.endsWith('usage.ts') && source === './quota') return '\0quota';
  },
  load(id) {
    if (id === '\0firebase') return 'export const db = {};';
    if (id === '\0quota') return `export const quota = {
      level: () => globalThis.__usageRecovery.level,
      count: () => {},
      subscribe: fn => {
        const f = globalThis.__usageRecovery;
        f.quotaListeners.add(fn); fn({level: f.level});
        return () => f.quotaListeners.delete(fn);
      },
    };`;
    if (id === '\0firestore') return `
      export const doc = (db, ...parts) => parts.join('/');
      export const increment = n => n;
      export const onSnapshot = (path, ...args) => {
        const f = globalThis.__usageRecovery;
        const entry = {path, fn: args.find(arg => typeof arg === 'function'), active: true};
        f.listeners.push(entry);
        return () => { entry.active = false; };
      };
      export const setDoc = (path, data) => new Promise((resolve, reject) => {
        globalThis.__usageRecovery.writes.push({path, data, resolve, reject});
      });
    `;
  },
}] });

const fixture = globalThis.__usageRecovery = { level: 'normal', quotaListeners: new Set(), listeners: [], writes: [] };
const RealDate = globalThis.Date;
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
let now = RealDate.parse('2026-10-18T12:00:00Z');
let nextTimer = 0;
const timers = new Map();
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
};
globalThis.setTimeout = (fn, ms = 0) => {
  const id = ++nextTimer;
  timers.set(id, { fn, at: now + ms });
  return id;
};
globalThis.clearTimeout = id => timers.delete(id);
const advance = ms => {
  now += ms;
  for (const [id, timer] of [...timers]) {
    if (timer.at <= now && timers.delete(id)) timer.fn();
  }
};
const settle = () => new Promise(resolve => setImmediate(resolve));
const { UsageTracker, dayKey, nextReset, remaining } = await import(pathToFileURL(resolve(file)).href);
const enc = id => id.replace(/[^A-Za-z0-9]/g, '_');
const snapshot = (uid, key, data, metadata = {}) => {
  for (const entry of fixture.listeners) {
    if (entry.active && entry.path === `modelRouter/${uid}/usage/${key}`) {
      entry.fn({ data: () => structuredClone(data), metadata: { fromCache: false, hasPendingWrites: false, ...metadata } });
    }
  }
};
const resume = (level = 'normal') => {
  fixture.level = level;
  for (const listener of fixture.quotaListeners) listener({level});
};
const counts = (id, requests, input = 0, output = 0) => ({ m: { [enc(id)]: { id, requests, input, output } } });
let trackers = [];
const tracker = (uid = 'synthetic-account') => {
  const changes = [];
  const usage = new UsageTracker(uid, view => changes.push(view));
  trackers.push(usage);
  usage.start();
  return { usage, changes, uid };
};
let failures = 0;
const test = async (name, run) => {
  fixture.level = 'normal';
  fixture.listeners = [];
  fixture.writes = [];
  fixture.quotaListeners.clear();
  timers.clear();
  now = RealDate.parse('2026-10-18T12:00:00Z');
  try {
    await run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}`);
    console.error(error);
  } finally {
    for (const usage of trackers) usage.stop();
    trackers = [];
    for (const write of fixture.writes) write.resolve();
    await settle();
  }
};

await test('requests and tokens remain visible when writes fail and snapshots never arrive', async () => {
  const { usage, changes, uid } = tracker();
  const id = 'gemini:gemini-2.5-flash';
  usage.record(id, { requests: 1, input: 12, output: 7 });
  assert.equal(changes.at(-1)?.models[id]?.requests, 1, 'Auto must receive the locally observed request immediately');
  fixture.writes[0].reject(new Error('synthetic unavailable'));
  await settle();
  snapshot(uid, dayKey('gemini'), {});
  assert.deepEqual(usage.view().models[id], { id, requests: 1, input: 12, output: 7, quota: null, blockedUntil: null, blockScope: null });
});

await test('daily blocks and learned limits survive rejected writes and stale snapshots', async () => {
  const { usage, uid } = tracker();
  const id = 'gemini:gemini-2.5-pro';
  const until = Date.now() + 120_000;
  usage.block(id, { scope: 'day', quota: 25, resetAt: until });
  assert.equal(usage.blockedUntil(id), until, 'Do not retry an exhausted model while waiting for Firestore');
  assert.equal(usage.view().models[id]?.quota, 25);
  for (const write of fixture.writes) write.reject(new Error('synthetic denied'));
  await settle();
  snapshot(uid, dayKey('gemini'), {});
  snapshot(uid, 'quotas', {});
  assert.equal(usage.blockedUntil(id), until);
  assert.equal(remaining(usage.view(), id), 25);
  advance(120_001);
  assert.equal(usage.blockedUntil(id), null, 'Local blocks must expire at the reported reset');
  assert.equal(usage.view().models[id].quota, 25, 'Learned daily limits outlive a single block');
});

await test('batched counts merge remote usage and never echo optimistic or acknowledged writes twice', async () => {
  fixture.level = 'slow';
  const { usage, uid } = tracker();
  const id = 'openrouter:vendor/chat:free';
  usage.setOpenRouterDaily(15);
  snapshot(uid, dayKey('openrouter'), counts(id, 10, 100, 30));
  usage.record(id, { requests: 1, input: 12, output: 7 });
  snapshot(uid, dayKey('openrouter'), counts(id, 14, 140, 40));
  assert.equal(usage.view().openrouter.used, 15, 'Unsent local requests add to requests made on another device');
  advance(60_000);
  assert.equal(usage.view().models[id].requests, 15, 'Dispatch must preserve the visible total');
  snapshot(uid, dayKey('openrouter'), counts(id, 15, 152, 47), { hasPendingWrites: true });
  assert.equal(usage.view().openrouter.used, 15);
  fixture.writes[0].resolve();
  await settle();
  snapshot(uid, dayKey('openrouter'), counts(id, 15, 152, 47));
  snapshot(uid, dayKey('openrouter'), counts(id, 15, 152, 47));
  assert.equal(usage.view().openrouter.used, 15);
  assert.equal(usage.view().models[id].input, 152);
  assert.equal(remaining(usage.view(), id), 0);
  assert.equal(usage.blockedUntil('openrouter:vendor/another:free'), nextReset('openrouter'), 'The free pool blocks every free model');
});

await test('failed increments retry once with newer counts and acknowledged increments are not resent', async () => {
  const { usage, uid } = tracker();
  const id = 'groq:llama-3.3-70b-versatile';
  usage.useProviders(['groq']);
  usage.record(id, { requests: 1, input: 10 });
  usage.record(id, { requests: 1, output: 5 });
  assert.equal(usage.view().models[id]?.requests, 2);
  fixture.writes[0].reject(Object.assign(new Error('synthetic denied'), { code: 'permission-denied' }));
  await settle();
  assert.equal(usage.view().models[id].requests, 2);
  const beforeRetry = fixture.writes.length;
  advance(60_000);
  const retry = fixture.writes.at(-1);
  assert.equal(fixture.writes.length, beforeRetry + 1, 'Retry must wait instead of immediately looping on failed writes');
  assert.deepEqual(retry.data.m[enc(id)], { id, requests: 2, input: 10, output: 5 });
  retry.resolve();
  await settle();
  snapshot(uid, dayKey('groq'), counts(id, 2, 10, 5));
  const written = fixture.writes.length;
  usage.stop();
  advance(60_000);
  assert.equal(fixture.writes.length, written, 'A stopped tracker must not retry acknowledged data');
  assert.equal(usage.view().models[id].requests, 2);
});

await test('ambiguous network failures keep local counts without replaying potentially accepted increments', async () => {
  const { usage, uid } = tracker();
  const id = 'gemini:gemini-2.5-flash';
  usage.record(id, { requests: 1 });
  fixture.writes[0].reject(Object.assign(new Error('synthetic lost acknowledgement'), { code: 'unavailable' }));
  await settle();
  advance(60_000);
  assert.equal(usage.view().models[id]?.requests, 1);
  assert.equal(fixture.writes.length, 1, 'Firestore owns transport retries; replaying an ambiguous increment can double the count');
  snapshot(uid, dayKey('gemini'), counts(id, 1));
  assert.equal(usage.view().models[id].requests, 1);
  usage.record(id, { requests: 1 });
  assert.equal(fixture.writes.at(-1).data.m[enc(id)].requests, 1, 'Only the new observation should be sent');
});

await test('a second rejected retry keeps its immutable increments without doubling newer observations', async () => {
  const { usage, uid } = tracker();
  const id = 'gemini:gemini-2.5-flash';
  const reject = write => write.reject(Object.assign(new Error('synthetic denied'), { code: 'firestore/permission-denied' }));
  usage.record(id, { requests: 1, input: 10 });
  reject(fixture.writes[0]);
  await settle();
  advance(60_000);
  const firstRetry = fixture.writes.at(-1);
  usage.record(id, { requests: 1, output: 5 });
  reject(firstRetry);
  await settle();
  assert.equal(usage.view().models[id].requests, 2);
  advance(60_000);
  const nextRetry = fixture.writes.at(-1);
  assert.deepEqual(nextRetry.data.m[enc(id)], { id, requests: 2, input: 10, output: 5 });
  snapshot(uid, dayKey('gemini'), counts(id, 2, 10, 5), { hasPendingWrites: true });
  assert.equal(usage.view().models[id].requests, 2);
  snapshot(uid, dayKey('gemini'), counts(id, 2, 10, 5));
  nextRetry.resolve();
  await settle();
  assert.equal(usage.view().models[id].requests, 2);
});

await test('acknowledgment snapshots can arrive before write promises settle and new records stay distinct', async () => {
  const { usage, uid } = tracker();
  const id = 'gemini:gemini-2.5-flash';
  usage.record(id, { requests: 1, input: 10 });
  snapshot(uid, dayKey('gemini'), counts(id, 1, 10));
  usage.record(id, { requests: 1, output: 5 });
  assert.equal(usage.view().models[id].requests, 2);
  fixture.writes[0].resolve();
  await settle();
  assert.deepEqual(fixture.writes.at(-1).data.m[enc(id)], { id, requests: 1, output: 5 });
  snapshot(uid, dayKey('gemini'), counts(id, 2, 10, 5));
  fixture.writes.at(-1).resolve();
  await settle();
  assert.equal(usage.view().models[id].requests, 2);
});

await test('stopping drains observations queued behind an in-flight write without scheduling more retries', async () => {
  const { usage } = tracker();
  const id = 'gemini:gemini-2.5-flash';
  usage.record(id, { requests: 1 });
  usage.record(id, { input: 10, output: 5 });
  usage.stop();
  fixture.writes[0].resolve();
  await settle();
  assert.equal(fixture.writes.length, 2, 'Stopping must still flush the final token totals once the earlier batch settles');
  assert.deepEqual(fixture.writes[1].data.m[enc(id)], { id, input: 10, output: 5 });
  fixture.writes[1].reject(Object.assign(new Error('synthetic denied'), { code: 'permission-denied' }));
  await settle();
  advance(60_000);
  assert.equal(fixture.writes.length, 2, 'Stop must leave no background retry timer');
});

await test('paused counts retain their original date when UTC rolls over before Pacific', async () => {
  now = RealDate.parse('2026-10-18T23:59:58Z');
  fixture.level = 'paused';
  const { usage } = tracker();
  const or = 'openrouter:vendor/chat:free';
  const gemini = 'gemini:gemini-2.5-flash';
  const yesterday = dayKey('openrouter');
  const pacific = dayKey('gemini');
  const oldSnapshot = fixture.listeners.find(entry => entry.path.endsWith(`/usage/${yesterday}`)).fn;
  usage.record(or, { requests: 2 });
  usage.record(gemini, { requests: 3 });
  usage.block(or, { scope: 'day', resetAt: nextReset('openrouter') });
  advance(5_000);
  assert.equal(usage.view().openrouter.used, 0, 'Yesterday must not exhaust today while syncing is paused');
  assert.equal(usage.blockedUntil(or), null);
  assert.equal(usage.view().models[gemini].requests, 3, 'Gemini resets at Pacific midnight');
  resume();
  usage.record(or, { requests: 1 });
  const dayWrites = fixture.writes.filter(write => write.data.m);
  assert(dayWrites.some(write => write.path.endsWith(`/usage/${yesterday}`) && write.data.m[enc(or)]?.requests === 2));
  assert(dayWrites.some(write => write.path.endsWith(`/usage/${pacific}`) && write.data.m[enc(gemini)]?.requests === 3));
  assert(dayWrites.some(write => write.path.endsWith(`/usage/${dayKey('openrouter')}`) && write.data.m[enc(or)]?.requests === 1));
  oldSnapshot({ data: () => counts(or, 50), metadata: { fromCache: false, hasPendingWrites: false } });
  assert.equal(usage.view().openrouter.used, 1, 'Late snapshots from an old watch cannot leak across dates');
});

await test('an old-day write rejected after midnight retries its original document without reviving old usage', async () => {
  now = RealDate.parse('2026-10-18T23:59:58Z');
  const { usage } = tracker();
  const id = 'groq:llama-3.3-70b-versatile';
  const oldDay = dayKey('groq');
  usage.useProviders(['groq']);
  usage.record(id, { requests: 2 });
  const oldWrite = fixture.writes[0];
  advance(5_000);
  oldWrite.reject(Object.assign(new Error('synthetic denied'), { code: 'permission-denied' }));
  await settle();
  usage.record(id, { requests: 1 });
  assert.equal(usage.view().models[id].requests, 1);
  assert(fixture.writes.some(write => write !== oldWrite && write.path.endsWith(`/usage/${oldDay}`) && write.data.m[enc(id)]?.requests === 2));
  assert(fixture.writes.some(write => write.path.endsWith(`/usage/${dayKey('groq')}`) && write.data.m[enc(id)]?.requests === 1));
  for (const write of fixture.writes) write.resolve();
  await settle();
  assert.equal(usage.view().models[id].requests, 1);
});

await test('preview usage stays local and respects daily blocks without cloud writes', async () => {
  const { usage } = tracker('preview-synthetic');
  const id = 'deepseek:deepseek-chat';
  usage.record(id, { requests: 1, input: 10 });
  usage.block(id, { scope: 'day', quota: 12, resetAt: Date.now() + 60_000 });
  assert.equal(usage.view().models[id]?.requests, 1);
  assert.equal(remaining(usage.view(), id), 11);
  assert(usage.blockedUntil(id));
  assert.equal(fixture.writes.length, 0);
});

await test('Pacific midnight clears local Gemini counts and blocks while preserving its learned daily limit', async () => {
  const { usage } = tracker('preview-synthetic');
  const id = 'gemini:gemini-2.5-flash';
  usage.record(id, { requests: 3 });
  usage.block(id, { scope: 'day', quota: 25 });
  advance(nextReset('gemini') - Date.now() + 1);
  assert.equal(usage.view().models[id].requests, 0);
  assert.equal(usage.blockedUntil(id), null);
  assert.equal(remaining(usage.view(), id), 25);
});

await test('local counters and blocks stay isolated between accounts and the shared free pool', async () => {
  const a = tracker('synthetic-a').usage;
  const b = tracker('synthetic-b').usage;
  const id = 'mistral:mistral-small';
  a.record(id, { requests: 1 });
  a.block(id, { scope: 'day', quota: 12 });
  assert.equal(a.view().models[id]?.requests, 1);
  assert.equal(a.view().models[id]?.quota, 12);
  assert.equal(a.view().openrouter.used, 0);
  assert.equal(b.view().models[id], undefined);
  assert.equal(b.blockedUntil(id), null);
  assert(fixture.writes.every(write => write.path.startsWith('modelRouter/synthetic-a/usage/')));
});

globalThis.Date = RealDate;
globalThis.setTimeout = realSetTimeout;
globalThis.clearTimeout = realClearTimeout;
delete globalThis.__usageRecovery;
if (failures) throw new Error(`${failures} usage recovery test(s) failed`);
