// Helpers for reading streamed replies from the AI providers.

// A transport EOF is successful only after the adapter's semantic finish marker.
// After that marker, briefly drain usage frames without waiting on a lingering socket.
import { waitFor } from './abort.js';
const streamFailure = (code, message) => Object.assign(new Error(message), { name: 'ProviderStreamError', code, status: 'stream' });
export function finishStream(completion) {
  if(completion.finished)return;
  completion.finished=true;
  completion.onComplete?.();
}
export async function* readSSE(body, { completion, signal, finishGraceMs = 100 } = {}) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', finishDeadline = null;
  const finishExpired = () => {
    if (!completion?.finished) return false;
    finishDeadline ??= performance.now() + finishGraceMs;
    return performance.now() >= finishDeadline;
  };
  try {
    for (;;) {
      if (finishExpired()) break;
      let timer, next;
      try {
        const read = reader.read();
        const pending = finishDeadline === null ? read : Promise.race([
          read, new Promise(resolve => { timer = setTimeout(() => resolve({ done: true }), Math.max(0, finishDeadline - performance.now())); }),
        ]);
        next = await (signal ? waitFor(pending, signal) : pending);
      } catch (error) {
        if (completion?.finished && !signal?.aborted) break;
        throw error;
      } finally { clearTimeout(timer); }
      const { value, done } = next;
      if (done) {
        if (completion && !completion.finished) throw streamFailure('incomplete_stream', 'The provider stream ended before its completion marker.');
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        if (finishExpired()) return;
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') {
          if (completion) {
            if (completion.allowDone !== false) finishStream(completion);
            if (!completion.finished) throw streamFailure('incomplete_stream', 'The provider stream ended before its completion marker.');
          }
          return;
        }
        if (!data) continue;
        let parsed;
        try { parsed = JSON.parse(data); }
        catch {
          if (completion && !completion.finished) throw streamFailure('malformed_stream', 'The provider returned a malformed stream frame.');
          continue; // Keep the permissive low-level reader and ignore unusable trailing usage.
        }
        yield parsed;
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Pulls a readable error message out of a failed upstream response.
export async function upstreamError(res,{redact=String}={}) {
  const raw = await res.text().catch(() => '');
  try {
    const body = JSON.parse(raw);
    const err = Array.isArray(body) ? body[0]?.error : body.error;
    const msg = err?.message || err?.metadata?.raw || (typeof err === 'string' ? err : '') || body.message || raw;
    return redact(String(msg)).slice(0, 400);
  } catch {
    return redact(raw).slice(0, 400) || `HTTP ${res.status}`;
  }
}

/**
 * Reads a failed response: a readable message plus, for rate-limit errors, what was hit.
 * limit = { scope: 'day' | 'minute', quota?: number, resetAt?: number (ms), retryAfterSec?: number }
 */
export async function readError(res,{redact=String}={}) {
  const raw = await res.text().catch(() => '');
  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // not JSON
  }
  const err = Array.isArray(body) ? body[0]?.error : body?.error;
  const message = redact(String(err?.message || err?.metadata?.raw || (typeof err === 'string' ? err : '') || body?.message || raw || `HTTP ${res.status}`)).slice(0, 400);
  const limit = res.status === 429 ? parseLimit(err, message, res.headers) : null;
  return { message, limit,code:err?.type || err?.status || err?.code || body?.type || null };
}

export function parseLimit(err, message = '', headers) {
  const limit = { scope: /per.?day|daily/i.test(message) ? 'day' : /per.?min/i.test(message) ? 'minute' : 'unknown' };
  // Google: QuotaFailure + RetryInfo details.
  for (const d of err?.details || []) {
    if (String(d['@type']).endsWith('QuotaFailure')) {
      const violations = d.violations || [];
      const daily = violations.find((v) => /PerDay/i.test(v.quotaId || ''));
      const any = daily || violations[0];
      if (daily) limit.scope = 'day';
      else if (any && /PerMinute/i.test(any.quotaId || '')) limit.scope = 'minute';
      if (any?.quotaValue && /Requests/i.test(any.quotaId || '')) limit.quota = Number(any.quotaValue);
    }
    if (String(d['@type']).endsWith('RetryInfo') && d.retryDelay) limit.retryAfterSec = parseFloat(d.retryDelay);
  }
  // OpenRouter: rate-limit headers echoed in error metadata (or on the response).
  const h = err?.metadata?.headers || {};
  const get = (k) => h[k] ?? h[k.toLowerCase()] ?? headers?.get?.(k);
  const reset = Number(get('X-RateLimit-Reset'));
  if (reset) limit.resetAt = reset > 1e12 ? reset : reset * 1000;
  const cap = Number(get('X-RateLimit-Limit'));
  if (cap && !limit.quota) limit.quota = cap;
  const retry = Number(headers?.get?.('retry-after'));
  if (retry && !limit.retryAfterSec) limit.retryAfterSec = retry;
  return limit;
}
