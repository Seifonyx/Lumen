// Helpers for reading streamed replies from the AI providers.

// Reads a server-sent-events body and yields each parsed JSON "data:" payload.
export async function* readSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        if (!data) continue;
        try {
          yield JSON.parse(data);
        } catch {
          // Ignore keep-alive comments and partial lines.
        }
      }
    }
  } finally {
    // End markers and early fallback must close the body, not leave a live connection behind.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

// Pulls a readable error message out of a failed upstream response.
export async function upstreamError(res) {
  const raw = await res.text().catch(() => '');
  try {
    const body = JSON.parse(raw);
    const err = Array.isArray(body) ? body[0]?.error : body.error;
    const msg = err?.message || err?.metadata?.raw || (typeof err === 'string' ? err : '') || body.message || raw;
    return String(msg).slice(0, 400);
  } catch {
    return raw.slice(0, 400) || `HTTP ${res.status}`;
  }
}

/**
 * Reads a failed response: a readable message plus, for rate-limit errors, what was hit.
 * limit = { scope: 'day' | 'minute', quota?: number, resetAt?: number (ms), retryAfterSec?: number }
 */
export async function readError(res) {
  const raw = await res.text().catch(() => '');
  let body = null;
  try {
    body = JSON.parse(raw);
  } catch {
    // not JSON
  }
  const err = Array.isArray(body) ? body[0]?.error : body?.error;
  const message = String(err?.message || err?.metadata?.raw || (typeof err === 'string' ? err : '') || body?.message || raw || `HTTP ${res.status}`).slice(0, 400);
  const limit = res.status === 429 ? parseLimit(err, message, res.headers) : null;
  return { message, limit };
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
