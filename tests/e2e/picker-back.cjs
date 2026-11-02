// Back from Browse all tools (Canvas, phones). Safari's own back swipe slides the page away over a snapshot of the
// previous history entry, taken when the new entry was pushed. So when the picker opens from +, its entry must be
// pushed only after the + sheet has left the screen, or the swipe shows the old + sheet before the chat.
// Playwright cannot drive Safari's native swipe; this suite checks what the swipe depends on: what is on screen when
// the entry is pushed, that Back (what the swipe performs) returns straight to the chat with the draft, that a partial
// drag of the picker that is let go settles back, and that repeated open/close cycles leave nothing behind.
// Synthetic profile; every request off the preview origin is blocked.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { profile } = require('./helpers/preview-profile.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5190';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

(async () => {
  const engine = process.env.MR_WEBKIT ? webkit : chromium, browser = await engine.launch();
  try {
    for (const [width, height] of [[390, 844], [320, 568]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: !process.env.MR_WEBKIT, userAgent: UA, reducedMotion: 'no-preference', serviceWorkers: 'block' });
      await ctx.route('**/*', (r) => new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort());
      await profile(ctx, 'preview-picker-back', 'light');
      // Record, for every history push, whether the + sheet was still in the page at that moment.
      await ctx.addInitScript(() => {
        window.__pushes = [];
        const push = history.pushState.bind(history);
        history.pushState = (...args) => { window.__pushes.push({ plus: Boolean(document.querySelector('.attach-menu')), picker: Boolean(document.querySelector('.tool-picker')) }); return push(...args); };
      });
      const page = await ctx.newPage(); page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base);
      const box = page.locator('.composer textarea');
      await box.waitFor({ state: 'attached' });
      if (!await page.locator('[data-lumen-canvas-shell]').count()) { console.log('SKIP picker-back: not the Canvas presentation'); await ctx.close(); return; }
      await box.fill('Keep this draft');
      const picker = page.getByRole('dialog', { name: 'Tools', exact: true });
      const openFromPlus = async () => {
        await page.evaluate(() => { window.__pushes.length = 0; });
        await page.getByRole('button', { name: 'Add photos, files or a repository' }).click();
        await page.getByRole('dialog', { name: 'Add to your message' }).getByRole('button', { name: 'Browse all tools' }).click();
        await picker.waitFor();
        await page.waitForFunction(() => window.__pushes.some((p) => !p.picker));
        const pushes = await page.evaluate(() => window.__pushes);
        assert.ok(pushes.length >= 1, 'opening the picker adds a history entry');
        assert.equal(pushes[0].plus, false, 'the picker entry is pushed after the + sheet has left the screen (Safari snapshots the previous screen then)');
        assert.equal(await page.locator('.attach-menu').count(), 0, 'no + sheet under the picker');
      };
      const atChat = async (how) => {
        await picker.waitFor({ state: 'detached' });
        await page.waitForTimeout(250);
        assert.equal(await page.locator('.attach-menu, .sheet-backdrop').count(), 0, `${how}: no + sheet comes back`);
        assert.equal(await box.inputValue(), 'Keep this draft', `${how}: the draft is kept`);
      };

      // Open from +, then Back (what the iPhone swipe performs): straight to the chat.
      await openFromPlus();
      await page.goBack();
      await atChat('Back');

      // A partial downward drag of the picker sheet, let go early: it settles where it was and stays usable.
      await openFromPlus();
      const grab = await page.locator('.tool-picker .sheet-grab').boundingBox();
      const touch = await ctx.newCDPSession(page).catch(() => null);
      if (touch) {
        const at = (y) => [{ x: grab.x + grab.width / 2, y }];
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(grab.y) });
        for (const dy of [12, 30, 48]) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(grab.y + dy) });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        // WebKit: the same partial drag through the sheet's own touch handlers.
        await page.locator('.tool-picker').evaluate(async (el) => {
          const g = el.querySelector('.sheet-grab').getBoundingClientRect(), x = g.left + g.width / 2;
          const fire = (type, y) => { const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y }); el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : [t], changedTouches: [t] })); };
          fire('touchstart', g.top); for (const dy of [12, 30, 48]) { fire('touchmove', g.top + dy); await new Promise((r) => setTimeout(r, 16)); } fire('touchend', g.top + 48);
        }).catch(() => {});
      }
      await page.waitForTimeout(700);
      await picker.waitFor();
      assert.equal(await page.locator('.tool-picker').evaluate((el) => getComputedStyle(el).transform), 'none', 'a let-go partial drag settles back in place');
      await picker.getByRole('searchbox', { name: 'Search tools' }).fill('study');
      await picker.getByRole('button', { name: 'Study', exact: true }).waitFor();
      await page.goBack();
      await atChat('Back after a cancelled drag');

      // Repeated cycles, closing each way: Back, the close button, Escape.
      for (const close of ['back', 'button', 'escape', 'back', 'button']) {
        await openFromPlus();
        if (close === 'back') await page.goBack();
        else if (close === 'button') await picker.getByRole('button', { name: 'Close tools' }).click();
        else await page.keyboard.press('Escape');
        await atChat(`cycle (${close})`);
      }
      // Forward after a Back brings the picker back on its own, without a + sheet.
      await page.goForward();
      await picker.waitFor();
      assert.equal(await page.locator('.attach-menu').count(), 0);
      await page.goBack();
      await atChat('Back after Forward');

      assert.deepEqual(errors, []);
      console.log(`PASS ${process.env.MR_WEBKIT ? 'webkit' : 'chromium'} ${width}x${height}: picker entry pushed after the + sheet left; Back, cancelled drag and repeated cycles return to the chat with the draft`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
