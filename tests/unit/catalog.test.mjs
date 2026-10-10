import assert from 'node:assert/strict';
import { catalog, setKeys } from '../../src/lib/ai/providers.js';
const model = (name) => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] });
let broken = false;
globalThis.fetch = async (url) => {
  if (url.includes('googleapis')) {
    if (broken) return new Response('unavailable', { status: 503 });
    return Response.json(url.includes('pageToken=next')
      ? { models: [model('gemini-flash-lite-latest'), model('gemma-3-1b-it'), model('gemma-3-27b-it')] }
      : { models: [model('gemini-flash-latest'), model('gemini-2.0-flash'), model('gemini-3-pro-preview'), model('gemini-3.1-pro-preview'), model('gemini-pro-latest')], nextPageToken: 'next' });
  }
  const free = { prompt: '0', completion: '0' };
  return Response.json({ data: [
    { id: 'vendor/current:free', pricing: free },
    { id: 'vendor/paid', pricing: { prompt: '1', completion: '1' } },
    { id: 'vendor/missing-price' },
    { id: 'vendor/disabled:free', pricing: free, disabled: true },
    { id: 'vendor/expired:free', pricing: free, expiration_date: '2025-01-01' },
    { id: 'vendor/content-safety:free', pricing: free },
  ] });
};
setKeys({ gemini: 'fixture', openrouter: 'fixture' });
let result = await catalog();
assert.deepEqual(result.models.map((m) => m.id), ['gemini:gemini-flash-latest', 'gemini:gemini-flash-lite-latest', 'gemini:gemma-3-1b-it', 'gemini:gemma-3-27b-it', 'openrouter:vendor/current:free']);
assert.equal(result.models.find(m => m.name === 'gemma-3-1b-it').vision, false);
assert.equal(result.models.find(m => m.name === 'gemma-3-27b-it').vision, true);
assert.deepEqual(result.failedProviders, []);
broken = true;
setKeys({ gemini: 'other-fixture', openrouter: 'fixture' });
result = await catalog();
assert.deepEqual(result.failedProviders, ['gemini']);
assert.equal(result.models.length, 1);
assert.equal(result.errors.length, 1);
console.log('PASS complete paginated catalogue, free-only/active filters and provider failure reporting');
