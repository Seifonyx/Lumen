import { checkAuth, json, parseModelId, readSSE } from './_shared.js';

export const config = { runtime: 'edge' };

// Messages arrive in a provider-neutral shape:
//   { role: 'user' | 'assistant', text: string, files?: [{ kind: 'image' | 'pdf' | 'text', name, mime, data?, text? }] }
// where `data` is base64 (no data: prefix) for images and PDFs, and `text` holds extracted text.

function textFileBlock(f) {
  return `File: ${f.name}\n\`\`\`\n${f.text}\n\`\`\``;
}

function toGemini(messages) {
  return messages.map((m) => {
    const parts = [];
    for (const f of m.files || []) {
      if (f.kind === 'text') parts.push({ text: textFileBlock(f) });
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
    const content = [];
    for (const f of m.files || []) {
      if (f.kind === 'text') content.push({ type: 'text', text: textFileBlock(f) });
      else if (f.kind === 'image') content.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${f.data}` } });
      else content.push({ type: 'file', file: { filename: f.name, file_data: `data:application/pdf;base64,${f.data}` } });
    }
    content.push({ type: 'text', text: m.text || ' ' });
    return { role: 'user', content };
  });
}

async function upstreamError(res) {
  const raw = await res.text();
  try {
    const body = JSON.parse(raw);
    const msg = body.error?.message || body.error || body.message || raw;
    return typeof msg === 'string' ? msg : JSON.stringify(msg);
  } catch {
    return raw.slice(0, 500) || `HTTP ${res.status}`;
  }
}

async function callGemini(name, messages, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(name)}:streamGenerateContent?alt=sse`;
  return fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: toGemini(messages) }),
  });
}

async function callOpenRouter(name, messages, signal) {
  const hasPdf = messages.some((m) => (m.files || []).some((f) => f.kind === 'pdf'));
  const body = { model: name, stream: true, messages: toOpenRouter(messages) };
  // Use the free text-extraction engine so PDFs never cost credits.
  if (hasPdf) body.plugins = [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }];
  return fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'x-title': 'Model Router',
    },
    body: JSON.stringify(body),
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const denied = checkAuth(request);
  if (denied) return denied;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Request too large or invalid. Try a smaller file or start a new chat.' }, 400);
  }
  const model = parseModelId(payload.model);
  if (!model) return json({ error: `Unknown model: ${payload.model}` }, 400);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length === 0) return json({ error: 'No messages.' }, 400);

  const upstream =
    model.provider === 'gemini'
      ? await callGemini(model.name, messages, request.signal)
      : await callOpenRouter(model.name, messages, request.signal);

  if (!upstream.ok) {
    return json({ error: `${model.provider === 'gemini' ? 'Google' : 'OpenRouter'} (${upstream.status}): ${await upstreamError(upstream)}` }, 502);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let wroteText = false;
      let note = '';
      const write = (t) => {
        if (!t) return;
        wroteText = true;
        controller.enqueue(encoder.encode(t));
      };
      try {
        await readSSE(upstream.body, (d) => {
          if (model.provider === 'gemini') {
            if (d.promptFeedback?.blockReason) note = `Blocked by Google: ${d.promptFeedback.blockReason}`;
            const cand = d.candidates?.[0];
            for (const p of cand?.content?.parts || []) if (!p.thought) write(p.text);
            const reason = cand?.finishReason;
            if (reason && reason !== 'STOP' && reason !== 'MAX_TOKENS') note = `Stopped by Google: ${reason}`;
          } else {
            if (d.error) note = `OpenRouter: ${d.error.message || JSON.stringify(d.error)}`;
            write(d.choices?.[0]?.delta?.content);
          }
        });
        if (note) controller.enqueue(encoder.encode(`${wroteText ? '\n\n' : ''}⚠️ ${note}`));
        else if (!wroteText) controller.enqueue(encoder.encode('⚠️ The model returned an empty reply. Try again or pick another model.'));
      } catch (e) {
        if (!request.signal.aborted) controller.enqueue(encoder.encode(`\n\n⚠️ Connection error: ${e.message}`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}
