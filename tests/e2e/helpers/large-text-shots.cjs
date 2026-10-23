// Drawer at larger text (not a test): node tests/e2e/helpers/large-text-shots.cjs <outDir> [url]
// 390×844 and 320×568 phones, Light, glass look; text at Lumen's default (15px), its Large setting (17px) and a
// simulated iOS Dynamic Type accessibility size (23px, set on --fs as src/lib/settings.ts does from the system font).
// Chromium emulation: not a physical-iPhone result.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { seedNav } = require('./nav-fixture.cjs');
const out = process.argv[2], url = (process.argv[3] || 'http://localhost:5197').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[390, 844], [320, 568]]) for (const [name, extra, fsPx] of [['default', {}, null], ['large', { fontSize: 'large' }, null], ['dynamic-23', {}, 23]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await seedNav(ctx, { extra });
    const page = await ctx.newPage();
    await page.goto(url + '/?emulator&glass');
    await page.waitForSelector('.composer textarea');
    if (fsPx) await page.evaluate((px) => document.documentElement.style.setProperty('--fs', `${px}px`), fsPx);
    await page.waitForTimeout(400);
    await page.click('.menu-btn'); await page.waitForTimeout(450);
    const folder = page.locator('.cv-project-row', { hasText: 'Studio launch' });
    if (await folder.getAttribute('aria-expanded') === 'false') await folder.click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(out, `${w}-${name}.png`) });
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
