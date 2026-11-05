// Where you are in each conversation: kept for this session by ChatView (to come back to the same spot after switching
// chats) and read once when the app is hidden, so a relaunch can return there too (resume.ts).

/** The message at the top of the view and how far its top is below the view's top. */
export type Anchor = { id: string; offset: number };
/** Per chat, this session: an anchor, or null while following the latest message. */
export const readingPositions = new Map<string, Anchor | null>();

let probe: (() => { chat: string; anchor: Anchor | null } | null) | null = null;
/** ChatView registers how to read the conversation's spot from the screen right now. */
export const setReadingProbe = (fn: typeof probe) => { probe = fn; };
/** The open conversation's spot as it is on screen now, or what was last remembered for it if it isn't visible. */
export function readingAnchor(chatId: string | null): Anchor | null {
  if (!chatId) return null;
  const live = probe?.();
  if (live && live.chat === chatId) return live.anchor;
  return readingPositions.get(chatId) ?? null;
}
