import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'rolldown';

// Run the store's actual helper caller with real selection/layout/eligibility
// logic. Isolating these closures avoids browser and Firebase initialization.
const source = readFileSync('src/store.ts', 'utf8');
const closure = name => {
  const start = source.indexOf(`  const ${name} =`);
  const end = source.indexOf('\n  };', start) + 5;
  assert(start >= 0 && end > start, `the current ${name} closure must be exercised`);
  return source.slice(start, end);
};
const entry = `
  import { AUTO } from ${JSON.stringify(resolve('src/lib/routing.ts'))};
  import { selectedModel } from ${JSON.stringify(resolve('src/lib/model-selection.ts'))};
  import { helperModels } from ${JSON.stringify(resolve('src/lib/helper-routing.ts'))};
  import { layoutModelProblem, layoutPolicy } from ${JSON.stringify(resolve('src/lib/layout-policy.ts'))};
  import { findLayout, isLayoutId } from ${JSON.stringify(resolve('src/lib/layouts.ts'))};
  import { isCoolingDown } from ${JSON.stringify(resolve('src/lib/ai/health.js'))};
  import { remaining } from ${JSON.stringify(resolve('src/lib/usage.ts'))};
  const modelInfo = (catalog, id) => catalog?.models.find(model => model.id === id);
  export function helperQueue(state, tokens = 100, outputTokens = 8192) {
    const get = () => state, usage = { blockedUntil: id => state.usage?.models[id]?.blockedUntil ?? null };
    ${closure('modelFor')}
    ${closure('summaryModels')}
    return summaryModels(tokens, outputTokens, 'Make a study deck', state.chat);
  }
`;
mkdirSync('node_modules/.cache/unit-tests', { recursive: true });
const output = 'node_modules/.cache/unit-tests/helper-layout-integration-fixture.mjs';
const fixtureId = '\0helper-layout-integration.ts';
await build({ input: fixtureId, output: { file: output, format: 'esm' }, logLevel: 'silent', plugins: [{
  name: 'isolated-helper-layout-caller',
  resolveId(id, importer) {
    if (id === fixtureId) return id;
    if (importer?.endsWith('/usage.ts') && id === './firebase') return '\0helper-layout-firebase';
    if (importer?.endsWith('/usage.ts') && id === './quota') return '\0helper-layout-quota';
  },
  load(id) {
    if (id === fixtureId) return entry;
    if (id === '\0helper-layout-firebase') return 'export const db = {};';
    if (id === '\0helper-layout-quota') return 'export const quota = {};';
  },
}] });
const { helperQueue } = await import(pathToFileURL(resolve(output)).href);

const first = 'groq:fixture-first', backup = 'groq:fixture-backup';
const excludedOutside = 'groq:fixture-excluded', readyOutside = 'groq:fixture-ready';
const ids = [first, backup, excludedOutside, readyOutside];
const rows = ids.map(id => ({
  id, name: id.slice(id.indexOf(':') + 1), label: id, provider: 'groq',
  context: 128000, vision: false, pdf: false, search: true, thinking: false,
}));
const fixed = { id: 'fixed', name: 'Fixed', icon: 'layers', description: 'Fixture', mode: 'order',
  models: [first, backup], fallback: 'enabled' };
const state = ({ layout = fixed, settings = {}, models = rows, usage = null } = {}) => ({
  settings: { enabledModels: ids, defaultModel: 'auto', layouts: [layout], autoSwitch: true,
    autoExcluded: [first, backup, excludedOutside], ...settings },
  catalog: { models, defaults: ids }, chat: { model: `layout:${layout.id}` }, usage,
});

test('switching off keeps the compatible fixed first assignment even when excluded from Auto', () => {
  assert.deepEqual(helperQueue(state({ settings: { autoSwitch: false } })), [first]);
});

test('fixed assigned backups bypass Auto exclusions while excluded outside models stay out', () => {
  const original = state();
  assert.deepEqual(helperQueue(original), [first, backup, readyOutside]);
  assert.deepEqual(original.settings.autoExcluded, [first, backup, excludedOutside], 'caller policy cannot mutate saved exclusions');
  assert.deepEqual(helperQueue(state({ layout: { ...fixed, fallback: 'layout' } })), [first, backup],
    'the explicit layout still controls whether outside backups are allowed');
});

test('dynamic layout and standalone Auto continue honoring all Auto exclusions', () => {
  assert.deepEqual(helperQueue(state({ layout: { ...fixed, mode: 'auto' } })), [readyOutside]);
  const standalone = state(); standalone.chat.model = 'auto';
  assert.deepEqual(helperQueue(standalone), [readyOutside]);
  standalone.settings.autoExcluded = ids;
  assert.deepEqual(helperQueue(standalone), [], 'all-excluded Auto cannot recover through an explicitly assigned exception');
});

test('saved hard requirements and context cannot be bypassed by a fixed assignment', () => {
  const models = rows.map(model => model.id === first ? { ...model, search: false } : model);
  const layout = { ...fixed, requirements: { capabilities: ['search'] } };
  assert.deepEqual(helperQueue(state({ layout, models, settings: { autoSwitch: false } })), [],
    'switching off cannot substitute a later model for an incompatible fixed first');
  assert.deepEqual(helperQueue(state({ layout, models })), [backup, readyOutside]);
  assert.deepEqual(helperQueue(state({ settings: { autoSwitch: false },
    models: rows.map(model => model.id === first ? { ...model, context: 4096 } : model) })), [],
    'the requested helper answer allowance must still fit');
});

test('blocked and exhausted fixed assignments remain ineligible despite the Auto-only exception', () => {
  const usage = { models: {
    [first]: { quota: 10, requests: 0, blockedUntil: Date.now() + 60000 },
    [backup]: { quota: 10, requests: 10, blockedUntil: null },
  }, openrouter: { limit: null, used: 0 } };
  assert.deepEqual(helperQueue(state({ usage })), [readyOutside]);
  assert.deepEqual(helperQueue(state({ usage, settings: { autoSwitch: false } })), []);
});
