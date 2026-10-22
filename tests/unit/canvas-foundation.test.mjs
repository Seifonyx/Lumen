import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import postcss from 'postcss';

test('canonical presentation props compile without allowing credential/store/dispatch injection', () => {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tests/types/tsconfig.canvas.json'], { stdio: 'pipe' });
});

test('Canvas foundation only declares scoped custom properties and cannot load assets or change element styles', () => {
  // Missing foundation is an assertion failure, rather than an accidental parser/import error.
  let css = '';
  try { css = readFileSync('src/styles/canvas.css', 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const root = postcss.parse(css);
  let declarations = 0;
  root.walkAtRules(rule => assert.equal(rule.name, 'media', 'no import/font/network/loading rules'));
  root.walkRules(rule => assert.equal(rule.selector, '[data-lumen-canvas-foundation]', 'never style root, body or production components'));
  root.walkDecls(decl => {
    declarations++;
    assert(decl.prop.startsWith('--canvas-'), 'never redefine production tokens or element properties');
    assert(!/url\s*\(/i.test(decl.value), 'no network/font dependency');
  });
  assert(declarations > 0, 'Canvas token foundation must exist');
});
