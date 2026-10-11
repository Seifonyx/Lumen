import type { Chat } from '../types';

export function normalizeChatTags(tags: string[]): string[] {
  return [...new Map(tags.map((tag) => [tag.trim().slice(0, 24).toLowerCase(), tag.trim().slice(0, 24)])).values()].filter(Boolean).slice(0, 5);
}

export function branchChat(chat: Chat, messageId: string, id: string, now = Date.now()): Chat | null {
  const index = chat.messages.findIndex((m) => m.id === messageId);
  if (index < 0) return null;
  const summaryIndex = chat.summary?.upTo ? chat.messages.findIndex((m) => m.id === chat.summary!.upTo) : -1;
  return {
    id,
    title: `${chat.title} (branch)`.slice(0, 100),
    createdAt: now,
    updatedAt: now,
    projectId: chat.projectId,
    assistant: chat.assistant,
    model: chat.model,
    repo: chat.repo,
    context: chat.context,
    summary: chat.summary && (!chat.summary.upTo || (summaryIndex >= 0 && summaryIndex <= index)) ? chat.summary : undefined,
    messages: chat.messages.slice(0, index + 1),
  };
}
