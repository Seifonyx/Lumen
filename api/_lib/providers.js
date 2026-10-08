// Talks to Google AI Studio (Gemini) and OpenRouter: lists models and streams replies
// as a common sequence of events: { t: 'text' | 'think' | 'sources' | 'notice' | 'error', ... }.

import { readSSE, upstreamError } from './http.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Gemini models that aren't chat models (speech, images, video, music, embeddings, agents...).
const GEMINI_SKIP = /(tts|image|imagen|embedding|aqa|veo|lyria|robotics|computer-use|transcribe|antigravity|deep-research|live|audio|nano-banana|omni)/i;

export const isGemma = (name) => /gemma/i.test(name);
// Gemini 2.5 and newer (and the "-latest" aliases) can think and use Google Search.
const geminiThinks = (name) => /^gemini-(?:[3-9]|2\.5|flash|pro)/i.test(name);

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);
export const hasOpenRouter = () => Boolean(process.env.OPENROUTER_API_KEY);

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
  const res = await fetch(`${GEMINI_BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY } });
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
  const res = await fetch(`${OPENROUTER_BASE}/models`, { headers: { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
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

const splitList = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

// Picks a sensible starting set when the user hasn't chosen models yet.
function pickDefaults(google, openrouter) {
  const fromEnv = [
    ...splitList(process.env.GEMINI_MODELS).map((n) => `gemini:${n}`),
    ...splitList(process.env.OPENROUTER_MODELS).map((n) => `openrouter:${n}`),
  ];
  if (fromEnv.length) return fromEnv;
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
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(payload),
    });

  let res = await send({ ...body, ...extras });
  // If thinking or search options are what the model refused, try once more without them.
  if (res.status === 400 && Object.keys(extras).length) {
    await res.body?.cancel();
    res = await send(body);
  }
  if (!res.ok) return { ok: false, status: res.status, message: await upstreamError(res) };
  return { ok: true, events: geminiEvents(res.body) };
}

async function* geminiEvents(body) {
  const seen = new Set();
  for await (const d of readSSE(body)) {
    if (d.error) {
      yield { t: 'error', text: d.error.message || 'Google returned an error.', status: d.error.code };
      return;
    }
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
}

async function openOpenRouter(name, messages, instructions, signal) {
  const gemma = isGemma(name);
  const chat = gemma
    ? toOpenRouter(withInstructionsInFirstUser(messages, instructions))
    : [{ role: 'system', content: instructions }, ...toOpenRouter(messages)];
  const body = { model: name, stream: true, messages: chat };
  // Free text extraction so PDFs never cost credits.
  if (messages.some((m) => (m.files || []).some((f) => f.kind === 'pdf'))) {
    body.plugins = [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }];
  }
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'x-title': 'Model Router',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, status: res.status, message: await upstreamError(res) };
  return { ok: true, events: openRouterEvents(res.body) };
}

async function* openRouterEvents(body) {
  for await (const d of readSSE(body)) {
    if (d.error) {
      yield { t: 'error', text: d.error.message || 'OpenRouter returned an error.', status: d.error.code };
      return;
    }
    const choice = d.choices?.[0];
    const delta = choice?.delta || {};
    if (delta.reasoning) yield { t: 'think', text: delta.reasoning };
    if (delta.content) yield { t: 'text', text: delta.content };
    if (choice?.finish_reason === 'length') yield { t: 'notice', text: 'The reply hit the length limit. Say "continue" for the rest.' };
  }
}

// One-shot, non-streaming completion (used for chat titles).
export async function complete({ provider, name }, prompt) {
  if (provider === 'gemini') {
    const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(name)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 256 } }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return (d.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text).join('');
  }
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    body: JSON.stringify({ model: name, max_tokens: 256, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) return null;
  const d = await res.json();
  return d.choices?.[0]?.message?.content || null;
}
