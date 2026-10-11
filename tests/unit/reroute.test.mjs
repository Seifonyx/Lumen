// Exercises every failure type against the real chat logic with scripted provider responses.
// (browser globals come from tests/unit/setup.mjs)
const enc = new TextEncoder();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Behaviour per model name, set by each scenario.
let behaviour = {};
const calls = [];
function stream(events, { delay = 5, hangAfter = false, dropAfter = null } = {}, signal) {
  return new Response(
    new ReadableStream({
      async start(c) {
        const abort = () => c.error(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }));
        signal?.addEventListener('abort', abort, { once: true });
        let i = 0;
        for (const ev of events) {
          if (signal?.aborted) return;
          if (dropAfter !== null && i === dropAfter) {
            c.error(new TypeError('network error'));
            return;
          }
          c.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
          i++;
          await sleep(delay);
        }
        if (hangAfter) return; // never closes
        c.close();
      },
    }),
  );
}
const g = (text, thought = false) => ({ candidates: [{ content: { parts: [{ text, thought }] } }] });
const gEnd = { candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] };

globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const name = url.includes('openrouter') ? 'OR:' + JSON.parse(init.body).model : /models\/([^:]+):/.exec(url)[1];
  calls.push(name);
  const b = behaviour[name] || 'ok';
  const json = (status, body) => new Response(JSON.stringify(body), { status });
  switch (b) {
    case '429': return json(429, { error: { code: 429, message: 'Resource exhausted', details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '50' }] }] } });
    case '500': return json(500, { error: { code: 500, message: 'Internal error' } });
    case '503': return json(503, { error: { code: 503, message: 'The model is overloaded' } });
    case '404': return json(404, { error: { code: 404, message: 'models/x is not found' } });
    case '400': return json(400, { error: { code: 400, message: 'Unsupported input' } });
    case '401': return json(401, { error: { code: 401, message: 'API key not valid' } });
    case 'network': throw new TypeError('Failed to fetch');
    case 'ignore-abort': return new Promise(() => {});
    case 'think-forever': return stream(Array.from({length: 100}, () => g('still thinking', true)), {delay: 30}, init.signal);
    case 'metadata-forever': return stream(Array.from({length: 100}, () => ({usageMetadata: {promptTokenCount: 1}})), {delay: 30}, init.signal);
    case 'hang-headers': return new Promise((_, rej) => init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    case 'hang-body': return stream([], { hangAfter: true }, init.signal);
    case 'empty': return stream([gEnd], {}, init.signal);
    case 'blocked': return stream([{ promptFeedback: { blockReason: 'SAFETY' } }], {}, init.signal);
    case 'safety-stop': return stream([{ candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] }], {}, init.signal);
    case 'instream-error': return stream([{ error: { code: 429, message: 'Rate limit exceeded: free-models-per-day' } }], {}, init.signal);
    case 'think-then-error': return stream([g('Let me think…', true), { error: { code: 500, message: 'boom' } }], {}, init.signal);
    case 'think-then-hang': return stream([g('thinking…', true)], { hangAfter: true }, init.signal);
    case 'drop-mid': return stream([g('Partial answer '), g('more'), g('never')], { dropAfter: 2 }, init.signal);
    case 'leading-spaces': return stream([g('  '), g('answer'), gEnd], {}, init.signal);
    case 'slow': return stream([g('a'), g('b'), g('c'), gEnd], { delay: 300 }, init.signal);
    default:
      if (name.startsWith('OR:')) return stream([{ choices: [{ delta: { content: `answer from ${name}` } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1 } }], {}, init.signal);
      return stream([g(`answer from ${name}`), { ...gEnd, usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 } }], {}, init.signal);
  }
};

const { setKeys } = await import(new URL('../../src/lib/ai/providers.js', import.meta.url));
const { runChat, timeouts, attemptQueue } = await import(new URL('../../src/lib/ai/chat.js', import.meta.url));
const { clearHealth, isCoolingDown } = await import('../../src/lib/ai/health.js');
setKeys({ gemini: 'g', openrouter: 'o' });
timeouts.firstResponseMs = 400;
timeouts.idleMs = 600;

const A = 'gemini:model-a', B = 'gemini:model-b', C = 'openrouter:vendor/c:free';
let failures = 0;
async function scenario(name, setup, expect, { abortAfter, options = {} } = {}) {
  clearHealth();
  behaviour = setup;
  calls.length = 0;
  const ctrl = new AbortController();
  if (abortAfter) setTimeout(() => ctrl.abort(), abortAfter);
  const events = [];
  const t0 = Date.now();
  for await (const ev of runChat({ model: A, fallbacks: [B, C], messages: [{ role: 'user', text: 'hi' }], options }, ctrl.signal)) events.push(ev);
  const text = events.filter((e) => e.t === 'text').map((e) => e.text).join('');
  const model = events.filter((e) => e.t === 'model').map((e) => e.id).at(-1);
  const notices = events.filter((e) => e.t === 'notice').map((e) => e.text);
  const error = events.find((e) => e.t === 'error')?.text;
  const r = { text, model, notices, error, events, calls: [...calls], ms: Date.now() - t0 };
  const ok = expect(r);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      → model=${model} text=${JSON.stringify(text)} notices=${JSON.stringify(notices)} error=${JSON.stringify(error)} calls=${calls.join(',')}`}`);
}

