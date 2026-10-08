import type { Attachment, Catalog } from '../types';

const TOKEN_KEY = 'mr.token';

export const auth = {
  get token() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },
  set token(v: string) {
    try {
      if (v) localStorage.setItem(TOKEN_KEY, v);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode */
    }
  },
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { ...(init.headers || {}), authorization: `Bearer ${auth.token}` },
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError("Can't reach the server. Check your internet connection.", 0);
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      msg = (await res.json()).error || msg;
    } catch {
      if (res.status === 413) msg = 'That is too much to send at once. Remove some attachments or start a new chat.';
    }
    throw new ApiError(msg, res.status);
  }
  return res;
}

export async function login(password: string): Promise<void> {
  const res = await call('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  auth.token = (await res.json()).token;
}

export async function fetchCatalog(): Promise<Catalog> {
  return (await call('/api/models')).json();
}

export async function fetchTitle(text: string, model?: string): Promise<string | null> {
  try {
    const res = await call('/api/title', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, model }),
    });
    return (await res.json()).title || null;
  } catch {
    return null;
  }
}

export interface WireMessage {
  role: 'user' | 'assistant';
  text: string;
  files?: Pick<Attachment, 'kind' | 'name' | 'mime' | 'data' | 'text'>[];
}

export type StreamEvent =
  | { t: 'model'; id: string }
  | { t: 'notice'; text: string }
  | { t: 'think'; text: string }
  | { t: 'text'; text: string }
  | { t: 'sources'; items: { title: string; url: string }[] }
  | { t: 'error'; text: string }
  | { t: 'done' };

// Vercel rejects request bodies above ~4.5 MB.
const MAX_BODY = 4_000_000;

/** Builds the request body, dropping attachments from the oldest messages first if it's too big. */
export function buildChatBody(payload: { model: string; fallbacks: string[]; messages: WireMessage[]; options: object }): string {
  const msgs = payload.messages.map((m) => ({ ...m }));
  let body = JSON.stringify({ ...payload, messages: msgs });
  for (let i = 0; body.length > MAX_BODY && i < msgs.length - 1; i++) {
    if (!msgs[i].files?.length) continue;
    const names = msgs[i].files!.map((f) => f.name).join(', ');
    msgs[i] = { ...msgs[i], files: [], text: `[Earlier attachment(s) no longer included: ${names}]\n${msgs[i].text}` };
    body = JSON.stringify({ ...payload, messages: msgs });
  }
  if (body.length > MAX_BODY) throw new ApiError('These attachments are too big to send together (about 4 MB max). Remove some or send them one at a time.', 413);
  return body;
}

export async function* streamChat(body: string, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  const res = await call('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.trim()) yield JSON.parse(line) as StreamEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as StreamEvent;
}
