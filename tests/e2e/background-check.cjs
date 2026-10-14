// Weekly background model check: removes only clear-cut broken models, keeps uncertain ones, brings back working ones.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, serviceWorkers: 'block' });
    await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
    const probed = [];
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      const url = r.request().url();
      if (url.includes('/models?')) return r.fulfill({ json: { models: ['gemini-flash-latest', 'gemini-gone', 'gemini-flaky', 'gemini-back'].map((n) => ({ name: `models/${n}`, displayName: n, supportedGenerationMethods: ['generateContent'] })) } });
      const name = /models\/([^:]+):/.exec(url)?.[1];
      probed.push(name);
      if (name === 'gemini-gone') return r.fulfill({ status: 404, json: { error: { message: 'Model gemini-gone is not found' } } });
      if (name === 'gemini-flaky') return r.fulfill({ status: 503, json: { error: { message: 'Overloaded' } } });
      return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'OK' }] } }] } });
    });
    await ctx.addInitScript(() => {
      window.__mrBackgroundCheck = true; window.__mrBackgroundCheckDelay = 300;
      if (localStorage.getItem('mr.preview_user')) return;
      const uid = 'preview-background-check';
      const settings = { autoIntroduced: true, autoTitle: false, enabledModels: ['gemini:gemini-flash-latest', 'gemini:gemini-gone', 'gemini:gemini-flaky'], defaultModel: 'gemini:gemini-flash-latest', unavailableModels: ['gemini:gemini-back'], unavailableInfo: { 'gemini:gemini-back': { reason: 'Model not found', at: 1 } } };
      localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'bg@local.invalid', displayName: 'Background' }));
      localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
      localStorage.setItem('mr.settings', JSON.stringify(settings));
      localStorage.setItem('mr.installHint', '1');
    });
    const page = await ctx.newPage();
    await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
    await page.locator('.composer textarea').waitFor();
    await page.getByText('Weekly model check:', { exact: false }).waitFor({ timeout: 30000 });
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('mr.settings')));
    assert.ok(settings.unavailableModels.includes('gemini:gemini-gone'), 'model that is gone is removed');
    assert.ok(!settings.unavailableModels.includes('gemini:gemini-flaky'), 'a model with server errors is not removed by the background check');
    assert.ok(!settings.unavailableModels.includes('gemini:gemini-back'), 'a removed model that answers again is brought back');
    assert.equal(settings.unavailableInfo['gemini:gemini-gone'].by, 'auto');
    // Runs at most once a week.
    const before = probed.length;
    await page.reload(); await page.locator('.composer textarea').waitFor(); await page.waitForTimeout(1500);
    assert.equal(probed.length, before, 'not repeated within the week');
    console.log('PASS weekly background check: clear-cut removals, no removal on server errors, brings back working models, once a week');
    await ctx.close();
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
