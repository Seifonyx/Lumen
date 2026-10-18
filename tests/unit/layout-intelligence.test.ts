import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankForTask, taskFromText, TASKS } from '../../src/lib/layout-builder';
import type { ModelInfo } from '../../src/types';

const model = (id: string, extra: Partial<ModelInfo> = {}): ModelInfo => ({
  id, name: id.split(':').slice(1).join(':'), label: id, provider: 'openrouter', context: 128_000,
  vision: false, pdf: false, search: false, thinking: false, ...extra,
});
const coding = TASKS.find(task => task.id === 'coding')!;

test('mixed input and research work requires every requested capability', () => {
  const task = taskFromText('Research current sources and analyze screenshots');
  const catalog = [model('openrouter:vision', { vision: true }), model('openrouter:search', { search: true }), model('openrouter:both', { vision: true, search: true })];
  assert.deepEqual(rankForTask(task, catalog).map(pick => pick.id), ['openrouter:both']);
});

test('mixed tasks retain speed penalties and explicit reasoning exclusions', () => {
  for (const description of ['Fast coding without lengthy reasoning', 'Fast coding, not reasoning']) {
    const task = taskFromText(description);
    assert.ok((task.weights.slow || 0) < 0, description);
    assert.equal(task.weights.reasoner, 0, description);
    assert.ok(!task.instructions?.includes('Think the problem through carefully'), description);
  }
});

test('negated and offline search do not create web requirements or search instructions', () => {
  for (const description of ['Analyze screenshots, not research', 'Analyze screenshots, do not use web search', 'Research supplied papers offline', 'Research sources offline, without web search']) {
    const task = taskFromText(description);
    assert.ok(!task.requiresAll?.includes('search'), description);
    assert.ok(!task.instructions?.includes('Search for current information'), description);
    assert.equal(rankForTask(task, [model('openrouter:vision', { vision: true })]).length, 1, description);
  }
});

test('image creation and explanations of search do not require those input tools', () => {
  for (const description of ['Write a React app to draw diagrams', 'Write code for image processing', 'Explain how search engines work']) {
    const task = taskFromText(description);
    assert.deepEqual(task.requiresAll, [], description);
    assert.equal(rankForTask(task, [model('openrouter:coder')]).length, 1, description);
  }
});

test('an email about software is writing, while an implementation plus email retains coding', () => {
  const email = taskFromText('Write an email about a Python bug');
  assert.equal(email.weights.coder, undefined);
  assert.ok(!email.instructions?.includes('Write correct, complete, production-quality code'));
  const mixed = taskFromText('Fix the Python bug and write an email explaining the change');
  assert.equal(mixed.weights.coder, coding.weights.coder);
});

test('formatted context minima exclude smaller and unknown-context models', () => {
  const catalog = [model('openrouter:small'), model('openrouter:unknown', { context: null }), model('openrouter:large', { context: 262_144 })];
  for (const description of ['Review code with a 200k token context', 'Review code with a 200,000 token context']) {
    const task = taskFromText(description);
    assert.equal(task.minContext, 200_000, description);
    assert.deepEqual(rankForTask(task, catalog).map(pick => pick.id), ['openrouter:large'], description);
  }
  assert.equal(taskFromText('Code with a 1 million token context').minContext, 1_000_000);
});

test('actual input sizes reserve answer space and reject unknown model capacity', () => {
  const task = { ...coding, minInputTokens: 200_000 };
  const catalog = [model('openrouter:exact', { context: 200_000 }), model('openrouter:unknown', { context: null }), model('openrouter:enough', { context: 262_144 })];
  assert.deepEqual(rankForTask(task, catalog).map(pick => pick.id), ['openrouter:enough']);
});

test('output length preferences are not interpreted as context minima', () => {
  const task = taskFromText('Write an email in at most 200 tokens');
  assert.equal(task.minContext, undefined);
  assert.equal(task.weights.longctx, TASKS.find(task => task.id === 'writing')!.weights.longctx);
});

test('available models precede higher-scoring blocked models without removing backups', () => {
  const picks = rankForTask(coding, [model('openrouter:qwen3-coder'), model('groq:tiny-8b', { provider: 'groq' })], { blocked: id => id.startsWith('openrouter') });
  assert.deepEqual(picks.map(pick => pick.id), ['groq:tiny-8b', 'openrouter:qwen3-coder']);
});

test('a known exhausted daily allowance also puts an available backup first', () => {
  const picks = rankForTask(coding, [model('openrouter:qwen3-coder'), model('groq:tiny-8b', { provider: 'groq' })], { left: id => id.startsWith('openrouter') ? 0 : null });
  assert.deepEqual(picks.map(pick => pick.id), ['groq:tiny-8b', 'openrouter:qwen3-coder']);
});

test('an explicit reasoning exclusion rejects forced-thinking models but keeps optional thinking', () => {
  const task = taskFromText('Code without lengthy reasoning');
  const picks = rankForTask(task, [model('openrouter:qwen3-coder-thinking', { thinking: true }), model('gemini:gemini-2.5-pro', { provider: 'google', thinking: true })]);
  assert.deepEqual(picks.map(pick => pick.id), ['gemini:gemini-2.5-pro']);
});

test('family hints are not presented as measured strength or a dedicated coding capability', () => {
  const picks = rankForTask(coding, [model('openrouter:gemini-9-pro')]);
  assert.ok(!picks[0].why.includes('one of the strongest models you have'));
  assert.ok(!picks[0].why.includes('built for code'));
});

test('duplicate catalog rows cannot occupy multiple layout slots', () => {
  const row = model('openrouter:coder');
  const picks = rankForTask(coding, [row, row, model('openrouter:other')]);
  assert.equal(new Set(picks.map(pick => pick.id)).size, picks.length);
});

test('every custom preference reaches saved instructions, including a long description ending', () => {
  const preference = 'Always answer in French and output code only.';
  const text = `TypeScript apps. ${'Existing project context. '.repeat(100)}${preference}`;
  const task = taskFromText(text);
  assert.equal(task.description, text);
  assert.ok(task.instructions?.includes(text));
  assert.ok(task.instructions?.includes(preference));
});
