// Phase 2 navigation screenshots (not a test): node tests/e2e/helpers/nav-shots.cjs <outDir> [url]
// Desktop 1440 and iPhone 390/320, light and dark, on the synthetic nav-fixture account (Canvas build).
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const fs = require('fs');
const { seedNav } = require('./nav-fixture.cjs');
const out = process.argv[2], url = (process.argv[3] || 'http://localhost:5197').replace(/\/$/, '');
const only = process.env.SHOTS ? new RegExp(process.env.SHOTS) : null;
fs.mkdirSync(out, { recursive: true });

const SIZES = [['desktop', 1440, 900, false], ['iphone', 390, 844, true], ['se', 320, 640, true]];
(async () => {
  const browser = await engine.launch();
  for (const theme of ['light', 'dark']) for (const [kind, w, h, phone] of SIZES) {
    if (kind === 'se' && theme === 'dark') continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 2, reducedMotion: 'reduce', timezoneId: 'UTC', colorScheme: theme });
    await seedNav(ctx, { theme });
    const page = await ctx.newPage();
    await page.goto(url + '/?emulator');
    await page.waitForSelector('.composer textarea', { timeout: 20000 });
    await page.waitForTimeout(600);
    const shot = async (name) => {
      const file = `${kind}-${theme}-${name}.png`;
      if (only && !only.test(file)) return;
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(out, file) });
    };
    // Phones open the drawer from whichever bar is showing (a chat, a hub page); a surface without one is left first.
    const drawer = async () => {
      if (!phone) return;
      const opener = page.locator('.hub-nav[aria-label="Open sidebar"]:visible, .menu-btn:visible, [data-nav-drawer]:visible').first();
      if (!await opener.count()) { await page.locator(':is(.hub-close,.feature-exit):visible, [data-routing-close]:visible, button:visible:has-text("Chat")').first().click(); await page.waitForTimeout(400); }
      await page.locator('.hub-nav[aria-label="Open sidebar"]:visible, .menu-btn:visible, [data-nav-drawer]:visible').first().click();
      await page.waitForTimeout(400);
    };
    const chat = async (title, project) => {
      await drawer();
      const folder = page.locator('.sidebar .cv-project-row', { hasText: project });
      if (project && await folder.getAttribute('aria-expanded') === 'false') { await folder.click(); await page.waitForTimeout(300); }
      await page.locator('.sidebar .chat-row', { hasText: title }).first().click(); await page.waitForTimeout(400);
    };

    await shot('home');
    await drawer(); await shot('nav');
    if (phone) await page.keyboard.press('Escape');
    await chat('A better project brief', 'Studio launch'); await shot('chat-in-project');
    await drawer(); await shot('nav-in-project');
    await page.fill('#chat-search', 'plan'); await shot('search');
    await page.fill('#chat-search', '');
    if (phone) await page.keyboard.press('Escape');
    for (const [name, label] of [['library', 'Library'], ['tools', 'Tools'], ['routing', 'Prism']]) {
      await drawer(); await page.locator('.cv-dest button', { hasText: label }).click(); await page.waitForTimeout(500); await shot(name);
      await page.keyboard.press('Escape');
    }
    await drawer(); await page.locator('.sidebar button', { hasText: 'All projects' }).click().catch(() => {}); await page.waitForTimeout(500); await shot('projects');
    await drawer(); await page.click('.cv-account'); await page.waitForTimeout(500); await shot('settings');
    await page.keyboard.press('Escape');
    if (!phone) { await page.click('.collapse-sidebar').catch(() => {}); await page.waitForTimeout(400); await shot('collapsed'); }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
