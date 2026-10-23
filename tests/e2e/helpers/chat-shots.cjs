// Phase 3 chat and reading screenshots (not a test): node tests/e2e/helpers/chat-shots.cjs <outDir> [url]
// Synthetic chat-fixture conversation on the Canvas build. Desktop 1280×800 (laptop), 1440×900 and 1920×1080; iPhone
// 320×568, 390×844 and 430×932; Light and Dark; captured at actual size (one CSS px per image px). States: the start of
// the long answer (with the attachments), the table, the code, the sources, the end of the thread (failed and stopped replies) and the composer
// with a multiline draft. SHOTS=<regex> limits files; GLASS=1 forces the iPhone glass look. Chromium with an emulated
// touch phone: not a physical-iPhone result.
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const fs = require('fs');
const { seedChat } = require('./chat-fixture.cjs');
const out = process.argv[2], url = (process.argv[3] || 'http://localhost:5197').replace(/\/$/, '');
const only = process.env.SHOTS ? new RegExp(process.env.SHOTS) : null;
fs.mkdirSync(out, { recursive: true });
const SIZES = [['1280', 1280, 800, false], ['1440', 1440, 900, false], ['1920', 1920, 1080, false], ['320', 320, 568, true], ['390', 390, 844, true], ['430', 430, 932, true]];
(async () => {
  const browser = await engine.launch();
  for (const theme of ['light', 'dark']) for (const [tag, w, h, phone] of SIZES) {
    const wanted = (name) => !only || only.test(`${tag}-${theme}-${name}.png`);
    if (!['1-answer', '2-table', '2b-code', '2c-sources', '3-end', '4-draft'].some(wanted)) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1, reducedMotion: 'reduce', timezoneId: 'UTC', colorScheme: theme });
    await seedChat(ctx, { theme });
    const page = await ctx.newPage();
    await page.goto(url + (process.env.GLASS ? '/?emulator&glass' : '/?emulator'));
    await page.waitForSelector('.composer textarea', { timeout: 20000 });
    await page.waitForTimeout(500);
    // Open the conversation from the sidebar (a fresh start opens a new chat by design).
    if (phone) { await page.click('.menu-btn'); await page.waitForTimeout(400); }
    const folder = page.locator('.cv-project-row', { hasText: 'Studio launch' });
    if (await folder.count() && await folder.getAttribute('aria-expanded') === 'false') await folder.click();
    await page.locator('.chat-row', { hasText: 'Launch plan, three weeks' }).first().click();
    await page.waitForSelector('[data-message-id="r2"]', { timeout: 10000 });
    await page.waitForTimeout(700);
    const shot = async (name) => { if (!wanted(name)) return; await page.waitForTimeout(300); await page.screenshot({ path: path.join(out, `${tag}-${theme}-${name}.png`) }); };
    const scrollTo = (sel, offset = 12) => page.evaluate(([s, o]) => {
      const el = document.querySelector(s); const sc = el?.closest('.messages, .chat-scroll, [data-scroller]') || document.querySelector('.messages');
      if (el && sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - o;
    }, [sel, offset]);
    await scrollTo('[data-message-id="r1"]', phone ? 12 : 64); await shot('1-answer');
    await scrollTo('[data-message-id="r2"] table', 80); await shot('2-table');
    await scrollTo('[data-message-id="r2"] .code-block', 80); await shot('2b-code');
    await scrollTo('[data-message-id="r2"] .sources', 260); await shot('2c-sources');
    await page.evaluate(() => { const sc = document.querySelector('.messages'); if (sc) sc.scrollTop = sc.scrollHeight; }); await shot('3-end');
    if (wanted('4-draft')) {
      await page.fill('.composer textarea', 'Draft the first outreach note to Ana.\nKeep it under 90 words, warm but direct,\nand mention the shop window she redid in spring.');
      await shot('4-draft');
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
