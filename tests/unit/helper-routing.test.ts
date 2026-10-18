import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ModelInfo, Settings } from '../../src/types';
import { helperModels } from '../../src/lib/helper-routing';

type HelperSettings = Pick<Settings, 'enabledModels' | 'autoExcluded' | 'routingPreference' | 'autoPreferProvider'>;
const model = (id: string, extra: Partial<ModelInfo> = {}): ModelInfo => ({
  id, name: id.split(':').slice(1).join(':'), label: id, provider: 'openrouter',
  context: 128000, vision: false, pdf: false, thinking: false, search: false, ...extra,
});
const settings = (...ids: string[]): HelperSettings => ({ enabledModels: ids });
const request = { tokens: 1000, outputTokens: 512, text: 'Write a summary', blocked: () => false, left: () => null };

test('helper routing only uses enabled catalog entries, without injecting disabled Gemini models', () => {
  const enabled = model('openrouter:general');
  const disabled = model('gemini:gemini-flash-latest', { provider: 'google' });
  assert.deepEqual(helperModels([disabled, enabled], settings(enabled.id), request), [enabled.id]);
  assert.deepEqual(helperModels([disabled], settings(enabled.id), request), []);
  assert.deepEqual(helperModels([], settings(enabled.id, disabled.id), request), []);
  assert.deepEqual(helperModels([enabled], settings('auto', enabled.id, enabled.id, 'openrouter:removed'), request), [enabled.id]);
});

test('unknown context remains bounded and known context reserves the requested output', () => {
  const unknown = model('openrouter:unknown', { context: null });
  assert.deepEqual(helperModels([unknown], settings(unknown.id), { ...request, tokens: 2000 }), [unknown.id]);
  assert.deepEqual(helperModels([unknown], settings(unknown.id), { ...request, tokens: 10000 }), []);
  const bounded = model('openrouter:bounded', { context: 32000 });
  assert.deepEqual(helperModels([bounded], settings(bounded.id), { ...request, tokens: 10000, outputTokens: 20000 }), []);
  assert.deepEqual(helperModels([bounded], settings(bounded.id), { ...request, tokens: 10000, outputTokens: 2000 }), [bounded.id]);
  assert.deepEqual(helperModels([bounded], settings(bounded.id), { ...request, tokens: 29000 }), [], 'shared conservative eligibility still applies');
});

test('a verified output limit bounds the actual allowance without inventing missing limits', () => {
  const limited = model('openrouter:limited', { context: 16000, outputLimit: 1000 });
  const unverified = model('openrouter:unverified', { context: 16000, outputLimit: null });
  assert.deepEqual(helperModels([limited, unverified], settings(limited.id, unverified.id), { ...request, tokens: 5000, outputTokens: 32000 }), [limited.id]);
});

test('Auto exclusions and known exhausted or blocked capacity cannot receive helper calls', () => {
  const first = model('openrouter:first'), second = model('openrouter:second');
  const catalog = [first, second];
  const enabled = settings(first.id, second.id);
  assert.deepEqual(helperModels(catalog, { ...enabled, autoExcluded: enabled.enabledModels }, request), []);
  assert.deepEqual(helperModels(catalog, enabled, { ...request, blocked: () => true }), []);
  assert.deepEqual(helperModels(catalog, enabled, { ...request, left: () => 0 }), []);
  assert.deepEqual(helperModels(catalog, enabled, { ...request, blocked: id => id === first.id }), [second.id]);
  assert.deepEqual(helperModels(catalog, enabled, { ...request, left: id => id === first.id ? -1 : null }), [second.id]);
});

test('a compatible enabled manual preferred model stays first while Auto exclusions still constrain backups', () => {
  const preferred = model('openrouter:preferred-mini');
  const strong = model('openrouter:general-120b');
  const excluded = model('openrouter:excluded');
  const enabled = { ...settings(preferred.id, strong.id, excluded.id), autoExcluded: [preferred.id, excluded.id] };
  assert.deepEqual(helperModels([preferred, strong, excluded], enabled, { ...request, preferred: preferred.id, priority: 'quality' }), [preferred.id, strong.id]);
  assert.deepEqual(helperModels([strong, excluded], enabled, { ...request, preferred: preferred.id }), [strong.id]);
  assert.deepEqual(helperModels([preferred, strong], settings(strong.id), { ...request, preferred: preferred.id }), [strong.id]);
});

