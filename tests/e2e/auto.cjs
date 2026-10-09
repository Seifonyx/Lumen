// In-app check: Auto option, "why" note, a hanging model replaced, manual text-only model + image rerouted.
const { chromium } = require('playwright');
// Settings is a page: on phones the section list shows first, and a section has a back arrow.
async function openTab(page, name) {
  if (await page.isVisible('.settings-back')) await page.click('.settings-back');
  await page.click(`.settings-tabs >> text=${name}`);
}
const path = require('path');
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let hangFlash = false;
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) {
      return route.fulfill({ json: { models: [
        { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
      ] } });
    }
    const model = /models\/([^:]+):/.exec(url)[1];
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Auto Test' }] } }] } });
    if (hangFlash && model === 'gemini-flash-latest') return; // never answers
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: `Answer from ${model}` }] }, finishReason: 'STOP' }] }) });
  });
  await ctx.route('**/openrouter.ai/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/key')) return route.fulfill({ json: { data: { is_free_tier: true } } });
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder', context_length: 262144, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] } });
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ choices: [{ delta: { content: 'Answer from qwen' } }] }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.fill('input[placeholder="sk-or-…"]', 'o');
  await page.click('text=Save keys');
  await page.waitForTimeout(1500);
  await openTab(page, 'Models');
  for (const label of ['Gemini Flash Latest', 'Gemini 2.5 Pro', 'Qwen3 Coder']) {
    const b = page.locator('.model-list.add .model-row', { hasText: label }).locator('button');
    if (await b.count()) await b.first().click();
  }
  check(await page.isChecked('.settings-section .switch >> nth=1'), 'Auto is on for new chats by default');
  await page.click('.settings-page [aria-label="Close"]');
  check((await page.textContent('.model-button')).includes('Auto'), 'picker shows Auto');

  // Image question in Auto -> a model that reads images, with the reason shown.
  await page.setInputFiles('.composer input[type=file][multiple]', path.join(__dirname, 'fixtures', 'photo.png'));
  await page.waitForFunction(() => document.querySelectorAll('.attachment').length === 1 && !document.querySelector('.attachment.loading'));
  await page.fill('.composer textarea', 'What is in this picture?');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant .model-tag', { timeout: 15000 });
  const tag1 = await page.textContent('.msg.assistant .model-tag');
  check(/Gemini Flash Latest · Auto: reads images/.test(tag1), `Auto picked a vision model and said why (${tag1.trim()})`);
  await page.screenshot({ path: path.join(__dirname, 'out', 'auto-reply.png') });

  // Flash now hangs: the app must give up on it and answer with another model.
  hangFlash = true;
  await page.evaluate(() => {
    // Shorten the wait so the test doesn't take 45 s; the real app waits 45 s.
  });
  await page.fill('.composer textarea', 'hello again');
  const t0 = Date.now();
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant >> nth=1 >> .model-tag', { timeout: 70000 });
  const notice = await page.textContent('.msg.assistant >> nth=1 >> .notice').catch(() => '');
  const tag2 = await page.textContent('.msg.assistant >> nth=1 >> .model-tag');
  check(/didn't respond in time — switched/.test(notice) && !/Flash/.test(tag2), `hanging model replaced after ${Math.round((Date.now() - t0) / 1000)} s → ${tag2.trim()}`);
  hangFlash = false;

  // Manual pick of a text-only model + image -> rerouted with a note.
  await page.click('.model-button');
  await page.click('.models-pop .pop-title:text-is("Qwen3 Coder")');
  await page.setInputFiles('.composer input[type=file][multiple]', path.join(__dirname, 'fixtures', 'photo.png'));
  await page.waitForFunction(() => document.querySelectorAll('.attachment').length === 1 && !document.querySelector('.attachment.loading'));
  await page.fill('.composer textarea', 'and this one?');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant >> nth=2 >> .model-tag', { timeout: 15000 });
  const n3 = await page.textContent('.msg.assistant >> nth=2 >> .notice');
  check(/Qwen3 Coder can't read images — using/.test(n3), `manual text-only model rerouted (${n3.trim()})`);

  check(!errors.length, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
})().catch((e) => { console.error(e); process.exit(2); });
