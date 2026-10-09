// Talks to Google AI Studio (Gemini) and OpenRouter: lists models and streams replies
// as a common sequence of events: { t: 'text' | 'think' | 'sources' | 'notice' | 'error', ... }.

import { parseLimit, readError, readSSE, upstreamError } from './http.js';

// API keys come from the user's settings (stored in their private Firebase document).
const keys = { gemini: '', openrouter: '' };
export function setKeys(next) {
  if (next.gemini !== keys.gemini || next.openrouter !== keys.openrouter) cache = null;
  keys.gemini = (next.gemini || '').trim();
  keys.openrouter = (next.openrouter || '').trim();
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Gemini models that aren't chat models (speech, images, video, music, embeddings, agents...).
const GEMINI_SKIP = /(tts|image|imagen|embedding|aqa|veo|lyria|robotics|computer-use|transcribe|antigravity|deep-research|live|audio|nano-banana|omni)/i;

export const isGemma = (name) => /gemma/i.test(name);
// Gemini 2.5 and newer (and the "-latest" aliases) can think and use Google Search.
const geminiThinks = (name) => /^gemini-(?:[3-9]|2\.5|flash|pro)/i.test(name);

export const hasGemini = () => Boolean(keys.gemini);
export const hasOpenRouter = () => Boolean(keys.openrouter);

export function parseModelId(id) {
  const m = /^(gemini|openrouter):(.+)$/.exec(id || '');
  if (!m) return null;
  const [, provider, name] = m;
  if (provider === 'gemini' && !/^[\w.\-]+$/.test(name)) return null;
  if (provider === 'openrouter' && !/^[\w.\-\/:~]+$/.test(name)) return null;
  return { provider, name };
}

// ---------------------------------------------------------------- Catalog

function prettyGemini(m) {
  return m.displayName || m.name.replace(/^models\//, '');
}

async function geminiCatalog() {
  const res = await fetch(`${GEMINI_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': keys.gemini } });
  if (!res.ok) throw new Error(`Google: ${await upstreamError(res)}`);
  const { models = [] } = await res.json();
  return models
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => ({ ...m, short: m.name.replace(/^models\//, '') }))
    .filter((m) => !GEMINI_SKIP.test(m.short))
    .map((m) => ({
      id: `gemini:${m.short}`,
      provider: 'google',
      name: m.short,
      label: prettyGemini(m),
      context: m.inputTokenLimit || null,
      vision: true,
      pdf: !isGemma(m.short),
      thinking: geminiThinks(m.short),
      search: !isGemma(m.short) && geminiThinks(m.short),
      preview: /preview|exp/i.test(m.short),
    }));
}

async function openRouterCatalog() {
  const res = await fetch(`${OPENROUTER_BASE}/models`, { headers: { authorization: `Bearer ${keys.openrouter}` } });
  if (!res.ok) throw new Error(`OpenRouter: ${await upstreamError(res)}`);
  const { data = [] } = await res.json();
  return data
    .filter((m) => Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0)
    .filter((m) => (m.architecture?.output_modalities || ['text']).includes('text'))
    .filter((m) => !/embed|guard|moderation|tts|whisper/i.test(m.id))
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

// Picks a sensible starting set when the user hasn't chosen models yet.
function pickDefaults(google, openrouter) {
  const g = google.filter((m) => !m.preview);
  const pick = (re) => g.find((m) => re.test(m.name))?.id;
  const ids = [pick(/^gemini-flash-latest$/) || pick(/^gemini-[\d.]+-flash$/), pick(/^gemini-flash-lite-latest$/) || pick(/flash-lite$/), pick(/^gemma-.*-it$/)];
  ids.push(...openrouter.slice(0, 2).map((m) => m.id));
  return ids.filter(Boolean);
}

let cache = null;

export async function catalog() {
  if (cache && cache.expires > Date.now()) return cache.value;
  const [g, o] = await Promise.allSettled([hasGemini() ? geminiCatalog() : [], hasOpenRouter() ? openRouterCatalog() : []]);
  const google = g.status === 'fulfilled' ? g.value : [];
  const openrouter = o.status === 'fulfilled' ? o.value : [];
  const errors = [g, o].filter((r) => r.status === 'rejected').map((r) => r.reason.message);
  const value = {
    providers: { google: hasGemini(), openrouter: hasOpenRouter() },
    models: [...google, ...openrouter],
    defaults: pickDefaults(google, openrouter),
    errors,
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
      if (f.kind === 'text') parts.push({ text: fileBlock(f) });
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
export async function openStream({ provider, name }, messages, { instructions, search, signal }) {
  return provider === 'gemini' ? openGemini(name, messages, instructions, search, signal) : openOpenRouter(name, messages, instructions, signal);
}

async function openGemini(name, messages, instructions, search, signal) {
  const gemma = isGemma(name);
  const body = gemma
    ? { contents: toGemini(withInstructionsInFirstUser(messages, instructions)) }
    : { systemInstruction: { parts: [{ text: instructions }] }, contents: toGemini(messages) };
  const extras = {};
  if (geminiThinks(name)) extras.generationConfig = { thinkingConfig: { includeThoughts: true } };
  if (search && !gemma && geminiThinks(name)) extras.tools = [{ google_search: {} }];

  const send = (payload) =>
    fetch(`${GEMINI_BASE}/models/${encodeURIComponent(name)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': keys.gemini },
      body: JSON.stringify(payload),
    });

  let res = await send({ ...body, ...extras });
  // If thinking or search options are what the model refused, try once more without them.
  if (res.status === 400 && Object.keys(extras).length) {
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
    if (info && d.usageMetadata) Object.assign(info, { input: d.usageMetadata.promptTokenCount || 0, output: (d.usageMetadata.candidatesTokenCount || 0) + (d.usageMetadata.thoughtsTokenCount || 0) });
    return (d.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text).join('');
  }
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${keys.openrouter}` },
    body: JSON.stringify({ model: name, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    if (info) Object.assign(info, { status: res.status, ...(await readError(res)) });
    return null;
  }
  const d = await res.json();
  if (info && d.usage) Object.assign(info, { input: d.usage.prompt_tokens || 0, output: d.usage.completion_tokens || 0 });
  return d.choices?.[0]?.message?.content || null;
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
