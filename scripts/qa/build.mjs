// Private iPhone QA: builds one synthetic review build from a clean, committed tree and writes its
// immutable manifest. Local only — this script never uploads, publishes or reads a credential.
//
//   node scripts/qa/build.mjs [--out DIR] [--run N] [--attempt N] [--hours H]
//
// Output: DIR/site/ (the build), DIR/manifest.json (exact bytes the gate pins), DIR/graph.json.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { makeManifest } from '../../server/private-qa/control.mjs';
import { QA_GRAPH_FORBIDDEN, QA_GRAPH_REQUIRED, auditGraph, auditOutput, listFiles, relativeTo } from './audit.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []));
const root = process.cwd();
const out = resolve(args.out || 'dist-qa');
const run = args.run ?? '0';
const attempt = args.attempt ?? '1';
const hours = Number(args.hours ?? 72);
if (!(hours > 0 && hours <= 72)) throw new Error('--hours must be between 0 and 72.');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const commit = git('rev-parse', 'HEAD');
const dirty = git('status', '--porcelain', '--untracked-files=normal') !== '';
if (dirty) {
  console.error('Refusing to build: the working tree has uncommitted changes. A review build must match one exact commit.');
  process.exit(1);
}

const sha = (...paths) => { const hash = createHash('sha256'); for (const p of paths) hash.update(readFileSync(p)); return hash.digest('hex'); };
const site = join(out, 'site');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let modules = [];
await build({
  configFile: join(root, 'vite.qa.config.ts'),
  logLevel: 'warn',
  build: { outDir: site, emptyOutDir: true },
  plugins: [{ name: 'qa-graph-observer', generateBundle() { modules = [...this.getModuleIds()]; } }],
});
auditGraph(modules, { forbidden: QA_GRAPH_FORBIDDEN, required: QA_GRAPH_REQUIRED, root });
const { network } = auditOutput(site);

const createdAt = Date.now();
const files = listFiles(site).map((path) => ({ path, bytes: new Uint8Array(readFileSync(join(site, path))) }));
const vite = JSON.parse(readFileSync('node_modules/vite/package.json', 'utf8')).version;
const { bytes, digest, manifest } = await makeManifest({
  files, commit, run, attempt, createdAt, expiresAt: createdAt + Math.round(hours * 3600_000), dirty,
  fixtureVersion: sha('qa/iphone/fixtures/canvas-fixture.json', 'qa/iphone/fixtures/profile.ts'),
  lockfileDigest: sha('package-lock.json'),
  toolchain: `node ${process.version}; vite ${vite}`,
});
writeFileSync(join(out, 'manifest.json'), bytes);
writeFileSync(join(out, 'graph.json'), JSON.stringify({ commit, modules: relativeTo(root, modules).sort(), network }, null, 2));
const total = files.reduce((n, f) => n + f.bytes.byteLength, 0);
console.log(`QA build ${manifest.buildId}\n  files ${files.length}, ${(total / 1048576).toFixed(1)} MB, manifest sha256 ${digest}\n  graph ${modules.length} modules audited; ${network.length} reviewed third-party network chunks\n  expires ${new Date(manifest.expiresAt).toISOString()} — not published anywhere`);
