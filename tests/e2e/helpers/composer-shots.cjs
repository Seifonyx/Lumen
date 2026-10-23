// Phase 3 composer screenshots (not a test): node tests/e2e/helpers/composer-shots.cjs <outDir> [url]
// Synthetic chat-fixture account on the Canvas build; actual size (one CSS px per image px). Desktop 1440×900 and
// 1280×800, iPhone 320×568, 390×844 and 430×932; Light and Dark. States: resting, typing, a long multiline draft,
// attachments (a picture and a PDF), a reply streaming (Stop), the expanded writing sheet, and a new chat in a
// project (its chip). SHOTS=<regex> limits files; GLASS=1 forces the iPhone glass look. The model reply is a local
// fixture held open for the streaming state (no network, no inference). Not a physical-iPhone result.
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const fs = require('fs');
const { seedChat } = require('./chat-fixture.cjs');
const out = process.argv[2], url = (process.argv[3] || 'http://localhost:5197').replace(/\/$/, '');
const only = process.env.SHOTS ? new RegExp(process.env.SHOTS) : null;
fs.mkdirSync(out, { recursive: true });
const SIZES = [['1280', 1280, 800, false], ['1440', 1440, 900, false], ['320', 320, 568, true], ['390', 390, 844, true], ['430', 430, 932, true]];
const STATES = ['1-resting', '2-typing', '3-multiline', '4-attachments', '5-streaming', '6-expanded', '7-project'];
// A 64×64 PNG (two colour fields) for the picture attachment.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAa0lEQVR4nO3PQRGAQBDAMEAsKhDCGzfn6lQs/SQCOtNzfc8x6X7XaP8arf/AQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQM1AzUDNQG0DJMEELohpYWwAAAAASUVORK5CYII=', 'base64');
const DRAFT = 'Draft the first outreach note to Ana.\nKeep it under 90 words, warm but direct.\nMention the shop window she redid in spring,\nand that I can start the week of 4 November.\nNo exclamation marks.\nEnd with one easy question she can answer in a line.';
(async () => {
  const browser = await engine.launch();
  for (const theme of ['light', 'dark']) for (const [tag, w, h, phone] of SIZES) {
    const wanted = (name) => !only || only.test(`${tag}-${theme}-${name}.png`);
    if (!STATES.some(wanted)) continue;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1, reducedMotion: 'reduce', timezoneId: 'UTC', colorScheme: theme });
    await seedChat(ctx, { theme });
    // Replies stay open (streaming) until the shot is taken; registered after the fixture's own route, so it wins.
    let release;
    const held = new Promise((r) => { release = r; });
    await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
      if (r.request().url().includes('/models?')) return r.fallback();
      await held;
      return r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Fixture reply.' }] }, finishReason: 'STOP' }] }) + '\n\n' }).catch(() => {});
    });
    const page = await ctx.newPage();
    await page.goto(url + (process.env.GLASS ? '/?emulator&glass' : '/?emulator'));
    const box = page.locator('.composer textarea');
    await box.waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    const shot = async (name) => { if (!wanted(name)) return; await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${tag}-${theme}-${name}.png`) }); };
    const openNav = async () => { if (phone && !(await page.locator('.cv-nav.open').count())) { await page.click('.menu-btn'); await page.waitForTimeout(400); } };
    const openChat = async () => {
      await openNav();
      const folder = page.locator('.cv-project-row', { hasText: 'Studio launch' });
      if (await folder.getAttribute('aria-expanded') === 'false') await folder.click();
      await page.locator('.chat-row', { hasText: 'Launch plan, three weeks' }).first().locator('.chat-open').click();
      await page.locator('[data-message-id="r8"]').waitFor();
      await page.waitForTimeout(400);
    };
    const blur = () => page.evaluate(() => document.activeElement?.blur());
    await openChat();
    await blur(); await shot('1-resting');
    await box.click(); await box.fill('Can you make it warmer?'); await shot('2-typing');
    await box.fill(DRAFT); await page.evaluate(() => { const t = document.querySelector('.composer textarea'); t.setSelectionRange(t.value.length, t.value.length); }); await shot('3-multiline');
    await box.fill('Use these for the outreach note.');
    await page.locator('input[type=file][accept="image/*"]:not([capture])').setInputFiles({ name: 'shop-window.png', mimeType: 'image/png', buffer: PNG });
    await page.locator('input[type=file]:not([accept="image/*"])').setInputFiles({ name: 'rates-2026.txt', mimeType: 'text/plain', buffer: Buffer.from('Day rate 650\nHalf day 380\n') });
    await page.locator('.attachment:not(.loading)').nth(1).waitFor({ timeout: 10000 }).catch(() => {});
    await shot('4-attachments');
    if (STATES.slice(4, 5).some(wanted)) {
      await page.locator('.composer .send-btn').click();
      await page.locator('.composer .send-btn.stop').waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      await shot('5-streaming');
    }
    release();
    await page.locator('.composer .send-btn.stop').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    await box.click(); await box.fill(DRAFT);
    await page.locator('.canvas-expand').click().catch(() => {}); await page.waitForTimeout(400); await shot('6-expanded');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300); await box.fill(''); await blur();
    // A new chat started in a project carries its chip.
    await openNav();
    const studio = page.locator('.cv-project', { hasText: 'Studio launch' });
    await studio.locator('.cv-new-here').click(); await page.waitForTimeout(500);
    await box.click(); await shot('7-project');
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
