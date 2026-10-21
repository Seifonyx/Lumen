// Codespaces review server: refuses to run outside a Codespace or for an unverified build, binds to
// loopback, accepts only the forwarded/loopback hosts, ignores browser-supplied identity, and keeps the
// QA01 gate's expiry, headers and integrity checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeManifest } from '../../server/private-qa/control.mjs';
import { codespaceHost, startCodespaceServer } from '../../scripts/qa/serve-codespace.mjs';
import { testIdentityProvider } from '../security/private-qa-fixtures.mjs';

const COMMIT = 'a'.repeat(40);
const ENV = { CODESPACES: 'true', CODESPACE_NAME: 'lumen-test-abc123', GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev' };
const enc = new TextEncoder();
const T0 = Date.UTC(2026, 9, 21, 12);

async function buildDir({ tamper = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'qa-codespace-'));
  const files = [{ path: 'index.html', bytes: enc.encode('<!doctype html><title>review</title>') }, { path: 'assets/app.js', bytes: enc.encode('console.log("SYNTHETIC")') }];
  const { bytes } = await makeManifest({ files, commit: COMMIT, run: 0, attempt: 1, createdAt: T0, expiresAt: T0 + 8 * 3600_000, fixtureVersion: 'c'.repeat(64), lockfileDigest: 'c'.repeat(64) });
  mkdirSync(join(dir, 'site/assets'), { recursive: true });
  for (const f of files) writeFileSync(join(dir, 'site', f.path), f.bytes);
  writeFileSync(join(dir, 'manifest.json'), bytes);
  if (tamper) writeFileSync(join(dir, 'site/assets/app.js'), 'console.log("TAMPERED")');
  return dir;
}

const get = (port, path, headers = {}) => new Promise((resolve, reject) => {
  const req = request({ host: '127.0.0.1', port, path, headers }, (res) => { let body = ''; res.on('data', (c) => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body })); });
  req.on('error', reject);
  req.end();
});

test('refuses to start outside an authorised Codespace', async () => {
  for (const env of [{}, { ...ENV, CODESPACES: 'false' }, { ...ENV, CODESPACE_NAME: '' }, { ...ENV, CODESPACE_NAME: 'bad name/..' }, { ...ENV, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: '' }, { ...ENV, GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'evil.test/x' }]) {
    assert.throws(() => codespaceHost(env, 4173), /Refusing to start/);
    await assert.rejects(startCodespaceServer({ buildDir: await buildDir(), port: 0, env, expectedCommit: COMMIT, now: () => T0 }), /Refusing to start/);
  }
  assert.equal(codespaceHost(ENV, 4173), 'lumen-test-abc123-4173.app.github.dev');
});

test('refuses a tampered build, a different commit or an expired build', async () => {
  await assert.rejects(startCodespaceServer({ buildDir: await buildDir({ tamper: true }), port: 0, env: ENV, expectedCommit: COMMIT, now: () => T0 }), /verification failed[\s\S]*digest mismatch/);
  await assert.rejects(startCodespaceServer({ buildDir: await buildDir(), port: 0, env: ENV, expectedCommit: 'b'.repeat(40), now: () => T0 }), /not the expected/);
  await assert.rejects(startCodespaceServer({ buildDir: await buildDir(), port: 0, env: ENV, expectedCommit: COMMIT, now: () => T0 + 9 * 3600_000 }), /expired/);
});

test('serves only on loopback, only to permitted hosts, through the gate, ignoring browser identity', async () => {
  let clock = T0;
  const server = await startCodespaceServer({ buildDir: await buildDir(), port: 0, env: ENV, expectedCommit: COMMIT, now: () => clock });
  try {
    assert.equal(server.address.address, '127.0.0.1');
    const port = server.address.port;
    const forwarded = server.host;
    assert.match(forwarded, /^lumen-test-abc123-\d+\.app\.github\.dev$/);
    const page = await get(port, `/b/${server.buildId}/`, { Host: forwarded });
    assert.equal(page.status, 200);
    assert.match(page.body, /<title>review<\/title>/);
    assert.equal(page.headers['cache-control'], 'private, no-store');
    assert.match(page.headers['content-security-policy'], /default-src 'none'/);
    assert.equal((await get(port, `/b/${server.buildId}/assets/app.js`, { Host: `localhost:${port}` })).status, 200);
    for (const host of ['evil.test', `other-${port}.app.github.dev`, `lumen-test-abc123-${port}.evil.test`, `${forwarded}.evil.test`]) {
      const denied = await get(port, `/b/${server.buildId}/`, { Host: host });
      assert.equal(denied.status, 404, host);
      assert.ok(!denied.body.includes('<title>review'));
    }
    // A forged identity from the browser is discarded: the namespace is the server's own reviewer.
    const lease = JSON.parse((await get(port, `/b/${server.buildId}/__lease`, { Host: forwarded })).body);
    const stranger = testIdentityProvider();
    const forgedLease = JSON.parse((await get(port, `/b/${server.buildId}/__lease`, { Host: forwarded, 'Cf-Access-Jwt-Assertion': await stranger.token('attacker@example.test') })).body);
    assert.equal(forgedLease.namespace, lease.namespace);
    assert.equal((await get(port, `/b/${server.buildId}/assets/missing.js`, { Host: forwarded })).status, 404);
    assert.equal((await get(port, '/control/registry.json', { Host: forwarded })).status, 404);
    // Expiry: the next request after the build's deadline is refused.
    clock = T0 + 8 * 3600_000;
    assert.equal((await get(port, `/b/${server.buildId}/`, { Host: forwarded })).status, 410);
    assert.equal((await get(port, `/b/${server.buildId}/__lease`, { Host: forwarded })).status, 410);
  } finally {
    await server.close();
  }
});

test('the devcontainer keeps the review port unpublished and runs only QA tooling', async () => {
  const { readFileSync } = await import('node:fs');
  const text = readFileSync('.devcontainer/devcontainer.json', 'utf8');
  assert.ok(!/"visibility"\s*:\s*"(public|org)"/i.test(text), 'never request a public or organisation port');
  assert.ok(!/secrets|GITHUB_TOKEN|firebase|deploy/i.test(text.replace(/\/\/.*$/gm, '')), 'no secrets, Firebase or deployment');
  assert.match(text, /serve-codespace\.mjs --build \/tmp\/lumen-qa-build --port 4173/);
  assert.match(text, /"otherPortsAttributes"\s*:\s*\{\s*"onAutoForward"\s*:\s*"ignore"/);
});
