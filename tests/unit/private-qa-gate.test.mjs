// Private iPhone QA gate (QA01): identity, registry, expiry, revocation, path and integrity checks, with
// synthetic keys and in-memory storage only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGate, namespaceFor } from '../../server/private-qa/gate.mjs';
import { REGISTRY_KEY, fileKey, initRegistry, makeManifest, manifestKey, publish, revoke } from '../../server/private-qa/control.mjs';
import { MemoryStorage, testIdentityProvider, unsigned } from '../security/private-qa-fixtures.mjs';

const enc = new TextEncoder();
const T0 = Date.UTC(2026, 9, 21, 12);
const HOUR = 3600_000;
const OWNER = 'owner@example.test', SECOND = 'second@example.test', STRANGER = 'stranger@example.test';
const shaA = 'a'.repeat(40), shaB = 'b'.repeat(40);
const digest = 'c'.repeat(64);
const SECRET_JS = 'console.log("BUILD_A_ONLY")';

async function world() {
  const storage = new MemoryStorage();
  const idp = testIdentityProvider();
  let clock = T0;
  await initRegistry({ storage, reviewers: [OWNER, SECOND], namespaceSalt: 'd'.repeat(32) });
  const make = async (commit, run, files, reviewers) => {
    const built = await makeManifest({ files, commit, run, attempt: 1, createdAt: clock, expiresAt: clock + 72 * HOUR, fixtureVersion: digest, lockfileDigest: digest, toolchain: 'node 22' });
    await publish({ storage, manifestBytes: built.bytes, files, reviewers, now: clock });
    return built.manifest.buildId;
  };
  const filesA = [{ path: 'index.html', bytes: enc.encode('<!doctype html><title>A</title>') }, { path: 'assets/app.js', bytes: enc.encode(SECRET_JS) }, { path: 'assets/app.css', bytes: enc.encode('body{}') }];
  const a = await make(shaA, 1, filesA, [OWNER]);
  const b = await make(shaB, 2, [{ path: 'index.html', bytes: enc.encode('<!doctype html><title>B</title>') }], [OWNER, SECOND]);
  const gate = createGate({ storage, trust: idp.trust, hosts: ['qa.test'], now: () => clock });
  const call = async (path, { who = OWNER, token, method = 'GET', headers = {}, host = 'qa.test' } = {}) => {
    const jwt = token !== undefined ? token : who ? await idp.token(who, { now: clock }) : null;
    const response = await gate.fetch(new Request(`https://${host}${path}`, { method, headers: { ...(jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}), ...headers } }));
    return { status: response.status, headers: response.headers, text: method === 'HEAD' ? '' : await response.text() };
  };
  return { storage, idp, gate, call, a, b, setClock: (t) => { clock = t; }, now: () => clock };
}

test('an allowed reviewer receives exact build files with private, no-store security headers', async () => {
  const { call, a } = await world();
  const page = await call(`/b/${a}/`);
  assert.equal(page.status, 200);
  assert.match(page.text, /<title>A<\/title>/);
  assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
  const script = await call(`/b/${a}/assets/app.js`);
  assert.equal(script.text, SECRET_JS);
  for (const response of [page, script]) {
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.match(response.headers.get('content-security-policy'), /default-src 'none'.*connect-src 'self'.*frame-ancestors 'none'/);
    assert.equal(response.headers.get('etag'), null);
    assert.equal(response.headers.get('last-modified'), null);
  }
});

