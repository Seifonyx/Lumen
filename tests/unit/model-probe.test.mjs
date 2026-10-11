import assert from 'node:assert/strict';
import { probeModel, setKeys } from '../../src/lib/ai/providers.js';
setKeys({ gemini: 'fixture', openrouter: 'fixture', groq: 'fixture', cerebras: 'fixture' });
const original = globalThis.fetch;
try {
  for (const [status, message, state] of [
    [404, 'Model fixture is not found', 'unavailable'],
    [400, 'Model has been decommissioned', 'unavailable'],
    [403, 'API key blocked for this website', 'unchecked'],
    [401, 'Invalid API key', 'unchecked'],
    [429, 'FreeTier rate limit: 50', 'unchecked'],
    [429, 'PerModel-FreeTier, limit: 0', 'unavailable'],
    [503, 'Model overloaded', 'unchecked'],
    [400, 'Unsupported max_tokens', 'unchecked'],
  ]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message } }), { status });
    assert.equal((await probeModel('gemini:fixture', new AbortController().signal)).state, state, message);
  }
  for (const id of ['gemini:fixture', 'groq:fixture', 'cerebras:fixture', 'openrouter:fixture:free']) {
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.contents?.[0]?.parts[0]?.text || body.messages[0].content, 'Reply OK.');
      assert.equal(body.generationConfig?.maxOutputTokens || body.max_tokens, 16);
      assert.ok(options.signal);
      return new Response(JSON.stringify({ candidates: [], choices: [], usage: { prompt_tokens: 3, completion_tokens: 1 } }));
    };
    assert.equal((await probeModel(id, new AbortController().signal)).state, 'available');
  }
  globalThis.fetch = async () => { throw new TypeError('Offline'); };
  assert.equal((await probeModel('gemini:fixture', new AbortController().signal)).state, 'unchecked');
  const late = new AbortController();
  globalThis.fetch = async () => {
    late.abort();
    return new Response(JSON.stringify({ error: { message: 'Model fixture is not found' } }), { status: 404 });
  };
  assert.equal((await probeModel('gemini:fixture', late.signal)).state, 'unchecked', 'late failure after cancellation cannot hide a model');
  const cancelled = new AbortController(); cancelled.abort();
  globalThis.fetch = async () => { assert.fail('Cancelled probe must not send'); };
  assert.equal((await probeModel('gemini:fixture', cancelled.signal)).state, 'unchecked');
  assert.equal((await probeModel('gemini:gemini-3.1-pro-preview', new AbortController().signal)).state, 'unchecked');
} finally { globalThis.fetch = original; }
console.log('PASS bounded model probes, all providers, conservative failures and cancellation');
