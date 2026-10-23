// iPhone drawer screenshots (not a test): node tests/e2e/helpers/drawer-shots.cjs <outDir> [url]
// Synthetic nav-fixture account, Canvas build. Sizes 320×568 (SE), 390×844 and 430×932; Light and Dark; states:
// default, expanded project, search active (with the keyboard's height simulated), and after "New chat in Studio
// launch" (the bottom New chat then names the project). GLASS=1 forces the iPhone glass look (on by default on iOS 16+).
// Captured at 2× and also at 1× (actual size, one CSS px per image px). Chromium with an emulated touch phone: not a
// physical-iPhone result.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { seedNav } = require('./nav-fixture.cjs');
const out = process.argv[2], url = (process.argv[3] || 'http://localhost:5197').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const SIZES = [['320', 320, 568], ['390', 390, 844], ['430', 430, 932]];
(async () => {
  const browser = await chromium.launch();
  for (const theme of ['light', 'dark']) for (const [tag, w, h] of SIZES) for (const scale of [2, 1]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: scale, reducedMotion: 'reduce', timezoneId: 'UTC', colorScheme: theme });
    await seedNav(ctx, { theme });
    const page = await ctx.newPage();
    await page.goto(url + (process.env.GLASS ? '/?emulator&glass' : '/?emulator'));
    await page.waitForSelector('.composer textarea', { timeout: 20000 });
    await page.waitForTimeout(500);
    const shot = (name) => page.waitForTimeout(350).then(() => page.screenshot({ path: path.join(out, `${tag}-${theme}-${name}${scale === 1 ? '@1x' : ''}.png`) }));
    const open = async () => { await page.click('.menu-btn'); await page.waitForTimeout(450); };
    await open(); await shot('1-default');
    const folder = page.locator('.cv-project-row', { hasText: 'Studio launch' });
    await page.locator('.cv-tree').evaluate((t) => { t.scrollTop = 0; });
    if (await folder.getAttribute('aria-expanded') === 'false') await folder.click();
    await page.locator('.chat-row', { hasText: 'A better project brief' }).click(); await page.waitForTimeout(400);
    await open(); await shot('2-project');
    // Search with the keyboard up (iOS shrinks the visual viewport; the drawer stays full height underneath).
    await page.fill('#chat-search', 'plan'); await page.focus('#chat-search');
    await page.evaluate((kb) => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: kb }); window.visualViewport.dispatchEvent(new Event('resize')); }, Math.round(h * 0.55));
    await shot('3-search');
    await page.fill('#chat-search', ''); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    if (await page.locator('.cv-nav.open').count() === 0) await open();
    await page.locator('.cv-new-here', { hasText: 'Studio launch' }).click(); await page.waitForTimeout(400);
    await open(); await page.locator('.cv-tree').evaluate((t) => { t.scrollTop = 0; }); await shot('4-in-project-scope');
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
