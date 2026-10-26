// A read-only view of canonical chat content, never a second persisted Library index.
import type { Attachment, Chat } from '../types';
import type { Item, CollectionKind } from '../components/CollectionPage';
import { isTemporaryChat } from './temporary-chat';
export type LibraryItem = Item | { kind: 'exports'; key: string; chat: Chat; name: string; content: string; at: number };
export type LibrarySort = 'newest' | 'oldest' | 'name';
export type ReadExports = (text: string) => { name: string; content: string }[];
export const itemName = (item: LibraryItem) => item.kind === 'documents' ? item.doc.name : item.kind === 'exports' ? item.name : item.file.name;
export function libraryItems(chats: Chat[], readExports?: ReadExports): LibraryItem[] {
  const items: LibraryItem[] = [];
  for (const chat of chats) {
    if (isTemporaryChat(chat)) continue;
    const seen = new Set<string>();
    for (const doc of chat.documents || []) items.push({kind:'documents',key:`d-${chat.id}-${doc.id}`,chat,doc,at:doc.updatedAt});
    for (const message of chat.messages) {
      for (const file of message.files || []) {
        if (file.auto || file.videoUri || seen.has(file.id)) continue;
        seen.add(file.id);
        items.push({kind:message.role === 'assistant' ? 'generated' : file.kind === 'image' ? 'photos' : 'files',key:`f-${chat.id}-${file.id}`,chat,file,at:message.createdAt});
      }
      // Same top-level file fence grammar as Markdown/FileCard. No parsing of ordinary code,
      // Office edit proposals or still-streaming replies into fabricated downloadable originals.
      if (readExports && message.role === 'assistant' && message.status !== 'streaming' && /(?:`{3,}|~{3,})file[:\s]/i.test(message.text)) {
        let n = 0;
        for (const block of readExports(message.text)) items.push({kind:'exports',key:`e-${chat.id}-${message.id}-${n++}`,chat,...block,at:message.createdAt});
      }
    }
  }
  return items;
}
export function discoverItems(items: LibraryItem[], {kind,query,project,sort}: {kind:CollectionKind;query:string;project:string;sort:LibrarySort}) {
  const q = query.trim().toLocaleLowerCase();
  return items.filter(item => (kind === 'all' || item.kind === kind || (kind === 'generated' && item.kind === 'exports')) && (!project || item.chat.projectId === project) && (!q || `${itemName(item)} ${item.chat.title} ${item.kind === 'documents' ? item.doc.content : ''}`.toLocaleLowerCase().includes(q)))
    .sort((a,b) => (sort === 'name' ? itemName(a).localeCompare(itemName(b)) : sort === 'oldest' ? a.at-b.at : b.at-a.at) || a.key.localeCompare(b.key));
}
export function availability(file: Attachment) {
  if (file.data) return 'Original available';
  if (file.stored) return 'Saved original · open to retrieve';
  if (file.text) return 'Extracted text available';
  if (file.thumb) return 'Preview only · original unavailable here';
  return 'Original unavailable on this device';
}
