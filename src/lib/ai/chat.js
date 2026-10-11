// Runs a chat turn in the browser: tries the chosen model, then the fallbacks, and yields events:
//   {t:'model', id} {t:'notice', text} {t:'think', text} {t:'text', text} {t:'sources', items} {t:'error', text} {t:'done'}
// and, for the usage meter: {t:'request', id} {t:'usage', id, input, output} {t:'limit', id, scope, quota?, resetAt?, retryAfterSec?}

import { buildInstructions } from './instructions.js';
import { complete, hasGemini, hasKey, openStream, parseModelId } from './providers.js';
import { isUnavailableFailure } from './model-status.js';
import { hasVideo, toolModel } from './tool-inputs.js';

const MAX_ATTEMPTS = 5;
export const timeouts = {
  // A model that sends nothing for this long is treated as failed and the next one is tried.
  firstResponseMs: 45_000,
  // Once answering, a model that goes silent this long is considered stuck.
  idleMs: 90_000,
};

function describe({ status, message = '' }) {
  if (status === 'timeout') return "didn't respond in time";
  if (status === 'empty') return 'returned an empty reply';
  if (status === 'blocked') return 'declined to answer';
  if (status === 'network') return "couldn't be reached";
  if (status === 429 || /quota|rate.?limit|exhausted/i.test(message)) return 'hit its usage limit';
  if (status === 401 || status === 403) return 'was refused (check the API key)';
  if (status === 404) return 'is not available';
  if (status === 400) return "couldn't handle this request";
  if (status >= 500) return 'is overloaded or down';
  return 'failed';
}

const available = (id) => {
  const m = parseModelId(id);
  return m && hasKey(m.provider) ? m : null;
};

export async function* runChat({ model, fallbacks = [], messages, options = {} }, signal) {
  const needsGemini = Boolean(options.codeExecution) || Boolean(options.requireSearch) || hasVideo(messages);
  const queue = [model, ...fallbacks].filter((id, i, all) => id && all.indexOf(id) === i && available(id) && (!needsGemini || toolModel(id))).slice(0, MAX_ATTEMPTS);
  if (queue.length === 0) {
    yield { t: 'error', text: needsGemini ? 'This tool request requires an enabled Gemini model and a Google API key. Check Settings → Models and API keys.' : `No API key for ${model}. Add your keys in Settings → API keys.` };
    yield { t: 'done' };
    return;
  }
  const instructions = buildInstructions({ custom: options.customInstructions || '', memory: options.memory || '', workspace: options.workspace || '' });
  const failures = [];
  const label = (id) => id.split(':').slice(1).join(':');

  const deadProviders = new Set();

  for (const id of queue) {
    if (signal.aborted) return;
    const target = available(id);
    // A rejected key fails every model that uses it, so don't try them one by one.
    if (deadProviders.has(target.provider)) continue;

    // Each attempt gets its own cancel switch, so a stuck model can be abandoned without stopping the reply.
    const attempt = new AbortController();
    const stopAttempt = () => attempt.abort();
    signal.addEventListener('abort', stopAttempt, { once: true });
    let timedOut = false;
    let timer = setTimeout(() => {
      timedOut = true;
      attempt.abort();
    }, timeouts.firstResponseMs);
    const keepAlive = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        attempt.abort();
      }, timeouts.idleMs);
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stopAttempt);
      attempt.abort(); // closes the connection if we gave up on this model
    };

    let opened;
    try {
      opened = await openStream(target, messages, { instructions, search: Boolean(options.search), requireSearch: Boolean(options.requireSearch), codeExecution: Boolean(options.codeExecution), signal: attempt.signal });
    } catch (e) {
      opened = { ok: false, status: timedOut ? 'timeout' : 'network', message: timedOut ? '' : e.message };
    }
    if (signal.aborted) {
      cleanup();
      return;
    }
    if (!opened.ok) {
      cleanup();
      failures.push({ id, status: opened.status, message: opened.message });
      if (isUnavailableFailure(opened.status, opened.message)) yield { t: 'unavailable', id };
      if (opened.status === 401 || opened.status === 403) deadProviders.add(target.provider);
      if (opened.limit) yield { t: 'limit', id, ...opened.limit };
      continue;
    }
    yield { t: 'request', id };

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

    // Until real answer text arrives, notices and sources are held back: if the model ends up
    // blocked or empty, we move on to the next one without showing them.
    let wrote = false;
    let thought = false;
    const held = [];
    let failedEarly = null;
    try {
      for await (const ev of opened.events) {
        keepAlive();
        if (ev.t === 'error' && !wrote) {
          failedEarly = { id, status: ev.status, message: ev.text };
          if (ev.limit) yield { t: 'limit', id, ...ev.limit };
          break;
        }
        if (ev.t === 'usage') {
          yield { ...ev, id };
          continue;
        }
        if (!wrote && (ev.t === 'notice' || ev.t === 'sources')) {
          held.push(ev);
          continue;
        }
        yield* announce();
        if (ev.t === 'think') thought = true;
        if (ev.t === 'text') {
          if (!wrote) {
            wrote = true;
            yield* held.splice(0);
          }
        }
        yield ev;
      }
    } catch (e) {
      if (signal.aborted) {
        cleanup();
        return;
      }
      if (!wrote) failedEarly = { id, status: timedOut ? 'timeout' : 'network', message: timedOut ? '' : e.message };
      else yield { t: 'error', text: timedOut ? 'The model stopped responding partway through. Tap Try again or Retry with another model.' : `Connection to the model dropped: ${e.message}` };
    }
    cleanup();
    if (!failedEarly && !wrote) {
      const blocked = held.find((h) => h.t === 'notice' && /blocked|stopped the reply/i.test(h.text));
      failedEarly = { id, status: blocked ? 'blocked' : 'empty', message: blocked ? blocked.text : '' };
    }
    if (failedEarly) {
      failures.push(failedEarly);
      if (isUnavailableFailure(failedEarly.status, failedEarly.message)) yield { t: 'unavailable', id };
      // Throw away the failed model's partial thinking before the next model starts.
      if (thought) yield { t: 'discard' };
      if (failedEarly.status === 401 || failedEarly.status === 403) deadProviders.add(target.provider);
      continue;
    }
    yield { t: 'done' };
    return;
  }

  if (!signal.aborted) {
    const detail = failures.map((f) => `• ${label(f.id)}: ${describe(f)}${f.message ? ` (${f.message})` : ''}`).join('\n');
    yield { t: 'error', text: `No model could answer.\n${detail}` };
    yield { t: 'done' };
  }
}