await scenario('daily limit (429) → next model', { 'model-a': '429' }, (r) => r.model === C && r.text === 'answer from OR:vendor/c:free' && /hit its usage limit — switched/.test(r.notices[0]) && r.events.some((e) => e.t === 'limit' && e.scope === 'day'));
await scenario('server error (500) → next model', { 'model-a': '500' }, (r) => r.model === C && /overloaded or down/.test(r.notices[0]));
await scenario('overloaded (503) → next model', { 'model-a': '503' }, (r) => r.model === C);
await scenario('model not found (404) → next model', { 'model-a': '404' }, (r) => r.model === C && /not available/.test(r.notices[0]));
await scenario("bad request (400) → next model", { 'model-a': '400' }, (r) => r.model === C && /couldn't handle/.test(r.notices[0]));
await scenario('network failure → next model', { 'model-a': 'network' }, (r) => r.model === C && /couldn't be reached/.test(r.notices[0]));
await scenario('no response at all (hang) → times out → next model', { 'model-a': 'hang-headers' }, (r) => r.model === C && /didn't respond in time/.test(r.notices[0]) && r.ms < 2000);
await scenario('connects but sends nothing → times out → next', { 'model-a': 'hang-body' }, (r) => r.model === C && /didn't respond in time/.test(r.notices[0]));
await scenario('empty reply → next model', { 'model-a': 'empty' }, (r) => r.model === C && /empty reply/.test(r.notices[0]));
await scenario('blocked prompt, no text → next model', { 'model-a': 'blocked' }, (r) => r.model === C && /declined to answer/.test(r.notices[0]) && !r.notices.some((n) => /Google blocked/.test(n)));
await scenario('stopped for safety, no text → next model', { 'model-a': 'safety-stop' }, (r) => r.model === C && /declined to answer/.test(r.notices[0]));
await scenario('error inside the stream before text → next', { 'model-a': 'instream-error' }, (r) => r.model === C && /usage limit/.test(r.notices[0]));
await scenario('thinks then crashes → thoughts discarded → next', { 'model-a': 'think-then-error' }, (r) => r.model === C && r.events.some((e) => e.t === 'discard') && r.text === 'answer from OR:vendor/c:free');
await scenario('thinks then goes silent → timeout → next', { 'model-a': 'think-then-hang' }, (r) => r.model === C && r.events.some((e) => e.t === 'discard'));
await scenario('bad Gemini key → skips other Gemini models → OpenRouter', { 'model-a': '401', 'model-b': '401' }, (r) => r.model === C && !r.calls.includes('model-b') && /check the API key/.test(r.notices[0]));
await scenario('two failures in a row → third model', { 'model-a': '503', 'OR:vendor/c:free': 'empty' }, (r) => r.model === B && /model-a is overloaded or down; vendor\/c:free returned an empty reply — switched to model-b/.test(r.notices[0]));
await scenario('everything fails → clear error listing each', { 'model-a': '429', 'model-b': '500', 'OR:vendor/c:free': 'empty' }, (r) => !r.model && /No model could answer/.test(r.error) && /model-a: hit its usage limit/.test(r.error) && /vendor\/c:free: returned an empty reply/.test(r.error));
await scenario('drops after answering → keeps text, shows error (no duplicate answer)', { 'model-a': 'drop-mid' }, (r) => r.model === A && r.text === 'Partial answer more' && /Connection to the model dropped/.test(r.error) && !r.calls.includes('model-b'));
await scenario('slow but steady model is NOT abandoned', { 'model-a': 'slow' }, (r) => r.model === A && r.text === 'abc');
await scenario('you press stop → stops quietly, no switching', { 'model-a': 'hang-headers' }, (r) => !r.model && !r.error && r.calls.length === 1, { abortAfter: 150 });

await scenario('leading whitespace is preserved without extending response deadlines', {'model-a': 'leading-spaces'}, r => r.model === A && r.text === '  answer');
timeouts.totalMs = 180;
await scenario('partial answer has a hard duration cap and is preserved', {'model-a': 'slow'}, r => r.model === A && r.text === 'a' && !!r.error && r.calls.length === 1 && r.ms < 1000);
timeouts.totalMs = 600_000;
timeouts.firstAnswerMs = 180;
await scenario('continuous thinking cannot postpone first-answer deadline', {'model-a': 'think-forever'}, r => r.model === C && r.ms < 1500 && r.events.some(e => e.t === 'discard'));
timeouts.firstAnswerMs = 60_000;
await scenario('metadata cannot postpone real-response deadline', {'model-a': 'metadata-forever'}, r => r.model === C && r.ms < 1500);
await scenario('uncooperative fetch is bounded without relying on abort', {'model-a': 'ignore-abort'}, r => r.model === C && r.ms < 1500);
timeouts.noAnswerMs = 180;
await scenario('all hanging attempts share a no-answer budget', {'model-a': 'ignore-abort', 'model-b': 'ignore-abort', 'OR:vendor/c:free': 'ignore-abort'}, r => !!r.error && r.ms < 1000);
timeouts.noAnswerMs = 120_000;
clearHealth();
const many = ['gemini:first', ...Array.from({length: 50}, (_,i) => 'gemini:variant-'+i), 'openrouter:free', 'groq:free', 'cerebras:free'];
const providers = attemptQueue(many).slice(0,4).map(id => id.split(':')[0]);
if(new Set(providers).size !== 4) { failures++; console.log('FAIL all providers must appear before the attempt cap'); }
else console.log('PASS large catalogues reach all connected providers within four attempts');
await scenario('transient overload cools down without permanent exclusion', {'model-a': '503'}, r => r.model === C && isCoolingDown(A) && !r.events.some(e => e.t === 'unavailable'));
setKeys({gemini: 'replacement', openrouter: 'o'});
if(isCoolingDown(A)) { failures++; console.log('FAIL key change must clear health'); }
else console.log('PASS transient health clears on key/account changes');
await scenario('explicit layout priority is kept before general fallback pool', {'model-a': '503'}, r => r.model === B, {options: {preferredModels: [A,B]}});
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
