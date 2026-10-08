// Long chats: older messages are replaced by a summary when the chat gets big, like Claude Code's
// "compacting". The whole chat stays visible; only what's sent to the model shrinks.

import type { Chat, ChatSummary, Message, ModelInfo } from '../types';
import { estimateTokens } from './routing';

/** Above this many tokens a chat is compacted (free models get slow, forgetful and hit limits sooner). */
export const COMPACT_AT = 50_000;
/** Recent messages are kept word for word, up to about this many tokens. */
const KEEP_TOKENS = 12_000;
const KEEP_MESSAGES = 6;

const tokensOf = (m: Message) => estimateTokens(m.text, m.files) + 4;

/** The summary if it still matches the chat (an edit or regenerate before its end makes it stale). */
export function activeSummary(chat: Chat): ChatSummary | null {
  const s = chat.summary;
  if (!s?.text) return null;
  if (s.upTo === null) return s;
  return chat.messages.some((m) => m.id === s.upTo) ? s : null;
}

/** Messages that are still sent word for word (everything after the summary). */
export function liveMessages(chat: Chat): Message[] {
  const s = activeSummary(chat);
  if (!s || s.upTo === null) return chat.messages;
  return chat.messages.slice(chat.messages.findIndex((m) => m.id === s.upTo) + 1);
}

/** Rough size of what the next request sends. */
export function contextTokens(chat: Chat): number {
  const s = activeSummary(chat);
  return (s ? Math.ceil(s.text.length / 4) + 50 : 0) + liveMessages(chat).reduce((n, m) => n + tokensOf(m), 0);
}

/** The point to compact at: smaller for models with a small context window. */
export function compactLimit(model?: ModelInfo): number {
  return model?.context ? Math.min(COMPACT_AT, Math.floor(model.context * 0.6)) : COMPACT_AT;
}

/**
 * Where to cut: how many of the live messages get summarized. Keeps the last few messages (about
 * KEEP_TOKENS, always the newest user message) and starts the kept part on a user message.
 * Returns 0 when there's nothing worth summarizing.
 */
export function cutPoint(live: Message[], manual = false): number {
  if (live.length < 3) return 0;
  let keep = 0;
  let size = 0;
  const maxKeep = manual ? 2 : KEEP_MESSAGES;
  for (let i = live.length - 1; i >= 0; i--) {
    const t = tokensOf(live[i]);
    if (keep >= 1 && (keep >= maxKeep || size + t > KEEP_TOKENS)) break;
    keep++;
    size += t;
  }
  let cut = live.length - keep;
  // Keep the newest exchange together: start on a user message.
  while (cut > 0 && live[cut].role !== 'user') cut--;
  if (cut <= 0) {
    // Nothing to gain by moving back; move forward to the next user message instead.
    cut = live.length - keep;
    while (cut < live.length - 1 && live[cut].role !== 'user') cut++;
  }
  return cut >= 2 ? cut : 0;
}

const MAX_FILE_CHARS = 20_000;
const MAX_MESSAGE_CHARS = 40_000;

function transcript(messages: Message[]): string {
  return messages
    .filter((m) => m.text || m.files?.length)
    .map((m) => {
      const who = m.role === 'user' ? 'USER' : 'ASSISTANT';
      const files = (m.files || []).map((f) =>
        f.kind === 'text' && f.text
          ? `[Attached file "${f.name}":\n${f.text.slice(0, MAX_FILE_CHARS)}${f.text.length > MAX_FILE_CHARS ? '\n…(rest of the file cut)' : ''}]`
          : `[Attached ${f.kind === 'image' ? 'image' : 'PDF'} "${f.name}"]`,
      );
      const text = m.text.length > MAX_MESSAGE_CHARS ? `${m.text.slice(0, MAX_MESSAGE_CHARS)}\n…(cut)` : m.text;
      return `${who}:\n${[...files, text].filter(Boolean).join('\n')}`;
    })
    .join('\n\n---\n\n');
}

/** The request that asks a model to summarize the older part of a chat. */
export function summaryPrompt(messages: Message[], previous: ChatSummary | null): string {
  return [
    'You are compacting a long conversation between a user and an AI assistant so it can continue with less text.',
    'Write a detailed summary that lets the assistant carry on as if it remembered everything. Include:',
    '- What the user is trying to achieve, and their current task',
    '- Key facts, names, numbers, dates and figures that came up (exact values)',
    '- Decisions made, answers given and conclusions reached',
    '- Files the user attached (name and their important content) and files the assistant made (name, type and what was in them)',
    "- The user's preferences and instructions about style, format and language",
    '- Anything unfinished, open questions and what was about to happen next',
    'Use short headings and bullet points. Be specific; do not add anything that was not in the conversation.',
    'Write the summary in the same language the conversation mostly uses. Reply with the summary only.',
    '',
    previous ? `An earlier part of the conversation was already summarized:\n<earlier_summary>\n${previous.text}\n</earlier_summary>\n\nFold it into your new summary.\n` : '',
    `<conversation>\n${transcript(messages)}\n</conversation>`,
  ].join('\n');
}

/** Puts the summary in front of the messages that are still sent in full. */
export function withSummary<T extends { role: 'user' | 'assistant'; text: string }>(summary: ChatSummary | null, live: T[]): T[] {
  if (!summary) return live;
  const intro = summary.upTo === null
    ? `[This chat continues an earlier conversation${summary.from ? ` ("${summary.from}")` : ''}. Summary of it:]`
    : '[The earlier part of this conversation was summarized to save space. Summary:]';
  const block = `${intro}\n${summary.text}\n[End of summary. The conversation continues below.]`;
  if (live[0]?.role === 'user') return [{ ...live[0], text: `${block}\n\n${live[0].text}` }, ...live.slice(1)];
  return [{ role: 'user', text: block } as T, ...live];
}
