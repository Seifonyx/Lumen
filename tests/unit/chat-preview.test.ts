import { chatPreview } from '../../src/lib/chat-preview';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };

check(chatPreview('**Draft** an email to `suppliers` about the _new_ [terms](https://example.invalid)', 'Email') === 'Draft an email to suppliers about the new terms', 'Markdown emphasis, code and links are stripped');
check(chatPreview('## Q3\n\n| Unit | Nurses |\n|---|---|\n| ER | 42 |', 'Staffing') === 'Q3 Unit Nurses ER 42', 'headings and table syntax are stripped');
check(chatPreview('- [x] done\n> quoted\n1. first', 'List') === 'done quoted first', 'list, task and quote markers are stripped');
check(chatPreview('Fix login on Safari', 'Fix login on Safari') === '', 'a line that repeats the title is left empty');
check(chatPreview('fix LOGIN on safari!', 'Fix login on Safari') === '', 'title repeats are matched loosely');
check(chatPreview('', 'Empty') === '' && chatPreview(undefined, 'Empty') === '', 'empty chats have no line');
check(chatPreview('snake_case_name and 2*3*4', 'x') === 'snake_case_name and 2*3*4', 'intra-word underscores and asterisks stay');
check(chatPreview('<img src=x onerror=alert(1)> hello', 'x') === 'hello', 'HTML tags are removed as text, never parsed');
check(chatPreview('a'.repeat(300), 'x').length === 120, 'long lines are cut to 120 characters');

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
