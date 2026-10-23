import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
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

/** Crease identity PREVIEW for owner review: LUMEN_IDENTITY=crease (only with LUMEN_CANVAS=1) resolves
 *  src/lib/brand-identity.ts to its "on" module and swaps the Canvas icons, manifest and launch screens for the
 *  proposal's (brand/crease/). Unset leaves every build on the shipped identity; no workflow sets it. */
function identityPreview(): Plugin | false {
  const flag = process.env.LUMEN_IDENTITY ?? '';
  if (!['', 'crease'].includes(flag)) throw new Error(`LUMEN_IDENTITY must be crease or unset, not "${flag}"`);
  if (!flag) return false;
  if (process.env.LUMEN_CANVAS !== '1') throw new Error('LUMEN_IDENTITY=crease previews the Canvas presentation; set LUMEN_CANVAS=1 too');
  const off = resolve('src/lib/brand-identity.ts').replaceAll('\\', '/');
  const on = resolve('src/lib/brand-identity.on.ts');
  return {
    name: 'lumen-identity-preview',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved && resolved.id.split('?')[0].replaceAll('\\', '/') === off ? on : null;
    },
  };
}
/** Public files the Crease preview replaces: the Canvas file name → the proposal's file. */
const CREASE_PUBLIC = (file: string) => process.env.LUMEN_IDENTITY !== 'crease' ? file
  : ({ 'icon.svg': 'brand/crease/svg/app-icon-dark.svg', 'apple-touch-icon.png': 'brand/crease/png/apple-touch-icon.png', 'icon-192.png': 'brand/crease/png/icon-192.png',
    'icon-512.png': 'brand/crease/png/icon-512.png', 'icon-maskable-512.png': 'brand/crease/png/icon-maskable-512.png', 'manifest.webmanifest': 'brand/crease/manifest.webmanifest' } as Record<string, string>)[relative('public-canvas', file).replaceAll('\\', '/')]
    ?? file.replace(/^public-canvas[\\/]splash/, 'brand/crease/splash');

/** Canvas build only: replaces public files with their Canvas versions (public-canvas/: the ink mark's icons and
 *  splash screens) and restyles the legal pages in ink and Geist. Runs after serviceWorker(), so the precache list
 *  keeps one entry per public file. The ordinary build never loads this plugin. */
function canvasPublic(): Plugin | false {
  if (process.env.LUMEN_CANVAS !== '1') return false;
  const walk = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [])
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  return {
    name: 'lumen-canvas-public',
    apply: 'build',
    // The start-up frame wears the Canvas layout, so the message box appears where the real one will.
    transformIndexHtml(html) {
      return html
        // Light and Dark only: a saved True black opens as Dark.
        .replace("if (s.theme === 'black') { root.dataset.theme = 'dark'; root.dataset.appearance = 'black'; }", "if (s.theme === 'black') root.dataset.theme = 'dark';")
        .replace("black: '#000000' }[s.theme]", "black: '#0d0f12' }[s.theme]")
        .replace('<html ', '<html data-lumen-canvas data-lumen-canvas-foundation ')
        .replace('<div class="app app-skeleton"', '<div class="app app-skeleton" data-lumen-canvas-shell data-lumen-canvas-foundation')
        .replace('<div class="composer sk-composer">', '<div class="composer sk-composer" data-lumen-canvas-foundation data-lumen-canvas-composer>');
    },
    generateBundle(_options, bundle) {
      for (const file of walk('public-canvas')) {
        this.emitFile({ type: 'asset', fileName: relative('public-canvas', file).replaceAll('\\', '/'), source: readFileSync(CREASE_PUBLIC(file)) });
      }
      const font = Object.keys(bundle).find((f) => /\/geist-latin-wght-normal-[^/]+\.woff2$/.test(f));
      const style = readFileSync('src/pwa/legal-ink.css', 'utf8').replace('__GEIST__', font ? `/${font}` : '');
      for (const page of ['privacy.html', 'terms.html']) {
        const html = readFileSync(join('public', page), 'utf8').replace(/<style>[\s\S]*?<\/style>/, `<style>${style}</style>`);
        this.emitFile({ type: 'asset', fileName: page, source: html });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), canvasPresentation(), identityPreview(), serviceWorker(), canvasPublic()],
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
