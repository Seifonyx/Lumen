// Runs a chat turn in the browser: tries the chosen model, then the fallbacks, and yields events:
//   {t:'model', id} {t:'notice', text} {t:'think', text} {t:'text', text} {t:'sources', items} {t:'error', text} {t:'done'}

import { buildInstructions } from './instructions.js';
import { complete, hasGemini, hasOpenRouter, openStream, parseModelId } from './providers.js';

const MAX_ATTEMPTS = 4;

function describe({ status, message = '' }) {
  if (status === 429 || /quota|rate.?limit|exhausted/i.test(message)) return 'hit its usage limit';
  if (status === 401 || status === 403) return 'was refused (check the API key)';
  if (status === 404) return 'is not available';
  if (status === 400) return "couldn't handle this request";
  if (status >= 500) return 'is overloaded or down';
  return 'failed';
}

const available = (id) => {
  const m = parseModelId(id);
  return m && (m.provider === 'gemini' ? hasGemini() : hasOpenRouter()) ? m : null;
};

export async function* runChat({ model, fallbacks = [], messages, options = {} }, signal) {
  const queue = [model, ...fallbacks].filter((id, i, all) => id && all.indexOf(id) === i && available(id)).slice(0, MAX_ATTEMPTS);
  if (queue.length === 0) {
    yield { t: 'error', text: `No API key for ${model}. Add your keys in Settings → API keys.` };
    yield { t: 'done' };
    return;
  }
  const instructions = buildInstructions({ custom: options.customInstructions || '' });
  const failures = [];
  const label = (id) => id.split(':').slice(1).join(':');

  for (const id of queue) {
    if (signal.aborted) return;
    let opened;
    try {
      opened = await openStream(available(id), messages, { instructions, search: Boolean(options.search), signal });
    } catch (e) {
      if (signal.aborted) return;
      opened = { ok: false, status: 0, message: e.message };
    }
    if (!opened.ok) {
      failures.push({ id, status: opened.status, message: opened.message });
      continue;
    }

    // Announce the model only once it actually starts answering.
    let announced = false;
    const announce = function* () {
      if (announced) return;
      announced = true;
      if (failures.length) {
        const why = failures.map((f) => `${label(f.id)} ${describe(f)}`).join('; ');
        yield { t: 'notice', text: `${why} — switched to ${label(id)}.` };
      }
      yield { t: 'model', id };
      if (options.search && !/^gemini:gemini/.test(id)) {
        yield { t: 'notice', text: 'Web search only works with Gemini models, so this answer did not search the web.' };
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
        yield* announce();
        if (ev.t === 'text' || ev.t === 'think') wrote = true;
        yield ev;
      }
    } catch (e) {
      if (signal.aborted) return;
      if (!wrote) failedEarly = { id, status: 0, message: e.message };
      else yield { t: 'error', text: `Connection to the model dropped: ${e.message}` };
    }
    if (failedEarly) {
      failures.push(failedEarly);
      continue;
    }
    yield* announce();
    if (!wrote) yield { t: 'notice', text: 'The model returned an empty reply. Try again or pick another model.' };
    yield { t: 'done' };
    return;
  }

  if (!signal.aborted) {
    const detail = failures.map((f) => `• ${label(f.id)}: ${describe(f)}${f.message ? ` (${f.message})` : ''}`).join('\n');
    yield { t: 'error', text: `No model could answer.\n${detail}` };
    yield { t: 'done' };
  }
}

/** Short chat title from the first message, using a light model so it barely touches limits. */
export async function makeTitle(text, model) {
  if (!text.trim()) return null;
  const candidates = [];
  if (hasGemini()) candidates.push('gemini:gemini-flash-lite-latest', 'gemini:gemini-2.5-flash-lite');
  if (available(model)) candidates.push(model);
  const prompt = `Write a short title (2 to 6 words) for a chat that starts with the message below. Use the same language as the message. Reply with the title only, no quotes or punctuation at the end.\n\nMessage:\n${text.slice(0, 2000)}`;
  for (const id of candidates) {
    try {
      const out = await complete(parseModelId(id), prompt);
      const title = (out || '').split('\n').find((l) => l.trim())?.replace(/^["'#*\s]+|["'*.\s]+$/g, '').slice(0, 80);
      if (title) return title;
    } catch {
      // Try the next model.
    }
  }
  return null;
}