test('manual preferred never bypasses context compatibility or readiness', () => {
  const preferred = model('openrouter:preferred', { context: 4096 });
  const backup = model('openrouter:backup');
  assert.deepEqual(helperModels([preferred, backup], settings(preferred.id, backup.id), { ...request, tokens: 10000, preferred: preferred.id }), [backup.id]);
  assert.deepEqual(helperModels([preferred, backup], settings(preferred.id, backup.id), { ...request, preferred: preferred.id, blocked: id => id === preferred.id }), [backup.id]);
});

test('quality and speed follow shared routing intelligence and per-call priority overrides the saved default', () => {
  const quick = model('groq:general-mini', { provider: 'groq' });
  const strong = model('openrouter:general-120b');
  const catalog = [quick, strong];
  const enabled = settings(quick.id, strong.id);
  assert.equal(helperModels(catalog, { ...enabled, routingPreference: 'quality' }, request)[0], strong.id);
  assert.equal(helperModels(catalog, { ...enabled, routingPreference: 'speed' }, request)[0], quick.id);
  assert.equal(helperModels(catalog, { ...enabled, routingPreference: 'speed' }, { ...request, priority: 'quality' })[0], strong.id);
  assert.equal(helperModels(catalog, { ...enabled, routingPreference: 'quality' }, { ...request, text: 'Use the fastest model to summarize this text' })[0], quick.id);
});

test('reported costs use the actual output allowance and never treat unknown pricing as free', () => {
  const outputPriced = model('openrouter:output-priced', { pricing: { input: 0, output: 0.01, currency: 'USD', unit: 'token' } });
  const inputPriced = model('openrouter:input-priced', { pricing: { input: 0.001, output: 0, currency: 'USD', unit: 'token' } });
  const unknown = model('openrouter:unknown-mini');
  const catalog = [unknown, outputPriced, inputPriced];
  const enabled = { ...settings(...catalog.map(m => m.id)), routingPreference: 'cost' as const };
  assert.deepEqual(helperModels(catalog, enabled, { ...request, tokens: 10000, outputTokens: 10 }), [outputPriced.id, inputPriced.id, unknown.id]);
  assert.deepEqual(helperModels(catalog, enabled, { ...request, tokens: 10000, outputTokens: 10000 }), [inputPriced.id, outputPriced.id, unknown.id]);
  assert.equal(helperModels([{ ...outputPriced, outputLimit: 100 }, inputPriced], enabled, { ...request, tokens: 10000, outputTokens: 10000 })[0], outputPriced.id);
});

test('the preferred provider is a bounded shared tie-breaker and inputs remain unchanged', () => {
  const first = model('openrouter:general');
  const second = model('cohere:general', { provider: 'cohere' });
  const catalog = Object.freeze([Object.freeze(first), Object.freeze(second)]) as unknown as ModelInfo[];
  const enabled = settings(first.id, second.id);
  Object.freeze(enabled.enabledModels);
  assert.equal(helperModels(catalog, { ...enabled, autoPreferProvider: 'cohere' }, request)[0], second.id);
  assert.deepEqual(enabled.enabledModels, [first.id, second.id]);
});

test('invalid token budgets fail closed', () => {
  const known = model('openrouter:known');
  for (const tokens of [NaN, Infinity, -1]) assert.deepEqual(helperModels([known], settings(known.id), { ...request, tokens }), []);
  for (const outputTokens of [NaN, Infinity, -1]) assert.deepEqual(helperModels([known], settings(known.id), { ...request, outputTokens }), []);
});

test('one-shot helpers can use a known nonstreaming model', () => {
  const batch=model('openrouter:batch-only',{streaming:false});
  assert.deepEqual(helperModels([batch],settings(batch.id),request),[batch.id]);
});
