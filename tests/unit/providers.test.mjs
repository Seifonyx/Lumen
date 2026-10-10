// Groq + Cerebras: model lists, names, streaming (inline <think> tags, usage), limits, fallback.
// (browser globals come from tests/unit/setup.mjs)
const enc = new TextEncoder();
let fails = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };
const sse = (chunks) => new Response(new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(enc.encode(`data: ${JSON.stringify(x)}\n\n`)); c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); } }));
const delta = (content, extra = {}) => ({ choices: [{ delta: { content, ...extra } }] });
const calls = [];
let behaviour = {};
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  calls.push({ url, body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.authorization });
  if (url === 'https://api.groq.com/openai/v1/models') return Response.json({ data: [
    { id: 'openai/gpt-oss-120b', context_window: 131072, active: true, created: 3 },
    { id: 'qwen/qwen3.8-27b', context_window: 131072, active: true, created: 4 },
    { id: 'whisper-large-v3', active: true }, { id: 'meta-llama/llama-guard-4-12b', active: true }, { id: 'groq/compound', active: true },
    { id: 'openai/gpt-oss-20b', context_window: 131072, active: true, created: 2 }, { id: 'old-model', active: false },
  ] });
  if (url === 'https://api.cerebras.ai/v1/models') return Response.json({ data: [{ id: 'gpt-oss-120b', created: 5 }, { id: 'qwen-3.8-27b', created: 1 }, { id: 'old-model', active: false, created: 2 }] });
  if (url.includes('generativelanguage')) {
    if (url.includes('/models?')) return Response.json({ models: [] });
    if (behaviour.gemini === '429') return new Response(JSON.stringify({ error: { code: 429, message: 'Resource exhausted per day' } }), { status: 429 });
    return sse([{ candidates: [{ content: { parts: [{ text: 'from gemini' }] }, finishReason: 'STOP' }] }]);
  }
  const body = JSON.parse(init.body);
  if (url.startsWith('https://api.groq.com')) {
    if (behaviour.groq === '429') return new Response(JSON.stringify({ error: { message: 'Rate limit reached for model `openai/gpt-oss-120b` on requests per day (RPD): Limit 1000, Used 1000', code: 'rate_limit_exceeded' } }), { status: 429, headers: { 'retry-after': '60' } });
    if (body.stream === false || !body.stream) return Response.json({ choices: [{ message: { content: '<think>hmm</think>Groq Title' } }] });
    return sse([delta('<thi'), delta('nk>Let me '), delta('think</th'), delta('ink>\n\nHello '), delta('from groq'), { choices: [{ delta: {}, finish_reason: 'stop' }], x_groq: { usage: { prompt_tokens: 12, completion_tokens: 5 } } }]);
  }
  if (url.startsWith('https://api.cerebras.ai')) {
    return sse([delta('', { reasoning: 'thinking…' }), delta('Hi from cerebras'), { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 7, completion_tokens: 3 } }]);
  }
  return new Response('?', { status: 404 });
};

const P = await import(new URL('../../src/lib/ai/providers.js', import.meta.url));
const { runChat } = await import(new URL('../../src/lib/ai/chat.js', import.meta.url));
P.setKeys({ gemini: 'g', openrouter: '', groq: 'gsk', cerebras: 'csk' });

