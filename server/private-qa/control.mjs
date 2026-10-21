// Private iPhone QA: immutable build manifests and the access registry.
//
// Storage is injected and must offer strongly consistent reads and conditional writes:
//   get(key)                       → null | { bytes: Uint8Array, etag: string }
//   put(key, bytes, { onlyIf })    → null when the precondition fails, else { etag }
//     onlyIf: { etagMatches: etag } replaces exactly that version; { etagDoesNotMatch: '*' } creates only.
// No local adapter publishes anywhere: tests and the loopback harness use an in-memory store.

import { BUILD_ID, COMMIT, assetPath, mimeOf } from './paths.mjs';

export const REGISTRY_KEY = 'control/registry.json';
export const LIMITS = Object.freeze({ maxActiveBuilds: 3, maxBuildMs: 72 * 3600_000, maxFileBytes: 15 * 1024 * 1024, maxBuildBytes: 50 * 1024 * 1024, maxFiles: 400, maxReviewers: 5 });

const encoder = new TextEncoder();
const decoder = new TextDecoder();
export const manifestKey = (buildId) => `builds/${buildId}/manifest.json`;
export const fileKey = (buildId, path) => `builds/${buildId}/files/${path}`;

export async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const fail = (code, message) => Object.assign(new Error(message), { code });
const email = (value) => typeof value === 'string' && /^[^\s@A-Z]+@[^\s@A-Z]+$/.test(value) && value.length <= 254;
const isTime = (value) => Number.isSafeInteger(value) && value > 0;
const hex64 = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

/** The registry if it is exactly the expected shape; otherwise null (callers deny). */
export function parseRegistry(bytes) {
  let value;
  try { value = JSON.parse(decoder.decode(bytes)); } catch { return null; }
  if (!value || typeof value !== 'object' || value.version !== 1 || typeof value.enabled !== 'boolean') return null;
  if (typeof value.namespaceSalt !== 'string' || !/^[0-9a-f]{32,128}$/.test(value.namespaceSalt)) return null;
  if (!Array.isArray(value.reviewers) || value.reviewers.length > LIMITS.maxReviewers || !value.reviewers.every(email)) return null;
  if (!value.builds || typeof value.builds !== 'object' || Array.isArray(value.builds)) return null;
  if (!value.revoked || typeof value.revoked !== 'object' || Array.isArray(value.revoked)) return null;
  for (const [id, build] of Object.entries(value.builds)) {
    if (!BUILD_ID.test(id) || !build || typeof build !== 'object') return null;
    if (!['active', 'revoked'].includes(build.status) || !hex64(build.manifestDigest) || !isTime(build.expiresAt) || !isTime(build.activatedAt)) return null;
    if (!Array.isArray(build.reviewers) || !build.reviewers.every(email) || build.sourceSha !== id.slice(0, 40)) return null;
  }
  for (const [id, at] of Object.entries(value.revoked)) if (!BUILD_ID.test(id) || !isTime(at)) return null;
  return value;
}

const serialize = (registry) => encoder.encode(JSON.stringify(registry));

export async function readRegistry(storage) {
  const object = await storage.get(REGISTRY_KEY);
  if (!object) return null;
  const registry = parseRegistry(object.bytes);
  return registry ? { registry, etag: object.etag } : null;
}

/** Creates the registry once (create-only; an existing registry is never replaced). */
export async function initRegistry({ storage, reviewers = [], namespaceSalt, enabled = true }) {
  const registry = { version: 1, enabled, namespaceSalt, reviewers: [...new Set(reviewers.map((r) => r.toLowerCase()))], builds: {}, revoked: {} };
  if (!parseRegistry(serialize(registry))) throw fail('invalid_registry', 'Registry settings are not valid.');
  const put = await storage.put(REGISTRY_KEY, serialize(registry), { onlyIf: { etagDoesNotMatch: '*' } });
  if (!put) throw fail('exists', 'A registry already exists.');
  return registry;
}

/**
 * Applies `change` to the current registry with a conditional write, re-reading and re-applying on a
 * concurrent update. `change` may throw to abort; it receives a copy and returns the new value.
 */
