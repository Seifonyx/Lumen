import { requireAuth } from './_lib/auth.js';
import { json, readJson } from './_lib/http.js';
import { buildInstructions } from './_lib/instructions.js';
import { hasGemini, hasOpenRouter, openStream, parseModelId } from './_lib/providers.js';

export const config = { runtime: 'edge' };

const MAX_ATTEMPTS = 4;

// Streams a reply as newline-delimited JSON events:
//   {t:'model', id}            which model is answering (changes if we switch)
//   {t:'notice', text}         e.g. "X hit its limit, switched to Y"
//   {t:'think', text}          reasoning text (shown collapsed)
//   {t:'text', text}           answer text
//   {t:'sources', items}       web search sources
//   {t:'error', text}          nothing could answer
//   {t:'done'}
export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  const denied = await requireAuth(request);
  if (denied) return denied;

  const body = await readJson(request);
  if (!body) return json({ error: 'The request was too large or invalid. Try smaller files or start a new chat.' }, 400);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) return json({ error: 'No messages.' }, 400);

  const available = (id) => {
    const m = parseModelId(id);
    return m && (m.provider === 'gemini' ? hasGemini() : hasOpenRouter()) ? m : null;
  };
  const queue = [body.model, ...(Array.isArray(body.fallbacks) ? body.fallbacks : [])]
    .filter((id, i, all) => id && all.indexOf(id) === i && available(id))
    .slice(0, MAX_ATTEMPTS);
  if (queue.length === 0) return json({ error: `Model not available: ${body.model}` }, 400);

  const options = body.options || {};
  const instructions = buildInstructions({ custom: options.customInstructions || '' });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      const failures = [];
      const label = (id) => id.split(':').slice(1).join(':');

      for (const id of queue) {
        if (request.signal.aborted) break;
        let opened;
        try {
          opened = await openStream(available(id), messages, { instructions, search: Boolean(options.search), signal: request.signal });
        } catch (e) {
          if (request.signal.aborted) break;
          opened = { ok: false, status: 0, message: e.message };
        }
        if (!opened.ok) {
          failures.push({ id, status: opened.status, message: opened.message });
          continue;
        }

        // Announce the model only once it actually starts answering.
        let announced = false;
        const announce = () => {
          if (announced) return;
          announced = true;
          if (failures.length) {
            const why = failures.map((f) => `${label(f.id)} ${describe(f)}`).join('; ');
            send({ t: 'notice', text: `${why} — switched to ${label(id)}.` });
          }
          send({ t: 'model', id });
          if (options.search && !/^gemini:gemini/.test(id)) {
            send({ t: 'notice', text: 'Web search only works with Gemini models, so this answer did not search the web.' });
          }
        };

        let wrote = false;
        let failedEarly = null;
        try {
          for await (const ev of opened.events) {
            if (ev.t === 'error' && !wrote) {
              failedEarly = { id, status: ev.status, message: ev.text };
              break;
            }
            announce();
            if (ev.t === 'text' || ev.t === 'think') wrote = true;
            send(ev);
          }
        } catch (e) {
          if (request.signal.aborted) break;
          if (!wrote) failedEarly = { id, status: 0, message: e.message };
          else send({ t: 'error', text: `Connection to the model dropped: ${e.message}` });
        }
        if (failedEarly) {
          failures.push(failedEarly);
          continue;
        }
        announce();
        if (!wrote) send({ t: 'notice', text: 'The model returned an empty reply. Try again or pick another model.' });
        send({ t: 'done' });
        controller.close();
        return;
      }

      if (!request.signal.aborted) {
        const detail = failures.map((f) => `• ${label(f.id)}: ${describe(f)}${f.message ? ` (${f.message})` : ''}`).join('\n');
        send({ t: 'error', text: `No model could answer.\n${detail}` });
        send({ t: 'done' });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}

function describe({ status, message = '' }) {
  if (status === 429 || /quota|rate.?limit|exhausted/i.test(message)) return 'hit its usage limit';
  if (status === 401 || status === 403) return 'was refused (check the API key)';
  if (status === 404) return 'is not available';
  if (status === 400) return "couldn't handle this request";
  if (status >= 500) return 'is overloaded or down';
  return 'failed';
}
