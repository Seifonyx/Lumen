import { applyEdit, cleanPath, isApplied, lineStats, parseEdit, readRequests, replaceReadRequests, unifiedDiff } from '../../src/lib/edits';
import { asksForFiles, mentionedPaths } from '../../src/lib/workspace';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };
const file = `export function add(a, b) {\n  return a + b;\n}\n\nexport function sub(a, b) {\n  return a - b;\n}\n`;

const e1 = parseEdit('edit', 'src/math.js', `<<<<<<< SEARCH\n  return a + b;\n=======\n  return Number(a) + Number(b);\n>>>>>>> REPLACE\n`);
check(e1.kind === 'patch' && e1.hunks.length === 1, 'parses SEARCH/REPLACE');
let r = applyEdit(file, e1);
check(r.ok && r.text.includes('return Number(a) + Number(b);') && r.text.includes('return a - b;'), 'applies an exact match');
check(isApplied(r.text, e1) && !isApplied(file, e1), 'knows when it is already applied');

const e2 = parseEdit('edit', './src/math.js', `<<<<<<< SEARCH\nexport function sub(a, b) {\nreturn a - b;\n}\n=======\nexport function sub(a, b) {\nreturn a - b; // difference\n}\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nexport function add(a, b) {\n=======\n/** Adds. */\nexport function add(a, b) {\n>>>>>>> REPLACE`);
r = applyEdit(file, e2);
check(e2.path === 'src/math.js' && r.ok && r.text.includes('  return a - b; // difference') && r.text.startsWith('/** Adds. */'), `two hunks, indentation the model dropped is put back:\n${r.text}`);

const bad = parseEdit('edit', 'src/math.js', `<<<<<<< SEARCH\nreturn a * b;\n=======\nreturn 0;\n>>>>>>> REPLACE`);
r = applyEdit(file, bad);
check(!r.ok && r.failed === 1 && r.text === file, 'text that is not in the file is reported, nothing changes');

const w = parseEdit('edit', 'README.md', '# Hello\n\nNew readme');
check(w.kind === 'write' && applyEdit(null, w).ok && applyEdit(null, w).text === '# Hello\n\nNew readme\n', 'block without markers = whole (new) file');
const d = parseEdit('delete', 'old.txt', '');
check(d.kind === 'delete' && applyEdit('x', d).ok && !applyEdit(null, d).ok && isApplied(null, d), 'delete');
const s = lineStats(file, applyEdit(file, e1).text);
check(s.added === 1 && s.removed === 1, 'line stats');
const diff = unifiedDiff(file, applyEdit(file, e1).text);
check(diff.some((l) => l.type === 'del' && l.text === '  return a + b;') && diff.some((l) => l.type === 'add' && l.text.includes('Number(a)')), 'unified diff');
check(cleanPath('`./src\\x.ts`') === 'src/x.ts' && cleanPath(' /a/b.js ') === 'a/b.js', 'paths cleaned');
check(readRequests('I need to see:\n[[read: src/app.ts]]\n[[ read : ./package.json ]]\n[[read: src/app.ts]]').join() === 'src/app.ts,package.json', 'read requests');
const variants = 'Let me look.\n[read: src/a.ts]\n[[read src/b.ts]]\n<read>src/c.ts</read>\nread_file("src/d.ts")\nREAD: `src/e.ts`\n[read more](https://x.y) and [read: the docs]';
check(readRequests(variants).join() === 'src/a.ts,src/b.ts,src/c.ts,src/d.ts,src/e.ts', `read request variants (${readRequests(variants).join()})`);
check(replaceReadRequests('[read more](https://x.y)\n[[read: a.ts]]', (p) => `<${p}>`) === '[read more](https://x.y)\n<a.ts>', 'links are not read requests');
const tree = ['src/App.tsx', 'src/store.ts', 'src/components/ChatView.tsx', 'src/components/Composer.tsx', 'lib/index.ts', 'src/index.ts', 'package.json', 'node_modules/x/index.js'].map((path) => ({ path, size: 1 })) as any[];
const asked = "To fix it I need to see the code. Could you share `src/App.tsx`, ChatView.tsx, components/Composer.tsx and package.json? Also index.ts. See https://react.dev/learn.html\n```ts\nimport x from './store.ts'\n```";
check(mentionedPaths(asked, tree).join() === 'src/App.tsx,src/components/ChatView.tsx,src/components/Composer.tsx,package.json', `paths named in a reply (${mentionedPaths(asked, tree).join()})`);
check(asksForFiles(asked) && asksForFiles('Please provide the contents of store.ts') && !asksForFiles('I changed store.ts to fix the bug.'), 'replies asking for files');
// Malformed edits must never leave markers in the code.
const stray = parseEdit('edit', 'src/App.tsx', 'export default function App() {\n  return null;\n}\n>>>>>>> REPLACE');
check(stray.kind === 'write' && !(stray as any).content.includes('>>>>>>>'), 'stray REPLACE marker dropped from a whole-file edit');
const half = parseEdit('edit', 'src/app.js', '  return a + b;\n=======\n  return a - b;\n>>>>>>> REPLACE');
check(half.kind === 'patch' && applyEdit(file, half).text.includes('return a - b;') && !applyEdit(file, half).text.includes('====='), 'edit with the SEARCH line missing still applies');
const md = parseEdit('edit', 'README.md', 'Title\n=======\n\ntext');
check(md.kind === 'write' && (md as any).content.includes('======='), 'markdown underline headings left alone');
const big = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
const partial = applyEdit(big, parseEdit('edit', 'x.ts', 'line 5\nline 6 changed'));
check(!partial.ok && 'reason' in partial && /replace all 100 lines/.test(partial.reason || '') && partial.text === big, 'a partial "whole file" edit is refused instead of wiping the file');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
