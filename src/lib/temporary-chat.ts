import type { Chat } from '../types';

export const isTemporaryChat = (chat?: Pick<Chat, 'id'> | null) => Boolean(chat?.id.startsWith('temporary-'));
export const savedChats = (chats: Chat[]) => chats.filter(chat => !isTemporaryChat(chat));
