import assert from 'node:assert/strict';
import { summarize, timeouts } from '../../src/lib/ai/chat.js';
import { setKeys } from '../../src/lib/ai/providers.js';

setKeys({ gemini: 'fixture' });
timeouts.summaryAttemptMs = 35;
timeouts.summaryTotalMs = 90;
const calls = [];
globalThis.fetch = async (url) => {
  calls.push(String(url));
  if (String(url).includes('stuck')) return new Promise(() => {}); // A transport that ignores AbortSignal.
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'A detailed summary preserving the conversation and its unfinished work.' }] } }] }));
};
const bounded = await Promise.race([
  summarize('Older conversation', ['gemini:stuck', 'gemini:working']),
  new Promise(resolve => setTimeout(() => resolve('stalled'), 250)),
]);
assert.notEqual(bounded, 'stalled', 'A stuck summary must release compaction and try a working model');
assert.equal(bounded.model, 'gemini:working');
assert.equal(calls.length, 2);
const aborter = new AbortController();
const stopped = summarize('Older conversation', ['gemini:stuck', 'gemini:working'], { signal: aborter.signal });
setTimeout(() => aborter.abort(), 5);
assert.equal(await Promise.race([stopped, new Promise(resolve => setTimeout(() => resolve('stalled'), 100))]), null, 'Stop must release compaction even if transport ignores cancellation');
console.log('PASS summary fallback and Stop settle despite an uncooperative transport');
