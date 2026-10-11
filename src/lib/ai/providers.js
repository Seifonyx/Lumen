// Talks to Google AI Studio (Gemini), OpenRouter, Groq and Cerebras: lists models and streams replies
// as a common sequence of events: { t: 'text' | 'think' | 'sources' | 'notice' | 'error', ... }.

import { parseLimit, readError, readSSE, upstreamError } from './http.js';
import { isActiveModel, isExcludedModel, isUnavailableFailure } from './model-status.js';
import { safeVideoUri, toolBlock } from './tool-inputs.js';

// API keys come from the user's settings (stored in their private Firebase document).
const keys = { gemini: '', openrouter: '', groq: '', cerebras: '' };
export function setKeys(next) {
  const clean = Object.fromEntries(Object.keys(keys).map((k) => [k, (next[k] || '').trim()]));
  if (Object.keys(keys).some((k) => clean[k] !== keys[k])) cache = null;
  Object.assign(keys, clean);
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Groq and Cerebras speak the OpenAI format; both have free plans (no card needed).
const COMPAT = {
  groq: { base: 'https://api.groq.com/openai/v1', label: 'Groq' },
  cerebras: { base: 'https://api.cerebras.ai/v1', label: 'Cerebras' },
};
// Speech, safety classifiers and agent systems aren't chat models.
const COMPAT_SKIP = /(whisper|tts|playai|orpheus|guard|safeguard|distil|compound|embed|rerank)/i;

// Gemini models that aren't chat models (speech, images, video, music, embeddings, agents...).
const GEMINI_SKIP = /(tts|image|imagen|embedding|aqa|veo|lyria|robotics|computer-use|transcribe|antigravity|deep-research|live|audio|nano-banana|omni)/i;

export const isGemma = (name) => /gemma/i.test(name);
// Gemini 2.5 and newer (and the "-latest" aliases) can think and use Google Search.
const geminiThinks = (name) => /^gemini-(?:[3-9]|2\.5|flash|pro)/i.test(name);

export const hasGemini = () => Boolean(keys.gemini);
export const hasOpenRouter = () => Boolean(keys.openrouter);
/** Is there a key for this provider ('gemini' | 'openrouter' | 'groq' | 'cerebras')? */
export const hasKey = (provider) => Boolean(keys[provider]);

export function parseModelId(id) {
  const m = /^(gemini|openrouter|groq|cerebras):(.+)$/.exec(id || '');
  if (!m) return null;
  const [, provider, name] = m;
  if (provider === 'gemini' && !/^[\w.\-]+$/.test(name)) return null;
  if (provider !== 'gemini' && !/^[\w.\-\/:~]+$/.test(name)) return null;
  return { provider, name };
}

// ---------------------------------------------------------------- Catalog

function prettyGemini(m) {
  return m.displayName || m.name.replace(/^models\//, '');
}

async function geminiCatalog() {
  const models = [];
  let pageToken = '';
  const seen = new Set();
  do {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers: { 'x-goog-api-key': keys.gemini } });
    if (!res.ok) throw new Error(`Google: ${await upstreamError(res)}`);
    const page = await res.json();
    if (!Array.isArray(page.models)) throw new Error('Google: invalid model catalogue');
    models.push(...page.models);
    pageToken = page.nextPageToken || '';
    if (pageToken && seen.has(pageToken)) throw new Error('Google: repeated catalogue page');
    seen.add(pageToken);
  } while (pageToken);
  return models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({ ...m, short: m.name.replace(/^models\//, '') }))
    .filter((m) => !GEMINI_SKIP.test(m.short) && isActiveModel(m) && !isExcludedModel(`gemini:${m.short}`))
    .map((m) => ({
      id: `gemini:${m.short}`,
      provider: 'google',
      name: m.short,
      label: prettyGemini(m),
      context: m.inputTokenLimit || null,
      vision: !/^gemma-?(?:2|3-(?:1b|270m)(?:-|$))/i.test(m.short),
      pdf: !isGemma(m.short),
      thinking: geminiThinks(m.short),
      search: !isGemma(m.short) && geminiThinks(m.short),
      preview: /preview|exp/i.test(m.short),
    }));
}

async function openRouterCatalog() {
  const res = await fetch(`${OPENROUTER_BASE}/models`, { headers: { authorization: `Bearer ${keys.openrouter}` } });
  if (!res.ok) throw new Error(`OpenRouter: ${await upstreamError(res)}`);
  const { data } = await res.json();
  if (!Array.isArray(data)) throw new Error('OpenRouter: invalid model catalogue');
  return data
    .filter((m) => isActiveModel(m) && m.pricing?.prompt != null && m.pricing?.completion != null && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)
    .filter((m) => (m.architecture?.output_modalities || ['text']).includes('text'))
    .filter((m) => !/embed|guard|moderation|content-safety|tts|whisper/i.test(m.id))
    .map((m) => {
      const input = m.architecture?.input_modalities || ['text'];
      return {
        id: `openrouter:${m.id}`,
        provider: 'openrouter',
        name: m.id,
        label: (m.name || m.id).replace(/\s*\(free\)\s*$/i, ''),
        context: m.context_length || null,
        vision: input.includes('image'),
        pdf: true, // OpenRouter turns PDFs into text for models that can't read them
        thinking: (m.supported_parameters || []).includes('reasoning'),
        search: false,
        created: m.created || 0,
      };
    })
    .sort((a, b) => b.created - a.created);
}

/** "meta-llama/llama-4-scout-17b-16e-instruct" → "Llama 4 Scout 17B 16E Instruct" */
export function prettyModelName(id) {
  const words = id.split('/').pop().replace(/[-_]+/g, ' ').trim().split(/\s+/);
  const special = { gpt: 'GPT', oss: 'OSS', qwq: 'QwQ', glm: 'GLM', ai: 'AI', it: 'IT' };
  return words
    .map((w) => {
      const lw = w.toLowerCase();
      if (special[lw]) return special[lw];
      if (/^\d+(\.\d+)?[bkm]$/i.test(w)) return w.toUpperCase();
      if (/^\d+e$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ')
    .replace(/^GPT OSS/, 'GPT-OSS');
}

async function compatCatalog(provider) {
  const { base, label } = COMPAT[provider];
  let res;
  try {
    res = await fetch(`${base}/models`, { headers: { authorization: `Bearer ${keys[provider]}` } });
  } catch {
    throw new Error(`${label}: couldn't be reached from this browser`);
  }
  if (!res.ok) throw new Error(`${label}: ${await upstreamError(res)}`);
  const { data } = await res.json();
  if (!Array.isArray(data)) throw new Error(`${label}: invalid model catalogue`);
  return data
    .filter((m) => m.id && isActiveModel(m) && !isExcludedModel(`${provider}:${m.id}`) && !COMPAT_SKIP.test(m.id))
    .map((m) => ({
      id: `${provider}:${m.id}`,
      provider,
      name: m.id,
      label: prettyModelName(m.id),
      context: m.context_window || m.context_length || null,
      vision: provider === 'groq' && /llama-4|vision|scout|maverick|qwen3\.[68]-27b/i.test(m.id),
      pdf: false, // PDFs reach these models only as extracted text
      thinking: /gpt-oss|qwen-?3|deepseek-r1|reason|think|qwq|magistral/i.test(m.id),
      search: false,
      created: m.created || 0,
    }))
    .sort((a, b) => b.created - a.created);
}

// Picks a sensible starting set when the user hasn't chosen models yet.
function pickDefaults(google, openrouter, groq = [], cerebras = []) {
  const g = google.filter((m) => !m.preview);
  const pick = (re) => g.find((m) => re.test(m.name))?.id;
  const ids = [pick(/^gemini-flash-latest$/) || pick(/^gemini-[\d.]+-flash$/), pick(/^gemini-flash-lite-latest$/) || pick(/flash-lite$/), pick(/^gemma-.*-it$/)];
  ids.push(...openrouter.slice(0, 2).map((m) => m.id));
  ids.push(...providerDefaults(groq), ...providerDefaults(cerebras));
  return ids.filter(Boolean);
}

/** Two good starting models for Groq or Cerebras: a strong general one and a fast one. */
function providerDefaults(list) {
  const pick = (re) => list.find((m) => re.test(m.name))?.id;
  const ids = [pick(/gpt-oss-120b/) || pick(/70b|120b|235b/) || list[0]?.id, pick(/gpt-oss-20b/) || pick(/qwen.*27b/)];
  return [...new Set(ids.filter(Boolean))];
}

let cache = null;

export async function catalog({ refresh = false } = {}) {
  if (refresh) cache = null;
  if (cache && cache.expires > Date.now()) return cache.value;
  const results = await Promise.allSettled([
    hasGemini() ? geminiCatalog() : [],
    hasOpenRouter() ? openRouterCatalog() : [],
    keys.groq ? compatCatalog('groq') : [],
    keys.cerebras ? compatCatalog('cerebras') : [],
  ]);
  const [google, openrouter, groq, cerebras] = results.map((r) => (r.status === 'fulfilled' ? r.value : []));
  const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message);
  const value = {
    providers: { google: hasGemini(), openrouter: hasOpenRouter(), groq: hasKey('groq'), cerebras: hasKey('cerebras') },
    models: [...google, ...openrouter, ...groq, ...cerebras],
    defaults: pickDefaults(google, openrouter, groq, cerebras),
    errors,
    failedProviders: results.flatMap((r, i) => r.status === 'rejected' ? [['gemini', 'openrouter', 'groq', 'cerebras'][i]] : []),
  };
  if (errors.length === 0) cache = { value, expires: Date.now() + 10 * 60 * 1000 };
  return value;
}

// ---------------------------------------------------------------- Message conversion
// Messages arrive as { role, text, files: [{ kind: 'image' | 'pdf' | 'text', name, mime, data?, text? }] }.

const fileBlock = (f) => `<file name="${f.name}">\n${f.text}\n</file>`;

function toGemini(messages) {
  return messages.map((m) => {
    const parts = [];
    for (const f of m.files || []) {
      if (f.videoUri) parts.push({ fileData: { mimeType: 'video/mp4', fileUri: safeVideoUri(f.videoUri) } });
      else if (f.kind === 'text') parts.push({ text: fileBlock(f) });
      else parts.push({ inline_data: { mime_type: f.mime, data: f.data } });
    }
    if (m.text) parts.push({ text: m.text });
    if (parts.length === 0) parts.push({ text: ' ' });
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
}

function toOpenRouter(messages) {
  return messages.map((m) => {
    if (m.role === 'assistant') return { role: 'assistant', content: m.text || ' ' };
    if (!m.files?.length) return { role: 'user', content: m.text || ' ' };
    const content = [];
    for (const f of m.files) {
      if (f.kind === 'text') content.push({ type: 'text', text: fileBlock(f) });
      else if (f.kind === 'image') content.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${f.data}` } });
      else content.push({ type: 'file', file: { filename: f.name, file_data: `data:application/pdf;base64,${f.data}` } });
    }
    content.push({ type: 'text', text: m.text || ' ' });
    return { role: 'user', content };
  });
}

// Gemma models reject system instructions, so they get them inside the first user message.
function withInstructionsInFirstUser(messages, instructions) {
  const i = messages.findIndex((m) => m.role === 'user');
  if (i < 0) return messages;
  const copy = [...messages];
  copy[i] = { ...copy[i], text: `${instructions}\n\n---\n\n${copy[i].text || ''}` };
  return copy;
}

// ---------------------------------------------------------------- Streaming

// Opens a streaming request. Resolves to { ok: true, events } or { ok: false, status, message }.
export async function openStream({ provider, name }, messages, { instructions, search, requireSearch, codeExecution, signal }) {
  if (provider === 'gemini') return openGemini(name, messages, instructions, search, signal, codeExecution, requireSearch);
  if (COMPAT[provider]) return openCompat(provider, name, messages, instructions, signal);
  return openOpenRouter(name, messages, instructions, signal);
}

// Groq / Cerebras: OpenAI-style messages. They can't take PDFs, and Cerebras takes no images, so
// those become a short note (routing normally sends such messages to a model that can read them).
function toCompat(messages, vision) {
  return messages.map((m) => {
    if (m.role === 'assistant') return { role: 'assistant', content: m.text || ' ' };
    const files = m.files || [];
    if (!files.length) return { role: 'user', content: m.text || ' ' };
    const content = [];
    for (const f of files) {
      if (f.kind === 'text' || f.text) content.push({ type: 'text', text: fileBlock({ ...f, text: f.text || '' }) });
      else if (f.kind === 'image' && vision) content.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${f.data}` } });
      else content.push({ type: 'text', text: `[Attached ${f.kind === 'image' ? 'image' : 'PDF'} "${f.name}" — this model can't read it]` });
    }
    content.push({ type: 'text', text: m.text || ' ' });
    // Text-only models take plain strings.
    return { role: 'user', content: content.every((c) => c.type === 'text') ? content.map((c) => c.text).join('\n\n') : content };
  });
}

async function openCompat(provider, name, messages, instructions, signal) {
  const { base } = COMPAT[provider];
  const vision = provider === 'groq' && /llama-4|vision|scout|maverick|qwen3\.[68]-27b/i.test(name);
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${keys[provider]}` },
    body: JSON.stringify({ model: name, stream: true, messages: [{ role: 'system', content: instructions }, ...toCompat(messages, vision)] }),
  });
  if (!res.ok) return { ok: false, status: res.status, ...(await readError(res)) };
  return { ok: true, events: compatEvents(res.body) };
}

/** Splits streamed text into thinking and answer when a model writes <think>…</think> inline. */
function thinkSplitter() {
  let inThink = false;
  let buf = '';
  return (chunk, flush = false) => {
    buf += chunk;
    const out = [];
    for (;;) {
      const tag = inThink ? '</think>' : '<think>';
      const i = buf.indexOf(tag);
      if (i >= 0) {
        if (i) out.push({ t: inThink ? 'think' : 'text', text: buf.slice(0, i) });
        buf = buf.slice(i + tag.length);
        inThink = !inThink;
        if (!inThink) buf = buf.replace(/^\s+/, '');
        continue;
      }
      // Hold back what could be the start of a tag split across chunks.
      let keep = 0;
      if (!flush) for (let k = Math.min(tag.length - 1, buf.length); k > 0; k--) if (tag.startsWith(buf.slice(-k))) { keep = k; break; }
      const emit = buf.slice(0, buf.length - keep);
      if (emit) out.push({ t: inThink ? 'think' : 'text', text: emit });
      buf = buf.slice(buf.length - keep);
      return out;
    }
  };
}

async function* compatEvents(body) {
  const split = thinkSplitter();
  for await (const d of readSSE(body)) {
    if (d.error) {
      const text = d.error.message || 'The provider returned an error.';
      const code = Number(d.error.code) || (/rate|limit|quota/i.test(text) ? 429 : 500);
      yield { t: 'error', text, status: code, limit: code === 429 ? parseLimit(d.error, text) : null };
      return;
    }
    const usage = d.usage || d.x_groq?.usage;
    if (usage) yield { t: 'usage', input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 };
    const choice = d.choices?.[0];
    const delta = choice?.delta || {};
    if (delta.reasoning) yield { t: 'think', text: delta.reasoning };
    if (delta.reasoning_content) yield { t: 'think', text: delta.reasoning_content };
    if (delta.content) yield* split(delta.content);
    if (choice?.finish_reason === 'length') yield { t: 'notice', text: 'The reply hit the length limit. Say "continue" for the rest.' };
  }
  yield* split('', true);
}

async function openGemini(name, messages, instructions, search, signal, codeExecution = false, requireSearch = false) {
  const gemma = isGemma(name);
  if(requireSearch && (!search || gemma || !geminiThinks(name)))return {ok:false,status:400,message:'This model cannot search the web for this task.'};
  const body = gemma
    ? { contents: toGemini(withInstructionsInFirstUser(messages, instructions)) }
    : { systemInstruction: { parts: [{ text: instructions }] }, contents: toGemini(messages) };
  const extras = {};
  if (geminiThinks(name)) extras.generationConfig = { thinkingConfig: { includeThoughts: true } };
  if (search && !gemma && geminiThinks(name)) extras.tools = [{ google_search: {} }];
  if (codeExecution) extras.tools = [...(extras.tools || []), { codeExecution: {} }];

  const send = (payload) =>
    fetch(`${GEMINI_BASE}/models/${encodeURIComponent(name)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': keys.gemini },
      body: JSON.stringify(payload),
    });

  let res = await send({ ...body, ...extras });
  // If thinking or search options are what the model refused, try once more without them.
  if (res.status === 400 && Object.keys(extras).length && !codeExecution && !requireSearch) {
    await res.body?.cancel();
    res = await send(body);
  }
  if (!res.ok) return { ok: false, status: res.status, ...(await readError(res)) };
  return { ok: true, events: geminiEvents(res.body) };
}

async function* geminiEvents(body) {
  const seen = new Set();
  let usage = null;
  for await (const d of readSSE(body)) {
    if (d.error) {
      const text = d.error.message || 'Google returned an error.';
      yield { t: 'error', text, status: d.error.code, limit: d.error.code === 429 ? parseLimit(d.error, text) : null };
      return;
    }
    if (d.usageMetadata) usage = d.usageMetadata;
    if (d.promptFeedback?.blockReason) yield { t: 'notice', text: `Google blocked this request (${d.promptFeedback.blockReason}).` };
    const cand = d.candidates?.[0];
    for (const p of cand?.content?.parts || []) {
      if (p.executableCode?.code) yield { t: 'text', text: '\n\n**Gemini executed Python**' + toolBlock('python', p.executableCode.code) };
      if (p.codeExecutionResult) yield { t: 'text', text: `\n\n**Execution result · ${p.codeExecutionResult.outcome || 'unknown'}**` + toolBlock('text', p.codeExecutionResult.output || '(No output)') };
      if (!p.text) continue;
      yield p.thought ? { t: 'think', text: p.text } : { t: 'text', text: p.text };
    }
    const chunks = cand?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((c) => c.web).filter((w) => w?.uri && !seen.has(w.uri));
    if (sources.length) {
      sources.forEach((w) => seen.add(w.uri));
      yield { t: 'sources', items: sources.map((w) => ({ title: w.title || w.uri, url: w.uri })) };
    }
    const reason = cand?.finishReason;
    if (reason === 'MAX_TOKENS') yield { t: 'notice', text: 'The reply hit the length limit. Say "continue" for the rest.' };
    else if (reason && reason !== 'STOP') yield { t: 'notice', text: `Google stopped the reply (${reason}).` };
  }
  if (usage) yield { t: 'usage', input: usage.promptTokenCount || 0, output: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0) };
}

async function openOpenRouter(name, messages, instructions, signal) {
  const gemma = isGemma(name);
  const chat = gemma
    ? toOpenRouter(withInstructionsInFirstUser(messages, instructions))
    : [{ role: 'system', content: instructions }, ...toOpenRouter(messages)];
  const body = { model: name, stream: true, messages: chat, usage: { include: true } };
  // Free text extraction so PDFs never cost credits.
  if (messages.some((m) => (m.files || []).some((f) => f.kind === 'pdf'))) {
    body.plugins = [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }];
  }
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${keys.openrouter}`,
      'x-title': 'Model Router',
      'http-referer': location.origin,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, status: res.status, ...(await readError(res)) };
  return { ok: true, events: openRouterEvents(res.body) };
}

async function* openRouterEvents(body) {
  for await (const d of readSSE(body)) {
    if (d.error) {
      const text = d.error.message || 'OpenRouter returned an error.';
      yield { t: 'error', text, status: d.error.code, limit: d.error.code === 429 ? parseLimit(d.error, text) : null };
      return;
    }
    if (d.usage) yield { t: 'usage', input: d.usage.prompt_tokens || 0, output: d.usage.completion_tokens || 0 };
    const choice = d.choices?.[0];
    const delta = choice?.delta || {};
    if (delta.reasoning) yield { t: 'think', text: delta.reasoning };
    if (delta.content) yield { t: 'text', text: delta.content };
    if (choice?.finish_reason === 'length') yield { t: 'notice', text: 'The reply hit the length limit. Say "continue" for the rest.' };
  }
}

/** OpenRouter's daily allowance for free models: 50 requests, or 1000 once you've bought credits. */
export async function openRouterDailyLimit() {
  if (!keys.openrouter) return null;
  try {
    const res = await fetch(`${OPENROUTER_BASE}/key`, { headers: { authorization: `Bearer ${keys.openrouter}` } });
    if (!res.ok) return null;
    const { data } = await res.json();
    return data?.is_free_tier === false ? 1000 : 50;
  } catch {
    return null;
  }
}

// One-shot, non-streaming completion (chat titles, summaries of long chats).
// Returns the text, or null on failure; `info` (if given) receives { status, input, output, limit }.
export async function complete({ provider, name }, prompt, { maxTokens = 256, signal, info } = {}) {
  if (provider === 'gemini') {
    const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(name)}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': keys.gemini },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }),
    });
    if (!res.ok) {
      if (info) Object.assign(info, { status: res.status, ...(await readError(res)) });
      return null;
    }
    const d = await res.json();
    if (info) info.status = 200;
    if (info && d.usageMetadata) Object.assign(info, { input: d.usageMetadata.promptTokenCount || 0, output: (d.usageMetadata.candidatesTokenCount || 0) + (d.usageMetadata.thoughtsTokenCount || 0) });
    return (d.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text).join('');
  }
  const compat = COMPAT[provider];
  const res = await fetch(`${compat ? compat.base : OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${compat ? keys[provider] : keys.openrouter}` },
    body: JSON.stringify({ model: name, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    if (info) Object.assign(info, { status: res.status, ...(await readError(res)) });
    return null;
  }
  const d = await res.json();
  if (info) info.status = 200;
  if (info && d.usage) Object.assign(info, { input: d.usage.prompt_tokens || 0, output: d.usage.completion_tokens || 0 });
  // Some models write their thinking inline; only the answer is wanted here.
  return (d.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim() || null;
}

/** One bounded, context-free request. Only an explicit model failure can hide a model.
 * @returns {Promise<{state: string, status?: number, input?: number, output?: number, limit?: object}>}
 */
export async function probeModel(id, signal) {
  const target = parseModelId(id);
  if (!target || !hasKey(target.provider) || isExcludedModel(id)) return { state: 'unchecked' };
  const attempt = new AbortController();
  const abort = () => attempt.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, 20_000);
  const info = {};
  try {
    if (attempt.signal.aborted) return { state: 'unchecked' };
    await complete(target, 'Reply OK.', { maxTokens: 16, signal: attempt.signal, info });
    if (signal.aborted) return { state: 'unchecked' };
    return { ...info, state: info.status === 200 ? 'available' : isUnavailableFailure(info.status, info.message) ? 'unavailable' : 'unchecked' };
  } catch {
    return { state: 'unchecked' };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    attempt.abort();
  }
}

// ---------------------------------------------------------------- Key safety

/**
 * Is the Gemini key locked to this website? A request sent without the site's address must be
 * refused, while the app's normal requests still work.
 * Returns { state: 'locked' | 'open' | 'wrong-site' | 'invalid' | 'error', message? }.
 */
export async function geminiKeyLock() {
  if (!keys.gemini) return null;
  const probe = (referrerPolicy) =>
    fetch(`${GEMINI_BASE}/models?pageSize=1`, { headers: { 'x-goog-api-key': keys.gemini }, referrerPolicy, cache: 'no-store' });
  try {
    const [bare, normal] = await Promise.all([probe('no-referrer'), probe('strict-origin-when-cross-origin')]);
    const bareErr = bare.ok ? null : await readError(bare);
    const normalErr = normal.ok ? null : await readError(normal);
    if (normal.ok && bare.ok) return { state: 'open' };
    if (normal.ok && /refer/i.test(bareErr?.message || '')) return { state: 'locked' };
    if (/refer/i.test(normalErr?.message || '')) return { state: 'wrong-site', message: normalErr.message };
    if (normal.status === 400 || normal.status === 401) return { state: 'invalid', message: normalErr?.message };
    return { state: 'error', message: (normalErr || bareErr)?.message };
  } catch {
    return { state: 'error', message: "Couldn't reach Google." };
  }
}

/** OpenRouter key details: spending limit (0 = free models only), credits used, free tier. */
export async function openRouterKeyInfo() {
  if (!keys.openrouter) return null;
  try {
    const res = await fetch(`${OPENROUTER_BASE}/key`, { headers: { authorization: `Bearer ${keys.openrouter}` }, cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: (await readError(res)).message };
    const { data = {} } = await res.json();
    const limit = data.limit === undefined ? null : data.limit;
    if (limit === 0) return { state: 'capped' };
    if (limit === null) return { state: data.is_free_tier ? 'free' : 'open' };
    return { state: 'limit', limit, used: data.usage ?? 0 };
  } catch {
    return { state: 'error', message: "Couldn't reach OpenRouter." };
  }
}
