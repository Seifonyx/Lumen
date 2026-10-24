import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Run the actual presentation-state module without a browser. It depends on only
// React's store subscription hook, which is inert for these imperative API tests.
const source = readFileSync(new URL('../../src/lib/routing-center.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const scope = { exports: {}, require: (id) => {
  assert.equal(id, 'react');
  return { useSyncExternalStore: (_subscribe, snapshot) => snapshot() };
} };
runInNewContext(output, scope, { filename: 'routing-center.ts' });
const route = scope.exports;

test('Prism starts at Models; removed Overview never survives entry or restore', () => {
  assert.deepEqual(Object.keys(route.getRoutingScreen()).sort(), ['open', 'section']);
  assert.equal(route.getRoutingScreen().section, 'models');
  route.openRoutingCenter();
  assert.equal(route.getRoutingScreen().section, 'models');
  route.showRoutingSection('providers');
  route.showRoutingProvider('gemini');
  assert.equal(route.getRoutingScreen().provider, 'gemini');
  route.showRoutingSection('overview'); // A legacy navigator must not resurrect Overview.
  assert.equal(route.getRoutingScreen().section, 'models');
  assert.equal(route.getRoutingScreen().provider, null);
  route.openRoutingCenter('overview');
  assert.equal(route.getRoutingScreen().section, 'models');
  route.restoreRoutingScreen({ open: true, section: 'overview', provider: null });
  assert.equal(route.getRoutingScreen().section, 'models');
  route.restoreRoutingScreen({ open: true, section: 'diagnostics', provider: null });
  assert.equal(route.getRoutingScreen().section, 'diagnostics');
  route.restoreRoutingScreen({ open: true, section: 'obsolete-section', provider: null });
  assert.equal(route.getRoutingScreen().section, 'models');
  route.closeRoutingCenter();
  assert.equal(route.getRoutingScreen().open, false);
});
