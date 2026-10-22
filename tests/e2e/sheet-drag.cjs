// Phone bottom sheets follow a drag: a short drag springs back, a long one closes the sheet.
// Covers the usage sheet, the model picker, the + sheet and a window (All chats).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const now = Date.now();
const chats = [{ id: 's1', title: 'Drag test chat', createdAt: now - 6e5, updatedAt: now - 6e5, model: 'gemini:gemini-flash-latest', messages: [
  { id: 'a', role: 'user', text: 'Hello', createdAt: now - 6e5 },
  { id: 'b', role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', text: 'Hi! How can I help?', createdAt: now - 5e5 },
] }];

/** Drags `selector` down by `dy` pixels with real touch events, one step per frame. */
const drag = (page, selector, dy) => page.evaluate(async ([sel, dy]) => {
  const el = document.querySelector(sel);
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const touch = (yy) => new Touch({ identifier: 7, target: el, clientX: x, clientY: yy });
  const fire = (type, yy, list = true) => el.dispatchEvent(new TouchEvent(type, { touches: list ? [touch(yy)] : [], changedTouches: [touch(yy)], bubbles: true, cancelable: true }));
  fire('touchstart', y);
  for (let i = 1; i <= 12; i++) { await new Promise((ok) => setTimeout(ok, 20)); fire('touchmove', y + (dy * i) / 12); }
  await new Promise((ok) => setTimeout(ok, 20));
  fire('touchend', y + dy, false);
}, [selector, dy]);

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await profile(ctx, 'sheet-drag', 'dark');
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
    await page.waitForSelector('.composer textarea');
    await seed(page, 'sheet-drag', chats);
    await page.reload();
    await page.waitForSelector('.composer textarea');
    await page.click('.menu-btn');
    await page.click('text=Drag test chat');

    const check = async (name, open, sheet, grip) => {
      await open();
      await page.locator(sheet).waitFor();
      await drag(page, grip, 30);
      await page.waitForTimeout(350);
      assert.ok(await page.locator(sheet).isVisible(), `${name}: a short drag springs back`);
      assert.equal(await page.locator(sheet).evaluate((el) => el.style.transform), '', `${name}: back in place`);
      await drag(page, grip, 420);
      await page.locator(sheet).waitFor({ state: 'detached', timeout: 3000 });
      console.log(`PASS ${name}: follows the drag and closes when dragged down`);
    };

    await check('usage sheet', () => page.focus('.composer textarea').then(()=>page.click('.usage-chip')), '.usage-pop.sheet', '.usage-pop.sheet .sheet-grip');
    await check('model picker', () => page.click('.composer .model-button'), '.models-pop.sheet', '.models-pop.sheet .sheet-grip');
    // 2.4.12: a swipe down that starts on the search box at the top of the model picker moves the sheet too.
    await check('model picker from its search box', () => page.click('.composer .model-button'), '.models-pop.sheet', '.models-pop.sheet input[type="search"]');
    await check('+ sheet', () => page.getByRole('button', { name: /^Add (?:photos, )?files or a repository$/ }).click(), '.sheet.attach-menu', '.sheet.attach-menu .sheet-grab');
    await check('All chats window', async () => { await page.click('.menu-btn'); await page.click('.view-all-chats'); }, '.modal', '.modal .sheet-grip');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
