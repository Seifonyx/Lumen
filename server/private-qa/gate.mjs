// Private iPhone QA gate: every request is checked, in order, before a single build byte is returned.
//   method → host → fetch metadata → identity token → live registry → reviewer → build → path →
//   manifest digest → asset digest.
// Any missing, malformed or unavailable input denies. Nothing is cached between requests: the registry
// is read for each one, so expiry and revocation apply to the next request.

import { importTrustKeys, verifyAccessJwt } from './access-jwt.mjs';
import { REGISTRY_KEY, fileKey, manifestKey, parseManifest, parseRegistry, sha256 } from './control.mjs';
import { parseBuildRequest } from './paths.mjs';

export const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "font-src 'self'", "img-src 'self' blob: data:", "media-src 'self' blob: data:",
  "connect-src 'self'", "manifest-src 'none'", "worker-src 'none'", "object-src 'none'", "frame-src 'none'", "frame-ancestors 'none'",
  "form-action 'none'", "base-uri 'none'",
].join('; ');

const BASE_HEADERS = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy': CSP,
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), display-capture=()',
};

const deny = (status, head) => new Response(head ? null : ({ 401: 'Sign in required.', 403: 'Not permitted.', 404: 'Not found.', 405: 'Method not allowed.', 410: 'This review build is no longer available.', 503: 'Review access is unavailable.' })[status] || 'Denied.', {
  status, headers: { ...BASE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', ...(status === 405 ? { Allow: 'GET, HEAD' } : {}) },
});

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The opaque, non-secret namespace for one reviewer in one build (never contains the identity). */
export async function namespaceFor(salt, buildId, email) {
  return (await sha256(new TextEncoder().encode(`lumen-qa-namespace\n${salt}\n${buildId}\n${email}`))).slice(0, 32);
}

/**
 * @param {object} options
 * @param {{get(key: string): Promise<null | {bytes: Uint8Array, etag: string}>}} options.storage
 * @param {{issuer: string, audience: string, keys: object[]}} options.trust  public RS256 JWKs
 * @param {string[]} options.hosts  exact hosts allowed to serve the gate
 * @param {() => number} [options.now]
 */
export function createGate({ storage, trust, hosts, now = () => Date.now() }) {
  if (!storage || !trust?.issuer || !trust?.audience || !Array.isArray(hosts) || !hosts.length) throw new Error('Gate configuration is incomplete.');
  const allowedHosts = new Set(hosts.map((h) => h.toLowerCase()));
  const keys = importTrustKeys(trust.keys);

  async function handle(request) {
    const head = request.method === 'HEAD';
    if (request.method !== 'GET' && !head) return deny(405, false);
    let url;
    try { url = new URL(request.url); } catch { return deny(404, head); }
    if (!allowedHosts.has(url.host.toLowerCase()) || url.username || url.password) return deny(404, head);
    // Other sites may link here, but may not load these files into their own pages.
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site' && request.headers.get('Sec-Fetch-Mode') !== 'navigate') return deny(403, head);

    const at = now();
    const identity = await verifyAccessJwt(request.headers.get('Cf-Access-Jwt-Assertion'), { keys: await keys, issuer: trust.issuer, audience: trust.audience, now: at });
    if (!identity) return deny(401, head);

    let registry;
    try {
      const object = await storage.get(REGISTRY_KEY);
      registry = object ? parseRegistry(object.bytes) : null;
    } catch { registry = null; }
    if (!registry || !registry.enabled) return deny(503, head);
    if (!registry.reviewers.includes(identity.email)) return deny(403, head);

    const rawPath = url.pathname;
    if (rawPath === '/') return list(registry, identity.email, at, head);
    const target = parseBuildRequest(rawPath);
    if (!target || url.search) return deny(404, head);
    const build = registry.builds[target.buildId];
    if (!build || !build.reviewers.includes(identity.email)) return deny(404, head);
    if (build.status !== 'active' || registry.revoked[target.buildId] || at >= build.expiresAt) return deny(410, head);

    if (target.lease) {
      const body = JSON.stringify({ buildId: target.buildId, namespace: await namespaceFor(registry.namespaceSalt, target.buildId, identity.email), expiresAt: build.expiresAt, now: at });
      return new Response(head ? null : body, { status: 200, headers: { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' } });
    }

    let manifest;
    try {
      const object = await storage.get(manifestKey(target.buildId));
      manifest = object ? await parseManifest(object.bytes, build.manifestDigest) : null;
    } catch { manifest = null; }
    if (!manifest || manifest.buildId !== target.buildId) return deny(503, head);
    const asset = manifest.assets[target.path];
    if (!asset) return deny(404, head);

    let bytes;
    try {
      const object = await storage.get(fileKey(target.buildId, target.path));
      bytes = object && object.bytes.byteLength === asset.bytes && (await sha256(object.bytes)) === asset.sha256 ? object.bytes : null;
    } catch { bytes = null; }
    if (!bytes) return deny(503, head);
    // Always the full, current body: no validators, so no unauthenticated 304 or partial reuse.
    return new Response(head ? null : bytes, { status: 200, headers: { ...BASE_HEADERS, 'Content-Type': asset.type, 'Content-Length': String(asset.bytes) } });
  }

  function list(registry, who, at, head) {
    const rows = Object.entries(registry.builds)
      .filter(([id, b]) => b.status === 'active' && !registry.revoked[id] && at < b.expiresAt && b.reviewers.includes(who))
      .sort((a, b) => b[1].activatedAt - a[1].activatedAt)
      .map(([id, b]) => `<li><a href="/b/${escape(id)}/">${escape(id.slice(0, 12))}</a> <span>build ${escape(id.slice(41))} · expires ${escape(new Date(b.expiresAt).toISOString())}</span></li>`);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lumen review builds</title></head><body><h1>Lumen review builds</h1>${rows.length ? `<ul>${rows.join('')}</ul>` : '<p>No review build is available.</p>'}<p>Synthetic review only. No live provider requests.</p></body></html>`;
    return new Response(head ? null : html, { status: 200, headers: { ...BASE_HEADERS, 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return {
    async fetch(request) {
      try { return await handle(request); } catch { return deny(503, request.method === 'HEAD'); }
    },
  };
}
