import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StreamEvent } from '../../src/lib/api';
import { comparisonStageResult, runComparisonStage, type ComparisonStagePatch } from '../../src/lib/comparison-stage';

async function* events(...items: StreamEvent[]): AsyncGenerator<StreamEvent> {
  yield* items;
}

test('terminal status preserves partial text while giving failure and stop priority', () => {
  assert.deepEqual(comparisonStageResult({ text: 'Partial', error: 'Quota exceeded' }), {
    text: 'Partial', status: 'error', error: 'Quota exceeded',
  });
  assert.deepEqual(comparisonStageResult({ text: 'Partial', stopped: true, error: 'Aborted' }), {
    text: 'Partial', status: 'stopped',
  });
  assert.equal(comparisonStageResult({ text: 'Complete' }).status, 'done');
  assert.deepEqual(comparisonStageResult({ text: '  ' }), {
    text: '  ', status: 'error', error: 'No answer was returned.',
  });
});

test('streaming keeps the first delta, transforms accumulated text and emits independent snapshots', async () => {
  const patches: ComparisonStagePatch[] = [];
  const observed: StreamEvent[] = [];
  const firstSource = { title: 'First', url: 'https://example.com/first' };
  const result = await runComparisonStage({
    events: events(
      { t: 'request', id: 'model-a' },
      { t: 'text', text: '[PRIVATE]' },
      { t: 'sources', items: [firstSource] },
      { t: 'text', text: ' answer' },
      { t: 'sources', items: [{ title: 'Second', url: 'https://example.com/second' }] },
      { t: 'usage', id: 'model-a', input: 12, output: 3 },
    ),
    signal: new AbortController().signal,
    transformText: text => text.replace('[PRIVATE]', 'Restored'),
    onEvent: event => observed.push(event),
    patch: patch => patches.push(patch),
  });
  assert.equal(patches[0].text, 'Restored');
  assert.equal(result.text, 'Restored answer');
  assert.equal(result.status, 'done');
  assert.equal(result.sources?.length, 2);
  assert.equal(patches[1].sources?.length, 1);
  firstSource.title = 'Changed after streaming';
  assert.equal(patches[1].sources?.[0].title, 'First');
  assert.equal(result.sources?.[0].title, 'First');
  assert.deepEqual(observed.map(event => event.t), ['request', 'text', 'sources', 'text', 'sources', 'usage']);
  assert.equal(patches.at(-1)?.status, 'done');
});

test('provider error after partial text remains an error even after done', async () => {
  const patches: ComparisonStagePatch[] = [];
  const result = await runComparisonStage({
    events: events({ t: 'text', text: 'Partial answer' }, { t: 'error', text: 'Provider failed' }, { t: 'done' }),
    signal: new AbortController().signal,
    patch: patch => patches.push(patch),
  });
  assert.equal(result.status, 'error');
  assert.equal(result.error, 'Provider failed');
  assert.equal(result.text, 'Partial answer');
  assert.deepEqual(patches.at(-1), result);
});

test('thrown transport errors retain partial text and sources', async () => {
  async function* failing(): AsyncGenerator<StreamEvent> {
    yield { t: 'text', text: 'Partial answer' };
    yield { t: 'sources', items: [{ title: 'Source', url: 'https://example.com' }] };
    throw new Error('Connection lost');
  }
  const result = await runComparisonStage({ events: failing(), signal: new AbortController().signal, patch: () => {} });
  assert.equal(result.status, 'error');
  assert.equal(result.error, 'Connection lost');
  assert.equal(result.text, 'Partial answer');
  assert.equal(result.sources?.length, 1);
});

test('abort preserves partial text when the iterator ends without throwing', async () => {
  const controller = new AbortController();
  async function* stopping(): AsyncGenerator<StreamEvent> {
    yield { t: 'text', text: 'Partial answer' };
    controller.abort();
  }
  const result = await runComparisonStage({ events: stopping(), signal: controller.signal, patch: () => {} });
  assert.deepEqual(result, { text: 'Partial answer', status: 'stopped' });
});

