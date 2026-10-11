import assert from 'node:assert/strict';
import { clearHealth, noteReplyLatency, replyLatency } from '../../src/lib/ai/health.js';
import { makeTitle, runChat, timeouts } from '../../src/lib/ai/chat.js';
import { setKeys, openStream } from '../../src/lib/ai/providers.js';

const A = 'gemini:gemini-2.5-flash', B = 'gemini:gemini-2.5-pro';
setKeys({ gemini: 'fixture' });
const clock = Date.now;
try {
  let now = clock(); Date.now = () => now;
  noteReplyLatency(A, 1000); assert.equal(replyLatency(A), null, 'one sample cannot change routing');
  noteReplyLatency(A, 2000); assert.equal(replyLatency(A), 1350, 'recent successes use a moving average');
  noteReplyLatency(A, NaN); noteReplyLatency(A, -1); assert.equal(replyLatency(A), 1350);
  now += 30 * 60_000 + 1; assert.equal(replyLatency(A), null, 'stale speed observations expire');
  noteReplyLatency(A, 500); noteReplyLatency(A, 500);
  setKeys({ gemini: 'new-key' }); assert.equal(replyLatency(A), null, 'key/account change discards observations');
} finally { Date.now = clock; clearHealth(); }

const saved = { ...timeouts };
Object.assign(timeouts, { firstResponseMs: 150, quickResponseMs: 25, quickAnswerMs: 55, firstAnswerMs: 200, idleMs: 250 });
const enc = new TextEncoder();
let calls = [], payloads = [], mode = 'hang';
globalThis.fetch = async (url, opts) => {
  const name = /models\/([^:]+):/.exec(String(url))[1];
  calls.push({ name, at: performance.now() }); payloads.push(JSON.parse(opts.body));
  if (name.includes('flash') && mode === 'hang') return new Promise(() => {}); // ignores abort
  const content = { candidates: [{ content: { parts: [{ text: 'Useful answer' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } };
  return new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode(`data: ${JSON.stringify(content)}\n\n`)); c.close(); } }));
};
async function turn(options) {
  calls = []; payloads = []; clearHealth();
  const events = [];
  for await (const e of runChat({ model: A, fallbacks: [B], messages: [{ role: 'user', text: 'hello' }], options }, new AbortController().signal)) events.push(e);
  assert.equal(events.filter(e => e.t === 'text').map(e => e.text).join(''), 'Useful answer');
  return events;
}
try {
  calls = [];
  const stopped = new AbortController();
  const turnBeforeFetch = runChat({ model: A, messages: [{ role: 'user', text: 'hello' }] }, stopped.signal);
  assert.equal((await turnBeforeFetch.next()).value.t, 'attempt');
  stopped.abort(); assert.equal((await turnBeforeFetch.next()).done, true);
  assert.equal(calls.length, 0, 'Stop during the connecting event must not launch a request');
  let events = await turn({ quickReply: true });
  assert.ok(calls[1].at - calls[0].at < 120, 'Auto quick fallback happens sooner');
  assert.deepEqual(events.filter(e => e.t === 'attempt').map(e => e.number), [1, 2]);
  assert.equal(payloads[0].generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(payloads[1].generationConfig.thinkingConfig.thinkingBudget, undefined, 'Pro keeps its normal thinking');
  await turn({}); assert.ok(calls[1].at - calls[0].at >= 140, 'manual/complex requests keep longer startup window');
  await turn({ quickReply: true, thinkingModels: [A] }); assert.ok(calls[1].at - calls[0].at >= 140, 'reasoning model keeps startup window');
  await turn({ quickReply: true, codeExecution: true }); assert.ok(calls[1].at - calls[0].at >= 140, 'tool request keeps startup window');
  mode = 'ok'; clearHealth();
  await turn({ quickReply: true }); assert.equal(replyLatency(A), null);
  // A second actual successful reply creates a usable latency sample.
  for await (const e of runChat({ model: A, messages: [{ role: 'user', text: 'hello' }], options: { quickReply: true } }, new AbortController().signal)) {}
  assert.ok(replyLatency(A) !== null);
  calls = []; payloads = [];
  const opened = await openStream({ provider: 'gemini', name: 'gemini-flash-latest' }, [{ role: 'user', text: 'hello' }], { instructions: '', quickReply: true, signal: new AbortController().signal });
  assert.ok(opened.ok); assert.equal(payloads[0].generationConfig.thinkingConfig.thinkingBudget, undefined, 'moving aliases keep supported defaults');
  let titleCalls = 0;
  globalThis.fetch = async () => {
    titleCalls++; setKeys({ gemini: 'different-account' });
    return new Response('{}', { status: 503 });
  };
  assert.equal(await makeTitle('Private first message', A), null);
  assert.equal(titleCalls, 1, 'background title cannot retry an old message using newly changed keys');
  console.log('PASS: adaptive samples, faster simple-chat failover, preserved reasoning/tools and safe Gemini options');
} finally { Object.assign(timeouts, saved); clearHealth(); }