test('missing, unsigned, forged, wrong-issuer/audience, expired and not-yet-valid tokens never receive build bytes', async () => {
  const { call, a, idp, now } = await world();
  const other = testIdentityProvider({ kid: idp.kid, issuer: idp.issuer, audience: idp.audience });
  const iat = Math.floor(now() / 1000);
  const base = { iss: idp.issuer, aud: [idp.audience], email: OWNER, iat, exp: iat + 600 };
  const valid = await idp.token(OWNER, { now: now() });
  const [h, p, s] = valid.split('.');
  const tokens = {
    none: null,
    empty: '',
    garbage: 'not.a.jwt',
    unsigned: unsigned(base),
    otherKeySameKid: await other.token(OWNER, { now: now() }),
    wrongIssuer: await idp.sign({ ...base, iss: 'https://elsewhere.invalid' }),
    wrongAudience: await idp.sign({ ...base, aud: ['other-app'] }),
    expired: await idp.sign({ ...base, iat: iat - 7200, exp: iat - 1 }),
    notYetValid: await idp.sign({ ...base, nbf: iat + 300 }),
    noEmail: await idp.sign({ ...base, email: undefined }),
    hs256Header: await idp.sign(base, { alg: 'HS256' }),
    unknownKid: await idp.sign(base, { kid: 'unknown' }),
    tamperedClaims: `${h}.${Buffer.from(JSON.stringify({ ...base, email: STRANGER })).toString('base64url')}.${s}`,
    swappedSignature: `${h}.${p}.${s.slice(0, -4)}AAAA`,
    critical: await idp.sign(base, { crit: ['exp'] }),
    noIssuedAt: await idp.sign({ ...base, iat: undefined }),
    tooLongLived: await idp.sign({ ...base, exp: iat + 25 * 3600 }),
    kelvinSignPrefix: await idp.sign({ ...base, email: '\u212Aowner@example.test' }),
    unicodeOwner: await idp.sign({ ...base, email: 'ownеr@example.test' }),
  };
  for (const [name, token] of Object.entries(tokens)) {
    for (const path of ['/', `/b/${a}/`, `/b/${a}/assets/app.js`, `/b/${a}/__lease`]) {
      const response = await call(path, { token: token ?? '' , who: null });
      assert.equal(response.status, 401, `${name} ${path}`);
      assert.ok(!response.text.includes('BUILD_A_ONLY') && !response.text.includes('<title>'), `${name} leaked bytes`);
    }
  }
});

test('identity matching is exact ASCII (case-insensitive), and weak signing keys are never trusted', async () => {
  const { call, a, idp, now } = await world();
  const iat = Math.floor(now() / 1000);
  assert.equal((await call(`/b/${a}/`, { token: await idp.sign({ iss: idp.issuer, aud: [idp.audience], email: 'Owner@Example.TEST', iat, exp: iat + 600 }), who: null })).status, 200);
  // Kelvin sign K lower-cases to "k": a different identity must not become a permitted reviewer.
  const storage = new MemoryStorage();
  await initRegistry({ storage, reviewers: ['kate@x.test'], namespaceSalt: 'd'.repeat(32) });
  const gate = createGate({ storage, trust: idp.trust, hosts: ['qa.test'], now: () => now() });
  const kelvin = await idp.sign({ iss: idp.issuer, aud: [idp.audience], email: '\u212Aate@x.test', iat, exp: iat + 600 });
  assert.equal((await gate.fetch(new Request('https://qa.test/', { headers: { 'Cf-Access-Jwt-Assertion': kelvin } }))).status, 401);
  const kate = await idp.sign({ iss: idp.issuer, aud: [idp.audience], email: 'kate@x.test', iat, exp: iat + 600 });
  assert.equal((await gate.fetch(new Request('https://qa.test/', { headers: { 'Cf-Access-Jwt-Assertion': kate } }))).status, 200);
  const weak = testIdentityProvider({ modulusLength: 1024 });
  const weakGate = createGate({ storage, trust: weak.trust, hosts: ['qa.test'], now: () => now() });
  assert.equal((await weakGate.fetch(new Request('https://qa.test/', { headers: { 'Cf-Access-Jwt-Assertion': await weak.token('kate@x.test', { now: now() }) } }))).status, 401);
  const broken = createGate({ storage, trust: { issuer: 'x', audience: 'y', keys: [{ kty: 'RSA', kid: 'bad', n: '!!', e: 'AQAB' }] }, hosts: ['qa.test'] });
  assert.equal((await broken.fetch(new Request('https://qa.test/', { headers: { 'Cf-Access-Jwt-Assertion': kate } }))).status, 401, 'an unusable key configuration denies instead of crashing');
});

test('reviewers only see builds they are allowed, and other identities are denied', async () => {
  const { call, a, b } = await world();
  assert.equal((await call(`/b/${a}/`, { who: STRANGER })).status, 403);
  assert.equal((await call('/', { who: STRANGER })).status, 403);
  assert.equal((await call(`/b/${a}/assets/app.js`, { who: SECOND })).status, 404, 'build/reviewer isolation');
  assert.equal((await call(`/b/${b}/`, { who: SECOND })).status, 200);
  const list = await call('/', { who: SECOND });
  assert.ok(list.text.includes(b.slice(0, 12)) && !list.text.includes(a.slice(0, 12)));
  const ownerList = await call('/');
  assert.ok(ownerList.text.includes(a.slice(0, 12)) && ownerList.text.includes(b.slice(0, 12)));
});

