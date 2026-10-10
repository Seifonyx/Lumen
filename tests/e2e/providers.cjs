// Groq + Cerebras in the app: keys, models switched on, picker groups, chatting, usage.
const { chromium } = require('playwright');
async function openTab(page, name) {
  if (await page.isVisible('.settings-back')) await page.click('.settings-back');
  await page.click(`.settings-tabs >> text=${name}`);
}
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (chunks) => chunks.map((o) => `data: ${JSON.stringify(o)}\n\n`).join('') + 'data: [DONE]\n\n';

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const seen = [];
  await ctx.route('**/generativelanguage.googleapis.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Provider Test' }] } }] } });
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse([{ candidates: [{ content: { parts: [{ text: 'from gemini' }] }, finishReason: 'STOP' }] }]) });
  });
  await ctx.route('**/api.groq.com/**', (route) => {
    const req = route.request();
    seen.push({ url: req.url(), auth: req.headers().authorization });
    if (req.url().endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'openai/gpt-oss-120b', context_window: 131072, active: true }, { id: 'openai/gpt-oss-20b', context_window: 131072, active: true }, { id: 'whisper-large-v3', active: true }] } });
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse([{ choices: [{ delta: { content: '<think>quick check</think>Hello from Groq' } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }], x_groq: { usage: { prompt_tokens: 40, completion_tokens: 4 } } }]) });
  });
  await ctx.route('**/api.cerebras.ai/**', (route) => {
    const req = route.request();
    seen.push({ url: req.url(), auth: req.headers().authorization });
    if (req.url().endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'gpt-oss-120b' }, { id: 'qwen-3.8-27b' }] } });
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse([{ choices: [{ delta: { content: 'Hello from Cerebras' } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 30, completion_tokens: 3 } }]) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('input[placeholder="AIza…"]');
  check(await page.isVisible('input[placeholder="gsk_…"]') && await page.isVisible('input[placeholder="csk-…"]'), 'Groq and Cerebras key fields');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.click('text=Save keys');
  await page.waitForTimeout(1500);
  // Add Groq + Cerebras later, like a user would.
  await page.fill('input[placeholder="gsk_…"]', 'gsk_test');
  await page.fill('input[placeholder="csk-…"]', 'csk-test');
  await page.click('text=Save keys');
  await page.waitForTimeout(2000);
  check(seen.some((s) => s.url.endsWith('/openai/v1/models') && s.auth === 'Bearer gsk_test') && seen.some((s) => s.url.endsWith('/v1/models') && s.auth === 'Bearer csk-test'), 'model lists fetched with the keys');
  await openTab(page, 'Models');
  const yours = await page.textContent('.model-list:not(.add)');
  check(/GPT-OSS 20B/.test(yours) && /GPT-OSS 120B/.test(yours) && /Groq/.test(yours) && /Cerebras/.test(yours), 'new providers\' suggested models switched on');
  check(!(await page.textContent('.settings-panel')).includes('Whisper'), 'speech models not offered');
  await page.click('.settings-page [aria-label="Close"]');

  await page.click('.model-button');
  const pop = await page.textContent('.models-pop');
  check(/Groq/.test(pop) && /Cerebras/.test(pop), 'picker groups by provider');
  await page.click('.models-pop .mp-title:text-is("GPT-OSS 20B")');
  await page.fill('.composer textarea', 'hi groq');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant .model-tag', { timeout: 20000 });
  check((await page.textContent('.msg.assistant .markdown')).trim() === 'Hello from Groq' && (await page.textContent('.msg.assistant .model-tag')).includes('GPT-OSS 20B'), 'Groq replies (thinking kept separate)');
  check(Boolean(await page.$('.msg.assistant .thinking')), 'its thinking is shown collapsed');

  await page.click('.model-button');
  await page.locator('.models-pop .mp-title:text-is("GPT-OSS 120B")').last().click();
  await page.fill('.composer textarea', 'hi cerebras');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant >> nth=1 >> .model-tag', { timeout: 20000 });
  check((await page.textContent('.msg.assistant >> nth=1 >> .markdown')).includes('Hello from Cerebras'), 'Cerebras replies');

  await page.waitForTimeout(1200);
  await page.click('.menu-btn');
  await page.click('.sidebar-foot');
  await openTab(page, 'Usage');
  const u = await page.textContent('.usage');
  check(/GPT-OSS 20B.*1 request · 40 in/.test(u.replace(/\s+/g, ' ')) && /GPT-OSS 120B.*1 request · 30 in/.test(u.replace(/\s+/g, ' ')) && /Groq and Cerebras limits reset/.test(u), 'usage counted per model');
  await page.screenshot({ path: require('path').join(__dirname, 'out', 'providers-usage.png') });

  check(!errors.length, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