const cat = await P.catalog();
const ids = cat.models.map((m) => m.id);
check(ids.includes('groq:openai/gpt-oss-120b') && ids.includes('cerebras:gpt-oss-120b'), 'models listed for both');
check(!ids.some((i) => /whisper|guard|compound|old-model/.test(i)), 'speech, safety, agent and retired models skipped');
const scout = cat.models.find((m) => m.id.includes('qwen3.8'));
check(scout.vision && !cat.models.find((m) => m.id === 'cerebras:gpt-oss-120b').vision && cat.models.every((m) => m.provider === 'google' || m.pdf === false), 'Llama 4 Scout reads images; no PDFs on Groq/Cerebras');
check(cat.models.find((m) => m.id === 'cerebras:gpt-oss-120b').thinking && cat.models.find((m) => m.id === 'groq:openai/gpt-oss-120b').context === 131072, 'thinking flag and context size');
check(cat.defaults.includes('groq:openai/gpt-oss-120b') && cat.defaults.includes('groq:openai/gpt-oss-20b') && cat.defaults.includes('cerebras:gpt-oss-120b'), `suggested models (${cat.defaults.filter((d) => !d.startsWith('gemini')).join(', ')})`);
check(P.prettyModelName('qwen/qwen3.8-27b') === 'Qwen3.8 27B' && P.prettyModelName('gpt-oss-120b') === 'GPT-OSS 120B' && P.prettyModelName('openai/gpt-oss-120b') === 'GPT-OSS 120B', 'readable names');
check(cat.providers.groq && cat.providers.cerebras, 'providers marked connected');

const collect = async (req) => { const ev = []; for await (const e of runChat(req, new AbortController().signal)) ev.push(e); return ev; };
const msgs = [{ role: 'user', text: 'hi' }];
let ev = await collect({ model: 'groq:openai/gpt-oss-120b', messages: msgs });
const text = ev.filter((e) => e.t === 'text').map((e) => e.text).join('');
const think = ev.filter((e) => e.t === 'think').map((e) => e.text).join('');
check(text === 'Hello from groq' && think === 'Let me think', `<think> split across chunks (text=${JSON.stringify(text)}, think=${JSON.stringify(think)})`);
check(ev.some((e) => e.t === 'usage' && e.input === 12 && e.output === 5), 'Groq usage counted');
const sent = calls.findLast((c) => c.url.startsWith('https://api.groq.com/openai/v1/chat'));
check(sent.auth === 'Bearer gsk' && sent.body.messages[0].role === 'system' && sent.body.messages[1].content === 'hi', 'request format');

ev = await collect({ model: 'cerebras:gpt-oss-120b', messages: msgs });
check(ev.filter((e) => e.t === 'text').map((e) => e.text).join('') === 'Hi from cerebras' && ev.some((e) => e.t === 'think') && ev.some((e) => e.t === 'usage' && e.input === 7), 'Cerebras reasoning + usage');

const pdf = [{ role: 'user', text: 'read this', files: [{ kind: 'pdf', name: 'labs.pdf', mime: 'application/pdf', data: 'AAAA' }, { kind: 'image', name: 'x.png', mime: 'image/png', data: 'BBBB' }] }];
await collect({ model: 'cerebras:gpt-oss-120b', messages: pdf });
const c = calls.findLast((x) => x.url.startsWith('https://api.cerebras.ai/v1/chat')).body.messages[1].content;
check(typeof c === 'string' && c.includes(`"labs.pdf" — this model can't read it`) && c.includes('"x.png"') && !c.includes('AAAA'), 'unreadable files become a note, not raw data');

behaviour = { gemini: '429' };
ev = await collect({ model: 'gemini:gemini-flash-latest', fallbacks: ['groq:openai/gpt-oss-120b'], messages: msgs });
check(ev.some((e) => e.t === 'model' && e.id === 'groq:openai/gpt-oss-120b') && ev.some((e) => e.t === 'notice' && /switched to/.test(e.text)), 'Gemini at its limit → Groq answers');
behaviour = { gemini: '429', groq: '429' };
ev = await collect({ model: 'groq:openai/gpt-oss-120b', fallbacks: ['cerebras:gpt-oss-120b'], messages: msgs });
const lim = ev.find((e) => e.t === 'limit');
check(lim && lim.id === 'groq:openai/gpt-oss-120b' && lim.scope === 'day' && ev.some((e) => e.t === 'model' && e.id === 'cerebras:gpt-oss-120b'), 'Groq daily limit recognised → Cerebras answers');

behaviour = {};
const title = await P.complete({ provider: 'groq', name: 'openai/gpt-oss-20b' }, 'title please');
check(title === 'Groq Title', 'titles: inline thinking removed');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
