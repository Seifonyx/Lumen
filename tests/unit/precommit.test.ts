import { checkChanges, problemsMessage } from '../../src/lib/precommit';
let fails = 0;
const check = (c: boolean, l: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) fails++; };
const ch = (content: string | null) => ({ content, original: '' });

(async () => {
  const p = await checkChanges({
    'src/App.tsx': ch('export default function App() {\n  return <div />;\n}\n>>>>>>> REPLACE\n'),
    'src/ok.tsx': ch('export const A = ({ x }: { x: number }) => <b>{x}</b>;\n'),
    'src/bad.ts': ch('const a: number = ;\n'),
    'src/old.js': ch('function f() {\n  return [1, 2;\n}\n'),
    'package.json': ch('{ "name": "x", }'),
    'tsconfig.json': ch('{ // comments are fine here\n}'),
    'gone.ts': ch(null),
    'README.md': ch('Title\n=======\n'),
  });
  const by = Object.fromEntries(p.map((x) => [x.path, x]));
  check(by['src/App.tsx']?.line === 4 && /marker/.test(by['src/App.tsx'].message), 'leftover marker found with its line');
  check(!by['src/ok.tsx'] && !by['tsconfig.json'] && !by['gone.ts'] && !by['README.md'], 'valid TSX, tsconfig comments, deleted files and markdown pass');
  check(/Syntax error/.test(by['src/bad.ts']?.message || '') && by['src/bad.ts'].line === 1 && /Syntax error/.test(by['src/old.js']?.message || ''), `syntax errors found (${by['src/bad.ts']?.message})`);
  check(/Not valid JSON/.test(by['package.json']?.message || ''), 'broken JSON found');
  check(p.length === 4 && /src\/App\.tsx \(line 4\)/.test(problemsMessage(p)), 'message for the model');
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();
