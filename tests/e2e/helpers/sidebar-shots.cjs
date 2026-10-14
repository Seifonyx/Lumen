// Sidebar design screenshots (not a test): node tests/e2e/helpers/sidebar-shots.cjs <outDir> [url]
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2], url = process.argv[3] || 'http://localhost:5191/';
const now = Date.now();
const chat = (id, title, ago, extra = {}) => ({ id, title, createdAt: now - ago, updatedAt: now - ago, messages: [{ id: `${id}m`, role: 'user', text: 'hi', createdAt: now - ago }], ...extra });
const chats = [chat('a', 'Hey there', 6e5), chat('b', 'Quarterly staffing summary', 4e6), chat('c', 'Arabic email to suppliers', 9e7), chat('d', 'Fix login on Safari', 4e8, { pinned: true })];
(async () => {
  const browser = await engine.launch();
  for (const theme of ['dark', 'light']) for (const [w, h] of [[1280, 820], [390, 844]]) {
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce', deviceScaleFactor: 2 });
    await profile(ctx, 'sidebar', theme);
    const page = await ctx.newPage();
    await page.goto(url);
    await page.waitForSelector('.composer textarea');
    await seed(page, 'sidebar', chats);
    await page.reload();
    await page.waitForSelector('.composer textarea');
    if (phone) await page.click('.menu-btn');
    await page.waitForTimeout(400);
    const box = await page.locator('.sidebar').boundingBox();
    await page.screenshot({ path: path.join(out, `sidebar-${w}-${theme}.png`), clip: { x: 0, y: 0, width: Math.min(box.width + 1, w), height: h } });
    await ctx.close();
  }
  await browser.close();
})();