/**
 * Short chat title from the first message, using a light model so it barely touches limits. Returns { title, model }.
 * @param {string} text
 * @param {string | undefined} model
 * @param {(id: string) => boolean} [skip] models to avoid (e.g. ones at their limit)
 */
export async function makeTitle(text, model, skip = () => false) {
  if (!text.trim()) return null;
  const candidates = [];
  if (hasGemini()) candidates.push('gemini:gemini-flash-lite-latest', 'gemini:gemini-2.5-flash-lite');
  if (available(model)) candidates.push(model);
  const prompt = `Write a short title (2 to 6 words) for a chat that starts with the message below. Use the same language as the message. Reply with the title only, no quotes or punctuation at the end.\n\nMessage:\n${text.slice(0, 2000)}`;
  for (const id of candidates) {
    if (skip(id)) continue;
    try {
      const out = await complete(parseModelId(id), prompt);
      const title = (out || '').split('\n').find((l) => l.trim())?.replace(/^["'#*\s]+|["'*.\s]+$/g, '').slice(0, 80);
      if (title) return { title, model: id };
    } catch {
      // Try the next model.
    }
  }
  return null;
}

// Writes a summary of a long chat with the first model that manages it. `report(id, info)` hears about
// every attempt ({ status?, input?, output?, limit? }) so usage can be counted and limits remembered.
export async function summarize(prompt, candidates, { skip = (_id) => false, report = (_id, _info) => {}, signal = /** @type {AbortSignal | undefined} */ (undefined) } = {}) {
  const tried = [];
  for (const id of candidates) {
    const m = available(id);
    if (!m || skip(id) || tried.includes(id)) continue;
    tried.push(id);
    if (signal?.aborted) break;
    const info = {};
    const timeout = AbortSignal.timeout(120_000);
    try {
      const out = await complete(m, prompt, { maxTokens: 8192, signal: signal ? AbortSignal.any([signal, timeout]) : timeout, info });
      report(id, info);
      const text = (out || '').trim();
      if (text.length > 40) return { text, model: id };
    } catch {
      report(id, info);
      // Try the next model.
    }
    if (tried.length >= 4) break;
  }
  return null;
}
