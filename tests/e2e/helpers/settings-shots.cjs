// Design review screenshots of every Settings tab (not a test): node tests/e2e/helpers/settings-shots.cjs <outDir> [url] [light|dark] [width]
// BROWSER=webkit runs the same screens in Safari's engine.
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const { profile } = require('./preview-profile.cjs');
const out = process.argv[2];
const url = process.argv[3] || 'http://localhost:5191/';
const themes = process.argv[4] ? [process.argv[4]] : ['light', 'dark'];
const widths = process.argv[5] ? [Number(process.argv[5])] : [1280, 390];
const TABS = ['General', 'API keys', 'Connectors', 'Models', 'Usage', 'Personalization', 'Memory', 'Privacy & data'];
(async () => {
  const browser = await engine.launch();
  for (const theme of themes) for (const w of widths) {
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 820 }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    await profile(ctx, 'settings-shots', theme);
    const page = await ctx.newPage();
    // Sync is blocked on purpose here; WebKit reports those blocked requests as page errors.
    page.on('pageerror', (e) => { if (!/firestore\.googleapis\.com/.test(e.message)) console.log('pageerror', e.message); });
    await page.goto(url);
    await page.waitForSelector('.composer textarea');
    if (phone) await page.click('.menu-btn');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.waitForTimeout(300);
    if (phone) await page.screenshot({ path: path.join(out, `${w}-${theme}-0-index.png`) });
    for (const [i, tab] of TABS.entries()) {
      if (await page.locator('.settings-back').isVisible()) await page.locator('.settings-back').click();
      await page.locator('.settings-tabs .tab-label').getByText(tab, { exact: true }).click();
      await page.waitForTimeout(400);
      // Grow the viewport to the full scroll height so one image shows the whole tab.
      const h = await page.locator('.settings-scroll').evaluate((e) => e.scrollHeight);
      await page.setViewportSize({ width: w, height: Math.min(Math.max(h + 60, phone ? 844 : 820), 4000) });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(out, `${w}-${theme}-${i + 1}-${tab.replace(/\W+/g, '').toLowerCase()}.png`) });
      await page.setViewportSize({ width: w, height: phone ? 844 : 820 });
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
