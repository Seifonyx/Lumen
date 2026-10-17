// Runs a chat turn in the browser: tries the chosen model, then the fallbacks, and yields events:
//   {t:'model', id} {t:'notice', text} {t:'think', text} {t:'text', text} {t:'sources', items} {t:'error', text} {t:'done'}
// and, for the usage meter: {t:'request', id} {t:'usage', id, input, output} {t:'limit', id, scope, quota?, resetAt?, retryAfterSec?}

import { buildInstructions } from './instructions.js';
import { complete, hasGemini, hasKey, keyVersion, modelCapabilities, openStream, parseModelId } from './providers.js';
import { isUnavailableFailure } from './model-status.js';
import { hasVideo, toolModel } from './tool-inputs.js';
import { isCoolingDown, noteFailure, noteSuccess, noteReplyLatency, replyLatency } from './health.js';
import { requestTokens, fitsContext } from './context-budget.js';

const MAX_ATTEMPTS = 5;
export const timeouts = {
  // A model that sends nothing for this long is treated as failed and the next one is tried.
  firstResponseMs: 25_000,
  quickResponseMs: 8_000,
  quickAnswerMs: 20_000,
  // Once answering, a model that goes silent this long is considered stuck.
  idleMs: 45_000,
  firstAnswerMs: 60_000,
  noAnswerMs: 120_000,
  totalMs: 600_000,
  summaryAttemptMs: 30_000,
  summaryTotalMs: 60_000,
};

// Keep the chosen model first, then try another provider before more models from the same one.
// This gives every connected provider a chance within the five actual requests.
export function attemptQueue(ids) {
  const remaining = [...ids];
  const queue = [];
  const counts = new Map();
  while (remaining.length) {
    const healthy = remaining.filter(id => !isCoolingDown(id));
    const pool = healthy.length ? healthy : remaining;
    const fewest = Math.min(...pool.map(id => counts.get(id.split(':')[0]) || 0));
    const index = queue.length ? remaining.findIndex(id => pool.includes(id) && (counts.get(id.split(':')[0]) || 0) === fewest) : 0;
    const [id] = remaining.splice(index, 1);
    queue.push(id);
    const provider = id.split(':')[0];
    counts.set(provider, (counts.get(provider) || 0) + 1);
  }
  return queue;
}

// Race the wait itself, not just fetch's abort handling (some stalled streams don't settle).
export function waitFor(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { cleanup(); reject(Object.assign(new Error('Stopped'), { name: 'AbortError' })); };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort();
  });
}

