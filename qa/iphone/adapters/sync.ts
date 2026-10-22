// Synthetic QA build only: replaces src/lib/sync.ts. Chats stay in this browser's canonical per-account
// database; nothing is synchronised anywhere. Same public surface as the canonical ChatSync.

import type { Chat } from '../../../src/types';

interface Handlers {
  local(id: string): Chat | undefined;
  allLocal(): Chat[];
  apply(chat: Chat): void;
  remove(id: string): void;
  error(message: string): void;
}

export async function fetchOriginal(_uid: string, _fileId: string): Promise<{ data: string; mime: string; name: string } | null> {
  return null;
}

export class ChatSync {
  constructor(_uid: string, _handlers: Handlers) {}
  start() {}
  stop() {}
  push(_chat: Chat) {}
  remove(_id: string) {}
}