export async function updateRegistry(storage, change, { attempts = 5 } = {}) {
  for (let i = 0; i < attempts; i++) {
    const current = await readRegistry(storage);
    if (!current) throw fail('registry_unavailable', 'The registry is missing or malformed.');
    const next = change(structuredClone(current.registry));
    if (!parseRegistry(serialize(next))) throw fail('invalid_registry', 'The registry change is not valid.');
    const put = await storage.put(REGISTRY_KEY, serialize(next), { onlyIf: { etagMatches: current.etag } });
    if (put) {
      const readback = await readRegistry(storage);
      if (!readback || readback.etag !== put.etag) throw fail('readback', 'The registry changed again before it could be confirmed.');
      return readback.registry;
    }
  }
  throw fail('conflict', 'The registry kept changing; nothing was applied.');
}

/**
 * Builds the immutable manifest for one review build. Every file is digested, typed from an allowlist
 * and bounded; a dirty source tree, unknown file type, traversal or oversized build is refused.
 */
export async function makeManifest({ files, commit, run, attempt, createdAt, expiresAt, dirty = false, fixtureVersion, toolchain, lockfileDigest, tests = [] }) {
  if (dirty !== false) throw fail('dirty', 'Only a clean, committed source tree can become a review build.');
  if (!COMMIT.test(commit || '')) throw fail('commit', 'A full 40-character commit SHA is required.');
  const buildId = `${commit}-${run}-${attempt}`;
  if (!BUILD_ID.test(buildId)) throw fail('build_id', 'Run and attempt must be small whole numbers.');
  if (!isTime(createdAt) || !isTime(expiresAt) || expiresAt <= createdAt || expiresAt - createdAt > LIMITS.maxBuildMs) throw fail('expiry', 'Builds expire within 72 hours of creation.');
  if (!hex64(fixtureVersion) || !hex64(lockfileDigest)) throw fail('provenance', 'Fixture and lockfile digests are required.');
  if (!Array.isArray(files) || !files.length || files.length > LIMITS.maxFiles) throw fail('files', 'A build needs between 1 and 400 files.');
  const assets = {};
  let total = 0;
  for (const file of files) {
    const path = assetPath(file?.path);
    if (!path) throw fail('path', `Refused file path: ${String(file?.path).slice(0, 80)}`);
    if (assets[path]) throw fail('duplicate', `Duplicate file path: ${path}`);
    if (!(file.bytes instanceof Uint8Array) || file.bytes.byteLength > LIMITS.maxFileBytes) throw fail('size', `File too large: ${path}`);
    total += file.bytes.byteLength;
    if (total > LIMITS.maxBuildBytes) throw fail('size', 'Build exceeds 50 MB.');
    assets[path] = { sha256: await sha256(file.bytes), bytes: file.bytes.byteLength, type: mimeOf(path) };
  }
  if (!assets['index.html']) throw fail('entry', 'A build needs index.html.');
  const manifest = {
    version: 1, buildId, commit, run: String(run), attempt: String(attempt), createdAt, expiresAt,
    fixtureVersion, lockfileDigest, toolchain: String(toolchain || '').slice(0, 200), tests: tests.map((t) => String(t).slice(0, 200)).slice(0, 50),
    assets: Object.fromEntries(Object.entries(assets).sort(([a], [b]) => a.localeCompare(b))),
  };
  const bytes = encoder.encode(JSON.stringify(manifest));
  return { manifest, bytes, digest: await sha256(bytes) };
}

/** Parses and re-validates manifest bytes against the same rules the builder applies. */
export async function parseManifest(bytes, expectedDigest) {
  if (expectedDigest !== undefined && (await sha256(bytes)) !== expectedDigest) return null;
  let m;
  try { m = JSON.parse(decoder.decode(bytes)); } catch { return null; }
  if (!m || m.version !== 1 || !BUILD_ID.test(m.buildId || '') || m.buildId !== `${m.commit}-${m.run}-${m.attempt}`) return null;
  if (!isTime(m.createdAt) || !isTime(m.expiresAt) || m.expiresAt <= m.createdAt || m.expiresAt - m.createdAt > LIMITS.maxBuildMs) return null;
  if (!m.assets || typeof m.assets !== 'object' || !m.assets['index.html']) return null;
  for (const [path, asset] of Object.entries(m.assets)) {
    if (assetPath(path) !== path || !hex64(asset?.sha256) || asset.type !== mimeOf(path) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0) return null;
  }
  return m;
}

