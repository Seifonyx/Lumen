// Shared helpers for the API routes. Files starting with "_" are not exposed as routes by Vercel.

const DEFAULT_GEMINI_MODELS = 'gemini-3.5-flash,gemini-flash-lite-latest,gemma-4-31b-it';
const DEFAULT_OPENROUTER_MODELS = 'nvidia/nemotron-3-super-120b-a12b:free,google/gemma-4-31b-it:free';

function splitList(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// Returns an error Response when the password is missing or wrong, otherwise null.
export function checkAuth(request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return json({ error: 'APP_PASSWORD is not set in Vercel. Add it and redeploy.' }, 500);
  }
  if (request.headers.get('x-app-password') !== expected) {
    return json({ error: 'Wrong password.' }, 401);
  }
  return null;
}

// Model ids look like "gemini:gemini-3.5-flash" or "openrouter:vendor/model:free".
export function listModels() {
  const models = [];
  if (process.env.GEMINI_API_KEY) {
    for (const name of splitList(process.env.GEMINI_MODELS || DEFAULT_GEMINI_MODELS)) {
      models.push({ id: `gemini:${name}`, provider: 'Google', name });
    }
  }
  if (process.env.OPENROUTER_API_KEY) {
    for (const name of splitList(process.env.OPENROUTER_MODELS || DEFAULT_OPENROUTER_MODELS)) {
      models.push({ id: `openrouter:${name}`, provider: 'OpenRouter', name });
    }
  }
  return models;
}

export function parseModelId(id) {
  const i = (id || '').indexOf(':');
  if (i < 0) return null;
  const provider = id.slice(0, i);
  const name = id.slice(i + 1);
  if (!listModels().some((m) => m.id === id)) return null;
  return { provider, name };
}

// Reads a server-sent-events body and calls onData with each parsed JSON "data:" payload.
export async function readSSE(body, onData) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
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
        onData(JSON.parse(data));
      } catch {
        // Ignore keep-alive comments and partial lines.
      }
    }
  }
}
