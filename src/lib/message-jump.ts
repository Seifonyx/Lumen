// Opening a chat at one message (a search result). The request waits here until the chat view that will show it takes
// it: the view of an already open chat on the request event, otherwise the view as it opens that chat. Nothing is
// scrolled before the thread exists. One request at a time (the newest wins), for the account that made it, for a few
// seconds, and only while the message is still in the chat; any other open drops it.
import type { Chat } from '../types';

export interface JumpRequest {
  chatId: string;
  messageId: string;
  /** what was searched, to find the matching words inside the message */
  key: string;
  /** opened from the keyboard: the message shows its focus ring */
  keyboard: boolean;
  account: string | null;
  at: number;
}

export const JUMP_REQUEST = 'lumen:jump-request';
const FRESH_MS = 5000;
let pending: JumpRequest | null = null;

/** Ask for `chatId` to open at `messageId`. Call right before selecting the chat. */
export function requestJump(request: Omit<JumpRequest, 'at'>): void {
  pending = { ...request, at: Date.now() };
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(JUMP_REQUEST));
}

const usable = (r: JumpRequest, chat: Pick<Chat, 'id' | 'messages'>, account: string | null, now: number) =>
  r.chatId === chat.id && r.account === account && now - r.at <= FRESH_MS && chat.messages.some((m) => m.id === r.messageId);

/** A chat view opening `chat`: the request for it, if still usable. Any request is used up either way. */
export function takeJump(chat: Pick<Chat, 'id' | 'messages'>, account: string | null, now = Date.now()): JumpRequest | null {
  const r = pending;
  pending = null;
  return r && usable(r, chat, account, now) ? r : null;
}

/** The view of an already open chat: takes a request only if it's for this chat (another chat's waits for its own open). */
export function takeJumpHere(chat: Pick<Chat, 'id' | 'messages'>, account: string | null, now = Date.now()): JumpRequest | null {
  if (pending?.chatId !== chat.id) return null;
  return takeJump(chat, account, now);
}
