// Running code from replies in the browser: JavaScript, TypeScript, HTML pages, stopping endless loops,
// sending the output back to the chat, and Python (when the Pyodide CDN can be reached).
const { chromium } = require('playwright');
const path = require('path');
const { scan } = require('./helpers/fitscan.cjs');
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
const T = '```';
const REPLY = [
  'JavaScript:',
  `${T}js\nconst add = (a, b) => a + b;\nconsole.log('sum', add(1, 2));\nconsole.log({ a: [1, 2], b: 'x' });\nconsole.error(new Error('boom').message);\n${T}`,
  'TypeScript:',
  `${T}ts\ninterface P { name: string }\nconst greet = (p: P): string => \`Hi \${p.name}\`;\nconsole.log(greet({ name: 'Seif' }));\n${T}`,
  'Loop:',
  `${T}javascript\nconsole.log('start');\nwhile (true) {}\n${T}`,
  'Page:',
  `${T}html\n<button id="b" onclick="console.log('clicked', 1 + 1)">Press</button>\n<script>console.log('page ready')</script>\n${T}`,
  'Python:',
  `${T}python\nimport math\nprint('root', math.sqrt(16))\n${T}`,
  'Not runnable:',
  `${T}sql\nSELECT 1;\n${T}`,
].join('\n\n');

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const pyReachable = await fetch('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js', { method: 'HEAD' }).then((r) => r.ok, () => false);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const ai = [];
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Run Test' }] } }] } });
    const body = JSON.parse(route.request().postData());
    ai.push(body);
    const reply = ai.length === 1 ? REPLY : 'Thanks for the output.';
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: reply }] }, finishReason: 'STOP' }] }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.click('text=Save keys');
  await page.waitForTimeout(1200);
  await page.click('.settings-page [aria-label="Close"]');
  await page.fill('.composer textarea', 'show me some code');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant .model-tag', { timeout: 20000 });

  const runs = await page.$$eval('.code-block', (els) => els.map((e) => Boolean(e.querySelector('[data-run-code]'))));
  check(runs.join() === 'true,true,true,true,true,false', `Run on JS, TS, HTML and Python blocks, not SQL (${runs.join()})`);

  const out = () => page.textContent('.run-out');
  const openRun = async (n) => {
    await page.click(`.code-block >> nth=${n} >> [data-run-code]`);
    await page.waitForSelector('.run-panel');
  };
  const closeRun = async () => {
    await page.click('.modal [aria-label="Close"]');
    await page.waitForSelector('.run-panel', { state: 'detached' });
  };

  // JavaScript
  await openRun(0);
  await page.waitForFunction(() => /Finished|Failed/.test(document.querySelector('.run-status')?.textContent || ''), null, { timeout: 15000 });
  let o = await out();
  check(o.includes('sum 3') && o.includes("{ a: [1, 2], b: \"x\" }") && o.includes('boom'), `JavaScript output (${o.replace(/\s+/g, ' ').slice(0, 120)})`);
  check(await page.isVisible('.run-line.error >> text=boom'), 'console.error shown as an error');
  await page.screenshot({ path: path.join(__dirname, 'out', 'run-js.png') });
  // Edit and run again
  await page.click('.run-code .cm-content');
  await page.keyboard.press('Control+End');
  await page.keyboard.type("\nconsole.log('edited ' + (6 * 7));");
  await page.click('.modal >> text=Run again');
  await page.waitForFunction(() => document.querySelector('.run-out')?.textContent.includes('edited 42'), null, { timeout: 15000 });
  check(true, 'edited code runs again');
  // Send output to the chat
  await page.click('.modal >> text=Ask to fix');
  await page.waitForSelector('.run-panel', { state: 'detached' });
  await page.waitForFunction(() => document.body.textContent.includes('Thanks for the output'), null, { timeout: 20000 });
  const sent = JSON.stringify(ai[1].contents.at(-1));
  check(sent.includes('it failed') && sent.includes('sum 3') && sent.includes('edited 42') && sent.includes('I changed it'), 'output (and the changed code) sent to the chat');

  // TypeScript
  await openRun(1);
  await page.waitForFunction(() => /Finished|Failed/.test(document.querySelector('.run-status')?.textContent || ''), null, { timeout: 15000 });
  o = await out();
  check(o.includes('Hi Seif') && !o.includes('Error'), `TypeScript runs (${o.replace(/\s+/g, ' ').slice(0, 80)})`);
  await closeRun();

  // Endless loop → Stop
  await openRun(2);
  await page.waitForFunction(() => document.querySelector('.run-out')?.textContent.includes('start'), null, { timeout: 15000 });
  await page.click('.modal >> text=Stop');
  await page.waitForFunction(() => document.querySelector('.run-out')?.textContent.includes('Stopped.'), null, { timeout: 5000 });
  check(await page.isVisible('.modal >> text=Run again'), 'endless loop stopped');
  await closeRun();

  // HTML page
  await openRun(3);
  const frame = page.frameLocator('.run-page');
  await frame.locator('#b').click();
  await page.waitForFunction(() => document.querySelector('.run-out')?.textContent.includes('clicked 2'), null, { timeout: 10000 });
  check((await out()).includes('page ready'), 'HTML page shown, its console logs come through');
  check(await page.$eval('.run-page', (f) => f.getAttribute('sandbox')) === 'allow-scripts allow-modals allow-forms', 'page is sandboxed away from the app');
  await page.screenshot({ path: path.join(__dirname, 'out', 'run-html.png') });
  await closeRun();

  // Python (needs jsDelivr)
  if (pyReachable) {
    await openRun(4);
    await page.waitForFunction(() => document.querySelector('.run-out')?.textContent.includes('root 4.0'), null, { timeout: 120000 });
    check(true, 'Python runs with Pyodide');
    await closeRun();
  } else console.log('SKIP  Python (jsDelivr not reachable here)');

  // Phone
  await page.setViewportSize({ width: 360, height: 760 });
  await page.waitForTimeout(800); // the sidebar slides away
  await openRun(0);
  await page.waitForFunction(() => /Finished|Failed/.test(document.querySelector('.run-status')?.textContent || ''), null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const bad = await scan(page);
  check(!bad.length, `phone: run panel fits${bad.length ? `:\n      ${bad.join('\n      ')}` : ''}`);
  await page.screenshot({ path: path.join(__dirname, 'out', 'run-phone.png') });

  check(!errors.length, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
