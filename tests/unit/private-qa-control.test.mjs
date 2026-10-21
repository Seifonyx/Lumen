// Private iPhone QA control plane (QA01): immutable manifests, create-only publication and conditional
// registry updates where revocation always wins. In-memory storage only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REGISTRY_KEY, initRegistry, makeManifest, parseManifest, publish, readRegistry, revoke, updateRegistry } from '../../server/private-qa/control.mjs';
import { MemoryStorage } from '../security/private-qa-fixtures.mjs';

const enc = new TextEncoder();
const T0 = Date.UTC(2026, 9, 21, 12), HOUR = 3600_000;
const OWNER = 'owner@example.test';
const d = 'c'.repeat(64);
const files = () => [{ path: 'index.html', bytes: enc.encode('<!doctype html>') }, { path: 'assets/a.js', bytes: enc.encode('1') }];
const manifest = (over = {}) => makeManifest({ files: files(), commit: 'a'.repeat(40), run: 7, attempt: 1, createdAt: T0, expiresAt: T0 + 72 * HOUR, fixtureVersion: d, lockfileDigest: d, toolchain: 'node 22', ...over });
const fresh = async () => { const storage = new MemoryStorage(); await initRegistry({ storage, reviewers: [OWNER], namespaceSalt: 'e'.repeat(32) }); return storage; };
const rejects = (promise, code) => assert.rejects(promise, (e) => e.code === code);

