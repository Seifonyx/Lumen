import assert from 'node:assert/strict';
import { runChat, timeouts } from '../../src/lib/ai/chat.js';
import { setKeys } from '../../src/lib/ai/providers.js';
import { clearHealth, clearRecord, reliability } from '../../src/lib/ai/health.js';

const encoder = new TextEncoder();
const frame = value => `data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`;
const gemini = (text, finishReason) => ({ candidates: [{ content: { parts: text ? [{ text }] : [] }, ...(finishReason ? { finishReason } : {}) }] });
const compat = (text, finish_reason) => ({ choices: [{ delta: text ? { content: text } : {}, ...(finish_reason ? { finish_reason } : {}) }] });
const messages = [{ role: 'user', text: 'Answer the question.' }];
const originalTimeouts = { ...timeouts };
Object.assign(timeouts, { firstResponseMs: 700, idleMs: 700, firstAnswerMs: 700, totalMs: 2000 });
setKeys({ gemini: 'synthetic', groq: 'synthetic', openrouter: 'synthetic', anthropic: 'synthetic', cohere: 'synthetic', providerAccess: { anthropic: true, cohere: true } });

let calls, cancelled;
function response(chunks, { hang = false, trailing } = {}) {
  let timer;
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(frame(chunk)));
      if (trailing) timer = setTimeout(() => controller.enqueue(encoder.encode(frame(trailing))), 20);
      if (!hang && !trailing) controller.close();
    },
    cancel() { cancelled++; clearTimeout(timer); },
  }));
}
async function collect(model, primary, { fallbacks = [], abortAfter, options = {} } = {}) {
  calls = []; cancelled = 0;
  clearHealth(); clearRecord();
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    return calls.length === 1 ? primary(options) : response([compat('Backup answer', 'stop')]);
  };
  const controller = new AbortController();
  const timer = abortAfter ? setTimeout(() => controller.abort(), abortAfter) : null;
  const events = [];
  try { for await (const event of runChat({ model, fallbacks, messages, options }, controller.signal)) events.push(event); }
  finally { clearTimeout(timer); }
  return events;
}

