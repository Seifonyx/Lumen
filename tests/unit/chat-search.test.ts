// Conversation search (src/lib/chat-search.ts) and opening a chat at a message (src/lib/message-jump.ts).
import { chatMatches, excerptText, findIn, messageMatch, searchKey } from '../../src/lib/chat-search';
import { requestJump, takeJump, takeJumpHere } from '../../src/lib/message-jump';
import type { Chat } from '../../src/types';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };
const chat = (id: string, title: string, texts: string[]): Chat => ({ id, title, createdAt: 0, updatedAt: 0, messages: texts.map((text, i) => ({ id: `${id}-${i}`, role: i % 2 ? 'assistant' : 'user', text, createdAt: i })) });

// The query and the rule every search shares.
check(searchKey('  TRAM 28 ') === 'tram 28', 'the query is trimmed and lower-cased');
const lisbon = chat('c1', 'Lisbon', ['Is the tram worth it?', 'Yes.', 'Which line?', 'Ride **TRAM 28** early, before 9.', 'At night?', 'Evening trams are quieter.']);
const old = (c: Chat, q: string) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q));
for (const q of ['tram', 'lisbon', 'night', 'nothing here', '28']) check(chatMatches(lisbon, q) === old(lisbon, q), `same chats as before for "${q}"`);

// Where a message matched.
const m = messageMatch(lisbon, 'tram');
check(m?.messageId === 'c1-5' && m.count === 3, 'the newest matching message is the target; all matching messages are counted');
check(m?.excerpt.match === 'tram' && m.excerpt.before === 'Evening ' && m.excerpt.after === 's are quieter.', 'the excerpt keeps the match as written, with its neighbours');
check(messageMatch(lisbon, 'lisbon') === null, 'a title match opens as before (no message target)');
check(messageMatch(lisbon, 'nothing here') === null, 'no match, no target');
check(messageMatch(chat('c2', 'x', ['Ride **TRAM 28** early']), 'tram 28')?.excerpt.match === 'TRAM 28', 'Markdown emphasis is stripped from the excerpt; the match keeps its case');
check(excerptText(messageMatch(chat('c3', 'x', ['See [the map](https://example.invalid/tram) for details']), 'map')!.excerpt) === 'See the map for details', 'links keep their words, not their address');
check(messageMatch(chat('c4', 'x', ['Open https://example.invalid/tram-times now']), 'tram-times')?.excerpt.match === 'tram-times', 'a match inside syntax still gets an excerpt from the raw text');
const long = messageMatch(chat('c5', 'x', [`${'Some words before the part that matters. '.repeat(20)}Here is the tram stop you asked about. ${'And then a lot more text afterwards. '.repeat(20)}`]), 'tram')!;
check(long.excerpt.before.startsWith('…') && long.excerpt.after.endsWith('…'), 'a long message is cut at both ends, with ellipses');
check(!/^…\S*\s/.test(long.excerpt.before) || long.excerpt.before.length <= 24, 'the excerpt starts on a whole word');
check(long.excerpt.before.length <= 24 && excerptText(long.excerpt).length <= 180, 'the match stays near the start of a one-line excerpt');
check(!messageMatch(chat('c6', 'x', ['a\n\n\nb tram']), 'tram')!.excerpt.before.includes('\n'), 'line breaks become spaces');

// Unicode: lower-casing that changes length (İ), emoji, Arabic and punctuation.
check(JSON.stringify(findIn('Visit İSTANBUL’s T1', 'stanbul')) === JSON.stringify({ index: 7, length: 7 }), 'positions map back after İ lower-cases to two characters');
check(findIn('İİİ tram', 'tram')?.index === 4, 'a match after several İ is placed correctly');
const unicode = chat('c7', 'Café', ['«الترام» and the Straßenbahn — 🚋 T1!']);
check(messageMatch(unicode, 'الترام')?.excerpt.match === 'الترام', 'Arabic matches');
check(messageMatch(unicode, 'straße')?.excerpt.match === 'Straße', 'ß matches and keeps its case');
check(messageMatch(unicode, '🚋 t1')?.excerpt.match === '🚋 T1', 'emoji and punctuation around a match survive');
check(messageMatch(unicode, 'café') === null, 'accented title matches stay title matches');

// Speed: what one keystroke does in a large account.
const big = Array.from({ length: 300 }, (_, c) => chat(`b${c}`, `Chat ${c}`, Array.from({ length: 200 }, (_, i) => `Message ${i} about the plans for week ${c}, with some ordinary words${i === 150 && c % 7 === 0 ? ' and a tram' : ''}.`)));
const t0 = performance.now();
const hits = big.filter((c) => chatMatches(c, 'tram')).map((c) => messageMatch(c, 'tram'));
const ms = performance.now() - t0;
console.log(`      300 chats × 200 messages: ${ms.toFixed(1)} ms`);
check(hits.length === 43 && hits.every((h) => h?.count === 1), 'large account: the right chats and targets');
check(ms < 120, 'large account: one keystroke stays fast (generous bound for CI machines)');

// Opening at a message: one request, for one account, for a few seconds, while the message exists.
const target = chat('t', 'Target', ['one', 'two', 'three']);
const other = chat('o', 'Other', ['x']);
const ask = (over: Partial<Parameters<typeof requestJump>[0]> = {}) => requestJump({ chatId: 't', messageId: 't-1', key: 'two', keyboard: false, account: 'u1', ...over });
ask();
check(takeJump(target, 'u1')?.messageId === 't-1', 'the chat it was meant for takes the request');
check(takeJump(target, 'u1') === null, 'a request is used once');
ask();
check(takeJumpHere(other, 'u1') === null && takeJump(target, 'u1')?.messageId === 't-1', 'an open chat leaves another chat’s request waiting');
ask();
check(takeJump(other, 'u1') === null && takeJump(target, 'u1') === null, 'opening a different chat drops the request');
ask();
check(takeJump(target, 'u2') === null, 'another account never takes it');
ask({ messageId: 'gone' });
check(takeJump(target, 'u1') === null, 'a deleted message is not jumped to');
ask();
check(takeJump(target, 'u1', Date.now() + 6000) === null, 'a stale request expires');
ask({ messageId: 't-0' }); ask({ messageId: 't-2' });
check(takeJump(target, 'u1')?.messageId === 't-2', 'the newest request wins');
ask({ account: null });
check(takeJump(target, null)?.messageId === 't-1', 'works before an account is known (local preview)');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
