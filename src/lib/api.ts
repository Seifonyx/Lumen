// Everything runs in the browser now: model lists, chat streaming (with automatic switching) and titles
// call Google AI Studio and OpenRouter directly, using the user's own API keys.

import type { Attachment, Catalog } from '../types';
import { makeTitle, runChat, summarize } from './ai/chat.js';
import type { LimitInfo } from './usage';
import { catalog } from './ai/providers.js';

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function fetchCatalog(refresh = false): Promise<Catalog> {
  return (await catalog({ refresh })) as Catalog;
}

export async function fetchTitle(text: string, model?: string, skip?: (id: string) => boolean): Promise<{ title: string; model: string } | null> {
  try {
    return (await makeTitle(text, model, skip)) as { title: string; model: string } | null;
  } catch {
    return null;
  }
}

export interface AttemptInfo {
  status?: number;
  input?: number;
  output?: number;
  limit?: LimitInfo | null;
}

/** Summarizes a long chat with the first model in `models` that manages it. */
export async function fetchSummary(
  prompt: string,
  models: string[],
  opts: { signal?: AbortSignal; report?: (id: string, info: AttemptInfo) => void },
): Promise<{ text: string; model: string } | null> {
  return (await summarize(prompt, models, opts)) as { text: string; model: string } | null;
}

export interface WireMessage {
  role: 'user' | 'assistant';
  text: string;
  /** privacy shield: send this one as is (you chose "Send as is") */
  asIs?: boolean;
  files?: Pick<Attachment, 'kind' | 'name' | 'mime' | 'data' | 'text' | 'videoUri'>[];
}

export type StreamEvent =
  | { t: 'attempt'; id: string; number: number }
  | { t: 'model'; id: string }
  | { t: 'notice'; text: string }
  | { t: 'think'; text: string }
  | { t: 'text'; text: string }
  | { t: 'sources'; items: { title: string; url: string }[] }
  | { t: 'error'; text: string }
  | { t: 'done' }
  | { t: 'discard' }
  | { t: 'unavailable'; id: string; reason?: string }
  | { t: 'request'; id: string }
  | { t: 'usage'; id: string; input: number; output: number }
  | { t: 'limit'; id: string; scope: 'day' | 'minute' | 'unknown'; quota?: number; resetAt?: number; retryAfterSec?: number };

// Google accepts requests up to ~20 MB; stay well below it.
const MAX_BODY = 15_000_000;

/** Builds the request, dropping attachments from the oldest messages first if it's too big. */
export function buildChatBody(payload: { model: string; fallbacks: string[]; messages: WireMessage[]; options: object }): string {
  const msgs = payload.messages.map(({ asIs: _asIs, ...m }) => ({ ...m }));
  let body = JSON.stringify({ ...payload, messages: msgs });
  for (let i = 0; body.length > MAX_BODY && i < msgs.length - 1; i++) {
    if (!msgs[i].files?.length) continue;
    const names = msgs[i].files!.map((f) => f.name).join(', ');
    msgs[i] = { ...msgs[i], files: [], text: `[Earlier attachment(s) no longer included: ${names}]\n${msgs[i].text}` };
    body = JSON.stringify({ ...payload, messages: msgs });
  }
  if (body.length > MAX_BODY) throw new ApiError('These attachments are too big to send together. Remove some or send them one at a time.', 413);
  return body;
}

export async function* streamChat(body: string, signal: AbortSignal): AsyncGenerator<StreamEvent> {
  try {
    yield* runChat(JSON.parse(body), signal) as AsyncGenerator<StreamEvent>;
  } catch (e) {
    if (signal.aborted) {
      const err = new Error('Stopped');
      err.name = 'AbortError';
      throw err;
    }
    if (e instanceof TypeError) throw new ApiError("Can't reach the AI service. Check your internet connection.", 0);
    throw e;
  }
}
