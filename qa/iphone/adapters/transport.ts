// Synthetic QA build only. The QA Vite configuration rewrites every `fetch(` call in application source
// to `qaFetch(`, so this is the build's only network path:
//   • Google model list / replies → deterministic local synthetic responses (nothing leaves the device);
//   • same-origin GET, blob: and data: → allowed (build files, local previews);
//   • everything else → refused, and the host recorded on `window.__qaBlockedHosts`.
// Prompts can steer scenarios: "[synthetic:error]", "[synthetic:quota]", "[synthetic:slow]".

import { ensureLease } from './lease';
import { nativeFetch } from './native-fetch';
const blockedHosts: string[] = [];
(globalThis as { __qaBlockedHosts?: string[] }).__qaBlockedHosts = blockedHosts;

export const SYNTHETIC_MODELS = [
  { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash (synthetic)', inputTokenLimit: 128000, outputTokenLimit: 8192, supportedGenerationMethods: ['generateContent'] },
  { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro (synthetic)', inputTokenLimit: 1048576, outputTokenLimit: 65536, supportedGenerationMethods: ['generateContent'] },
];

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const abortError = () => Object.assign(new Error('The request was stopped.'), { name: 'AbortError' });

function lastUserText(body: unknown): string {
  const contents = (body as { contents?: Array<{ role?: string; parts?: Array<{ text?: string }> }> })?.contents || [];
  const last = [...contents].reverse().find((c) => c.role === 'user');
  return (last?.parts || []).map((p) => p.text || '').join(' ').replace(/\s+/g, ' ').trim();
}

/** A deterministic answer that never echoes more than a short excerpt of the prompt. */
export function syntheticReply(prompt: string): string {
  const excerpt = prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt;
  return [
    `**Synthetic reply.** No live provider was contacted. You asked: “${excerpt || 'an empty message'}”.`,
    'This text is generated on your device so reading, scrolling, copying and Stop can be reviewed without a model.',
    '- Draft and selection should survive opening the model picker and usage.',
    '- Stop should end this reply without sending again.',
    'Context counts and limits shown in this build are estimates for review only.',
  ].join('\n\n');
}

function sse(chunks: string[], { delayMs, signal, usage }: { delayMs: number; signal?: AbortSignal | null; usage: { promptTokenCount: number; candidatesTokenCount: number } }) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let i = 0;
      const stop = () => { clearTimeout(timer); try { controller.error(abortError()); } catch { /* already closed */ } };
      if (signal?.aborted) return stop();
      signal?.addEventListener('abort', stop, { once: true });
      const next = () => {
        if (signal?.aborted) return;
        if (i < chunks.length) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: chunks[i++] }] } }] })}\n\n`));
          timer = setTimeout(next, delayMs);
          return;
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: '' }] }, finishReason: 'STOP' }], usageMetadata: usage })}\n\n`));
        controller.close();
        signal?.removeEventListener('abort', stop);
      };
      timer = setTimeout(next, delayMs);
    },
    cancel() { clearTimeout(timer); },
  });
}

async function synthetic(url: URL, init: RequestInit | undefined): Promise<Response> {
  const signal = init?.signal;
  if (signal?.aborted) throw abortError();
  const method = (init?.method || 'GET').toUpperCase();
  if (method === 'GET' && /\/v1beta\/models$/.test(url.pathname)) return json({ models: SYNTHETIC_MODELS });
  const action = /\/v1beta\/models\/([\w.-]+):(streamGenerateContent|generateContent|batchEmbedContents)$/.exec(url.pathname);
  if (!action || method !== 'POST') return json({ error: { code: 404, message: 'Not available in the synthetic review.', status: 'NOT_FOUND' } }, 404);
  if (action[2] === 'batchEmbedContents') return json({ error: { code: 503, message: 'Searchable knowledge is disabled in the synthetic review.', status: 'UNAVAILABLE' } }, 503);
  // A reply is new activity: confirm this build is still admitted before producing anything.
  if (!(await ensureLease())) return json({ error: { code: 403, message: 'This review build has expired or access was removed.', status: 'PERMISSION_DENIED' } }, 403);
  let body: unknown = null;
  try { body = JSON.parse(typeof init?.body === 'string' ? init.body : 'null'); } catch { /* treated as empty */ }
  const prompt = lastUserText(body);
  if (prompt.includes('[synthetic:quota]')) return json({ error: { code: 429, message: 'Synthetic quota reached for this review scenario. Try again in 1 minute.', status: 'RESOURCE_EXHAUSTED' } }, 429);
  if (prompt.includes('[synthetic:error]')) return json({ error: { code: 503, message: 'Synthetic provider error for this review scenario.', status: 'UNAVAILABLE' } }, 503);
  const text = syntheticReply(prompt);
  const usage = { promptTokenCount: Math.ceil(prompt.length / 4) + 40, candidatesTokenCount: Math.ceil(text.length / 4) };
  if (action[2] === 'generateContent') return json({ candidates: [{ content: { role: 'model', parts: [{ text: prompt ? 'Synthetic title' : 'Synthetic' }] }, finishReason: 'STOP' }], usageMetadata: usage });
  const words = text.split(/(?<=\s)/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 6) chunks.push(words.slice(i, i + 6).join(''));
  return new Response(sse(chunks, { delayMs: prompt.includes('[synthetic:slow]') ? 600 : 90, signal, usage }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

export async function qaFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // A Request object carries its own method/body/signal: fold them into init so nothing is ignored.
  if (input instanceof Request && !init) init = { method: input.method, body: ['GET', 'HEAD'].includes(input.method) ? undefined : await input.clone().text(), signal: input.signal, headers: input.headers };
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let url: URL;
  try { url = new URL(raw, document.baseURI); } catch { throw new TypeError('Invalid request address.'); }
  if (url.protocol === 'blob:' || url.protocol === 'data:') return nativeFetch(input, init);
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (url.origin === location.origin && method === 'GET') return nativeFetch(input, { ...init, credentials: 'same-origin', redirect: 'error' });
  if (url.protocol === 'https:' && url.hostname === 'generativelanguage.googleapis.com') return synthetic(url, init);
  blockedHosts.push(url.hostname || url.protocol);
  throw new TypeError(`Network access to ${url.hostname || url.protocol} is disabled in this synthetic review build.`);
}
