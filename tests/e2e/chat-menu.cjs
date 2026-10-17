// A held chat's menu owns the rest of the touch; the drawer underneath must not drag or activate.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/';
const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    for (const [width, glass, reduced, height = 844] of [[390, true, false], [390, false, false], [320, true, false], [390, true, true], [844, true, false, 390], [1280, false, false]]) {
      const phone = width < 900;
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference', ...(glass ? { userAgent: ua } : {}) });
      const uid = `chat-menu-${width}-${glass}-${reduced}`;
      await profile(ctx, uid, glass ? 'dark' : 'light', { projects: Array.from({ length: 18 }, (_, i) => ({ id: `project-${i}`, name: `Project ${i}`, createdAt: Date.now() })) });
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
          if (cdp) return cdp.send('Input.dispatchTouchEvent', { type, touchPoints: ['touchEnd', 'touchCancel'].includes(type) ? [] : [{ x, y }] });
          // WebKit has no CDP touch API: retain the original touch target, as a real held gesture does.
          await page.evaluate(({ type, x, y }) => {
            if (type === 'touchStart') window.__heldTarget = document.elementFromPoint(x, y);
            const target = window.__heldTarget;
            const t = { identifier: 8, target, clientX: x, clientY: y };
            const name = { touchStart: 'touchstart', touchMove: 'touchmove', touchEnd: 'touchend', touchCancel: 'touchcancel' }[type];
            const event = new Event(name, { bubbles: true, cancelable: true });
            Object.defineProperties(event, { touches: { value: ['touchEnd', 'touchCancel'].includes(type) ? [] : [t] }, changedTouches: { value: [t] } });
            target.dispatchEvent(event);
          }, { type, x, y });
        };
        const hold = async () => {
          await row().scrollIntoViewIfNeeded();
          const b = await row().boundingBox();
          const p = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
          await touch('touchStart', p.x, p.y);
          await page.getByRole('menu', { name: 'Chat options' }).waitFor();
          return p;
        };
        let point = await hold();
        const preview = page.locator('.ctx-preview');
        assert.ok(await preview.evaluate(el => { const s = getComputedStyle(el); return s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent' && parseFloat(s.borderRadius) >= 8; }), 'Held chat keeps a visible rounded bubble');
        assert.equal(await preview.locator('.chat-open').evaluate(el => getComputedStyle(el).fontSize), await row().locator('.chat-open').evaluate(el => getComputedStyle(el).fontSize), 'Lifted title keeps its sidebar typography');
        await touch('touchMove', width - 12, point.y);
        await page.waitForTimeout(100);
        const offset = await drawer.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).m41);
        assert.ok(Math.abs(offset) < 1, `The open menu must stop the held finger dragging the drawer (${offset}px)`);
        assert.equal(await page.locator('html[data-sidebar-dragging]').count(), 0);
        await touch('touchEnd', width - 12, point.y);
        const menu = page.getByRole('menu', { name: 'Chat options' });
        assert.equal(await menu.getByRole('menuitem', { name: /Study this|tags/i }).count(), 0);
        await menu.getByRole('menuitem', { name: 'Pin', exact: true }).tap();
        await row().locator('.pin-mark').waitFor();
        await page.waitForTimeout(450);
        assert.equal(await drawer.evaluate(el => el.classList.contains('open')), true, 'Pin does not select a chat or close the drawer');

        // Continue the original hold through menu options, without lifting and tapping again.
        point = await hold();
        await page.waitForTimeout(550);
        const rename = menu.getByRole('menuitem', { name: 'Rename', exact: true });
        const unpin = menu.getByRole('menuitem', { name: 'Unpin', exact: true });
        const a = await rename.boundingBox(), b = await unpin.boundingBox();
        await touch('touchMove', a.x + a.width - 24, a.y + a.height / 2);
        assert.equal(await rename.getAttribute('data-menu-preview'), 'true', 'Sliding previews the option under the finger');
        await touch('touchMove', b.x + b.width / 2, b.y + b.height / 2);
        assert.equal(await unpin.getAttribute('data-menu-preview'), 'true', 'The highlight follows the new option');
        assert.equal(await rename.getAttribute('data-menu-preview'), null, 'Only one option is previewed');
        assert.equal(await row().locator('.pin-mark').count(), 1, 'Previewing does not perform an action');
        assert.ok(await unpin.evaluate(el => parseFloat(getComputedStyle(el).borderRadius)) >= 8, 'Held options have the rounded corners of the ellipsis menu');
        await touch('touchEnd', b.x + b.width / 2, b.y + b.height / 2);
        await row().locator('.pin-mark').waitFor({ state: 'detached' });
        await page.waitForTimeout(350);

        // Leaving the menu before release cancels the choice and keeps the drawer usable.
        point = await hold();
        await page.waitForTimeout(550);
        const pin = await menu.getByRole('menuitem', { name: 'Pin', exact: true }).boundingBox();
        await touch('touchMove', pin.x + pin.width / 2, pin.y + pin.height / 2);
        await touch('touchMove', width - 12, 120);
        await touch('touchEnd', width - 12, 120);
        assert.equal(await row().locator('.pin-mark').count(), 0, 'Releasing outside never selects the last previewed option');
        assert.ok(await menu.isVisible());
        await touch('touchStart', pin.x + pin.width / 2, pin.y + pin.height / 2);
        await page.waitForTimeout(500);
        assert.equal(await menu.getByRole('menuitem', { name: 'Pin', exact: true }).evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'Holding an option does not create a touch focus box');
        await touch('touchCancel', pin.x + pin.width / 2, pin.y + pin.height / 2);
        assert.equal(await row().locator('.pin-mark').count(), 0, 'A cancelled option gesture never commits');
        await menu.focus();
        await page.keyboard.press('ArrowDown');
        const keyboardFocus = await menu.evaluate(el => ({ input: el.dataset.menuInput, active: document.activeElement?.textContent, visible: el.contains(document.activeElement) && getComputedStyle(document.activeElement).outlineStyle !== 'none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2 }));
        assert.ok(keyboardFocus.visible, `Keyboard navigation keeps a visible focus indicator (${JSON.stringify(keyboardFocus)})`);
        await page.keyboard.press('Escape');
        await page.locator('.ctx-layer:not(.exit-ghost)').waitFor({ state: 'detached' });
        await page.waitForTimeout(350);

        point = await hold();
        await touch('touchEnd', point.x, point.y);
        await page.waitForTimeout(550);
        await page.touchscreen.tap(width - 12, 120);
        await page.locator('.ctx-layer:not(.exit-ghost)').waitFor({ state: 'detached' });
        assert.equal(await drawer.evaluate(el => el.classList.contains('open')), true, 'An outside tap dismisses only the context menu');
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.composer textarea').inputValue(), 'KEEP_MY_DRAFT', 'Menu actions and dismissal preserve the draft');
        // An inactive row must also remain stable: ancestor :active used to tint it.
        await row().getByRole('button', { name: 'Chat options' }).click();
        const inactiveMenu = row().getByRole('menu', { name: 'Chat options' });
        await inactiveMenu.waitFor();
        await page.waitForTimeout(350);
        assert.equal(await inactiveMenu.locator('[data-menu-preview]').count(), 0, 'Opening ellipsis has no preselected action');
        assert.equal(await inactiveMenu.locator('.menu-touch-highlight').evaluate(el => el.hidden), true, 'Opening ellipsis keeps the highlight hidden');
        await inactiveMenu.getByRole('menuitem', { name: 'Rename', exact: true }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
        await page.mouse.move(width - 5, 100);
        await page.waitForTimeout(200);
        const inactiveColor = await row().evaluate(el => getComputedStyle(el).backgroundColor);
        const action = await inactiveMenu.getByRole('menuitem', { name: 'Rename', exact: true }).boundingBox();
        await page.mouse.move(action.x + action.width / 2, action.y + action.height / 2);
        await page.waitForTimeout(200);
        assert.equal(await row().evaluate(el => getComputedStyle(el).backgroundColor), inactiveColor, 'Hovering an ellipsis action keeps an inactive chat bubble color');
        await touch('touchStart', action.x + action.width / 2, action.y + action.height / 2);
        await page.waitForTimeout(200);
        assert.equal(await row().evaluate(el => getComputedStyle(el).backgroundColor), inactiveColor, 'Holding an ellipsis action keeps an inactive chat bubble color');
        await touch('touchCancel', action.x + action.width / 2, action.y + action.height / 2);
        await inactiveMenu.focus();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(350);
        await drawer.locator('.chat-open', { hasText: 'Alpha' }).tap();
        await page.waitForFunction(() => !document.querySelector('.sidebar.open'));
        // The ellipsis menu uses the same sliding highlight and release behavior.
        await page.locator('.menu-btn').click();
        await drawer.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))));
        const alpha = drawer.locator('.chat-row', { hasText: 'Alpha' });
        await alpha.getByRole('button', { name: 'Chat options' }).click();
        const inline = alpha.getByRole('menu', { name: 'Chat options' });
        await inline.getByRole('menuitem', { name: 'Pin', exact: true }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
        await inline.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))));
        const ir = await inline.getByRole('menuitem', { name: 'Rename', exact: true }).boundingBox();
        const ip = await inline.getByRole('menuitem', { name: 'Pin', exact: true }).boundingBox();
        const rowColor = await alpha.evaluate(el => getComputedStyle(el).backgroundColor);
        await touch('touchStart', ir.x + ir.width / 2, ir.y + ir.height / 2);
        await page.waitForTimeout(200);
        assert.equal(await alpha.evaluate(el => getComputedStyle(el).backgroundColor), rowColor, 'Holding an ellipsis action does not recolor the chat bubble');
        await touch('touchMove', ip.x + ip.width / 2, ip.y + ip.height / 2);
        assert.equal(await inline.getByRole('menuitem', { name: 'Pin', exact: true }).getAttribute('data-menu-preview'), 'true');
        await touch('touchEnd', ip.x + ip.width / 2, ip.y + ip.height / 2);
        await alpha.locator('.pin-mark').waitFor();
        await page.waitForTimeout(350);
        await alpha.getByRole('button', { name: 'Chat options' }).click();
        await inline.getByRole('menuitem', { name: 'Move to project', exact: true }).click();
        await page.waitForTimeout(350);
        const projects = inline.locator('.chat-move-list');
        await projects.scrollIntoViewIfNeeded();
        const list = await projects.boundingBox();
        await touch('touchStart', list.x + list.width / 2, list.y + 22);
        await touch('touchMove', list.x + list.width / 2, list.y + list.height - 6);
        await page.waitForTimeout(350);
        assert.ok(await projects.evaluate(el => el.scrollTop) > 30, 'A held finger at the inner project list edge scrolls to more options');
        await touch('touchMove', width - 12, 120);
        await touch('touchEnd', width - 12, 120);
        await page.keyboard.press('Escape');
        point = await hold();
        await touch('touchEnd', point.x, point.y);
        // Browsers retain :active on the original pressed button while the pointer moves.
        // The moving highlight must be the only fill, even with that native state retained.
        const startAction = menu.getByRole('menuitem', { name: 'Rename', exact: true });
        const nextAction = menu.getByRole('menuitem', { name: 'Pin', exact: true });
        await page.waitForTimeout(550);
        await startAction.hover();
        await page.mouse.down();
        const nextBox = await nextAction.boundingBox();
        await page.mouse.move(nextBox.x + nextBox.width / 2, nextBox.y + nextBox.height / 2);
        await page.waitForTimeout(200);
        assert.equal(await nextAction.getAttribute('data-menu-preview'), 'true');
        assert.equal(await startAction.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'The original pressed action has no second highlight after sliding');
        await page.mouse.move(width - 12, 120);
        await page.mouse.up();
      } else {
        await row().getByRole('button', { name: 'Chat options' }).click();
        const menu = row().getByRole('menu', { name: 'Chat options' });
        await page.waitForTimeout(350);
        assert.equal(await menu.locator('[data-menu-preview]').count(), 0, 'Mouse opening starts neutral');
        await page.keyboard.press('ArrowUp');
        assert.equal(await menu.getByRole('menuitem', { name: 'Delete', exact: true }).evaluate(el => el === document.activeElement), true, 'ArrowUp enters the last action from the menu container');
        await page.keyboard.press('Escape');
        const opener = row().getByRole('button', { name: 'Chat options' });
        await opener.focus();
        await page.keyboard.press('ArrowDown');
        assert.equal(await menu.getByRole('menuitem', { name: 'Rename', exact: true }).evaluate(el => el === document.activeElement), true, 'Keyboard opening still focuses the first action');
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
