// Usage meter screenshots (not a test): node tests/e2e/helpers/usage-shots.cjs <outDir> [url]
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2], url = process.argv[3] || 'http://localhost:5191/';
const now = Date.now();
const long = 'Here is a detailed answer with plenty of words to fill the context. '.repeat(400);
const chats = [{ id: 'u1', title: 'Staffing plan', createdAt: now - 6e5, updatedAt: now - 6e5, model: 'gemini:gemini-flash-latest', messages: [
  { id: 'a', role: 'user', text: 'Plan next month’s staffing.', createdAt: now - 6e5 },
  { id: 'b', role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', text: long, createdAt: now - 5e5 },
] }];
(async () => {
  const browser = await engine.launch();
  for (const theme of ['dark', 'light']) for (const [w, h] of [[1280, 820], [390, 844]]) {
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce', deviceScaleFactor: 2 });
    await profile(ctx, 'usage', theme);
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForSelector('.composer textarea');
    await seed(page, 'usage', chats);
    await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('mr.usage')); if (k) console.log(k); });
    await page.reload();
    await page.waitForSelector('.composer textarea');
    if (phone) { await page.click('.menu-btn'); }
    await page.click('text=Staffing plan');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `usage-${w}-${theme}-chip.png`), clip: { x: 0, y: h - 200, width: w, height: 200 } });
    await page.click('.usage-chip');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, `usage-${w}-${theme}-open.png`) });
    await ctx.close();
  }
  await browser.close();
})();
