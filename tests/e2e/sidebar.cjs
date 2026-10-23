// Isolated local accounts and mocked AI. Covers intent, finger tracking, cancellation and native scrolling.
const { chromium } = require('playwright');
const path = require('node:path');
const { scan } = require('./helpers/fitscan.cjs');
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++; };
async function touch(page, selector, type, x, y, count = 1) {
  return page.locator(selector).evaluate((target, { type, x, y, count }) => {
    const points = Array.from({ length: count }, (_, id) => new Touch({ identifier: id, target, clientX: x + id * 20, clientY: y }));
    const event = new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' || type === 'touchcancel' ? [] : points, targetTouches: type === 'touchend' || type === 'touchcancel' ? [] : points, changedTouches: points });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }, { type, x, y, count });
}
const settled = page => page.waitForTimeout(320);
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[390, 844], [320, 720], [844, 390]]) {
      for (const rtl of [false, true]) {
        const label = `${width}px ${rtl ? 'RTL' : 'LTR'}`;
        const ctx = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
        await ctx.route('**/firestore.googleapis.com/**', r => r.abort());
        await ctx.route('**/generativelanguage.googleapis.com/**', r => {
          if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576 }] } });
          const text = Array.from({ length: 60 }, (_, i) => `Paragraph ${i + 1}. Keep this conversation readable and easy to scroll.`).join('\n\n') + '\n\n```js\nconst longVariable = "' + 'x'.repeat(300) + '";\n```';
          return r.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n' });
        });
        await ctx.addInitScript(() => {
          if (window.top !== window || localStorage.getItem('mr.preview_user')) return;
          const uid = 'preview-sidebar_test';
          const settings = { theme: 'dark', autoIntroduced: true, autoTitle: false, enabledModels: ['gemini:gemini-flash-latest'], defaultModel: 'gemini:gemini-flash-latest' };
          localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'sidebar@local.invalid', displayName: 'Sidebar', photoURL: '' }));
          localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'test-key', settings }));
          localStorage.setItem('mr.settings', JSON.stringify(settings));
          localStorage.setItem('mr.installHint', '1');
        });
        const page = await ctx.newPage(), errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.app:not(.app-skeleton) .main.is-empty');
        await page.evaluate(rtl => { document.documentElement.dir = rtl ? 'rtl' : 'ltr'; }, rtl);
        const sign = rtl ? -1 : 1, start = rtl ? width - 90 : 90, y = Math.min(250, height / 2);
        const isOpen = () => page.locator('.sidebar').evaluate(el => el.classList.contains('open'));
        check(await page.locator('.sidebar').evaluate(el => el.inert), `${label}: closed drawer is excluded from keyboard navigation`);
        await touch(page, '.messages', 'touchstart', start, y);
        check(!(await touch(page, '.messages', 'touchmove', start + sign * 4, y + 100)), `${label}: vertical intent is left to the browser`);
        await touch(page, '.messages', 'touchend', start + sign * 4, y + 100);
        check(!(await isOpen()), `${label}: vertical drag does not open the drawer`);

        await touch(page, '.messages', 'touchstart', start, y);
        await touch(page, '.messages', 'touchmove', start + sign * 28, y);
        await page.waitForTimeout(180); // Slow, short swipe: no fling.
        await touch(page, '.messages', 'touchend', start + sign * 28, y);
        await settled(page);
        check(!(await isOpen()) && !(await page.evaluate(() => 'sidebarDragging' in document.documentElement.dataset)), `${label}: short swipe returns closed`);

        await touch(page, '.messages', 'touchstart', start, y);
        await page.waitForTimeout(20);
        await touch(page, '.messages', 'touchmove', start + sign * 36, y);
        await touch(page, '.messages', 'touchend', start + sign * 36, y);
        await settled(page);
        check(await isOpen(), `${label}: a quick short fling opens the drawer`);
        await page.getByRole('button', { name: 'Close menu', exact: true }).click(); await settled(page);

        await touch(page, '.messages', 'touchstart', start, y);
        await touch(page, '.messages', 'touchmove', start + sign * 130, y + 3);
        await page.waitForTimeout(35);
        const box = await page.locator('.sidebar').boundingBox();
        const exposed = rtl ? width - box.x : box.x + box.width;
        check(exposed > 120 && exposed < 140 && await page.locator('.scrim').evaluate(el => Number(getComputedStyle(el).opacity) > 0 && Number(getComputedStyle(el).opacity) < 1), `${label}: sidebar and scrim follow the finger before release`);
        await page.waitForTimeout(150);
        await touch(page, '.messages', 'touchend', start + sign * 130, y + 3);
        await settled(page);
        check(await isOpen() && (await scan(page)).length === 0 && await page.locator('.main').evaluate(el => el.inert), `${label}: swipe from the chat area opens a fitting modal drawer`);
        await page.screenshot({ path: path.join(__dirname, 'out', `sidebar-${width}-${rtl ? 'rtl' : 'ltr'}.png`) });
        await page.locator('.sidebar-foot, .cv-account').focus(); await page.keyboard.press('Tab');
        check(await page.locator('.close-sidebar, .cv-nav [aria-label="Close menu"]').evaluate(el => el === document.activeElement), `${label}: drawer keyboard focus stays inside`);

        const closeX = rtl ? width - 230 : 230;
        await touch(page, ':is(.chat-list, .cv-nav)', 'touchstart', closeX, y);
        await touch(page, ':is(.chat-list, .cv-nav)', 'touchmove', closeX - sign * 28, y);
        await page.waitForTimeout(180);
        await touch(page, ':is(.chat-list, .cv-nav)', 'touchend', closeX - sign * 28, y);
        await settled(page);
        check(await isOpen(), `${label}: a slow short closing swipe stays open`);
        await touch(page, ':is(.chat-list, .cv-nav)', 'touchstart', closeX, y);
        await touch(page, ':is(.chat-list, .cv-nav)', 'touchmove', closeX - sign * 150, y);
        await page.waitForTimeout(150);
        await touch(page, ':is(.chat-list, .cv-nav)', 'touchend', closeX - sign * 150, y);
        await settled(page);
        check(!(await isOpen()) && !(await page.locator('.main').evaluate(el => el.inert)), `${label}: opposite swipe closes the drawer`);

        await touch(page, '.messages', 'touchstart', start, y);
        await touch(page, '.messages', 'touchmove', start + sign * 100, y);
        await touch(page, '.messages', 'touchcancel', start + sign * 100, y);
        await settled(page);
        check(!(await isOpen()) && !(await page.evaluate(() => 'sidebarDragging' in document.documentElement.dataset)), `${label}: cancellation clears the drag styles`);
        await touch(page, '.messages', 'touchstart', start, y, 2);
        await touch(page, '.messages', 'touchmove', start + sign * 150, y, 2);
        await touch(page, '.messages', 'touchend', start + sign * 150, y);
        check(!(await isOpen()), `${label}: multiple fingers cannot toggle the drawer`);

        await page.fill('.composer textarea', 'Keep my draft');
        await touch(page, '.composer textarea', 'touchstart', start, y);
        await touch(page, '.composer textarea', 'touchmove', start + sign * 150, y);
        await touch(page, '.composer textarea', 'touchend', start + sign * 150, y);
        check(!(await isOpen()) && await page.inputValue('.composer textarea') === 'Keep my draft', `${label}: composer gestures preserve the draft`);
        await page.click('.menu-btn'); await page.click('.sidebar-foot, .cv-account');
        await touch(page, '.settings-page', 'touchstart', start, y);
        await touch(page, '.settings-page', 'touchmove', start + sign * 150, y);
        await touch(page, '.settings-page', 'touchend', start + sign * 150, y);
        check(!(await isOpen()), `${label}: settings cannot trigger a hidden drawer`);
        await page.click('.settings-page [aria-label="Close"]');

        await page.fill('.composer textarea', 'A long scroll test'); await page.click('.send-btn');
        await page.waitForSelector('.msg.assistant pre'); await page.locator('.send-btn.stop').waitFor({ state: 'hidden' });
        await touch(page, '.msg.assistant pre', 'touchstart', start, y);
        await touch(page, '.msg.assistant pre', 'touchmove', start + sign * 150, y);
        await touch(page, '.msg.assistant pre', 'touchend', start + sign * 150, y);
        check(!(await isOpen()), `${label}: code gestures do not open the drawer`);
        // (On phones message text is selected through the long-press menu; code blocks keep native selection.)
        await page.locator('.msg.assistant pre').first().evaluate(el => window.getSelection().selectAllChildren(el));
        await touch(page, '.messages', 'touchstart', start, y);
        await touch(page, '.messages', 'touchmove', start + sign * 150, y);
        await touch(page, '.messages', 'touchend', start + sign * 150, y);
        check(!(await isOpen()), `${label}: selected message text is preserved`);
        await page.evaluate(() => window.getSelection().removeAllRanges());
        // Chromium's native touch input verifies that scrolling still works, beyond event dispatch.
        await page.locator('.messages').evaluate(el => { el.scrollTop = 0; });
        const cdp = await ctx.newCDPSession(page), messageBox = await page.locator('.messages').boundingBox();
        const sx = width / 2, sy = messageBox.y + messageBox.height * .8;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
        for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + 2, y: sy - i * 15 }] }); await page.waitForTimeout(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(100);
        check(await page.locator('.messages').evaluate(el => el.scrollTop > 20) && !(await isOpen()), `${label}: native touch scroll remains usable in long chats`);
        const nativeY = messageBox.y + messageBox.height / 2;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start, y: nativeY }] });
        for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start + sign * i * 32, y: nativeY }] }); await page.waitForTimeout(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settled(page);
        check(await isOpen(), `${label}: native horizontal touch opens the drawer`);
        await page.locator(':is(.chat-list, .cv-nav)').scrollIntoViewIfNeeded();
        const listBox = await page.locator(':is(.chat-list, .cv-nav)').boundingBox(), listY = listBox.y + listBox.height / 2;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: closeX, y: listY }] });
        for (let i = 1; i <= 5; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: closeX - sign * i * 32, y: listY }] }); await page.waitForTimeout(16); }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settled(page);
        check(!(await isOpen()), `${label}: native horizontal touch closes the drawer`);
        await page.click('.menu-btn'); await settled(page); await page.keyboard.press('Escape'); await settled(page);
        check(!(await isOpen()) && await page.locator('.menu-btn').evaluate(el => el === document.activeElement), `${label}: Escape closes and restores the menu button focus`);
        check(errors.length === 0, `${label}: no browser errors (${errors.join(' | ')})`);
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED'); process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
