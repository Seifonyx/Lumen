// Motion and responsiveness regressions (phase 1 of the motion pass):
// a long chat opens on its latest message and fills in older ones; sending while scrolled up brings you to
// your message; earlier messages keep their buttons while a reply streams (no pop or shift); true black
// and the status-bar colour are set before the app's code runs.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const long = Array.from({ length: 30 }, (_, i) => [
  { id: `u${i}`, role: 'user', text: `Question ${i}: how should we plan the week?`, createdAt: now - 9e6 + i * 1000 },
  { id: `a${i}`, role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', createdAt: now - 9e6 + i * 1000 + 500, text: `## Answer ${i}\n\nStart with the **three** most important tasks.\n\n| Day | Focus |\n|---|---|\n| Mon | Plan |\n\n\`\`\`js\nconst focus = 3;\n\`\`\`` },
]).flat();
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1280]) {
      const phone = width < 900;
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block' });
      await profile(ctx, 'motion', 'light');
      let release;
      await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
        const u = r.request().url();
        if (u.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
        if (u.includes(':generateContent')) return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Title' }] } }] } });
        await new Promise((ok) => { release = ok; });
        return r.fulfill({ contentType: 'text/event-stream', body: sse({ candidates: [{ content: { parts: [{ text: 'Here is the plan.' }] }, finishReason: 'STOP' }] }) });
      });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(URL);
      await page.waitForSelector('.composer textarea');
      await seed(page, 'motion', [{ id: 'long', title: 'Weekly planning', createdAt: now - 9e6, updatedAt: now, model: 'gemini:gemini-flash-latest', messages: long }]);
      await page.reload();
      await page.waitForSelector('.composer textarea');
      if (phone) await page.click('.menu-btn');
      await page.click('text=Weekly planning');
      // All 60 messages arrive, and the view ends on the latest one.
      await page.waitForFunction(() => document.querySelectorAll('.thread .message-row').length === 60, null, { timeout: 10000 });
      await page.waitForTimeout(500);
      const gap = await page.locator('.messages').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
      assert.ok(gap < 8, `${width}px: opens on the latest message (gap ${gap}px)`);

      // Scroll up a little, send: you're brought to your message, and earlier buttons stay put while it streams.
      await page.locator('.messages').evaluate((el) => { el.scrollTop = el.scrollHeight - el.clientHeight - 300; el.dispatchEvent(new Event('scroll')); });
      await page.waitForTimeout(200);
      await page.fill('.composer textarea', 'What about next week?');
      await page.click('.send-btn');
      await page.locator('.message-row').filter({ hasText: 'What about next week?' }).waitFor();
      await page.waitForTimeout(300);
      const during = await page.locator('.message-row').filter({ hasText: 'Question 29' }).locator('.msg-action').count();
      const box = await page.locator('.message-row').filter({ hasText: 'What about next week?' }).boundingBox();
      const view = await page.locator('.messages').boundingBox();
      assert.ok(box && view && box.y < view.y + view.height && box.y + box.height > view.y, `${width}px: your new message is in view (${JSON.stringify([box, view])})`);
      release();
      await page.locator('.msg.assistant', { hasText: 'Here is the plan.' }).waitFor();
      const after = await page.locator('.message-row').filter({ hasText: 'Question 29' }).locator('.msg-action').count();
      assert.equal(during, after, `${width}px: earlier message keeps its buttons while a reply streams (${during} vs ${after})`);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: long chat opens on the latest message; sending brings it into view; no buttons pop during streaming`);
      await ctx.close();
    }

    // True black before the app runs: the pre-paint script sets it, and the status bar follows.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => localStorage.setItem('mr.settings', JSON.stringify({ theme: 'black' })));
    await ctx.route('**/src/main.tsx', (r) => r.abort());
    await ctx.route(/\/assets\/index-.*\.js$/, (r) => r.abort());
    const page = await ctx.newPage();
    await page.goto(URL);
    const pre = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, look: document.documentElement.dataset.appearance, bars: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content) }));
    assert.deepEqual(pre, { theme: 'dark', look: 'black', bars: ['#000000', '#000000'] }, JSON.stringify(pre));
    console.log('PASS true black and the status-bar colour are set before the app code loads');
    await ctx.close();
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
