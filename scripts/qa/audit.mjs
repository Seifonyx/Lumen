// Private iPhone QA: what a synthetic review build may and may not contain. Used by scripts/qa/build.mjs
// and tests/security/private-qa-isolation.mjs. Pure checks; no network, no publication.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { MIME } from '../../server/private-qa/paths.mjs';

/** Module IDs that must never be in the QA graph (Firebase, sync, service worker, proof/test/server code). */
export const QA_GRAPH_FORBIDDEN = [
  /\/node_modules\/(?:@firebase|firebase)\//, /\/src\/lib\/firebase\.ts(?:\?|$)/, /\/src\/lib\/sync\.ts(?:\?|$)/, /\/src\/pwa\/(?:register\.ts|sw\.js)(?:\?|$)/,
  /\/src\/firebase-config\.json(?:\?|$)/, /\/docs\/blackout\/workspace-proofs\/(?!fixture\.json(?:\?|$))/, /\/tests\//, /\/server\//,
];
/** Modules that must be in the QA graph: proof that the replacements, not the originals, were used. */
export const QA_GRAPH_REQUIRED = ['qa/iphone/adapters/firebase.ts', 'qa/iphone/adapters/firebase-sdk.ts', 'qa/iphone/adapters/sync.ts', 'qa/iphone/adapters/pwa-register.ts', 'qa/iphone/adapters/transport.ts', 'src/App.tsx', 'src/store.ts', 'src/components/Composer.tsx', 'src/components/ModelPicker.tsx', 'src/lib/routing.ts', 'src/lib/ai/providers.js'];
/** Modules that must never be in the ordinary production graph. */
export const PRODUCTION_GRAPH_FORBIDDEN = [/\/qa\/iphone\//, /\/server\/private-qa\//, /\/scripts\/qa\//, /\/vite\.qa\.config\.ts/];

export function auditGraph(ids, { forbidden, required = [], root = '' }) {
  const normal = ids.map((id) => id.replaceAll('\\', '/').replace(/^\0/, ''));
  const leaked = normal.filter((id) => forbidden.some((pattern) => pattern.test(id)));
  if (leaked.length) throw Object.assign(new Error(`Forbidden modules in graph:\n${leaked.join('\n')}`), { code: 'forbidden_module', leaked });
  const relativeIds = new Set(normal.map((id) => (root ? id.replace(`${root.replaceAll('\\', '/').replace(/\/$/, '')}/`, '') : id).split('?')[0]));
  const missing = required.filter((path) => !relativeIds.has(path));
  if (missing.length) throw Object.assign(new Error(`Required modules missing:\n${missing.join('\n')}`), { code: 'missing_module', missing });
  return true;
}

/** Text that would show Firebase, proof harnesses or service-worker installation in emitted files. */
export const OUTPUT_FORBIDDEN_TEXT = ['firebaseapp.com', 'identitytoolkit', 'firestore.googleapis.com', 'securetoken.googleapis.com', 'the-model-router', 'serviceWorker.register', '__blackoutHarness', 'preview-blackout', 'mr.blackout.ownedFixture', 'sourceMappingURL'];

/**
 * Third-party chunks allowed to contain network primitives, each with the reason it is acceptable. Any
 * other emitted file with one fails the audit. CSP `connect-src 'self'` and `worker-src 'none'` and the
 * browser request-capture tests are the further layers for these.
 */
export const NETWORK_ALLOWLIST = [
  { file: /^assets\/pdf-[\w-]+\.js$/, reason: 'pdf.js URL/range loader; Lumen passes local bytes, never a URL' },
  { file: /^assets\/pdf\.worker\.min-[\w-]+\.mjs$/, reason: 'pdf.js worker (loaded in-page; its XHR path is for URL documents only)' },
  { file: /^assets\/pptx-[\w-]+\.js$/, reason: 'PowerPoint generator image loader; only local data URLs are passed' },
  { file: /^assets\/markdown-extras-[\w-]+\.js$/, reason: 'KaTeX lexer method named fetch(); not a network call' },
  { file: /^assets\/runner-[\w-]+\.js$/, reason: 'Pyodide worker source text (importScripts) inside a string; worker creation is disabled in QA builds' },
];
const NETWORK_PRIMITIVE = /(?<![\w$.])fetch\s*\(|XMLHttpRequest|new\s+WebSocket|new\s+EventSource|sendBeacon|importScripts\s*\(|serviceWorker\s*\.\s*register/;

export function listFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]));
}

export function auditOutput(dir, { qaTransportFile } = {}) {
  const files = listFiles(dir);
  const problems = [];
  const network = [];
  for (const file of files) {
    const ext = file.slice(file.lastIndexOf('.') + 1);
    if (!MIME[ext]) problems.push(`${file}: file type not allowed in a review build`);
    if (/(^|\/)(sw\.js|manifest\.webmanifest)$|\.map$/.test(file)) problems.push(`${file}: service worker, install manifest or source map`);
    if (!/\.(?:html|m?js|css|json|svg|txt)$/.test(file)) continue;
    const text = readFileSync(join(dir, file), 'utf8');
    for (const marker of OUTPUT_FORBIDDEN_TEXT) if (text.includes(marker)) problems.push(`${file}: contains "${marker}"`);
    if (NETWORK_PRIMITIVE.test(text)) {
      const allowed = NETWORK_ALLOWLIST.find((entry) => entry.file.test(file)) || (qaTransportFile && qaTransportFile.test(file) ? { reason: 'QA transport/lease (synthetic + same-origin only)' } : null);
      if (allowed) network.push({ file, reason: allowed.reason });
      else problems.push(`${file}: network primitive outside the reviewed allowlist`);
    }
  }
  if (!files.includes('index.html')) problems.push('index.html missing');
  if (problems.length) throw Object.assign(new Error(`QA output audit failed:\n${problems.join('\n')}`), { code: 'output', problems });
  return { files, network };
}

export const relativeTo = (root, ids) => ids.map((id) => relative(root, id.replace(/^\0/, '')).replaceAll('\\', '/'));
