import { branchChat, normalizeChatTags } from '../../src/lib/chat-tools';
let fails = 0;
const check = (condition: boolean, label: string) => { console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`); if (!condition) fails++; };

const tags = normalizeChatTags(['  ICU ', 'icu', '', 'follow up', 'A'.repeat(30), 'one', 'two', 'three']);
check(tags.length === 5 && tags[0] === 'icu' && tags[1] === 'follow up' && tags[2].length === 24, 'tags are trimmed, deduplicated case-insensitively, capped at five and 24 characters');

const chat: any = {
  id: 'source', title: 'Report', createdAt: 1, updatedAt: 2, projectId: 'p1', model: 'gemini:test', context: ['README.md'],
  messages: ['m1', 'm2', 'm3'].map((id, i) => ({ id, role: i % 2 ? 'assistant' : 'user', text: id, createdAt: i })),
};
chat.summary = { text: 'Earlier summary', upTo: 'm1', count: 1, saved: 1, createdAt: 1 };
const branch = branchChat(chat, 'm2', 'branch-id', 99)!;
check(branch.id === 'branch-id' && branch.title === 'Report (branch)' && branch.messages.map((m) => m.id).join(',') === 'm1,m2', 'branch copies the conversation through the selected message');
check(branch.projectId === 'p1' && branch.model === chat.model && branch.context?.[0] === 'README.md' && branch.summary === chat.summary, 'branch preserves project, model, context and applicable summary');
check(branchChat(chat, 'missing', 'bad') === null, 'unknown branch point is rejected');
chat.summary = { ...chat.summary, upTo: 'm3' };
check(branchChat(chat, 'm2', 'earlier')?.summary === undefined, 'branch before a summary boundary drops the summary');
chat.summary = { ...chat.summary, upTo: null, from: 'Earlier chat' };
check(branchChat(chat, 'm2', 'continued')?.summary === chat.summary, 'branch preserves the summary from a continued chat');

if (fails) process.exitCode = 1;