function describe({ status, message = '' }) {
  if (status === 'timeout') return "didn't respond in time";
  if (status === 'empty') return 'returned an empty reply';
  if (status === 'blocked') return 'declined to answer';
  if (status === 'network') return "couldn't be reached";
  if (status === 'context') return 'has too little context for this request';
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
  const image = messages.some(m => m.files?.some(f => f.kind === 'image' && !f.text));
  const pdf = messages.some(m => m.files?.some(f => f.kind === 'pdf' && !f.text));
  const candidates = [model, ...fallbacks].filter((id, i, all) => id && all.indexOf(id) === i && available(id) && (!needsGemini || toolModel(id)));
  const preferred = options.preferredModels?.length ? new Set([model, ...options.preferredModels]) : null;
  const queue = preferred
    ? [...attemptQueue(candidates.filter(id => preferred.has(id))), ...attemptQueue(candidates.filter(id => !preferred.has(id)))]
    : attemptQueue(candidates);
  if (queue.length === 0) {
    yield { t: 'error', text: needsGemini ? 'This tool request requires an enabled Gemini model and a Google API key. Check Settings → Models and API keys.' : `No API key for ${model}. Add your keys in Settings → API keys.` };
    yield { t: 'done' };
    return;
  }
  const officeFiles = [...new Set(messages.flatMap((m) => (m.files || []).map((f) => f.name)).filter((n) => /\.(docx|xlsx|xlsm)$/i.test(n || '')))];
  const instructions = buildInstructions({ custom: options.customInstructions || '', memory: options.memory || '', workspace: options.workspace || '', officeFiles });
  const tokens = requestTokens(messages, instructions);
  const failures = [];
  const label = (id) => id.split(':').slice(1).join(':');

  const deadProviders = new Set();
  const started = Date.now();
  let answered = false;
  let attempts = 0;

  for (const id of queue) {
    if (signal.aborted) return;
    const target = available(id);
    if (!target) continue;
    const metadata = modelCapabilities(id);
    if (metadata && ((image && !metadata.vision) || (pdf && metadata.pdf === false))) {
      failures.push({ id, status: 400, message: 'This model cannot read the attachments in this conversation.' });
      continue;
    }
    if (!fitsContext(metadata?.context ?? options.modelContexts?.[id], tokens)) {
      failures.push({ id, status: 'context', message: 'The conversation and instructions exceed this model’s safe context budget.' });
      continue;
    }
    // A rejected key fails every model that uses it, so don't try them one by one.
    if (deadProviders.has(target.provider)) continue;
    if (attempts++ >= MAX_ATTEMPTS || Date.now() - started >= (answered ? timeouts.totalMs : timeouts.noAnswerMs)) break;
    yield { t: 'attempt', id, number: attempts };
    if (signal.aborted) return;
    const attemptStarted = Date.now();
    let firstAnswerMs = null;
    // Speed mode is explicitly limited to Auto's simple short-context questions.
    const quick = options.quickReply === true && !needsGemini && !options.thinkingModels?.includes(id);
    const learned = quick ? replyLatency(id) : null;
    const startWait = quick ? Math.min(timeouts.firstResponseMs, Math.max(timeouts.quickResponseMs, learned === null ? 0 : learned * 3 + 1500)) : timeouts.firstResponseMs;

    // Each attempt gets its own cancel switch, so a stuck model can be abandoned without stopping the reply.
    const attempt = new AbortController();
    const stopAttempt = () => attempt.abort();
    signal.addEventListener('abort', stopAttempt, { once: true });
    let timedOut = false;
    let timer = setTimeout(() => {
      timedOut = true;
      attempt.abort();
    }, startWait);
    let answerTimer = setTimeout(() => { timedOut = true; attempt.abort(); }, quick ? Math.min(timeouts.firstAnswerMs, Math.max(timeouts.quickAnswerMs, startWait)) : timeouts.firstAnswerMs);
    let deadline = setTimeout(() => { timedOut = true; attempt.abort(); }, Math.max(1, (answered ? timeouts.totalMs : timeouts.noAnswerMs) - (Date.now() - started)));
    const setTotalDeadline = () => {
      deadline = setTimeout(() => { timedOut = true; attempt.abort(); }, Math.max(1, timeouts.totalMs - (Date.now() - started)));
    };
    const keepAlive = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timedOut = true;
        attempt.abort();
      }, timeouts.idleMs);
    };
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(answerTimer);
      clearTimeout(deadline);
      signal.removeEventListener('abort', stopAttempt);
      attempt.abort(); // closes the connection if we gave up on this model
    };

    let opened;
    try {
      opened = await waitFor(openStream(target, messages, { instructions, quickReply: quick, search: Boolean(options.search), requireSearch: Boolean(options.requireSearch), codeExecution: Boolean(options.codeExecution), signal: attempt.signal }), attempt.signal);
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
      noteFailure(id, opened.status);
      if (isUnavailableFailure(opened.status, opened.message)) yield { t: 'unavailable', id, reason: String(opened.message || '').slice(0, 140) };
      if (opened.status === 401 || (opened.status === 403 && !isUnavailableFailure(opened.status, opened.message))) deadProviders.add(target.provider);
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
    let failedLate = false;
    const iterator = opened.events[Symbol.asyncIterator]();
    try {
      for (;;) {
        const next = await waitFor(iterator.next(), attempt.signal);
        if (next.done) break;
        const ev = next.value;
        // Metadata must not extend the wait for a real response indefinitely.
        if ((ev.t === 'text' || ev.t === 'think') && ev.text?.trim()) keepAlive();
        if (ev.t === 'error' && !wrote) {
          failedEarly = { id, status: ev.status, message: ev.text };
          if (ev.limit) yield { t: 'limit', id, ...ev.limit };
          break;
        }
        if (ev.t === 'error') { failedLate = true; noteFailure(id, ev.status || 500); }
        if (ev.t === 'usage') {
          yield { ...ev, id };
          continue;
        }
        if (!wrote && (ev.t === 'notice' || ev.t === 'sources')) {
          held.push(ev);
          continue;
        }
        if (!wrote && ev.t === 'text' && !ev.text?.trim()) {
          held.push(ev); // retain leading whitespace, but don't treat it as a useful answer
          continue;
        }
        yield* announce();
        if (ev.t === 'think') thought = true;
        if (ev.t === 'text') {
          if (!wrote) {
            wrote = true;
            firstAnswerMs = Date.now() - attemptStarted;
            answered = true;
            clearTimeout(answerTimer);
            // A useful answer can stream longer, but still has a hard overall deadline.
            clearTimeout(deadline);
            setTotalDeadline();
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
      else {
        failedLate = true;
        noteFailure(id, timedOut ? 'timeout' : 'network');
        yield { t: 'error', text: timedOut ? 'The model stopped responding partway through. Tap Try again or Retry with another model.' : `Connection to the model dropped: ${e.message}` };
      }
    }
    cleanup();
    void iterator.return?.().catch(() => {});
    if (!failedEarly && !wrote) {
      const blocked = held.find((h) => h.t === 'notice' && /blocked|stopped the reply/i.test(h.text));
      failedEarly = { id, status: blocked ? 'blocked' : 'empty', message: blocked ? blocked.text : '' };
    }
    if (failedEarly) {
      failures.push(failedEarly);
      noteFailure(id, failedEarly.status);
      if (isUnavailableFailure(failedEarly.status, failedEarly.message)) yield { t: 'unavailable', id, reason: String(failedEarly.message || '').slice(0, 140) };
      // Throw away the failed model's partial thinking before the next model starts.
      if (thought) yield { t: 'discard' };
      if (failedEarly.status === 401 || (failedEarly.status === 403 && !isUnavailableFailure(failedEarly.status, failedEarly.message))) deadProviders.add(target.provider);
      continue;
    }
    if (!failedLate) {
      noteSuccess(id);
      // Reasoning-capable models still provide useful speed observations on a
      // simple Auto question, even when we retain their longer startup budget.
      if (options.quickReply === true && !needsGemini && firstAnswerMs !== null) noteReplyLatency(id, firstAnswerMs);
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
  const generation = keyVersion();
  const candidates = [];
  if (hasGemini()) candidates.push('gemini:gemini-flash-lite-latest', 'gemini:gemini-2.5-flash-lite');
  if (available(model)) candidates.push(model);
  const prompt = `Write a short title (2 to 6 words) for a chat that starts with the message below. Use the same language as the message. Reply with the title only, no quotes or punctuation at the end.\n\nMessage:\n${text.slice(0, 2000)}`;
  for (const id of candidates) {
    if (keyVersion() !== generation) return null;
    if (skip(id) || isCoolingDown(id)) continue;
    try {
      const timeout = AbortSignal.timeout(10_000);
      const out = await waitFor(complete(parseModelId(id), prompt, { signal: timeout }), timeout);
      if (keyVersion() !== generation) return null;
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
export async function summarize(prompt, candidates, { skip = (_id) => false, report = (_id, _info) => {}, signal = /** @type {AbortSignal | undefined} */ (undefined), minLength = 41, maxTokens = 8192 } = {}) {
  const tried = [];
  const started = Date.now();
  for (const id of candidates) {
    const m = available(id);
    if (!m || skip(id) || tried.includes(id)) continue;
    tried.push(id);
    const remaining = timeouts.summaryTotalMs - (Date.now() - started);
    if (signal?.aborted || remaining <= 0) break;
    const info = {};
    const attempt = new AbortController();
    const timer = setTimeout(() => attempt.abort(), Math.min(timeouts.summaryAttemptMs, remaining));
    const combined = signal ? AbortSignal.any([signal, attempt.signal]) : attempt.signal;
    try {
      const out = await waitFor(complete(m, prompt, { maxTokens, signal: combined, info }), combined);
      report(id, info);
      const text = (out || '').trim();
      if (text.length >= minLength) return { text, model: id };
    } catch {
      report(id, info);
      // Try the next model.
    } finally {
      clearTimeout(timer);
      attempt.abort();
    }
    if (tried.length >= 4) break;
  }
  return null;
}
