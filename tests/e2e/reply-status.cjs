// A slow reply says what it's doing ("Searching the web") instead of looking stuck.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
    await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
      if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'] }] } });
      await new Promise((ok) => setTimeout(ok, 4000));
      return r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Found it.' }] }, finishReason: 'STOP' }] }) + '\n\n' }).catch(() => {});
    });
    await ctx.addInitScript(() => {
      if (localStorage.getItem('mr.preview_user')) return;
      const uid = 'preview-reply-status';
      const settings = { autoIntroduced: true, autoTitle: false, webSearch: true, enabledModels: ['gemini:gemini-flash-latest'], defaultModel: 'gemini:gemini-flash-latest' };
      localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'status@local.invalid', displayName: 'Status' }));
      localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
      localStorage.setItem('mr.settings', JSON.stringify(settings));
      localStorage.setItem('mr.installHint', '1');
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
    await page.locator('.composer textarea').waitFor();
    await page.fill('.composer textarea', 'latest news on the moon mission');
    await page.click('.send-btn');
    await page.locator('.route-label', { hasText: 'Searching the web' }).waitFor({ timeout: 6000 });
    await page.getByText('Found it.').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS a slow reply shows what it is doing');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
