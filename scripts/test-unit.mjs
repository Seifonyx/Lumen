// Runs the unit tests in tests/unit. TypeScript tests are bundled first (with Vite's bundler).
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'rolldown';

const dir = 'tests/unit';
const out = 'node_modules/.cache/unit-tests';
mkdirSync(out, { recursive: true });
let failed = 0;
for (const file of readdirSync(dir).filter((f) => /\.test\.(ts|mjs)$/.test(f)).sort()) {
  let target = join(dir, file);
  if (file.endsWith('.ts')) {
    target = join(out, file.replace(/\.ts$/, '.mjs'));
    await build({ input: join(dir, file), output: { file: target, format: 'esm' }, logLevel: 'silent' });
  }
  console.log(`\n▶ ${file}`);
  const run = spawnSync(process.execPath, ['--import', './tests/unit/setup.mjs', target], { stdio: 'inherit' });
  if (run.status !== 0) failed++;
}
console.log(failed ? `\n✗ ${failed} unit test file(s) failed` : '\n✓ all unit tests passed');
process.exit(failed ? 1 : 0);
