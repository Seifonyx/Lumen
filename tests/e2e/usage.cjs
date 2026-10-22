// Usage meter test: counts, learned limits, skipping limited models, OpenRouter pool, sync to a 2nd device.
const { chromium, webkit } = require('playwright');
// Settings is a page: on phones the section list shows first, and a section has a back arrow.
async function openTab(page, name) {
  if (await page.isVisible('.settings-back')) await page.click('.settings-back');
  await page.click(`.settings-tabs >> text=${name}`);
}
const path = require('path');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;

async function mock(ctx, calls) {
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) {
      return route.fulfill({ json: { models: ['gemini-3.5-flash', 'gemini-flash-latest'].map((n) => ({ name: `models/${n}`, displayName: n, supportedGenerationMethods: ['generateContent'] })) } });
    }
    const model = /models\/([^:]+):/.exec(url)[1];
    calls.push(url.includes(':generateContent') ? `${model}:title` : model);
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Usage Test' }] } }] } });
    if (model === 'gemini-3.5-flash') {
      return route.fulfill({
        status: 429,
        json: { error: { code: 429, message: 'You exceeded your current quota.', status: 'RESOURCE_EXHAUSTED', details: [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier', quotaValue: '20' }] },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '3600s' },
        ] } },
      });
    }
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: 'Hello!' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300 } }) });
  });
  await ctx.route('**/openrouter.ai/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/key')) return route.fulfill({ json: { data: { is_free_tier: true } } });
    if (url.endsWith('/models')) return route.fulfill({ json: { data: [{ id: 'deepseek/free-model:free', name: 'DeepSeek (free)', pricing: { prompt: '0', completion: '0' } }] } });
    const title=route.request().postDataJSON()?.stream!==true;
    calls.push(title ? 'openrouter:title' : 'openrouter');
    if(title)return route.fulfill({json:{choices:[{message:{content:'Usage Test'},finish_reason:'stop'}],usage:{prompt_tokens:12,completion_tokens:3}}});
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ choices: [{ delta: { content: 'OR reply' } }] }) + sse({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 500, completion_tokens: 50 } }) });
  });
}