test('AbortError without a signaled controller is classified as stopped', async () => {
  async function* stopping(): AsyncGenerator<StreamEvent> {
    yield { t: 'text', text: 'Partial answer' };
    throw Object.assign(new Error('Stopped by provider'), { name: 'AbortError' });
  }
  const result = await runComparisonStage({ events: stopping(), signal: new AbortController().signal, patch: () => {} });
  assert.deepEqual(result, { text: 'Partial answer', status: 'stopped' });
});

test('abort releases a stalled iterator and ignores its eventual delta', async () => {
  const controller = new AbortController();
  const patches: ComparisonStagePatch[] = [];
  let resume!: (value: IteratorResult<StreamEvent>) => void;
  let requested!: () => void;
  const pending = new Promise<void>(resolve => { requested = resolve; });
  let calls = 0;
  let closed = false;
  const source: AsyncIterable<StreamEvent> = {
    [Symbol.asyncIterator]: () => ({
      next: () => ++calls === 1
        ? Promise.resolve({ done: false, value: { t: 'text', text: 'Partial' } } as const)
        : new Promise(resolve => { resume = resolve; requested(); }),
      return: () => { closed = true; return new Promise(() => {}); },
    }),
  };
  const running = runComparisonStage({ events: source, signal: controller.signal, patch: patch => patches.push(patch) });
  await pending;
  controller.abort();
  let timer: ReturnType<typeof setTimeout>;
  const result = await Promise.race([
    running,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Stop left the stage stalled')), 100); }),
  ]).finally(() => clearTimeout(timer));
  assert.deepEqual(result, { text: 'Partial', status: 'stopped' });
  assert.equal(closed, true);
  const count = patches.length;
  resume({ done: false, value: { t: 'text', text: ' late' } });
  await Promise.resolve();
  assert.equal(patches.length, count);
});

test('an already aborted stage never advances the source', async () => {
  const controller = new AbortController();
  controller.abort();
  let requested = false;
  async function* source(): AsyncGenerator<StreamEvent> { requested = true; yield { t: 'text', text: 'Late' }; }
  const result = await runComparisonStage({ events: source(), signal: controller.signal, patch: () => {} });
  assert.equal(result.status, 'stopped');
  assert.equal(requested, false);
});

test('invalidation suppresses event observers and terminal patches', async () => {
  let current = true;
  const patches: ComparisonStagePatch[] = [];
  const observed: StreamEvent[] = [];
  async function* source(): AsyncGenerator<StreamEvent> {
    yield { t: 'text', text: 'Current' };
    current = false;
    yield { t: 'usage', id: 'old-account', input: 10, output: 2 };
    yield { t: 'text', text: ' stale' };
  }
  const result = await runComparisonStage({
    events: source(), signal: new AbortController().signal,
    isCurrent: () => current, onEvent: event => observed.push(event), patch: patch => patches.push(patch),
  });
  assert.equal(result.text, 'Current');
  assert.deepEqual(observed.map(event => event.t), ['text']);
  assert.equal(patches.length, 1);
});

test('invalidation within an observer prevents that event from patching state', async () => {
  let current = true;
  const patches: ComparisonStagePatch[] = [];
  await runComparisonStage({
    events: events({ t: 'text', text: 'Stale' }), signal: new AbortController().signal,
    isCurrent: () => current, onEvent: () => { current = false; }, patch: patch => patches.push(patch),
  });
  assert.equal(patches.length, 0);
});

test('fallback discard clears discarded output and records the successful model', async () => {
  const result = await runComparisonStage({
    events: events(
      { t: 'model', id: 'first' }, { t: 'text', text: 'Discard this' },
      { t: 'sources', items: [{ title: 'Old', url: 'https://example.com/old' }] },
      { t: 'error', text: 'First failed' }, { t: 'discard' },
      { t: 'model', id: 'second' }, { t: 'text', text: 'Replacement' }, { t: 'done' },
    ),
    signal: new AbortController().signal, patch: () => {},
  });
  assert.deepEqual(result, { text: 'Replacement', status: 'done', model: 'second' });
});