/**
 * Publishes a build: uploads every file and the manifest under a fresh prefix (create-only), then
 * activates it in the registry with a conditional write. A build ID that already has objects, is
 * already registered or was ever revoked can never be (re)published.
 */
export async function publish({ storage, manifestBytes, files, reviewers, now = Date.now() }) {
  const manifest = await parseManifest(manifestBytes);
  if (!manifest) throw fail('manifest', 'The manifest is not valid.');
  if (manifest.expiresAt <= now) throw fail('expired', 'This build has already expired.');
  const id = manifest.buildId;
  const permitted = [...new Set((reviewers || []).map((r) => String(r).toLowerCase()))];
  if (!permitted.length || !permitted.every(email)) throw fail('reviewers', 'Name at least one permitted reviewer.');
  const supplied = new Map((files || []).map((f) => [f.path, f.bytes]));
  const expected = Object.keys(manifest.assets);
  if (supplied.size !== expected.length || !expected.every((p) => supplied.has(p))) throw fail('files', 'Files do not match the manifest.');
  for (const path of expected) {
    if ((await sha256(supplied.get(path))) !== manifest.assets[path].sha256) throw fail('digest', `Digest mismatch: ${path}`);
  }
  const before = await readRegistry(storage);
  if (!before) throw fail('registry_unavailable', 'The registry is missing or malformed.');
  if (before.registry.revoked[id] || before.registry.builds[id]) throw fail('duplicate', 'This build ID was already used.');
  if (!permitted.every((r) => before.registry.reviewers.includes(r))) throw fail('reviewers', 'Every reviewer must already be allowed by the registry.');
  for (const path of expected) {
    if (!(await storage.put(fileKey(id, path), supplied.get(path), { onlyIf: { etagDoesNotMatch: '*' } }))) throw fail('duplicate', 'This build ID already has stored files.');
  }
  if (!(await storage.put(manifestKey(id), manifestBytes, { onlyIf: { etagDoesNotMatch: '*' } }))) throw fail('duplicate', 'This build ID already has a manifest.');
  const digest = await sha256(manifestBytes);
  return updateRegistry(storage, (registry) => {
    if (registry.revoked[id] || registry.builds[id]) throw fail('duplicate', 'This build ID was revoked or registered meanwhile.');
    if (!permitted.every((r) => registry.reviewers.includes(r))) throw fail('reviewers', 'A reviewer was removed meanwhile.');
    const active = Object.values(registry.builds).filter((b) => b.status === 'active' && b.expiresAt > now).length;
    if (active >= LIMITS.maxActiveBuilds) throw fail('limit', 'Three builds are already active; revoke one first.');
    registry.builds[id] = { status: 'active', sourceSha: manifest.commit, manifestDigest: digest, expiresAt: manifest.expiresAt, activatedAt: now, reviewers: permitted };
    return registry;
  });
}

/**
 * Revokes access. `buildId` disables one build (recorded even if it was never published, so a late
 * publish cannot activate it); `reviewer` removes a person everywhere; `everything` turns the whole
 * gate off. Revocation always wins a race with publication.
 */
export async function revoke({ storage, buildId, reviewer, everything = false, now = Date.now() }) {
  if (buildId !== undefined && !BUILD_ID.test(buildId)) throw fail('build_id', 'Not a build ID.');
  if (reviewer !== undefined && !email(String(reviewer).toLowerCase())) throw fail('reviewers', 'Not a reviewer identity.');
  if (buildId === undefined && reviewer === undefined && !everything) throw fail('nothing', 'Say what to revoke.');
  return updateRegistry(storage, (registry) => {
    if (everything) registry.enabled = false;
    if (buildId !== undefined) {
      registry.revoked[buildId] = registry.revoked[buildId] || now;
      if (registry.builds[buildId]) registry.builds[buildId].status = 'revoked';
    }
    if (reviewer !== undefined) {
      const who = String(reviewer).toLowerCase();
      registry.reviewers = registry.reviewers.filter((r) => r !== who);
      for (const build of Object.values(registry.builds)) build.reviewers = build.reviewers.filter((r) => r !== who);
    }
    return registry;
  });
}
