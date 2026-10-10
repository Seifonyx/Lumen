// Coding workspace + layouts: Max coding layout, connect a GitHub repo, browse/open files, attach a
// file, AI asks to read a file, applies edits, diff, commit to a new branch with a pull request.
const { chromium } = require('playwright');
const path = require('path');
const { scan } = require('./helpers/fitscan.cjs');
async function openTab(page, name) {
  if (await page.isVisible('.settings-back')) await page.click('.settings-back');
  await page.click(`.settings-tabs >> text=${name}`);
}
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
const APP = 'export function add(a, b) {\n  return a + b;\n}\n';
const UTIL = 'export const VERSION = 1;\n';
const F = '````';

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ai = [];
  const gh = { trees: [], commits: [], refs: [], pulls: [], reads: [] };
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [
      { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
    ] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Coding Test' }] } }] } });
    const body = JSON.parse(route.request().postData());
    ai.push({ model: /models\/([^:]+):/.exec(url)[1], body });
    const all = JSON.stringify(body.contents);
    let reply = 'Hi.';
    const last = JSON.stringify(body.contents.at(-1));
    const prior = JSON.stringify(body.contents.slice(0, -1));
    if (last.includes('bump the version')) reply = 'Sure.\n<tool_call>edit path="src/util.js"\n<<<<<<< SEARCH\nexport const VERSION = 1;\n=======\nexport const VERSION = 2;\n>>>>>>> REPLACE\n</tool_call>';
    else if (last.includes('where is VERSION used')) reply = 'Let me find it.\n[[search: VERSION]]';
    else if (last.includes('Search for \\"VERSION\\"')) reply = 'VERSION is defined in src/util.js on line 1.';
    else if (last.includes('multiply gives wrong')) reply = last.includes('file name=\\"src/math/calc.js\\"') ? 'calc.js looks right to me.' : 'No file.';
    else if (last.includes('what is this project')) reply = 'I need to see it first. Could you share the contents of `README.md`?';
    else if (last.includes('Here are the files') && last.includes('# Demo') && prior.includes('what is this project')) reply = 'It is a small demo. Its scripts live in package.json.';
    else if (last.includes('Here are the files') && last.includes('package.json')) reply = 'The package is called demo.';
    else if (all.includes('what is this project')) reply = 'Hm.';
    else if (all.includes('handle strings') && !all.includes('file name=\\"src/app.js\\"')) reply = 'Let me look at the code first.\n[[read: src/app.js]]';
    else if (all.includes('handle strings')) reply = `Here is the change:\n\n${F}edit:src/app.js\n<<<<<<< SEARCH\n  return a + b;\n=======\n  return Number(a) + Number(b);\n>>>>>>> REPLACE\n${F}\n\nAnd a test:\n\n${F}edit:src/app.test.js\nimport { add } from './app.js';\nconsole.assert(add('1', 2) === 3);\n${F}`;
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: reply }] }, finishReason: 'STOP' }] }) });
  });
  await ctx.route('**/api.github.com/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const json = (b, status = 200) => route.fulfill({ status, json: b });
    if (req.headers().authorization !== 'Bearer github_pat_test') return json({ message: 'Bad credentials' }, 401);
    if (p === '/user/repos') return json([{ owner: { login: 'seif' }, name: 'demo', full_name: 'seif/demo', default_branch: 'main', private: true, pushed_at: '2026-10-01T00:00:00Z', description: 'Demo app' }, { owner: { login: 'seif' }, name: 'other', full_name: 'seif/other', default_branch: 'main', private: false, pushed_at: '2026-09-01T00:00:00Z', description: '' }]);
    if (p === '/repos/seif/demo/branches') return json([{ name: 'main' }, { name: 'dev' }]);
    if (p.startsWith('/repos/seif/demo/git/trees/') && req.method() === 'GET') return json({ sha: 't1', truncated: false, tree: [
      { path: 'README.md', type: 'blob', size: 10 }, { path: 'package.json', type: 'blob', size: 20 }, { path: 'src', type: 'tree' },
      { path: 'src/app.js', type: 'blob', size: APP.length }, { path: 'src/math', type: 'tree' }, { path: 'src/math/calc.js', type: 'blob', size: 50 }, { path: 'src/util.js', type: 'blob', size: UTIL.length }, { path: 'assets/logo.png', type: 'blob', size: 999 },
    ] });
    if (p.startsWith('/repos/seif/demo/contents/')) {
      const file = decodeURIComponent(p.slice('/repos/seif/demo/contents/'.length));
      gh.reads.push(file);
      const files = { 'src/app.js': APP, 'src/util.js': UTIL, 'README.md': '# Demo\n', 'package.json': '{ "name": "demo" }\n', 'src/math/calc.js': 'export function multiply(a, b) {\n  return a * b;\n}\n' };
      return files[file] !== undefined ? route.fulfill({ body: files[file], headers: { 'content-type': 'text/plain' } }) : json({ message: 'Not Found' }, 404);
    }
    if (p === '/repos/seif/demo/git/ref/heads/main') return json({ object: { sha: 'base1' } });
    if (p === '/repos/seif/demo/git/commits/base1') return json({ sha: 'base1', tree: { sha: 'tree1' } });
    if (p === '/repos/seif/demo/git/trees' && req.method() === 'POST') { gh.trees.push(JSON.parse(req.postData())); return json({ sha: 'tree2' }, 201); }
    if (p === '/repos/seif/demo/git/commits' && req.method() === 'POST') { gh.commits.push(JSON.parse(req.postData())); return json({ sha: 'c2', html_url: 'https://github.com/seif/demo/commit/c2' }, 201); }
    if (p === '/repos/seif/demo/git/refs' && req.method() === 'POST') { gh.refs.push(JSON.parse(req.postData())); return json({ ref: 'x' }, 201); }
    if (p === '/repos/seif/demo/pulls' && req.method() === 'POST') { gh.pulls.push(JSON.parse(req.postData())); return json({ html_url: 'https://github.com/seif/demo/pull/7' }, 201); }
    if (p === '/repos/seif/demo/actions/runs' && u.searchParams.get('head_sha') === 'c2') return json({ workflow_runs: [{ id: 11, name: 'Tests', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/seif/demo/actions/runs/11' }] });
    if (p === '/repos/seif/demo/commits/c2/status') return json({ statuses: [{ context: 'Vercel', state: 'success', target_url: 'https://vercel.com/x' }] });
    if (p === '/repos/seif/demo/actions/runs/11/jobs') return json({ jobs: [{ id: 21, name: 'unit', conclusion: 'failure', steps: [{ name: 'Checkout', conclusion: 'success' }, { name: 'npm test', conclusion: 'failure' }] }] });
    if (p === '/repos/seif/demo/check-runs/21/annotations') return json([{ path: 'src/app.test.js', start_line: 2, annotation_level: 'failure', message: 'AssertionError: expected 3' }]);
    if (p === '/repos/seif/demo/actions/jobs/21/logs') return gh.logsBlocked ? json({ message: 'blocked' }, 500) : route.fulfill({ headers: { 'content-type': 'text/plain' }, body: Array.from({ length: 200 }, (_, i) => `2026-10-09T18:00:${String(i % 60).padStart(2, '0')}.0000000Z setup line ${i}`).concat(['2026-10-09T18:01:00.0000000Z > node src/app.test.js', '2026-10-09T18:01:01.0000000Z AssertionError: expected 3 but got "12"', '2026-10-09T18:01:01.0000000Z ##[error]Process completed with exit code 1.']).join('\n') });
    return json({ message: `unexpected ${req.method()} ${p}` }, 404);
  });

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.fill('input[placeholder="github_pat_…"]', 'github_pat_test');
  await page.click('text=Save keys');
  await page.waitForTimeout(1500);

  // ---- Layouts
  await openTab(page, 'Models');
  const lt = await page.textContent('.layouts-tab');
  check(/Max coding/.test(lt) && /Everyday/.test(lt) && /Deep thinking/.test(lt) && /Gemini 2\.5 Pro/.test(lt), 'recommended layouts filled with your models');
  await page.click('.layouts-tab >> text=New layout');
  await page.fill('.layout-editor input[placeholder="e.g. Web apps"]', 'Web apps');
  await page.fill('.layout-editor input[placeholder*="Add a model"]', 'flash');
  await page.click('.layout-editor [aria-label="Add Gemini Flash Latest"]');
  await page.click('.layout-editor >> text=Save layout');
  await page.waitForSelector('.layout-card >> text=Web apps');
  check(true, 'custom layout created');
  // Recommended layouts can be edited, reset, removed and brought back.
  await page.click('.layout-card:has-text("Deep thinking") [aria-label="Edit Deep thinking"]');
  await page.fill('.layout-editor input[placeholder="e.g. Web apps"]', 'Hard problems');
  await page.click('.layout-editor >> text=Save layout');
  await page.waitForSelector('.layout-card >> text=Hard problems');
  const names = await page.$$eval('.layout-card .layout-name', (els) => els.map((e) => e.textContent));
  check(names.indexOf('Hard problems') === 2 && !names.includes('Deep thinking') && (await page.textContent('.layout-card:has-text("Hard problems")')).includes('edited'), 'recommended layout edited in place');
  await page.click('[aria-label="Reset Hard problems"]');
  await page.waitForSelector('.layout-card >> text=Deep thinking');
  check(true, 'edited recommended layout reset');
  await page.click('[aria-label="Delete Arabic"]');
  await page.waitForSelector('text=Bring back 1 removed recommended layout');
  check(!(await page.$('.layout-card:has-text("Arabic")')), 'recommended layout removed');
  await page.screenshot({ path: path.join(__dirname, 'out', 'layouts.png') });
  await page.click('text=Bring back 1 removed recommended layout');
  await page.waitForSelector('.layout-card >> text=Arabic');
  check(true, 'removed recommended layouts brought back');
  await page.click('.settings-page [aria-label="Close"]');

  await page.click('.model-button');
  check((await page.textContent('.models-pop')).includes('Max coding') && (await page.textContent('.models-pop')).includes('Web apps'), 'layouts in the model menu');
  await page.screenshot({ path: path.join(__dirname, 'out', 'model-menu-desktop.png'), clip: { x: 260, y: 0, width: 700, height: 720 } });
  await page.click('.models-pop >> text=Max coding');
  check((await page.textContent('.model-button')).includes('Max coding'), 'layout chosen');

  // ---- Connect a repository
  await page.click('.suggestion >> text=Code on a GitHub repo');
  await page.waitForSelector('.repo-row');
  check((await page.textContent('.repo-list')).includes('seif/demo'), 'your repositories listed');
  await page.click('.repo-row >> text=seif/demo');
  await page.waitForSelector('.repo-confirm select');
  await page.click('.repo-confirm >> text=Open repository');
  await page.waitForSelector('.workspace .ws-tree');
  await page.waitForSelector('.ws-dir >> text=src');
  check((await page.textContent('.ws-tree')).includes('README.md'), 'file tree shown');
  await page.click('.ws-dir >> text=src');
  await page.click('.ws-open >> text=app.js');
  await page.waitForSelector('.cm-content', { timeout: 15000 });
  check((await page.textContent('.cm-content')).includes('return a + b;'), 'file opens in the code editor');
  await page.click('[aria-label="Back to files"]');
  await page.click('[aria-label="Add src/util.js to chat"]');
  check((await page.textContent('.repo-strip')).includes('util.js') && (await page.textContent('.repo-strip')).includes('demo'), 'attached file shown in the message box');

  // ---- Ask for a change
  await page.fill('.composer textarea', 'make add() handle strings');
  await page.click('.send-btn');
  await page.waitForSelector('.edit-card', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.edit-card').length === 2 && !document.querySelector('.edit-card .spin'), null, { timeout: 15000 });
  const first = ai[0];
  const sys = first.body.systemInstruction.parts[0].text;
  check(first.model === 'gemini-2.5-pro' && /expert software engineer/.test(sys), 'Max coding used the strongest model with its instructions');
  check(/<project_map>[\s\S]*src\/app\.js: add[\s\S]*src\/math\/calc\.js: multiply/.test(sys) && /\[\[search:/.test(sys), 'model got a map of what each file defines, and can search');
  check(/seif\/demo/.test(sys) && /repository_files>[\s\S]*src\/app\.js/.test(sys) && !/logo\.png/.test(sys) && /\[\[read:/.test(sys), 'model got the repo file list and the editing rules');
  check(JSON.stringify(first.body.contents).includes('export const VERSION'), 'attached file sent with the message');
  check(ai.length === 2 && JSON.stringify(ai[1].body.contents).includes('return a + b;') && !JSON.stringify(ai[1].body.contents.at(-1)).includes('VERSION'), 'AI asked for src/app.js → loaded and it continued (unchanged attached file not re-sent)');
  check((await page.textContent('.msg.auto-files')).includes('src/app.js') && (await page.textContent('.thread')).includes('Reading src/app.js'), 'shown as "Loaded src/app.js"');
  const cards = await page.$$eval('.edit-card', (els) => els.map((e) => e.textContent));
  check(/src\/app\.js/.test(cards[0]) && /\+1/.test(cards[0]) && /−1/.test(cards[0]) && /New file/.test(cards[1]), `edit cards (${cards.join(' | ')})`);
  await page.click('.edit-card >> nth=0 >> text=Review');
  await page.waitForSelector('.diff');
  const diff = await page.textContent('.diff');
  check(diff.includes('return Number(a) + Number(b);') && diff.includes('return a + b;'), 'diff before applying');
  await page.screenshot({ path: path.join(__dirname, 'out', 'coding-diff.png') });
  await page.click('.diff-footer >> text=Apply this change');
  await page.waitForFunction(() => document.querySelector('.edit-card')?.classList.contains('applied'));
  check(true, 'first edit applied');
  await page.click('.apply-all >> text=Apply all');
  await page.waitForFunction(() => document.querySelectorAll('.edit-card.applied').length === 2);
  check((await page.textContent('.code-toggle .badge')) === '2', '2 changes waiting');
  check((await page.textContent('.toasts')).includes('Applied 1 change') && !(await page.textContent('.toasts')).includes("couldn't"), '"Apply all" skips the one already applied');
  await page.screenshot({ path: path.join(__dirname, 'out', 'coding-chat.png') });

  // ---- Commit
  await page.click('.ws-tabs >> text=Changes');
  const changes = await page.textContent('.ws-change-list');
  check(/src\/app\.js\+1−1/.test(changes.replace(/\s/g, '')) && /src\/app\.test\.js/.test(changes), 'changes listed');
  await page.waitForTimeout(500);
  check(!(await page.$('.ws-problems')) && (await page.textContent('.ws-commit')).includes('Commit 2 files'), 'changed files checked before committing: no problems');
  check((await page.inputValue('.ws-commit input[type="text"]')).includes('make add() handle strings') && (await page.inputValue('input[aria-label="New branch name"]')).startsWith('model-router/make-add-handle-strings'), 'commit message and branch suggested');
  await page.click('.ws-commit >> text=& push');
  await page.waitForSelector('.ws-done', { timeout: 15000 });
  const tree = gh.trees[0]?.tree || [];
  check(gh.trees[0]?.base_tree === 'tree1' && tree.length === 2 && tree.find((t) => t.path === 'src/app.js')?.content === 'export function add(a, b) {\n  return Number(a) + Number(b);\n}\n', 'commit has the edited files');
  check(gh.commits[0]?.parents?.[0] === 'base1' && gh.refs[0]?.ref.startsWith('refs/heads/model-router/') && gh.pulls[0]?.base === 'main', 'pushed to a new branch and opened a pull request');
  check((await page.textContent('.ws-done')).includes('pull request') && (await page.textContent('.ws-head')).includes('model-router/'), 'links shown; chat continues on the new branch');

  // ---- Test results of the commit, and fixing a failure
  await page.waitForSelector('.checks-bar.failure', { timeout: 20000 });
  check((await page.textContent('.checks-bar')).includes('Failed on c2: Tests') && !(await page.textContent('.checks-bar')).includes('Vercel'), 'failed GitHub check shown above the message box');
  await page.screenshot({ path: path.join(__dirname, 'out', 'coding-checks.png') });
  const b1 = ai.length;
  await page.click('.checks-bar >> text=Fix this failure');
  await page.waitForFunction((n) => document.querySelectorAll('.msg.assistant').length > n, (await page.$$('.msg.assistant')).length, { timeout: 20000 });
  await page.waitForTimeout(500);
  const fixMsg = JSON.stringify(ai[b1].body.contents.at(-1));
  check(fixMsg.includes('job \\"unit\\" failed at step \\"npm test\\"') && fixMsg.includes('AssertionError: expected 3') && fixMsg.includes('github-checks.log') && !fixMsg.includes('setup line 3\\n'), 'failure details and the relevant log lines sent to the model');
  // When the browser can't read the full log, GitHub's error notes are sent instead.
  gh.logsBlocked = true;
  const b1b = ai.length;
  await page.waitForFunction(() => !document.querySelector('.checks-bar button[disabled]'));
  await page.click('.checks-bar >> text=Fix this failure');
  await page.waitForFunction((n) => document.querySelectorAll('.msg.assistant').length > n, (await page.$$('.msg.assistant')).length, { timeout: 20000 });
  await page.waitForTimeout(500);
  check(JSON.stringify(ai[b1b].body.contents.at(-1)).includes('src/app.test.js:2: failure: AssertionError: expected 3'), "log unreadable → GitHub's error notes sent instead");
  await page.click('[aria-label="Hide test results"]');
  check(!(await page.$('.checks-bar')), 'test results can be hidden');

  // ---- Models that ask for files in words, or only name them
  const before = ai.length;
  await page.fill('.composer textarea', 'what is this project');
  await page.click('.send-btn');
  await page.waitForFunction(() => document.body.textContent.includes('Its scripts live in package.json'), null, { timeout: 20000 });
  check(ai.length === before + 2 && JSON.stringify(ai[before + 1].body.contents.at(-1)).includes('# Demo'), 'asked for README.md in words → loaded automatically');
  await page.waitForSelector('.load-mentioned');
  check((await page.textContent('.load-mentioned')).includes('package.json'), '"Load file & continue" offered for a file the reply names');
  await page.screenshot({ path: path.join(__dirname, 'out', 'coding-load-mentioned.png') });
  await page.click('.load-mentioned >> text=Load file');
  await page.waitForFunction(() => document.body.textContent.includes('The package is called demo'), null, { timeout: 20000 });
  check(ai.length === before + 3 && !(await page.$('.load-mentioned')), 'loaded and continued; offer gone once the file was given');

  // ---- Searching the code
  const b2 = ai.length;
  await page.fill('.composer textarea', 'where is VERSION used');
  await page.click('.send-btn');
  await page.waitForFunction(() => document.body.textContent.includes('VERSION is defined in src/util.js'), null, { timeout: 20000 });
  const found = JSON.stringify(ai[b2 + 1].body.contents.at(-1));
  check(found.includes('src/util.js:1: export const VERSION = 1;'), 'model searched the code and got path:line matches');
  check((await page.textContent('.msg.auto-files >> nth=-1')).includes('Searched VERSION · 1 match') && (await page.textContent('.thread')).includes('Searching the code for VERSION'), 'search shown in the chat');

  // ---- Files a request is about are attached automatically
  const b3 = ai.length;
  await page.fill('.composer textarea', 'multiply gives wrong results');
  await page.click('.send-btn');
  await page.waitForFunction(() => document.body.textContent.includes('calc.js looks right'), null, { timeout: 20000 });
  check(ai.length === b3 + 1 && (await page.textContent('.msg.user >> nth=-1')).includes('calc.js'), 'calc.js (defines multiply) attached automatically');
  check(await page.isVisible('.msg.user >> nth=-1 >> .chip-note'), 'marked as attached automatically');

  // ---- A model writing edits in its own format still gets an Apply card
  await page.fill('.composer textarea', 'bump the version');
  await page.click('.send-btn');
  await page.waitForFunction(() => [...document.querySelectorAll('.edit-card')].some((c) => c.textContent.includes('src/util.js')), null, { timeout: 20000 });
  const lastReply = await page.textContent('.msg.assistant >> nth=-1');
  check(!lastReply.includes('<<<<<<<') && !lastReply.includes('tool_call') && (await page.isVisible('.msg.assistant >> nth=-1 >> .edit-card >> text=Apply')), '<tool_call> edit shown as an edit card');

  // ---- Custom layout as default
  await page.click('.sidebar-foot');
  await openTab(page, 'Models');
  await page.locator('.layout-card', { hasText: 'Web apps' }).locator('[aria-label="Use for new chats"]').click();
  await page.click('.settings-page [aria-label="Close"]');
  await page.click('.menu-btn');
  await page.click('[aria-label="New chat"]');
  check((await page.textContent('.model-button')).includes('Web apps'), 'custom layout is the default for new chats');

  // ---- The coding panel on a phone
  await page.click('.sidebar >> text=Coding Test');
  await page.waitForSelector('.code-toggle');
  await page.setViewportSize({ width: 360, height: 760 });
  await page.waitForTimeout(300);
  if (!(await page.isVisible('.workspace'))) await page.click('.code-toggle');
  await page.waitForSelector('.workspace');
  await page.click('.ws-tabs >> text=Files');
  await page.waitForTimeout(300);
  let bad = await scan(page);
  check(!bad.length, `phone: files panel fits${bad.length ? `:\n      ${bad.join('\n      ')}` : ''}`);
  await page.screenshot({ path: path.join(__dirname, 'out', 'coding-phone-files.png') });
  await page.click('.ws-dir >> text=src');
  await page.click('.ws-dir >> text=math');
  await page.click('.ws-open >> text=calc.js');
  await page.waitForSelector('.cm-content', { timeout: 15000 });
  bad = await scan(page);
  check(!bad.length, `phone: file view fits${bad.length ? `:\n      ${bad.join('\n      ')}` : ''}`);
  await page.screenshot({ path: path.join(__dirname, 'out', 'coding-phone-file.png') });
  await page.click('[aria-label="Back to files"]');
  await page.click('.ws-tabs >> text=Changes');
  await page.waitForTimeout(300);
  bad = await scan(page);
  check(!bad.length, `phone: changes panel fits${bad.length ? `:\n      ${bad.join('\n      ')}` : ''}`);
  await page.screenshot({ path: path.join(__dirname, 'out', 'coding-phone-changes.png') });

  check(!errors.length, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
