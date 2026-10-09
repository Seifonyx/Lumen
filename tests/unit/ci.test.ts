import { logExcerpt, overall } from '../../src/lib/ci';
import { htmlDocument, prepareJs, runLang } from '../../src/lib/runner';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };

const log = [...Array.from({ length: 300 }, (_, i) => `2026-10-09T18:00:00.1234567Z step ${i}`), '2026-10-09T18:01:00.0000000Z \x1b[31mFAIL\x1b[0m tests/app.test.js', '2026-10-09T18:01:00.0000000Z   Expected 3, received "12"', '2026-10-09T18:01:01.0000000Z ##[error]Process completed with exit code 1.'].join('\n');
const ex = logExcerpt(log);
check(ex.includes('FAIL tests/app.test.js') && ex.includes('##[error]Process completed') && !ex.includes('2026-10-09T') && !ex.includes('\x1b'), 'failing lines kept; timestamps and colours removed');
check(!ex.includes('step 10\n') && ex.includes('step 299') && ex.startsWith('…'), 'unrelated early lines dropped, context before the error kept');
check(logExcerpt('a\nb\nc').includes('c'), 'no error markers → the end of the log');
check(logExcerpt(Array.from({ length: 5000 }, (_, i) => `error ${i}`).join('\n'), 2000).length <= 2010, 'long excerpts are capped');

check(overall([]) === 'none' && overall([{ id: 'a', name: 'a', state: 'success', url: '' }, { id: 'b', name: 'b', state: 'pending', url: '' }]) === 'pending' && overall([{ id: 'a', name: 'a', state: 'failure', url: '' }, { id: 'b', name: 'b', state: 'neutral', url: '' }]) === 'failure', 'overall check state');

const js = prepareJs("import _ from 'lodash';\nimport { x } from './local.js';\nimport fs from 'node:fs';\nconst d = await import('dayjs');\nimport 'zone.js';\nimport y from 'https://esm.sh/y';");
check(js.includes("from 'https://esm.sh/lodash'") && js.includes("from './local.js'") && js.includes("import('https://esm.sh/dayjs')") && js.includes("import 'https://esm.sh/zone.js'") && js.includes("'https://esm.sh/y'") && js.includes("'fs' is a Node.js module"), 'npm imports → esm.sh, Node modules explained');
check(runLang('Python') === 'python' && runLang('ts') === 'ts' && runLang('html') === 'html' && runLang('sql') === null && runLang('') === null, 'runnable languages');
check(htmlDocument('<p>x</p>').includes('__runner') && htmlDocument('<html><head><title>t</title></head></html>').indexOf('__runner') < htmlDocument('<html><head><title>t</title></head></html>').indexOf('<title>'), 'console bridge goes first in HTML pages');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
