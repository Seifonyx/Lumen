import assert from 'node:assert/strict';
import { probeModel, setKeys } from '../../src/lib/ai/providers.js';
import { checkModels, classify, settle } from '../../src/lib/ai/model-check.ts';
setKeys({ gemini: 'fixture', openrouter: 'fixture', groq: 'fixture', cerebras: 'fixture' });
const original = globalThis.fetch;
try {
  // The probe reports what happened: status, message and reply text.
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.contents?.[0]?.parts[0]?.text || body.messages[0].content, 'Reply with the single word OK.');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }], choices: [{ message: { content: 'OK' } }] }));
  };
  for (const id of ['gemini:fixture', 'groq:fixture', 'cerebras:fixture', 'openrouter:fixture:free']) {
    const r = await probeModel(id, new AbortController().signal);
    assert.equal(r.status, 200); assert.equal(r.text, 'OK');
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Model fixture is not found' } }), { status: 404 });
  assert.equal((await probeModel('gemini:fixture', new AbortController().signal)).status, 404);
  globalThis.fetch = async () => { throw new TypeError('Offline'); };
  assert.equal((await probeModel('gemini:fixture', new AbortController().signal)).status, 0);
  const cancelled = new AbortController(); cancelled.abort();
  globalThis.fetch = async () => { assert.fail('Cancelled probe must not send'); };
  assert.equal((await probeModel('gemini:fixture', cancelled.signal)).status, 0);
} finally { globalThis.fetch = original; }

// What each result means.
const o = (r) => { const c = classify(r); return 'outcome' in c ? c.outcome : 'retry'; };
for (const [r, want] of [
  [{ status: 200, text: 'OK' }, 'working'],
  [{ status: 200, text: '' }, 'retry'],
  [{ status: 0, message: 'timeout' }, 'retry'],
  [{ status: 503, message: 'overloaded' }, 'retry'],
  [{ status: 404, message: 'Model fixture is not found' }, 'broken'],
  [{ status: 404, message: 'No endpoints found matching your data policy' }, 'broken'],
  [{ status: 410, message: 'gone' }, 'broken'],
  [{ status: 400, message: 'Model has been decommissioned' }, 'broken'],
  [{ status: 400, message: 'Developer instruction is not enabled for models/gemma' }, 'broken'],
  [{ status: 422, message: 'This is not a chat model' }, 'broken'],
  [{ status: 402, message: 'Insufficient credits' }, 'broken'],
  [{ status: 400, message: 'This model requires a paid plan' }, 'broken'],
  [{ status: 403, message: 'You do not have access to this model' }, 'broken'],
  [{ status: 401, message: 'Invalid API key' }, 'key'],
  [{ status: 400, message: 'API key not valid. Please pass a valid API key.' }, 'key'],
  [{ status: 403, message: 'Forbidden' }, 'key'],
  [{ status: 429, message: 'Rate limit exceeded' }, 'busy'],
  [{ status: 429, message: 'PerModel-FreeTier, limit: 0' }, 'broken'],
]) assert.equal(o(r), want, `${r.status} ${r.message || r.text}`);
assert.equal(settle('Answered with nothing', { status: 200, text: '' }).outcome, 'broken');
assert.equal(settle('timeout', { status: 200, text: 'OK' }).outcome, 'working');
assert.equal(settle('timeout', { status: 0 }).outcome, 'broken');

// The runner: retries, key problems stop a provider early, and an unreachable provider loses nothing.
const run = async (ids, answers) => {
  const calls = [];
  const probe = async (id, _s, opts) => { calls.push([id, opts?.maxTokens]); const a = answers[id]; return typeof a === 'function' ? a(calls.filter((c) => c[0] === id).length) : a; };
  const results = await checkModels(ids, probe, new AbortController().signal, () => {}, { pause: async () => {} });
  return { results: Object.fromEntries(results.map((r) => [r.id, r.outcome])), calls };
};
let r = await run(['g:a', 'g:b', 'g:c', 'g:d'], {
  'g:a': { status: 200, text: 'OK' },
  'g:b': { status: 404, message: 'not found' },
  'g:c': (n) => (n === 1 ? { status: 200, text: '' } : { status: 200, text: 'OK' }), // thinking model needing room
  'g:d': (n) => (n === 1 ? { status: 429 } : { status: 200, text: 'OK' }), // momentary rate limit
});
assert.deepEqual(r.results, { 'g:a': 'working', 'g:b': 'broken', 'g:c': 'working', 'g:d': 'working' });
assert.ok(r.calls.some(([id, max]) => id === 'g:c' && max === 512), 'empty replies retried with more room');
r = await run(['k:a', 'k:b', 'k:c', 'k:d'], { 'k:a': { status: 401, message: 'Invalid API key' }, 'k:b': { status: 401 }, 'k:c': { status: 401 }, 'k:d': { status: 401 } });
assert.ok(Object.values(r.results).every((x) => x === 'key'));
assert.ok(r.calls.length <= 2, 'a rejected key stops checking that provider');
r = await run(['o:a', 'o:b', 'p:a', 'p:b'], { 'o:a': { status: 0 }, 'o:b': { status: 0 }, 'p:a': { status: 200, text: 'OK' }, 'p:b': { status: 0 } });
assert.equal(r.results['o:a'], 'busy', 'an unreachable provider keeps its models');
assert.equal(r.results['o:b'], 'busy');
assert.equal(r.results['p:b'], 'broken', 'a model that never answers while its provider works is removed');
console.log('PASS model check: probes, outcomes, retries, key pause and outage guard');
