// Phone layout: at 320 and 390 px wide nothing spills past the screen or out of its box — long model
// names, chat titles, links, words, tables, code and file names, the model menu and every settings section.
const { chromium } = require('playwright');
const path = require('path');
const { scan } = require('./helpers/fitscan.cjs');
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
const F = '````';
const LONG_TITLE = 'Quarterly emergency department staffing and overtime analysis for the whole hospital';
const REPLY = [
  'Here is everything: https://example.com/a/really/long/link/that/does/not/have/any/spaces/in/it/at/all/so/it/must/wrap/somewhere?with=query&and=more',
  '',
  'Supercalifragilisticexpialidociouspneumonoultramicroscopicsilicovolcanoconiosisantidisestablishmentarianism and `window.someVeryLongObject.withAChainOfProperties.thatNeverEnds.atAll()`.',
  '',
  '| Department | Nurses | Doctors | Overtime hours | Shifts missed | Notes |',
  '|---|---|---|---|---|---|',
  '| Emergency | 42 | 18 | 1,240 | 12 | Needs two more senior nurses on nights |',
  '',
  '```js',
  'const result = await fetchEverythingFromTheServer({ department: "emergency", includeOvertime: true, includeShifts: true });',
  '```',
  '',
  '$$\\sum_{i=1}^{n} \\frac{overtime_i \\times rate_i}{shifts_i + missed_i} = total\\ cost\\ of\\ overtime\\ across\\ departments$$',
  '',
  `${F}file:Emergency_department_staffing_report_for_the_quarterly_board_meeting.pptx`,
  JSON.stringify({ title: 'Update', slides: [{ layout: 'title', title: 'Update', subtitle: 'March' }] }),
  F,
].join('\n');

async function run(browser, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 720 }, isMobile: true, hasTouch: true });
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [
      { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3-flash-preview-long-context-experimental-1029', displayName: 'Gemini 3 Flash Preview Long Context Experimental Edition 1029', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
    ] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: LONG_TITLE }] } }] } });
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: REPLY }] }, finishReason: 'STOP' }] }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('input[placeholder="AIza…"]');
  const shot = (n) => page.screenshot({ path: path.join(__dirname, 'out', `fit-${width}-${n}.png`) });
  const look = async (label) => {
    const bad = await scan(page);
    check(!bad.length, `${width}px ${label}${bad.length ? `:\n      ${bad.join('\n      ')}` : ''}`);
  };

  await look('API keys (first sign-in)');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.click('button:has-text("Save keys")');
  await page.waitForTimeout(1200);
  for (const name of ['General', 'API keys', 'Models', 'Usage', 'Personalization', 'Memory', 'Privacy & data']) {
    if (await page.isVisible('.settings-back')) await page.click('.settings-back');
    if (name === 'General') await look('settings menu');
    await page.click(`.settings-tabs >> text=${name}`);
    await page.waitForTimeout(200);
    if (name === 'Models') {
      await page.locator('.models-nav button').filter({ hasText: 'Browse models' }).click();
      await page.click('[aria-label^="Add Gemini 3 Flash Preview"]');
      await page.waitForTimeout(200);
    }
    await look(`settings: ${name}`);
    await shot(`settings-${name.replace(/\s/g, '')}`);
  }
  if (await page.isVisible('.settings-back')) await page.click('.settings-back');
  await page.click('.settings-tabs >> text=Models');
  await page.locator('.models-nav button').filter({ hasText: 'Layouts' }).click();
  await page.click('[aria-label="Edit Everyday"]');
  await page.fill('.layout-editor input[placeholder*="Add a model"]', 'gemini');
  await look('layout editor');
  await shot('layout-editor');
  await page.click('.layout-editor >> text=Cancel');
  await page.click('.settings-page [aria-label="Close"]');

  await page.waitForSelector('.app:not(.app-skeleton) .topbar');
  await look('new chat');
  await shot('empty');
  await page.fill('.composer textarea', 'Please check https://example.com/another/very/long/link/without/any/spaces/that/goes/on/and/on/forever and AVeryLongWordWithoutAnySpacesThatSomeoneMightPasteIntoTheChatBox1234567890');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant .model-tag', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await look('chat with long content');
  await shot('chat');
  await page.click('.model-button');
  await page.waitForTimeout(200);
  await look('model menu');
  await shot('model-menu');
  await page.click('.models-pop .mp-title:text-is("Gemini 3 Flash Preview Long Context Experimental Edition 1029")');
  await page.waitForTimeout(200);
  await look('long model name in the top bar');
  await page.evaluate(() => document.querySelector('.messages')?.scrollTo({ top: 0 }));
  await page.waitForTimeout(200);
  await shot('chat-top');
  await page.click('.menu-btn');
  await page.waitForTimeout(300);
  // Let the drawer finish sliding in before measuring it.
  await page.waitForFunction(() => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.target?.closest?.('.sidebar')), null, { timeout: 3000 }).catch(() => {});
  await look('sidebar with a long chat title');
  await shot('sidebar');
  check(!errors.length, `${width}px no page errors ${errors.join(' | ')}`);
  await ctx.close();
}

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  await run(browser, 390);
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  await run(browser, 320);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
