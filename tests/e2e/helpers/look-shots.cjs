// Design review screenshots for the consistent-look pass (not a test). Safari's engine with an iPhone user agent, so
// glass is on. Usage: MR_TEST_URL=http://localhost:3000 SHOTS_OUT=dir node tests/e2e/helpers/look-shots.cjs
// Optional: SHOTS_WIDTHS=390,320 SHOTS_THEMES=light,dark SHOTS_ONLY=router-models,library
const fs = require('node:fs'), path = require('node:path');
const { webkit, chromium } = require('playwright');
const { profile, seed } = require('./preview-profile.cjs');
const { openPlace } = require('./nav.cjs');
const now = Date.now(), day = 864e5;
const fixture = [
  { id: 'c1', title: 'A week in Lisbon', createdAt: now - day, updatedAt: now - day, messages: [
    { id: 'u1', role: 'user', text: 'Plan a week in Lisbon', createdAt: now - day, files: [{ id: 'f1', name: 'Field notes.docx', kind: 'text', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 20480 }, { id: 'f2', name: 'Budget.csv', kind: 'text', mime: 'text/csv', size: 128, text: 'a,b' }] },
    { id: 'a1', role: 'assistant', status: 'done', model: 'gemini:gemini-flash-latest', createdAt: now - day + 1000, text: 'Day 1: Alfama. Day 2: Belem.' }] },
  { id: 'c2', title: 'Kitchen renovation', createdAt: now - 2 * day, updatedAt: now - 2 * day, messages: [{ id: 'u2', role: 'user', text: 'hi', createdAt: now - 2 * day }] },
];
const base = process.env.MR_TEST_URL || 'http://localhost:3000', out = process.env.SHOTS_OUT || 'tests/e2e/out/look';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const only = process.env.SHOTS_ONLY ? process.env.SHOTS_ONLY.split(',') : null, want = (n) => !only || only.includes(n);
const heights = { 320: 568, 390: 844 };
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const engine = process.env.SHOTS_ENGINE === 'chromium' ? chromium : webkit, browser = await engine.launch();
  for (const width of (process.env.SHOTS_WIDTHS || '390,320').split(',').map(Number)) for (const theme of (process.env.SHOTS_THEMES || 'light,dark').split(',')) {
    const ctx = await browser.newContext({ viewport: { width, height: heights[width] || 844 }, deviceScaleFactor: 2, isMobile: engine !== webkit, hasTouch: true, userAgent: UA, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await profile(ctx, 'look-shots', theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    const ready = async () => { await page.waitForSelector('.app:not(.app-skeleton) .composer textarea'); await page.waitForTimeout(500); };
    const home = async () => { await page.goto(base); await ready(); };
    await home(); await seed(page, 'look-shots', fixture); await home();
    const shot = async (n, scroll) => {
      if (!want(n)) return;
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, `${width}-${theme}-${n}.png`) });
      if (scroll) {
        await page.evaluate((sel) => { for (const el of document.querySelectorAll(sel)) el.scrollTop = 260; }, scroll);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(out, `${width}-${theme}-${n}-scrolled.png`) });
      }
    };
    if (want('chat')) await shot('chat');
    const place = async (name, sel) => { await home(); await openPlace(page, name); await page.waitForSelector(sel); await page.waitForTimeout(400); };
    if (want('router-models') || want('router-providers') || want('router-routing')) {
      await place('Router', '.rc-page');
      await shot('router-models', '.rc-scroll');
      for (const [tab, n] of [['Providers', 'router-providers'], ['Routing', 'router-routing']]) {
        await page.evaluate(() => { document.querySelector('.rc-scroll').scrollTop = 0; });
        await page.locator('.phone-sections button', { hasText: tab }).first().click(); await page.waitForTimeout(500);
        await shot(n, '.rc-scroll');
      }
    }
    if (want('library')) { await place('Library', '.hub-page'); await shot('library', '.hub-scroll'); }
    if (want('projects')) { await place('All projects', '.hub-page, .projects-page'); await shot('projects', '.hub-scroll, .projects-scroll'); }
    if (want('settings')) { await place('Settings', '.settings-page'); await shot('settings', '.settings-scroll'); }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
