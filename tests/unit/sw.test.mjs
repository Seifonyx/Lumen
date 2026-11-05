// The service worker (src/pwa/sw.js) with a simulated cache storage: a half-stored version is removed, the previous
// version's files stay one more release for windows still running it, a file this version lacks comes from that copy,
// and a waiting version takes over only when told to. Push and notification handlers are untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('src/pwa/sw.js', 'utf8');
const ORIGIN = 'https://lumen.test';

function storage() {
  const names = new Map();
  const key = (req) => { const u = new URL(typeof req === 'string' ? req : req.url, ORIGIN); return u.origin + u.pathname + u.search; };
  const bare = (req) => { const u = new URL(typeof req === 'string' ? req : req.url, ORIGIN); return u.origin + u.pathname; };
  const cache = (entries) => ({
    async addAll(reqs) { for (const r of reqs) { const res = await globalThis.__fetch(r); if (!res.ok) throw new TypeError('bad response'); entries.set(key(r), res); } },
    async put(req, res) { entries.set(key(req), res); },
    async match(req, opts = {}) { if (!opts.ignoreSearch) return entries.get(key(req)); for (const [k, v] of entries) if (k.split('?')[0] === bare(req)) return v; return undefined; },
  });
  return {
    names,
    async open(name) { if (!names.has(name)) names.set(name, new Map()); return cache(names.get(name)); },
    async keys() { return [...names.keys()]; },
    async delete(name) { return names.delete(name); },
    async match(req, opts) { for (const entries of names.values()) { const hit = await cache(entries).match(req, opts); if (hit) return hit; } return undefined; },
  };
}

function worker(version, files, { caches = storage(), windows = 1, net = {} } = {}) {
  const handlers = {}, state = { skipped: 0, claimed: 0 };
  const fetch = async (req) => { const url = new URL(typeof req === 'string' ? req : req.url, ORIGIN).pathname; if (!(url in net)) throw new TypeError('offline'); return new Response(net[url], { status: net[url] === null ? 404 : 200 }); };
  globalThis.__fetch = fetch;
  const self = {
    addEventListener: (type, fn) => { handlers[type] = fn; },
    skipWaiting: async () => { state.skipped++; },
    clients: { claim: async () => { state.claimed++; }, matchAll: async () => Array.from({ length: windows }, () => ({ url: ORIGIN + '/' })) },
    registration: { showNotification: async () => {} },
    location: { origin: ORIGIN },
  };
  const code = source.replace("'__VERSION__'", JSON.stringify(version)).replace('__PRECACHE__', JSON.stringify(files));
  // A service worker resolves relative URLs against its own location.
  const SwRequest = class extends Request { constructor(url, init) { super(typeof url === 'string' ? new URL(url, ORIGIN) : url, init); } };
  vm.runInContext(code, vm.createContext({ self, caches, fetch, Request: SwRequest, Response, URL, console }));
  const fire = async (type, extra = {}) => { const waits = []; let responded; handlers[type]({ waitUntil: (p) => waits.push(p), respondWith: (p) => { responded = p; }, ...extra }); await Promise.all(waits); return responded && await responded; };
  return { caches, state, fire, handlers };
}
const text = async (res) => res && await res.text();

test('a version that cannot be stored completely is removed, and the running one is untouched', async () => {
  const caches = storage();
  const v1 = worker('v1', ['/', '/a.js'], { caches, net: { '/': 'v1 page', '/a.js': 'a1' } });
  await v1.fire('install'); await v1.fire('activate');
  const v2 = worker('v2', ['/', '/b.js'], { caches, net: { '/': 'v2 page' } }); // b.js unreachable
  await assert.rejects(v2.fire('install'));
  assert.deepEqual([...caches.names.keys()].filter((k) => k.startsWith('model-router-')), ['model-router-v1'], 'no half-stored v2 copy is left');
});

test('activating keeps the previous version one release for windows still running it', async () => {
  const caches = storage();
  const v1 = worker('v1', ['/', '/a1.js'], { caches, net: { '/': 'v1 page', '/a1.js': 'old lazy file' } });
  await v1.fire('install'); await v1.fire('activate');
  const v2 = worker('v2', ['/', '/a2.js'], { caches, net: { '/': 'v2 page', '/a2.js': 'new lazy file' } });
  await v2.fire('install'); await v2.fire('activate');
  assert.ok(caches.names.has('model-router-v1') && caches.names.has('model-router-v2'), 'v1 is kept while v2 runs');
  assert.equal(v2.state.claimed, 1);
  // A window still running v1 asks for one of its lazily loaded files, which the server no longer has.
  const old = await v2.fire('fetch', { request: new Request(ORIGIN + '/a1.js') });
  assert.equal(await text(old), 'old lazy file', 'served from the copy kept for it');
  // A file no copy has comes from the network; the page itself is always this version's.
  await assert.rejects(v2.fire('fetch', { request: new Request(ORIGIN + '/not-stored.js') }), /offline/, 'a miss goes to the network (offline here)');
  const nav = { method: 'GET', url: ORIGIN + '/chat', mode: 'navigate' };
  assert.equal(await text(await v2.fire('fetch', { request: nav })), 'v2 page');
  // A version that waited but never ran, and anything older than the previous version, are removed on the next one.
  const v3w = worker('v3', ['/'], { caches, net: { '/': 'v3 page' } }); await v3w.fire('install'); // superseded, never activated
  const v4 = worker('v4', ['/', '/a4.js'], { caches, net: { '/': 'v4 page', '/a4.js': 'a4' } });
  await v4.fire('install'); await v4.fire('activate');
  assert.deepEqual([...caches.names.keys()].filter((k) => k.startsWith('model-router-')).sort(), ['model-router-v2', 'model-router-v4'], 'v2 (previous) and v4 (current) remain');
});

test('this version\'s own copy wins for files every version has', async () => {
  const caches = storage();
  const v1 = worker('v1', ['/', '/icon.png'], { caches, net: { '/': 'p1', '/icon.png': 'old icon' } }); await v1.fire('install'); await v1.fire('activate');
  const v2 = worker('v2', ['/', '/icon.png'], { caches, net: { '/': 'p2', '/icon.png': 'new icon' } }); await v2.fire('install'); await v2.fire('activate');
  assert.equal(await text(await v2.fire('fetch', { request: new Request(ORIGIN + '/icon.png?x=1') })), 'new icon');
});

test('the first version that records itself keeps the newest older copy', async () => {
  const caches = storage();
  await caches.open('model-router-old'); // what an earlier service worker left, without a record
  const v2 = worker('v2', ['/'], { caches, net: { '/': 'p2' } }); await v2.fire('install'); await v2.fire('activate');
  assert.ok(caches.names.has('model-router-old'), 'kept for windows still running it');
});

test('a waiting version takes over only when told to', async () => {
  const w = worker('v2', ['/'], { net: { '/': 'p' } });
  await w.fire('message', { data: 'something else' });
  assert.equal(w.state.skipped, 0);
  await w.fire('message', { data: 'SKIP_WAITING' });
  assert.equal(w.state.skipped, 1, 'Update in Settings: takes over');
});

test('push and notification handlers are still there', () => {
  const w = worker('v1', ['/']);
  assert.equal(typeof w.handlers.push, 'function');
  assert.equal(typeof w.handlers.notificationclick, 'function');
});
