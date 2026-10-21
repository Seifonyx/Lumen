// Synthetic QA build (private iPhone review). Separate from vite.config.ts: the ordinary production build
// never reads this file, and this build never emits a service worker or public assets.
//
// Build-time isolation, enforced by the `lumen-qa-isolation` plugin:
//   • src/lib/firebase.ts, src/lib/sync.ts, src/pwa/register.ts → QA adapters (same exports, no Firebase);
//   • firebase/app|auth|firestore → a stub that refuses every operation; any other Firebase package fails;
//   • every `fetch(` in application source → the synthetic transport; every `new Worker(` → a disabled error;
//   • the real Firebase, sync, service-worker and Firebase-configuration modules can never load.

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const repo = fileURLToPath(new URL('.', import.meta.url));
const at = (path: string) => resolve(repo, path).replaceAll('\\', '/');

export const QA_REPLACEMENTS: Record<string, string> = {
  [at('src/lib/firebase.ts')]: at('qa/iphone/adapters/firebase.ts'),
  [at('src/lib/sync.ts')]: at('qa/iphone/adapters/sync.ts'),
  [at('src/pwa/register.ts')]: at('qa/iphone/adapters/pwa-register.ts'),
};
const SDK_STUB = at('qa/iphone/adapters/firebase-sdk.ts');
const SDK_ENTRIES = new Set(['firebase/app', 'firebase/auth', 'firebase/firestore']);
const TRANSPORT = at('qa/iphone/adapters/transport.ts');
const WORKER_BLOCK = at('qa/iphone/adapters/worker-disabled.ts');
/** Modules that must never be part of the QA graph, whatever imports them. */
export const QA_FORBIDDEN = [
  /\/node_modules\/(?:@firebase|firebase)\//, /\/src\/lib\/firebase\.ts$/, /\/src\/lib\/sync\.ts$/, /\/src\/pwa\/(?:register\.ts|sw\.js)$/, /\/src\/firebase-config\.json$/,
  /\/docs\/blackout\/workspace-proofs\/(?!fixture\.json$)/, /\/tests\//, /\/server\//,
];
const strip = (id: string) => id.split('?')[0].replaceAll('\\', '/');

export function qaIsolation(): Plugin {
  return {
    name: 'lumen-qa-isolation',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (source === 'firebase' || source.startsWith('firebase/') || source.startsWith('@firebase/')) {
        if (SDK_ENTRIES.has(source)) return SDK_STUB;
        this.error(`QA build: unsupported Firebase import "${source}" from ${importer}`);
      }
      if (!importer || source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved) return null;
      return QA_REPLACEMENTS[strip(resolved.id)] ?? null;
    },
    load(id) {
      const path = strip(id);
      if (QA_FORBIDDEN.some((pattern) => pattern.test(path))) this.error(`QA build: forbidden module ${path}`);
      return null;
    },
    transform(code, id) {
      const path = strip(id);
      if (!path.startsWith(at('src/')) || !/\.(?:[jt]sx?|mjs)$/.test(path)) return null;
      if (/\bnew\s+(?:XMLHttpRequest|WebSocket|EventSource|SharedWorker)\b|\.sendBeacon\s*\(|serviceWorker\s*\.\s*register\s*\(/.test(code)) {
        this.error(`QA build: ${path} uses a network or service-worker primitive the synthetic transport does not cover`);
      }
      let next = code;
      const imports: string[] = [];
      if (/(?<![\w$.])fetch\s*\(/.test(next)) {
        next = next.replace(/(?<![\w$.])fetch\s*\(/g, '__qaFetch(');
        imports.push(`import { qaFetch as __qaFetch } from ${JSON.stringify(TRANSPORT)};`);
      }
      if (/\bnew\s+Worker\s*\(/.test(next)) {
        // Drop `new URL('./x.worker.ts', import.meta.url)` too, so the worker source is not emitted at all.
        next = next.replace(/\bnew\s+Worker\s*\(\s*new\s+URL\s*\(\s*(['"`])[^'"`]+\1\s*,\s*import\.meta\.url\s*\)/g, '__qaWorker(null');
        next = next.replace(/\bnew\s+Worker\s*\(/g, '__qaWorker(');
        imports.push(`import { disabledWorker as __qaWorker } from ${JSON.stringify(WORKER_BLOCK)};`);
      }
      return imports.length ? { code: `${imports.join('\n')}\n${next}`, map: null } : null;
    },
  };
}

export default defineConfig({
  root: at('qa/iphone'),
  base: './',
  publicDir: false,
  plugins: [qaIsolation(), react()],
  build: {
    outDir: process.env.QA_OUT_DIR ? resolve(process.env.QA_OUT_DIR) : at('dist-qa'),
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 0,
    // The preload polyfill would add its own fetch; Safari/Chromium support modulepreload natively.
    modulePreload: { polyfill: false },
  },
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
});