test('manifests pin commit, run, provenance and every file digest, and refuse unsafe builds', async () => {
  const { manifest: m, bytes, digest } = await manifest();
  assert.equal(m.buildId, `${'a'.repeat(40)}-7-1`);
  assert.equal(m.assets['assets/a.js'].type, 'text/javascript; charset=utf-8');
  assert.match(m.assets['index.html'].sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(await parseManifest(bytes, digest), m);
  assert.equal(await parseManifest(bytes, 'f'.repeat(64)), null);
  await rejects(manifest({ dirty: true }), 'dirty');
  await rejects(manifest({ commit: 'abc123' }), 'commit');
  await rejects(manifest({ commit: 'A'.repeat(40) }), 'commit');
  await rejects(manifest({ run: 'main' }), 'build_id');
  await rejects(manifest({ expiresAt: T0 + 72 * HOUR + 1 }), 'expiry');
  await rejects(manifest({ expiresAt: T0 }), 'expiry');
  await rejects(manifest({ fixtureVersion: 'x' }), 'provenance');
  await rejects(manifest({ files: [{ path: 'assets/a.js', bytes: enc.encode('1') }] }), 'entry');
  for (const path of ['../index.html', 'assets/../x.js', '/abs.js', 'a//b.js', '.env', 'assets/a.js.map', 'sw.js.LICENSE', 'x.wasm', 'a\\b.js', 'a%2f.js', '']) {
    await rejects(manifest({ files: [...files(), { path, bytes: enc.encode('x') }] }), 'path');
  }
  await rejects(manifest({ files: [...files(), { path: 'index.html', bytes: enc.encode('again') }] }), 'duplicate');
  await rejects(manifest({ files: [...files(), { path: 'big.js', bytes: new Uint8Array(15 * 1024 * 1024 + 1) }] }), 'size');
});

test('publication is create-only, digest-checked and activates only after every file is stored', async () => {
  const storage = await fresh();
  const { bytes, manifest: m } = await manifest();
  const registry = await publish({ storage, manifestBytes: bytes, files: files(), reviewers: [OWNER], now: T0 });
  assert.equal(registry.builds[m.buildId].status, 'active');
  assert.equal(registry.builds[m.buildId].sourceSha, 'a'.repeat(40));
  await rejects(publish({ storage, manifestBytes: bytes, files: files(), reviewers: [OWNER], now: T0 }), 'duplicate');

  const other = await manifest({ run: 8 });
  const tampered = files(); tampered[1].bytes = enc.encode('2');
  await rejects(publish({ storage, manifestBytes: other.bytes, files: tampered, reviewers: [OWNER], now: T0 }), 'digest');
  await rejects(publish({ storage, manifestBytes: other.bytes, files: files().slice(0, 1), reviewers: [OWNER], now: T0 }), 'files');
  await rejects(publish({ storage, manifestBytes: other.bytes, files: [...files(), { path: 'extra.js', bytes: enc.encode('') }], reviewers: [OWNER], now: T0 }), 'files');
  await rejects(publish({ storage, manifestBytes: other.bytes, files: files(), reviewers: ['someone@else.test'], now: T0 }), 'reviewers');
  await rejects(publish({ storage, manifestBytes: other.bytes, files: files(), reviewers: [OWNER], now: T0 + 73 * HOUR }), 'expired');
  await rejects(publish({ storage, manifestBytes: enc.encode('{}'), files: files(), reviewers: [OWNER], now: T0 }), 'manifest');
  assert.equal((await readRegistry(storage)).registry.builds[other.manifest.buildId], undefined, 'failed publications never activate');
});

test('lifetime is bounded from publication time, not from the creation time a manifest claims', async () => {
  const storage = await fresh();
  const future = await manifest({ createdAt: T0 + 365 * 24 * HOUR, expiresAt: T0 + 365 * 24 * HOUR + 72 * HOUR });
  await rejects(publish({ storage, manifestBytes: future.bytes, files: files(), reviewers: [OWNER], now: T0 }), 'expiry');
  const ok = await manifest({ createdAt: T0 - HOUR, expiresAt: T0 + 71 * HOUR });
  await publish({ storage, manifestBytes: ok.bytes, files: files(), reviewers: [OWNER], now: T0 });
  // A registry entry claiming more than 72 hours of access is malformed (and the gate then denies everything).
  const { registry } = await readRegistry(storage);
  registry.builds[ok.manifest.buildId].expiresAt = T0 + 400 * HOUR;
  storage.overwrite(REGISTRY_KEY, enc.encode(JSON.stringify(registry)));
  assert.equal(await readRegistry(storage), null);
});

test('at most three builds are active at once', async () => {
  const storage = await fresh();
  for (const run of [1, 2, 3]) {
    const { bytes } = await manifest({ run });
    await publish({ storage, manifestBytes: bytes, files: files(), reviewers: [OWNER], now: T0 });
  }
  const fourth = await manifest({ run: 4 });
  await rejects(publish({ storage, manifestBytes: fourth.bytes, files: files(), reviewers: [OWNER], now: T0 }), 'limit');
  assert.deepEqual(storage.keys(`builds/${fourth.manifest.buildId}/`), [], 'a refused build leaves no orphan files');
  await revoke({ storage, buildId: `${'a'.repeat(40)}-1-1`, now: T0 });
  const fifth = await manifest({ run: 5 });
  await publish({ storage, manifestBytes: fifth.bytes, files: files(), reviewers: [OWNER], now: T0 });
});

test('a revocation that lands while a build is being published always wins', async () => {
  const storage = await fresh();
  const { bytes, manifest: m } = await manifest();
  // Revoke after the files are stored but before the manifest/registry activation.
  let hooked = false;
  const originalPut = storage.put.bind(storage);
  storage.put = async (key, b, o) => { if (!hooked && key.startsWith('builds/') && key.endsWith('manifest.json')) { hooked = true; await revoke({ storage, buildId: m.buildId, now: T0 }); } return originalPut(key, b, o); };
  await rejects(publish({ storage, manifestBytes: bytes, files: files(), reviewers: [OWNER], now: T0 }), 'duplicate');
  const { registry } = await readRegistry(storage);
  assert.equal(registry.builds[m.buildId], undefined);
  assert.ok(registry.revoked[m.buildId]);
  // A later retry of the same build ID cannot resurrect it either.
  storage.put = originalPut;
  await rejects(publish({ storage, manifestBytes: bytes, files: files(), reviewers: [OWNER], now: T0 }), 'duplicate');
});

test('concurrent registry writers are reconciled by conditional writes, never lost', async () => {
  const storage = await fresh();
  const one = await manifest({ run: 1 }), two = await manifest({ run: 2 });
  const originalPut = storage.put.bind(storage);
  let interleaved = false;
  storage.put = async (key, b, o) => {
    if (!interleaved && key === REGISTRY_KEY) { interleaved = true; storage.put = originalPut; await publish({ storage, manifestBytes: two.bytes, files: files(), reviewers: [OWNER], now: T0 }); }
    return originalPut(key, b, o);
  };
  const applied = await publish({ storage, manifestBytes: one.bytes, files: files(), reviewers: [OWNER], now: T0 });
  assert.equal(applied.confirmedCurrent, true);
  const { registry } = await readRegistry(storage);
  assert.equal(registry.builds[one.manifest.buildId].status, 'active');
  assert.equal(registry.builds[two.manifest.buildId].status, 'active');
});

test('a write that succeeded is reported as applied even if another writer changes the registry right after', async () => {
  const storage = await fresh();
  const originalGet = storage.get.bind(storage);
  let writes = 0;
  const originalPut = storage.put.bind(storage);
  storage.put = async (key, b, o) => { const result = await originalPut(key, b, o); if (key === REGISTRY_KEY && result && ++writes === 1) { const cur = storage.objects.get(key); storage.overwrite(key, cur.bytes); } return result; };
  const result = await revoke({ storage, everything: true, now: T0 });
  assert.equal(result.enabled, false);
  assert.equal(result.confirmedCurrent, false, 'applied, but changed again since');
  assert.equal((await readRegistry(storage)).registry.enabled, false);
  storage.get = originalGet;
});

test('a registry that keeps changing gives up without applying anything', async () => {
  const storage = await fresh();
  const originalPut = storage.put.bind(storage);
  storage.put = async (key, b, o) => { if (key === REGISTRY_KEY) { const cur = storage.objects.get(key); storage.overwrite(key, cur.bytes); } return originalPut(key, b, o); };
  await rejects(updateRegistry(storage, (r) => ({ ...r, enabled: false })), 'conflict');
  storage.put = originalPut;
  assert.equal((await readRegistry(storage)).registry.enabled, true);
});

test('revocation covers one build, one reviewer or everything, and is confirmed by reading back', async () => {
  const storage = await fresh();
  const { bytes, manifest: m } = await manifest();
  await publish({ storage, manifestBytes: bytes, files: files(), reviewers: [OWNER], now: T0 });
  let registry = await revoke({ storage, buildId: m.buildId, now: T0 + 1 });
  assert.equal(registry.builds[m.buildId].status, 'revoked');
  assert.equal(registry.revoked[m.buildId], T0 + 1);
  registry = await revoke({ storage, reviewer: OWNER, now: T0 + 2 });
  assert.deepEqual(registry.reviewers, []);
  assert.deepEqual(registry.builds[m.buildId].reviewers, []);
  registry = await revoke({ storage, everything: true, now: T0 + 3 });
  assert.equal(registry.enabled, false);
  await rejects(revoke({ storage, now: T0 }), 'nothing');
  await rejects(revoke({ storage, buildId: 'latest', now: T0 }), 'build_id');
});

test('the registry is created once and malformed registries are unusable', async () => {
  const storage = await fresh();
  await rejects(initRegistry({ storage, reviewers: [OWNER], namespaceSalt: 'e'.repeat(32) }), 'exists');
  await rejects(initRegistry({ storage: new MemoryStorage(), reviewers: [OWNER], namespaceSalt: 'short' }), 'invalid_registry');
  storage.overwrite(REGISTRY_KEY, enc.encode('{"version":1}'));
  assert.equal(await readRegistry(storage), null);
  await rejects(revoke({ storage, everything: true }), 'registry_unavailable');
});
