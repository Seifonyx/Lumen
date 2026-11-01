// A conversation search result found through a message (src/lib/chat-search.ts), as the drawer and Jump to show it:
// the excerpt with the match set off, what a screen reader hears, and opening the chat at that message.
import { useStore } from '../store';
import { excerptText, type ChatMatch, type Excerpt } from '../lib/chat-search';
import { requestJump } from '../lib/message-jump';

/** A search result found through a message: its excerpt, with the match set off, and what a screen reader hears. */
export const MatchExcerpt = ({ excerpt }: { excerpt: Excerpt }) => <>{excerpt.before}<mark className="search-match">{excerpt.match}</mark>{excerpt.after}</>;
export const matchLabel = (title: string, match: ChatMatch, place?: string) =>
  `${title}${place ? `, in ${place}` : ''}, ${match.count === 1 ? 'one matching message' : `${match.count} matching messages`}: ${excerptText(match.excerpt)}`;
/** Opens `chatId` at the matching message (src/lib/message-jump.ts), from a click or the keyboard. */
export function openMatch(chatId: string, match: ChatMatch, key: string, keyboard: boolean) {
  const { selectChat, user } = useStore.getState();
  requestJump({ chatId, messageId: match.messageId, key, keyboard, account: user?.uid ?? null });
  selectChat(chatId);
}

