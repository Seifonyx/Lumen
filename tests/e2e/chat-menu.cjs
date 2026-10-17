// A held chat's menu owns the rest of the touch; the drawer underneath must not drag or activate.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/';
const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    for (const [width, glass, reduced] of [[390, true, false], [390, false, false], [320, true, false], [390, true, true], [1280, false, false]]) {
      const phone = width < 900;
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference', ...(glass ? { userAgent: ua } : {}) });
      const uid = `chat-menu-${width}-${glass}-${reduced}`;
      await profile(ctx, uid, glass ? 'dark' : 'light');
      await ctx.addInitScript(() => { window.__mrMotion = true; });
      const page = await ctx.newPage();
      await page.goto(new URL('/privacy.html', url).href);
      const now = Date.now();
      await seed(page, uid, ['Alpha', 'Beta', 'Gamma', ...Array.from({ length: 25 }, (_, i) => `Older ${i}`)].map((title, i) => ({ id: title, title, tags: ['legacy-hidden-tag'], createdAt: now - i * 1000, updatedAt: now - i * 1000, messages: [{ id: `${title}-u`, role: 'user', text: 'A saved conversation.', createdAt: now }] })));
      await page.goto(url);
      await page.locator('.composer textarea').fill('KEEP_MY_DRAFT');
      const drawer = page.locator('.sidebar');
      const row = () => drawer.locator('.chat-row', { hasText: 'Beta' });
      if (phone) {
        await page.locator('.menu-btn').click();
        await page.waitForTimeout(500);
        const cdp = process.env.MR_WEBKIT ? null : await ctx.newCDPSession(page);
        const touch = async (type, x, y) => {
          if (cdp) return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
          // WebKit has no CDP touch API: retain the original touch target, as a real held gesture does.
          await page.evaluate(({ type, x, y }) => {
            if (type === 'touchStart') window.__heldTarget = document.elementFromPoint(x, y);
            const target = window.__heldTarget;
            const t = { identifier: 8, target, clientX: x, clientY: y };
            const name = { touchStart: 'touchstart', touchMove: 'touchmove', touchEnd: 'touchend' }[type];
            const event = new Event(name, { bubbles: true, cancelable: true });
            Object.defineProperties(event, { touches: { value: type === 'touchEnd' ? [] : [t] }, changedTouches: { value: [t] } });
            target.dispatchEvent(event);
          }, { type, x, y });
        };
        const hold = async () => {
          const b = await row().boundingBox();
          const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          await touch('touchStart', p.x, p.y);
          await page.getByRole('menu', { name: 'Chat options' }).waitFor();
          return p;
        };
        let point = await hold();
        await touch('touchMove', point.x - 80, point.y);
        await page.waitForTimeout(100);
        const offset = await drawer.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).m41);
        assert.ok(Math.abs(offset) < 1, `The open menu must stop the held finger dragging the drawer (${offset}px)`);
        assert.equal(await page.locator('html[data-sidebar-dragging]').count(), 0);
        await touch('touchEnd', point.x - 80, point.y);
        const menu = page.getByRole('menu', { name: 'Chat options' });
        assert.equal(await menu.getByRole('menuitem', { name: /Study this|tags/i }).count(), 0);
        await menu.getByRole('menuitem', { name: 'Pin', exact: true }).tap();
        await row().locator('.pin-mark').waitFor();
        await page.waitForTimeout(450);
        assert.equal(await drawer.evaluate(el => el.classList.contains('open')), true, 'Pin does not select a chat or close the drawer');

        point = await hold();
        await touch('touchEnd', point.x, point.y);
        await page.waitForTimeout(550);
        await page.touchscreen.tap(width - 12, 120);
        await page.locator('.ctx-layer:not(.exit-ghost)').waitFor({ state: 'detached' });
        assert.equal(await drawer.evaluate(el => el.classList.contains('open')), true, 'An outside tap dismisses only the context menu');
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.composer textarea').inputValue(), 'KEEP_MY_DRAFT', 'Menu actions and dismissal preserve the draft');
        await drawer.locator('.chat-open', { hasText: 'Alpha' }).tap();
        await page.waitForFunction(() => !document.querySelector('.sidebar.open'));
      } else {
        await row().getByRole('button', { name: 'Chat options' }).click();
        const menu = row().getByRole('menu', { name: 'Chat options' });
        assert.equal(await menu.getByRole('menuitem', { name: /Study this|tags/i }).count(), 0);
        await menu.getByRole('menuitem', { name: 'Pin', exact: true }).click();
        await row().locator('.pin-mark').waitFor();
      }
      assert.equal(await drawer.locator('.chat-tag-count').count(), 0, 'Saved legacy tags have no sidebar badge');
      console.log(`PASS chat menu ${process.env.MR_WEBKIT ? 'webkit' : 'chromium'} ${width}px ${glass ? 'glass' : 'solid'} ${reduced ? 'reduced' : 'motion'}: gesture isolation, action, dismissal, simplified options`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
