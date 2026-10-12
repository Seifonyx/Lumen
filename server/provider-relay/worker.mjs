// BYOK relay: no stored credentials, arbitrary upstreams, cookies or request logging.
const origins = new Set(['https://model-router.web.app', 'https://model-router--dev-82jv5mm2.web.app', 'http://localhost:5190']);
export default {
  async fetch(request) {
    const origin = request.headers.get('origin');
    if (!origins.has(origin)) return new Response('Origin not allowed', { status: 403 });
    const cors = { 'access-control-allow-origin': origin, 'vary': 'Origin', 'cache-control': 'no-store',
      'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type, x-mr-account-id',
      'access-control-expose-headers': 'retry-after, x-ratelimit-limit, x-ratelimit-reset', 'x-content-type-options': 'nosniff' };
    const error = (message, status) => Response.json({ error: { message } }, { status, headers: cors });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const match = /^\/(nvidia|cloudflare)\/(models|chat\/completions)$/.exec(url.pathname);
    if (!match) return error('Unsupported relay route', 404);
    const [, provider, path] = match;
    if (request.method !== (path === 'models' ? 'GET' : 'POST')) return error('Method not allowed', 405);
    const auth = request.headers.get('authorization') || '';
    if (!/^Bearer [^\s]{1,2048}$/.test(auth)) return error('A provider key is required', 401);
    let target;
    if (provider === 'nvidia') {
      target = `https://integrate.api.nvidia.com/v1/${path}`;
    } else {
      const account = request.headers.get('x-mr-account-id') || '';
      if (!/^[a-f0-9]{32}$/i.test(account)) return error('Invalid Cloudflare account ID', 400);
      target = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/${path === 'models' ? 'models/search' : 'v1/chat/completions'}`;
      if (path === 'models') {
        const page = Number(url.searchParams.get('page') || 1);
        if (!Number.isInteger(page) || page < 1 || page > 100) return error('Invalid catalogue page', 400);
        target += `?per_page=100&page=${page}`;
      }
    }
    let body;
    if (request.method === 'POST') {
      if (!request.headers.get('content-type')?.startsWith('application/json')) return error('JSON required', 415);
      const reader = request.body?.getReader();
      if (!reader) return error('Missing request body', 400);
      const chunks = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 24 * 1024 * 1024) { await reader.cancel(); return error('Request too large', 413); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
      try {
        const payload = JSON.parse(new TextDecoder().decode(body));
        if (typeof payload.model !== 'string' || !Array.isArray(payload.messages)) return error('Model and messages required', 400);
      } catch { return error('Invalid JSON', 400); }
    }
    try {
      const upstream = await fetch(target, { method: request.method, headers: { authorization: auth, ...(body ? { 'content-type': 'application/json' } : {}) }, body, signal: request.signal, redirect: 'error' });
      const headers = new Headers(cors);
      for (const name of ['content-type', 'retry-after', 'x-ratelimit-limit', 'x-ratelimit-reset']) {
        if (upstream.headers.has(name)) headers.set(name, upstream.headers.get(name));
      }
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch { return error('Provider connection failed', 502); }
  },
};
