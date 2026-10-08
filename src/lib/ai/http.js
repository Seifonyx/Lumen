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
        if (!data || data === '[DONE]') continue;
        try {
          yield JSON.parse(data);
        } catch {
          // Ignore keep-alive comments and partial lines.
        }
      }
    }
  } finally {
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
