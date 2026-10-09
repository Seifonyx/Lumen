import { indexable, outline, projectMap, relevantFiles, searchCode, searchRequests } from '../../src/lib/repoindex';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };

const store = "import x from 'y';\nexport const useStore = create(() => ({}));\nexport async function loadCatalog() {\n  return fetchModels();\n}\nfunction helper() {}\nexport { a as modelLabel, b };\n";
const composer = "export default function Composer() {\n  const send = useStore((s) => s.send);\n  return <textarea />;\n}\n";
const py = 'class Router:\n    def route(self):\n        pass\n\ndef main():\n    pass\n';
const files = new Map([['src/store.ts', store], ['src/components/Composer.tsx', composer], ['tools/router.py', py]]);
const index = { files, complete: true };
const chat = { id: 'c', messages: [], changes: { 'src/new.ts': { content: 'export const useStoreSoon = 1;\n' } } } as any;

check(outline('src/store.ts', store).join() === 'useStore,loadCatalog,helper,modelLabel,b', `JS/TS outline (${outline('src/store.ts', store).join()})`);
check(outline('src/components/Composer.tsx', composer).join() === 'Composer' && outline('tools/router.py', py).join() === 'Router,main', 'component and Python outline');
const map = projectMap(chat, index);
check(/src\/store\.ts: useStore, loadCatalog/.test(map) && /src\/new\.ts: useStoreSoon/.test(map) && /tools\/router\.py: Router, main/.test(map), 'project map includes uncommitted files');

const r = searchCode(chat, index, 'useStore');
check(r.count === 3 && /src\/store\.ts:2: export const useStore/.test(r.text) && /src\/components\/Composer\.tsx:2:/.test(r.text) && /src\/new\.ts:1:/.test(r.text), `search finds uses with path:line (${r.count})`);
check(searchCode(chat, index, '/load\\w+\\(/').count === 1 && searchCode(chat, index, 'nothing-here').text.includes('no matches'), 'regex search and no matches');
check(searchRequests('Let me look.\n[[search: useStore]]\n[[grep: /fetch\\w+/]]\n[search: x]').join('|') === 'useStore|/fetch\\w+/', 'search requests');

const tree = [...files.keys(), 'src/components/ChatView.tsx', 'src/lib/routing.ts', 'package.json', 'node_modules/a/index.js', 'README.md'].map((path) => ({ path, size: 100 }));
check(relevantFiles('The message box (composer) loses text when I switch chats', tree, index)[0] === 'src/components/Composer.tsx', 'request about the composer → Composer.tsx');
check(relevantFiles('loadCatalog fails sometimes', tree, index)[0] === 'src/store.ts', 'a function name → the file that defines it');
check(relevantFiles('make it nicer', tree, index).length === 0, 'vague requests attach nothing');
check(relevantFiles('auto routing picks the wrong model', tree, null).includes('src/lib/routing.ts'), 'works before the index is ready');

const big = Array.from({ length: 500 }, (_, i) => ({ path: `src/f${i}.ts`, size: 1000 })).concat([{ path: 'logo.png', size: 1 }, { path: 'dist/app.js', size: 1 }]);
const ix = indexable(big);
check(ix.take.length === 400 && !ix.complete && !ix.take.some((f) => /png|dist/.test(f.path)), 'big repos: capped, binaries and builds skipped');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
