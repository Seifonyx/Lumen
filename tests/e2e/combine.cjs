// 2.1: after comparing models, "Combine into one answer" has one model write the best answer from all of them
// (with where they differed); it can be continued in the chat like any answer.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const sse = (text) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n';

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    await profile(ctx, 'combine', 'light', { enabledModels: ['gemini:gemini-flash-latest', 'gemini:gemini-2.5-pro'] });
    let combinePrompt = '', combineUrl = '';
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      const url = r.request().url();
      if (url.includes('/models?')) return r.fulfill({ json: { models: [
        { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'], thinking: true },
      ] } });
      if (url.includes(':generateContent')) return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Title' }] } }] } });
      const body = r.request().postData() || '';
      if (body.includes('Write the single best answer')) { combinePrompt = body; combineUrl = url; return r.fulfill({ contentType: 'text/event-stream', body: sse('Best of both: boil 9 minutes.\n\n**Where they differed**\n- Time: 8 vs 10 minutes.') }); }
      const model = /models\/([^:]+):/.exec(url)[1];
      return r.fulfill({ contentType: 'text/event-stream', body: sse(model.includes('pro') ? 'Boil for 10 minutes.' : 'Boil for 8 minutes.') });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await page.fill('.composer textarea', 'How long to boil an egg?');
    await page.getByRole('button', { name: /^Add (?:photos, )?files or a repository$/ }).click();
    await page.getByRole('button', { name: 'Compare models', exact: true }).click();
    await page.click('.compare-picker-actions >> text=Compare');
    await page.waitForFunction(() => document.querySelectorAll('.comparison-card .comparison-save').length === 2);

    await page.getByRole('button', { name: 'Combine into one answer' }).click();
    const card = page.locator('.comparison-combined');
    await card.locator('.comparison-save').waitFor();
    assert.match(await card.textContent(), /Best of both: boil 9 minutes\./);
    assert.match(await card.textContent(), /Where they differed/);
    assert.match(combinePrompt, /Boil for 8 minutes\./);
    assert.match(combinePrompt, /Boil for 10 minutes\./);
    assert.match(combinePrompt, /How long to boil an egg\?/);
    assert.match(combineUrl, /models\/gemini-2\.5-pro/, 'the stronger model writes it');
    console.log('PASS Combine writes one answer from all of them, with where they differed');

    await card.locator('.comparison-save').click();
    const reply = page.locator('.msg.assistant').last();
    await reply.locator('text=Best of both').waitFor();
    assert.equal(await page.locator('.msg.user').last().textContent().then((t) => t.includes('How long to boil an egg?')), true);
    console.log('PASS the combined answer continues in the chat');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
