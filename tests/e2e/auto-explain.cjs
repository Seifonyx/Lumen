// Auto explains itself: tap the model line under a reply to see why, what was next, and keep a model out of Auto.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
      await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
        if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-pro'].map((n) => ({ name: `models/${n}`, displayName: n, supportedGenerationMethods: ['generateContent'] })) } });
        return r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello there.' }] }, finishReason: 'STOP' }] }) + '\n\n' });
      });
      await ctx.addInitScript(() => {
        if (localStorage.getItem('mr.preview_user')) return;
        const uid = 'preview-auto-explain';
        const settings = { autoIntroduced: true, autoTitle: false, enabledModels: ['gemini:gemini-flash-latest', 'gemini:gemini-flash-lite-latest', 'gemini:gemini-2.5-pro'], defaultModel: 'auto' };
        localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'auto@local.invalid', displayName: 'Auto' }));
        localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
        localStorage.setItem('mr.settings', JSON.stringify(settings));
        localStorage.setItem('mr.installHint', '1');
      });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
      await page.locator('.composer textarea').waitFor();
      await page.fill('.composer textarea', 'hi there');
      await page.click('.send-btn');
      const why = page.locator('.route-why-btn');
      await why.waitFor();
      await why.click();
      const pop = page.getByRole('dialog', { name: 'Why this model' });
      await pop.waitFor();
      assert.match(await pop.textContent(), /Next in line/);
      if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${width}.png` });
      assert.ok(await pop.evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0; }), 'popover fits the screen');
      const picked = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mr.settings')); return s; });
      await pop.getByRole('checkbox').check();
      await page.waitForFunction(() => (JSON.parse(localStorage.getItem('mr.settings')).autoExcluded || []).length === 1);
      await page.keyboard.press('Escape');
      await pop.waitFor({ state: 'detached' });
      assert.ok(picked);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: Auto explains its choice and a model can be kept out of Auto`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