test('only GET and HEAD on the exact configured host; other sites cannot embed build files', async () => {
  const { call, a } = await world();
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']) {
    const response = await call(`/b/${a}/`, { method });
    assert.equal(response.status, 405, method);
    assert.equal(response.headers.get('allow'), 'GET, HEAD');
  }
  for (const host of ['qa.test.evil.invalid', 'other.test', 'qa.test:8443']) assert.equal((await call(`/b/${a}/`, { host })).status, 404, host);
  assert.equal((await call(`/b/${a}/assets/app.js`, { headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'no-cors' } })).status, 403);
  assert.equal((await call(`/b/${a}/__lease`, { headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'cors' } })).status, 403);
  assert.equal((await call(`/b/${a}/assets/app.js`, { headers: { 'Sec-Fetch-Site': 'same-site', 'Sec-Fetch-Mode': 'no-cors' } })).status, 403, 'a sibling subdomain may not embed files either');
  assert.equal((await call(`/b/${a}/assets/app.js`, { headers: { 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'no-cors' } })).status, 200);
  assert.equal((await call(`/b/${a}/`, { headers: { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate' } })).status, 200, 'a link from elsewhere may open the page');
  const head = await call(`/b/${a}/assets/app.js`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await call(`/b/${a}/assets/app.js`, { method: 'HEAD', who: null, token: '' })).status, 401);
});

test('traversal, encoded, undeclared and query paths are refused without falling through to other files or builds', async () => {
  const { call, a, b } = await world();
  const refused = [
    `/b/${a}/assets%2Fapp.js`, `/b/${a}/assets/%61pp.js`, `/b/${a}//assets/app.js`,
    `/b/${a}/.env`, `/b/${a}/assets/app.js.map`, `/b/${a}/assets/missing.js`, `/b/${a}/manifest.json`, `/b/${a}/assets/app.js?x=1`,
    `/b/${a}`, `/b/${a.toUpperCase()}/`, `/b/${a}x/`, `/b/../control/registry.json`, '/control/registry.json', `/builds/${a}/manifest.json`,
    `/b/${a}/assets/app..js`, `/b/${a}/assets/app%00.js`, `/b/${a}/index.html%20`,
  ];
  for (const path of refused) {
    const response = await call(path);
    assert.ok([404, 410].includes(response.status), `${path} → ${response.status}`);
    assert.ok(!response.text.includes('BUILD_A_ONLY') && !response.text.includes('<title>'), `${path} leaked bytes`);
  }
  // The URL standard resolves dot segments, including %2e%2e, before any code sees the path. The resolved
  // path is authorised like any other, so this can only reach files the same reviewer may fetch directly.
  assert.equal((await call(`/b/${b}/%2e%2e/${a}/assets/app.js`, { who: SECOND })).status, 404, 'resolved path stays reviewer-scoped');
  assert.equal((await call(`/b/${a}/assets\\app.js`)).text, SECRET_JS, 'backslash becomes "/" under the URL standard: same permitted file');
  assert.match((await call(`/b/${a}/%2e%2e/${b}/index.html`)).text, /<title>B<\/title>/, 'owner may read B directly as well');
  const normalised = await call(`/b/${a}/assets/../index.html`);
  assert.equal(normalised.status, 200);
  assert.match(normalised.text, /<title>A<\/title>/);
});

test('expiry applies on the next request, including the lease and with an already-issued login', async () => {
  const { call, a, setClock } = await world();
  setClock(T0 + 72 * HOUR - 1);
  assert.equal((await call(`/b/${a}/`)).status, 200);
  setClock(T0 + 72 * HOUR);
  for (const path of [`/b/${a}/`, `/b/${a}/assets/app.js`, `/b/${a}/__lease`]) assert.equal((await call(path)).status, 410, path);
  assert.ok(!(await call('/')).text.includes(a.slice(0, 12)));
});

test('revoking a build, a reviewer or everything denies the very next request', async () => {
  const { call, a, b, storage, now } = await world();
  assert.equal((await call(`/b/${a}/`)).status, 200);
  await revoke({ storage, buildId: a, now: now() });
  assert.equal((await call(`/b/${a}/`)).status, 410);
  assert.equal((await call(`/b/${a}/assets/app.js`)).status, 410);
  assert.equal((await call(`/b/${b}/`, { who: SECOND })).status, 200);
  await revoke({ storage, reviewer: SECOND, now: now() });
  assert.equal((await call(`/b/${b}/`, { who: SECOND })).status, 403);
  assert.equal((await call(`/b/${b}/`)).status, 200);
  await revoke({ storage, everything: true, now: now() });
  assert.equal((await call(`/b/${b}/`)).status, 503);
  assert.equal((await call('/')).status, 503);
});

test('a missing, malformed or unreachable registry denies instead of using an earlier answer', async () => {
  const { call, a, storage } = await world();
  assert.equal((await call(`/b/${a}/`)).status, 200);
  const saved = storage.objects.get(REGISTRY_KEY);
  storage.failGet = (key) => key === REGISTRY_KEY;
  assert.equal((await call(`/b/${a}/`)).status, 503);
  storage.failGet = null;
  storage.overwrite(REGISTRY_KEY, enc.encode('{"version":1,"enabled":true'));
  assert.equal((await call(`/b/${a}/assets/app.js`)).status, 503);
  storage.overwrite(REGISTRY_KEY, enc.encode(JSON.stringify({ version: 2, enabled: true })));
  assert.equal((await call(`/b/${a}/`)).status, 503);
  storage.objects.delete(REGISTRY_KEY);
  assert.equal((await call(`/b/${a}/`)).status, 503);
  storage.objects.set(REGISTRY_KEY, saved);
  assert.equal((await call(`/b/${a}/`)).status, 200);
});

test('the registry is read for every request (no authorisation cache)', async () => {
  const { call, a, storage } = await world();
  storage.gets.length = 0;
  for (let i = 0; i < 4; i++) await call(`/b/${a}/assets/app.js`);
  assert.equal(storage.gets.filter((k) => k === REGISTRY_KEY).length, 4);
});

test('tampered or missing manifests and assets are never served', async () => {
  const { call, a, storage } = await world();
  storage.overwrite(fileKey(a, 'assets/app.js'), enc.encode('console.log("tampered")'));
  assert.equal((await call(`/b/${a}/assets/app.js`)).status, 503);
  storage.objects.delete(fileKey(a, 'assets/app.css'));
  assert.equal((await call(`/b/${a}/assets/app.css`)).status, 503);
  const manifest = storage.objects.get(manifestKey(a)).bytes;
  const forged = JSON.parse(new TextDecoder().decode(manifest));
  forged.assets['assets/extra.js'] = { sha256: 'e'.repeat(64), bytes: 1, type: 'text/javascript; charset=utf-8' };
  storage.overwrite(manifestKey(a), enc.encode(JSON.stringify(forged)));
  assert.equal((await call(`/b/${a}/`)).status, 503, 'manifest digest is pinned by the registry');
});

test('validators are ignored: no 304, partial or stale response can bypass the checks', async () => {
  const { call, a } = await world();
  for (const headers of [{ 'If-None-Match': '*' }, { 'If-Modified-Since': new Date(T0 + HOUR).toUTCString() }, { Range: 'bytes=0-3' }]) {
    const response = await call(`/b/${a}/assets/app.js`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.text, SECRET_JS);
  }
  assert.equal((await call(`/b/${a}/assets/app.js`, { who: null, token: '', headers: { 'If-None-Match': '*' } })).status, 401);
});

test('the lease gives an opaque namespace per reviewer and build, without the identity', async () => {
  const { call, a, b } = await world();
  const lease = JSON.parse((await call(`/b/${a}/__lease`)).text);
  assert.equal(lease.buildId, a);
  assert.match(lease.namespace, /^[0-9a-f]{32}$/);
  assert.equal(lease.expiresAt, T0 + 72 * HOUR);
  const raw = (await call(`/b/${a}/__lease`)).text;
  assert.ok(!raw.includes('@') && !raw.includes('owner'));
  const ownerB = JSON.parse((await call(`/b/${b}/__lease`)).text).namespace;
  const secondB = JSON.parse((await call(`/b/${b}/__lease`, { who: SECOND })).text).namespace;
  assert.equal(new Set([lease.namespace, ownerB, secondB]).size, 3);
  assert.equal(lease.namespace, await namespaceFor('d'.repeat(32), a, OWNER));
});

test('the build list shows only live builds and the synthetic notice', async () => {
  const { call, setClock } = await world();
  const page = await call('/');
  assert.match(page.text, /Synthetic review only/);
  assert.equal(page.headers.get('content-type'), 'text/html; charset=utf-8');
  setClock(T0 + 80 * HOUR);
  assert.match((await call('/')).text, /No review build is available/);
});
