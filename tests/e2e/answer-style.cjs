// 2.1: Settings → Personalization: Reply language and Answer length go to every model as instructions; Developer
// options are for developers and explicit preview accounts (ordinary-user rendering has unit coverage).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/';
const sse = (text) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n';

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'answer-style', 'light');
    const bodies = [];
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
      bodies.push(r.request().postData() || '');
      return r.fulfill({ contentType: 'text/event-stream', body: sse('Bonjour.') });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: 'General', exact: true }).click();
    assert.equal(await page.locator('.settings-page:not(.exit-ghost)').getByText('Developer options').count(), 1, 'Explicit preview accounts expose their testing controls');
    await page.locator('.settings-tabs').getByRole('button', { name: /Personali[sz]ation/ }).click();
    const sp = page.locator('.settings-page:not(.exit-ghost)');
    await sp.getByLabel('Reply language').selectOption('French');
    await sp.getByRole('radiogroup', { name: 'Answer length' }).getByRole('radio', { name: 'Short' }).click();
    assert.equal(await sp.getByRole('button', { name: '+ Egyptian Arabic' }).count(), 0);
    await page.click('.settings-page [aria-label="Close"], .rc-page:not([hidden]) .rc-head .feature-exit, .rc-page:not([hidden]) .phone-navigation > button');
    await page.fill('.composer textarea', 'hello');
    await page.click('.send-btn');
    await page.locator('.msg.assistant:has-text("Bonjour.")').waitFor();
    assert.match(bodies.at(-1), /Always reply in French/);
    assert.match(bodies.at(-1), /Keep answers short/);
    console.log('PASS reply language and answer length reach the model');

    // Back to "Match my writing": nothing extra.
    await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: /Personali[sz]ation/ }).click();
    await sp.getByLabel('Reply language').selectOption('');
    await sp.getByRole('radiogroup', { name: 'Answer length' }).getByRole('radio', { name: 'Auto' }).click();
    await page.click('.settings-page [aria-label="Close"], .rc-page:not([hidden]) .rc-head .feature-exit, .rc-page:not([hidden]) .phone-navigation > button');
    await page.fill('.composer textarea', 'again');
    await page.click('.send-btn');
    await page.locator('.msg.assistant').nth(1).locator('.model-tag').waitFor();
    assert.doesNotMatch(bodies.at(-1), /Always reply in|Keep answers short/);
    assert.match(bodies.at(-1), /language of the user's latest message/, 'with no reply language chosen, replies follow the language you write in');
    console.log('PASS turning them off removes the instructions');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
