import { applyEdit, cleanPath, isApplied, lineStats, parseEdit, readRequests, unifiedDiff } from '../../src/lib/edits';
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
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
