import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Writes dist/sw.js with this build's file list, so the app works offline and updates cleanly. */
function serviceWorker(): Plugin {
  return {
    name: 'model-router-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      // Fonts: browsers that run service workers all use .woff2, so the older formats aren't stored.
      const built = Object.keys(bundle).filter((f) => !/\.(map|ttf|woff)$/.test(f) && f !== 'index.html');
      const extras = readdirSync('public').filter((f) => /\.(png|svg|webmanifest)$/.test(f));
      extras.push(...readdirSync('public/python').filter((f) => f.endsWith('.whl')).map((f) => `python/${f}`));
      const files = ['/', ...built.map((f) => `/${f}`), ...extras.map((f) => `/${f}`)];
      const html = bundle['index.html'];
      const version = createHash('sha256')
        .update(files.join('\n'))
        .update(html && html.type === 'asset' ? String(html.source) : '')
        .digest('hex')
        .slice(0, 12);
      const source = readFileSync('src/pwa/sw.js', 'utf8').replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

/** LUMEN_CANVAS=1 builds the approved Canvas presentation: canvas-presentation.ts resolves to its "on" module.
 *  Unset or 0 leaves the ordinary build untouched (this plugin is absent), which is also the rollback build. */
function canvasPresentation(): Plugin | false {
  const flag = process.env.LUMEN_CANVAS ?? '';
  if (!['', '0', '1'].includes(flag)) throw new Error(`LUMEN_CANVAS must be 1 or 0, not "${flag}"`);
  if (flag !== '1') return false;
  const off = resolve('src/lib/canvas-presentation.ts').replaceAll('\\', '/');
  const on = resolve('src/lib/canvas-presentation.on.ts');
  return {
    name: 'lumen-canvas-presentation',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && resolved.id.split('?')[0].replaceAll('\\', '/') === off ? on : null;
    },
  };
}

export default defineConfig({
  plugins: [react(), canvasPresentation(), serviceWorker()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