try {
  for (const [model, delta] of [['gemini:gemini-2.5-flash', gemini], ['groq:fixture', compat], ['openrouter:fixture:free', compat]]) {
    const events = await collect(model, () => response([delta('Partial answer')]), { fallbacks: ['groq:backup'] });
    assert.equal(events.filter(event => event.t === 'text').map(event => event.text).join(''), 'Partial answer');
    assert(events.some(event => event.t === 'error'), `${model}: EOF without a terminal marker must report interruption`);
    assert.equal(calls.length, 1, 'An interrupted partial reply cannot trigger another model');
    assert.equal(events.at(-1).t, 'done');
    assert.equal(reliability(model), null, 'An interrupted attempt must not count as a successful model observation');
  }

  timeouts.totalMs=60;
  const finishedNearDeadline=await collect('groq:fixture',()=>response([compat('Finished within deadline','stop')],{hang:true}));
  assert(!finishedNearDeadline.some(event=>event.t==='error'),'usage draining after semantic completion cannot turn a finished answer into a deadline failure');
  timeouts.totalMs=2000;

  let events = await collect('groq:fixture', () => response([]), { fallbacks: ['groq:backup'] });
  assert.equal(calls.length, 2, 'EOF before visible output can use an authorized fallback');
  assert(events.some(event => event.t === 'text' && event.text === 'Backup answer'));

  events = await collect('groq:fixture', () => response([compat('Partial answer'), '{malformed']), { fallbacks: ['groq:backup'] });
  assert(events.some(event => event.t === 'error'), 'A malformed stream frame cannot silently complete a partial reply');
  assert.equal(calls.length, 1);

  const terminalCases = [
    ['gemini:gemini-2.5-flash', [gemini('Finished answer', 'STOP')]],
    ['groq:fixture', [compat('Finished answer', 'stop')]],
    ['openrouter:fixture:free', [compat('Finished answer'), '[DONE]']],
    ['anthropic:claude-fixture', [{ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Finished answer' } }, { type: 'message_stop' }]],
    ['cohere:command-fixture', [{ event_type: 'text-generation', text: 'Finished answer' }, { event_type: 'message-end' }]],
  ];
  for (const [model, chunks] of terminalCases) {
    const started = Date.now();
    events = await collect(model, () => response(chunks, { hang: true }));
    assert(!events.some(event => event.t === 'error'), `${model}: a logical finish must not become an idle timeout`);
    assert(events.some(event => event.t === 'text' && event.text === 'Finished answer'));
    assert.equal(events.at(-1).t, 'done');
    assert(Date.now() - started < 500, 'A terminal marker must close lingering IO within its bounded drain window');
    assert.equal(cancelled, 1, 'Completing the adapter must close its underlying stream');
  }

  for (const [model, delta] of [['gemini:gemini-2.5-flash', gemini], ['groq:fixture', compat], ['openrouter:fixture:free', compat]]) {
    events = await collect(model, () => response([delta('Finished answer', model.startsWith('gemini:') ? 'STOP' : 'stop'), delta('Must not append after completion')], { hang: true }));
    assert.equal(events.filter(event => event.t === 'text').map(event => event.text).join(''), 'Finished answer', 'Only usage metadata may be consumed after logical completion');
  }

  for (const [model, delta, usage] of [
    ['gemini:gemini-2.5-flash', gemini, { usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 7 } }],
    ['groq:fixture', compat, { usage: { prompt_tokens: 12, completion_tokens: 7 } }],
    ['openrouter:fixture:free', compat, { usage: { prompt_tokens: 12, completion_tokens: 7 } }],
  ]) {
    events = await collect(model, () => response([delta('Finished answer', model.startsWith('gemini:') ? 'STOP' : 'stop')], { hang: true, trailing: usage }));
    assert(events.some(event => event.t === 'usage' && event.input === 12 && event.output === 7), `${model}: a bounded drain should preserve trailing usage`);
    assert(!events.some(event => event.t === 'error'));
  }

  events = await collect('groq:fixture', () => response([compat('Finished answer', 'stop')], { hang: true }), { abortAfter: 15, fallbacks: ['groq:backup'] });
  assert(!events.some(event => event.t === 'error'), 'Cancellation during terminal draining stays quiet');
  assert.equal(calls.length, 1);
  assert.equal(cancelled, 1);

  events = await collect('groq:fixture', () => response([], { hang: true }), { abortAfter: 15, fallbacks: ['groq:backup'] });
  assert(!events.some(event => event.t === 'error'), 'Cancellation before completion stays quiet');
  assert.equal(calls.length, 1);
  assert.equal(cancelled, 1);

  const toolResult = { candidates: [{ content: { parts: [{ executableCode: { language: 'PYTHON', code: 'print(4)' } }, { codeExecutionResult: { outcome: 'OUTCOME_OK', output: '4' } }] } }] };
  events = await collect('gemini:gemini-2.5-flash', () => response([toolResult]), { fallbacks: ['gemini:gemini-2.5-pro'], options: { codeExecution: true } });
  assert(events.some(event => event.t === 'error'), 'EOF after observable tool execution must report interruption');
  assert(events.some(event => event.t === 'text' && event.text.includes('OUTCOME_OK')));
  assert.equal(calls.length, 1, 'Observable tool work cannot be replayed by fallback');

  for(const [model,frames] of [
    ['anthropic:claude-fixture',[{type:'message_start',message:{usage:{input_tokens:12,output_tokens:1}}},{type:'content_block_delta',delta:{type:'text_delta',text:'Finished answer'}},{type:'message_delta',usage:{output_tokens:5}},{type:'message_stop'}]],
    ['cohere:command-fixture',[{type:'content-delta',delta:{message:{content:{text:'Finished answer'}}}},{type:'message-end',delta:{usage:{tokens:{input_tokens:12,output_tokens:5}}}}]],
  ]) {
    events=await collect(model,()=>response(frames));
    const usage=events.filter(event=>event.t==='usage');
    assert.equal(usage.reduce((sum,event)=>sum+event.input,0),12,`${model}: native input counted once`);
    assert.equal(usage.reduce((sum,event)=>sum+event.output,0),5,`${model}: cumulative native output counted once`);
  }
} finally {
  Object.assign(timeouts, originalTimeouts);
  setKeys({});
}

console.log('PASS semantic stream completion, interrupted EOF, partial-output preservation, trailing usage and cancellation');