async function device(browser, mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 820 } });
  const calls = [];
  await mock(ctx, calls);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('.app:not(.app-skeleton) .topbar:visible, .settings-page');
  return { ctx, page, calls, errors };
}

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  const A = await device(browser, true);
  await A.page.waitForSelector('input[placeholder="AIza…"]');
  await A.page.fill('input[placeholder="AIza…"]', 'g-key');
  await A.page.fill('input[placeholder="sk-or-…"]', 'or-key');
  await A.page.click('button:has-text("Save keys")');
  await A.page.waitForTimeout(1500);
  // Enable both Gemini models (3.5 first) + the OpenRouter one, default = 3.5.
  await openTab(A.page, 'Models');
  await A.page.locator('.models-nav button').filter({ hasText: 'Browse models' }).click();
  for (const label of ['gemini-3.5-flash', 'gemini-flash-latest', 'DeepSeek']) {
    await A.page.getByLabel('Search available models').fill(label);
    const btn = A.page.locator('.model-list.add .model-row', { hasText: label }).locator('button');
    if (await btn.count()) await btn.first().click();
  }
  await A.page.locator('.models-nav button').filter({ hasText: 'Your models' }).click();
  await A.page.locator('.model-row', { hasText: 'gemini-3.5-flash' }).locator('.star').first().click();
  await A.page.click('.settings-page [aria-label="Close"]');

  // 1st message: 3.5 is limited -> switches across providers to OpenRouter and learns limit 20.
  await A.page.click('.model-button');
  await A.page.click('.models-pop .mp-title:text-is("gemini-3.5-flash")');
  await A.page.fill('.composer textarea', 'first');
  await A.page.click('.send-btn');
  await A.page.waitForSelector('.msg.assistant .model-tag', { timeout: 15000 });
  check(/hit its usage limit/.test(await A.page.textContent('.msg.assistant .notice')), 'switch notice on first limit');
  await A.page.waitForTimeout(1200);
  check(await A.page.$('.usage-warning.blocked'), 'warning shown above the message box');

  // 2nd message: should skip 3.5 straight away (no new request to it).
  const before = A.calls.filter((c) => c === 'gemini-3.5-flash').length;
  await A.page.fill('.composer textarea', 'second');
  await A.page.click('.send-btn');
  await A.page.waitForSelector('.msg.assistant >> nth=1 >> .model-tag', { timeout: 15000 });
  check(A.calls.filter((c) => c === 'gemini-3.5-flash').length === before, 'limited model skipped without trying it');
  check(/reached its limit .* using/.test(await A.page.textContent('.msg.assistant >> nth=1 >> .notice')), 'skip explained in the reply');

  // Both fallbacks stayed on DeepSeek; its enabled background title is a third pool request.
  await A.page.click('.model-button');
  await A.page.click('.models-pop .mp-title:text-is("gemini-flash-latest")');
  await A.page.fill('.composer textarea', 'third');
  await A.page.click('.send-btn');
  await A.page.waitForSelector('.msg.assistant >> nth=2 >> .model-tag', { timeout: 15000 });
  await A.page.waitForTimeout(1200);

  // Picker shows the limit tag.
  await A.page.click('.model-button');
  check((await A.page.textContent('.models-pop')).includes('Limit'), 'picker marks the limited model');
  await A.page.keyboard.press('Escape');
  // The usage popup describes the selected model: pick DeepSeek to see the shared OpenRouter pool.
  await A.page.click('.model-button');
  await A.page.click('.models-pop .mp-title:text-is("DeepSeek")');

  await A.page.locator('.usage-chip').click();
  const dailyMeter = A.page.getByRole('meter', { name: 'Requests used today' });
  check(A.calls.filter(c => c === 'openrouter').length === 2 && A.calls.filter(c => c === 'gemini-flash-latest').length === 1 && A.calls.filter(c => c === 'openrouter:title').length === 1, 'fallbacks keep to the answered model; manual request and the enabled title are counted exactly');
  check(await dailyMeter.getAttribute('aria-valuemax') === '50' && await dailyMeter.getAttribute('aria-valuenow') === '3', 'usage popup includes two replies and the real background title request');
  check((await A.page.locator('.usage-pop').textContent()).includes('47 remaining'), 'usage popup shows the remaining daily requests');
  await A.page.getByRole('button', { name: 'Close usage', exact: true }).click();

  // Usage tab.
  await A.page.click('.menu-btn');
  await A.page.click('.sidebar-foot, .cv-account');
  await openTab(A.page, 'Usage');
  await A.page.waitForSelector('.usage-row');
  const text = await A.page.textContent('.usage');
  console.log('      usage tab:', text.replace(/\s+/g, ' ').slice(0, 400));
  check(/3 of 50 today/.test(text), 'OpenRouter pool: two fallback requests plus title, 3 of 50');
  check(/Limit reached/.test(text), 'limited model shown');
  check(/1 request · 1K in \/ 300 out tokens/.test(text) && A.calls.filter(c => c === 'gemini-flash-latest:title').length === 0, 'manual Gemini request counted once; title stays on the answered OpenRouter model');
  await A.page.screenshot({ path: path.join(OUT, 'usage-tab.png') });

  // Second device sees the same counts and block.
  const B = await device(browser, false);
  await B.page.waitForTimeout(2000);
  await B.page.click('.sidebar-foot, .cv-account');
  await openTab(B.page, 'Usage');
  await B.page.waitForSelector('.usage-row');
  const textB = await B.page.textContent('.usage');
  check(/Limit reached/.test(textB) && /3 of 50 today/.test(textB), 'usage + block synced to second device');
  check(/0 requests · daily limit 20/.test(textB), 'blocked model retains its learned daily limit on the second device');
  const learned = await B.page.textContent('.usage'); console.log('      B usage:', learned.replace(/\s+/g, ' ').slice(0, 500));
  check(/daily limit 20/.test(learned), 'learned daily limit shown');

  const errs = [...A.errors, ...B.errors];
  console.log('errors', errs);
  check(!errs.length, 'no page errors');
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
