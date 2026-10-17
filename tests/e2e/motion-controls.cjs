// Motion is deliberately enabled: cancellation, rapid navigation and reduced motion must work mid-animation.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
const url = process.env.MR_TEST_URL || 'http://localhost:5190/';
const only = process.env.MOTION_CASE;
const run = name => !only || only === name;
const rest = page => page.waitForFunction(() => !document.querySelector('.page-swap-ghost'));

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    for (const [width, glass, reduced] of [[1280, false, false], [390, true, false], [390, true, true]]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference', ...(glass ? { userAgent: ua } : {}) });
      await profile(ctx, `motion-controls-${width}-${reduced}`, glass ? 'dark' : 'light');
      await ctx.addInitScript(() => { window.__mrMotion = true; });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      const input = page.locator('.composer textarea');
      await input.waitFor();
      await input.fill('KEEP_MY_DRAFT');

      if (run('press')) {
        const add = page.locator('.composer button[aria-label^="Add"]').first();
        const box = await add.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        if (!reduced) await page.waitForFunction(() => {
          const el = document.querySelector('.composer button[aria-label^="Add"]');
          const scale = Number(getComputedStyle(el).scale.split(' ')[0]);
          return scale >= .94 && scale < 1;
        }, null, { timeout: 3000 });
        const pressed = await add.evaluate(el => ({ scale: getComputedStyle(el).scale, translate: getComputedStyle(el).translate }));
        const scale = Number(pressed.scale.split(' ')[0]);
        if (reduced) assert.ok(pressed.scale === 'none' || scale === 1, 'Reduced motion keeps the control stationary');
        else assert.ok(scale >= .94 && scale < 1, `A bounded press-in, without swelling (${pressed.scale})`);
        assert.ok(pressed.translate === 'none' || pressed.translate === '0px', 'Buttons stay under the finger');
        await page.mouse.move(1, 1);
        await page.mouse.up();
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.is-pressed').count(), 0, 'Releasing outside clears press feedback');
        assert.equal(await page.locator('.attach-menu').count(), 0, 'Releasing outside does not activate the action');
      }

      if (run('cancel') && width < 900) {
        await page.locator('.composer button[aria-label^="Add"]').first().click();
        const sheet = page.locator('.sheet.attach-menu');
        await sheet.waitFor();
        await page.waitForTimeout(550);
        const original = await sheet.boundingBox();
        const grip = await page.locator('.attach-menu .sheet-grab').boundingBox();
        const x = grip.x + grip.width / 2, y = grip.y + grip.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x, y + original.height * .65, { steps: 12 });
        await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', isPrimary: true })));
        await page.mouse.up();
        await page.waitForTimeout(800);
        assert.ok(await sheet.isVisible(), 'A cancelled sheet gesture never dismisses the dialog');
        assert.ok(Math.abs((await sheet.boundingBox()).y - original.y) < 1, 'Cancelled sheet returns to its resting position');
        await page.keyboard.press('Escape');
        await sheet.waitFor({ state: 'detached' });
      }

      if (run('navigation')) {
        await page.evaluate(() => {
          window.__outgoingSurfaces = 0;
          new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (node instanceof HTMLElement && node.classList.contains('page-swap-ghost') && node.inert && node.getAttribute('aria-hidden') === 'true') window.__outgoingSurfaces++;
          }))).observe(document.querySelector('.app'), { childList: true, subtree: true });
        });
        if (width < 900) await page.locator('.menu-btn').click();
        await page.locator('.sidebar').getByRole('button', { name: 'Tools', exact: true }).click();
        const hub = page.locator('.hub-page:not(.exit-ghost)');
        await hub.waitFor();
        if (!reduced) {
          assert.ok(await page.evaluate(() => window.__outgoingSurfaces > 0), 'Opening a hub preserves a noninteractive outgoing surface on phone and desktop');
        }
        // Interrupt the entrance: the destination must remain usable, with no obsolete copied screens.
        await hub.getByRole('button', { name: 'Close', exact: true }).click({ force: true });
        await rest(page);
        await page.waitForTimeout(500);
        assert.equal(await page.locator('.page-swap-ghost').count(), 0);
        assert.equal(await input.inputValue(), 'KEEP_MY_DRAFT');
        assert.ok(await input.isEditable(), 'The real composer is available after rapid back navigation');
        if (reduced) assert.equal(await page.locator('.exit-ghost').count(), 0, 'Reduced motion does not retain outgoing copies');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS motion controls ${process.env.MR_WEBKIT ? 'webkit' : 'chromium'} ${width}px ${glass ? 'glass' : 'solid'} ${reduced ? 'reduced' : 'motion'}: ${only || 'press, cancellation, navigation'}`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
