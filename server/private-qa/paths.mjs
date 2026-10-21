// Private iPhone QA: build identity, path and MIME rules shared by the manifest builder and the gate.
// Everything here fails closed: an unknown shape is rejected, never normalised into something servable.

/** `<full commit sha>-<workflow run>-<attempt>`; immutable, never reused. */
export const BUILD_ID = /^[0-9a-f]{40}-[0-9]{1,20}-[0-9]{1,3}$/;
export const COMMIT = /^[0-9a-f]{40}$/;
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
export const MAX_PATH = 512;

/** Extensions a review build may contain, with the exact type served for each. */
export const MIME = Object.freeze({
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
});

/** A build-relative asset path ("index.html", "assets/app-1a2b.js"), or null when it is not acceptable. */
export function assetPath(path) {
  if (typeof path !== 'string' || !path || path.length > MAX_PATH) return null;
  const parts = path.split('/');
  if (!parts.every((part) => SEGMENT.test(part) && part !== '.' && part !== '..' && !part.includes('..'))) return null;
  return mimeOf(path) ? path : null;
}

export function mimeOf(path) {
  const dot = path.lastIndexOf('.');
  return dot > 0 ? MIME[path.slice(dot + 1)] || null : null;
}

/**
 * The asset a raw request path names inside one build, decoding nothing.
 * `/b/<id>/` and `/b/<id>/index.html` name the entry; percent-escapes, backslashes, empty or dot
 * segments and anything outside the allowed alphabet are refused rather than decoded.
 */
export function parseBuildRequest(rawPath) {
  if (typeof rawPath !== 'string' || rawPath.length > MAX_PATH + 80) return null;
  if (/[%\\\0-\x1f\x7f]/.test(rawPath)) return null;
  const match = /^\/b\/([^/]+)\/(.*)$/.exec(rawPath);
  if (!match || !BUILD_ID.test(match[1])) return null;
  const rest = match[2];
  if (rest === '') return { buildId: match[1], path: 'index.html' };
  if (rest === '__lease') return { buildId: match[1], lease: true };
  const path = assetPath(rest);
  return path ? { buildId: match[1], path } : null;
}
