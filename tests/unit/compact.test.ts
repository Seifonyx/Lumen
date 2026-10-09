import { activeSummary, contextTokens, cutPoint, liveMessages, summaryPrompt, withSummary, compactLimit } from '../../src/lib/compact';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };
const msg = (i: number, role: 'user' | 'assistant', len = 400) => ({ id: 'm' + i, role, text: 'x'.repeat(len), createdAt: i });
const conv = (n: number, len = 400) => Array.from({ length: n }, (_, i) => msg(i, i % 2 ? 'assistant' : 'user', len));

check(cutPoint(conv(3)) === 0, 'short chat: nothing to compact');
const c20 = conv(20);
const cut = cutPoint(c20);
check(cut === 14 && c20[cut].role === 'user', `auto keeps last 6, starts on a user message (cut=${cut})`);
check(cutPoint(c20, true) === 18, 'manual keeps only the last exchange');
const big = conv(10, 20_000); // 5k tokens each
const cb = cutPoint(big);
check(big.length - cb <= 4 && big[cb].role === 'user', `large messages: keeps ~12k tokens (kept ${big.length - cb})`);
const huge = [msg(0, 'user', 200_000), msg(1, 'assistant', 4000), msg(2, 'user', 100)];
check(cutPoint(huge) === 2, 'one giant message gets summarized, newest question kept');
const odd = [...conv(9), msg(99, 'user', 100)]; // ends with a new user message
const co = cutPoint(odd);
check(odd[co].role === 'user' && co > 0 && co < odd.length, `ends on new user message (cut=${co})`);

const chat: any = { id: 'c', title: 't', createdAt: 0, updatedAt: 0, messages: c20 };
check(contextTokens(chat) > 2000 && liveMessages(chat).length === 20, 'no summary: everything live');
chat.summary = { text: 'SUMMARY', upTo: 'm13', count: 14, saved: 0, createdAt: 0 };
check(liveMessages(chat).length === 6 && liveMessages(chat)[0].id === 'm14', 'summary: only later messages live');
check(contextTokens(chat) < 1000, 'context shrinks');
const stale = { ...chat, messages: c20.slice(0, 10) };
check(activeSummary(stale) === null && liveMessages(stale).length === 10, 'summary ignored once its messages are gone');
const w = withSummary(activeSummary(chat), liveMessages(chat));
check(w.length === 6 && w[0].text.startsWith('[The earlier part') && w[0].text.includes('SUMMARY') && w[0].role === 'user', 'summary placed in first kept user message');
const w2 = withSummary(chat.summary, [{ role: 'assistant' as const, text: 'a' }]);
check(w2.length === 2 && w2[0].role === 'user', 'summary prepended when kept part starts with the assistant');
const cont = withSummary({ text: 'S', upTo: null, count: 3, saved: 0, createdAt: 0, from: 'Budget' }, [{ role: 'user' as const, text: 'hi' }]);
check(cont[0].text.includes('continues an earlier conversation ("Budget")'), 'continued chat intro');
const p = summaryPrompt([{ ...msg(1, 'user'), text: 'hello', files: [{ id: 'f', kind: 'text', name: 'a.xlsx', mime: 'x', size: 1, text: 'cells' }, { id: 'g', kind: 'image', name: 'p.png', mime: 'image/png', size: 1 }] }] as any, { text: 'OLD', upTo: 'x', count: 2, saved: 0, createdAt: 0 });
check(p.includes('<earlier_summary>\nOLD') && p.includes('a.xlsx":\ncells') && p.includes('Attached image "p.png"') && p.includes('USER:\n'), 'prompt includes previous summary and files');
check(compactLimit({ context: 32768 } as any) === 19660 && compactLimit() === 50000, 'limit follows small context windows');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
