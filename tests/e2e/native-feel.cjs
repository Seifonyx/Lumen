// The "feels like an app" layer on phones (1.3), with real touch sequences and motion on:
//  long press: a message or chat sinks, then a menu opens over a dimmed background with a lifted copy and a
//              buzz; a quick tap or a scroll doesn't open it, and the lift doesn't also tap what's underneath;
//  swipe rows (All chats): right pins, a short left swipe uncovers Delete, a long one deletes, Undo restores;
//  sending: the message flies from the text box into the conversation; streamed words fade in and the
//           finished reply is left as plain text; haptics fire for send, long press, switches.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const chats = [
  { id: 'n1', title: 'Garden ideas', createdAt: now - 5e5, updatedAt: now - 5e5, model: 'gemini:gemini-flash-latest', messages: [
    { id: 'n1u', role: 'user', text: 'What should I plant in spring?', createdAt: now - 5e5 },
    { id: 'n1a', role: 'assistant', status: 'done', model: 'gemini:gemini-flash-latest', text: 'Start with **peas**, lettuce and radishes. They like cool weather.\n\nThen add tomatoes once nights are warm.', createdAt: now - 4e5 },
  ] },
  ...['Trip packing list', 'Budget for March', 'Birthday message'].map((title, i) => ({ id: `r${i}`, title, createdAt: now - (i + 2) * 9e7, updatedAt: now - (i + 2) * 9e7, messages: [{ id: `r${i}m`, role: 'user', text: 'hi', createdAt: now - (i + 2) * 9e7 }] })),
];

const touchAt = (page, x, y, { holdMs = 0, to } = {}) => page.evaluate(async ([x, y, holdMs, to]) => {
  const target = document.elementFromPoint(x, y);
  const mk = (cx, cy) => new Touch({ identifier: 7, target, clientX: cx, clientY: cy });
  const fire = (type, cx, cy, down = true) => target.dispatchEvent(new TouchEvent(type, { touches: down ? [mk(cx, cy)] : [], changedTouches: [mk(cx, cy)], bubbles: true, cancelable: true }));
  fire('touchstart', x, y);
  if (to) for (let i = 1; i <= 8; i++) { await new Promise((ok) => setTimeout(ok, 16)); fire('touchmove', x + ((to[0] - x) * i) / 8, y + ((to[1] - y) * i) / 8); }
  await new Promise((ok) => setTimeout(ok, holdMs));
  const [ex, ey] = to || [x, y];
  const ended = !fire('touchend', ex, ey, false);
  // A real lift is followed by a click unless the touchend was cancelled.
  // (a scroll, i.e. a moved finger, doesn't click)
  if (!ended && !to) target.click();
  return target.className;
}, [x, y, holdMs, to]);
const center = async (loc) => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const swipe = (page, x0, y, x1, ms) => page.evaluate(async ([x0, y, x1, ms]) => {
  const target = document.elementFromPoint(x0, y);
  const mk = (cx) => new Touch({ identifier: 9, target, clientX: cx, clientY: y });
  const fire = (type, cx, down = true) => target.dispatchEvent(new TouchEvent(type, { touches: down ? [mk(cx)] : [], changedTouches: [mk(cx)], bubbles: true, cancelable: true }));
  fire('touchstart', x0);
  const steps = 10;
  for (let i = 1; i <= steps; i++) { await new Promise((ok) => setTimeout(ok, ms / steps)); fire('touchmove', x0 + ((x1 - x0) * i) / steps); }
  await new Promise((ok) => setTimeout(ok, 8));
  fire('touchend', x1, false);
}, [x0, y, x1, ms]);
const translateX = (loc) => loc.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).m41);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      await profile(ctx, `nf-${theme}`, theme);
      await ctx.addInitScript(() => {
        window.__mrMotion = true;
        window.__buzz = 0;
        navigator.vibrate = () => { window.__buzz++; return true; };
        // A reply that streams in over about a second, a few words at a time.
        const real = window.fetch;
        window.fetch = async (input, init) => {
          const url = typeof input === 'string' ? input : input.url;
          if (!url.includes('streamGenerateContent')) return real(input, init);
          const words = 'Sure. Water them **in the morning** so the leaves dry before evening, and mulch to keep the soil cool.'.split(' ');
          const body = new ReadableStream({ async start(c) {
            for (let i = 0; i < words.length; i += 3) {
              await new Promise((ok) => setTimeout(ok, 90));
              const text = words.slice(i, i + 3).join(' ') + ' ';
              c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`));
            }
            c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'STOP' }] })}\n\n`));
            c.close();
          } });
          return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
        };
      });
      await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
        const u = r.request().url();
        if (u.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
        return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Title' }] } }] } });
      });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(URL);
      await page.waitForSelector('.composer textarea');
      await seed(page, `nf-${theme}`, chats);
      await page.reload();
      await page.waitForSelector('.composer textarea');
      await page.click('.menu-btn');
      await page.locator('.sidebar.open').waitFor();
      await page.waitForTimeout(500);
      await page.click('text=Garden ideas');
      await page.locator('.msg.assistant').waitFor();
      await page.waitForTimeout(700);
      const buzz = () => page.evaluate(() => window.__buzz);

      // ---- Long press on a reply
      const reply = page.locator('.msg.assistant .markdown');
      let [x, y] = await center(reply);
      await touchAt(page, x, y, { holdMs: 150 });
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.ctx-menu').count(), 0, `${theme}: a short tap doesn't open the menu`);
      await touchAt(page, x, y, { holdMs: 600, to: [x, y + 40] });
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.ctx-menu').count(), 0, `${theme}: moving the finger (scrolling) cancels the long press`);
      const before = await buzz();
      const pressed = page.evaluate(([x, y]) => new Promise((ok) => {
        const target = document.elementFromPoint(x, y);
        const t = new Touch({ identifier: 8, target, clientX: x, clientY: y });
        target.dispatchEvent(new TouchEvent('touchstart', { touches: [t], changedTouches: [t], bubbles: true, cancelable: true }));
        setTimeout(() => ok(document.querySelector('.msg.assistant').classList.contains('pressing')), 250);
      }), [x, y]);
      assert.ok(await pressed, `${theme}: the reply sinks slightly while held`);
      await page.waitForTimeout(400);
      await page.evaluate(([x, y]) => { const target = document.elementFromPoint(x, y); const t = new Touch({ identifier: 8, target, clientX: x, clientY: y }); target.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true })); }, [x, y]);
      const menu = page.getByRole('menu', { name: 'Reply actions' });
      await menu.waitFor();
      assert.ok(await buzz() > before, `${theme}: a long press buzzes`);
      const items = (await menu.getByRole('menuitem').allTextContents()).filter((t) => !/Read aloud|Share/.test(t));
      assert.deepEqual(items, ['Copy', 'Select text', 'Regenerate', 'Save as Word'], `${theme}: reply menu items`);
      await page.waitForTimeout(450);
      const preview = await page.locator('.ctx-preview').boundingBox();
      const menuBox = await menu.boundingBox();
      assert.ok(preview.height > 30 && menuBox.y >= preview.y + preview.height - 1 && menuBox.y + menuBox.height <= 844, `${theme}: the lifted reply with its menu just below, on screen`);
      assert.match(await page.locator('.ctx-preview').innerText(), /peas/, `${theme}: the preview shows the reply`);
      await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/nf-${theme}-reply-menu.png` : undefined });
      await page.keyboard.press('Escape');
      await page.locator('.ctx-layer:not(.exit-ghost)').waitFor({ state: 'detached' });
      assert.equal(await page.locator('.modal, .text-selection-view').count(), 0, `${theme}: closing the menu opens nothing else`);

      // ---- Long press on your message: Edit
      // (The test backend's sync warnings can sit over the top of the screen: close them first.)
      await page.locator('.toast-error [aria-label="Dismiss"]').evaluateAll((bs) => bs.forEach((b) => b.click()));
      await page.waitForTimeout(300);
      [x, y] = await center(page.locator('.msg.user .bubble'));
      await touchAt(page, x, y, { holdMs: 900 });
      await page.getByRole('menu', { name: 'Message actions' }).waitFor();
      await page.waitForTimeout(450); await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/nf-${theme}-msg-menu.png` : undefined });
      await page.waitForTimeout(400);
      await page.getByRole('menuitem', { name: 'Edit' }).click();
      await page.getByLabel('Edit message').waitFor();
      await page.getByRole('button', { name: 'Cancel' }).click();

      // ---- Long press a chat in the drawer: Pin
      await page.click('.menu-btn');
      await page.locator('.sidebar.open').waitFor();
      await page.waitForTimeout(500);
      [x, y] = await center(page.locator('.chat-row', { hasText: 'Budget for March' }));
      await touchAt(page, x, y, { holdMs: 900 });
      await page.getByRole('menu', { name: 'Chat options' }).waitFor();
      await page.waitForTimeout(450); await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/nf-${theme}-chat-menu.png` : undefined });
      assert.equal(await page.locator('.sidebar.open').count(), 1, `${theme}: the drawer stays open under the chat menu`);
      await page.waitForTimeout(400);
      await page.getByRole('menuitem', { name: 'Pin', exact: true }).click();
      await page.locator('.chat-row', { hasText: 'Budget for March' }).locator('.pin-mark').waitFor();
      assert.equal(await page.locator('.ctx-layer:not(.exit-ghost)').count(), 0);

      // ---- Swipe rows in All chats
      await page.waitForTimeout(400);
      await page.click('.view-all-chats');
      const dialog = page.getByRole('dialog', { name: 'All chats' });
      await dialog.waitFor();
      await page.waitForTimeout(500);
      const row = (t) => dialog.locator('li', { hasText: t });
      let box = await row('Trip packing list').boundingBox();
      await swipe(page, box.x + 60, box.y + box.height / 2, box.x + 170, 200);
      await page.waitForTimeout(600);
      assert.match(await row('Trip packing list').innerText(), /Pinned/, `${theme}: swiping right pins`);
      box = await row('Birthday message').boundingBox();
      await swipe(page, box.x + 300, box.y + box.height / 2, box.x + 220, 300);
      await page.waitForTimeout(600);
      const opened = await translateX(row('Birthday message').locator('.swipe-face'));
      assert.ok(Math.abs(opened + 88) < 3, `${theme}: a short left swipe uncovers Delete (${opened.toFixed(0)})`);
      await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/nf-${theme}-swipe.png` : undefined });
      // Touching another row closes it.
      box = await row('Garden ideas').boundingBox();
      await touchAt(page, box.x + 200, box.y + box.height / 2, { holdMs: 30, to: [box.x + 200, box.y + box.height / 2 + 30] });
      await page.waitForTimeout(600);
      assert.ok(Math.abs(await translateX(row('Birthday message').locator('.swipe-face'))) < 1, `${theme}: touching elsewhere closes the open row`);
      box = await row('Birthday message').boundingBox();
      await swipe(page, box.x + 330, box.y + box.height / 2, box.x + 20, 260);
      await row('Birthday message').waitFor({ state: 'detached', timeout: 3000 });
      const undo = page.locator('.toast', { hasText: 'Chat deleted' }).getByRole('button', { name: 'Undo' });
      await undo.click();
      await row('Birthday message').waitFor();
      console.log(`PASS ${theme}: long-press menus (reply, message, chat), swipe to pin / uncover Delete / delete + Undo`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      // ---- Send: the message flies in; streamed words fade in, then are plain text
      if (await page.locator('.sidebar.open').count()) { await page.click('.close-sidebar'); await page.waitForTimeout(500); }
      await page.click('text=Garden ideas').catch(() => {});
      const sendBuzz = await buzz();
      await page.fill('.composer textarea', 'And how often should I water?');
      await page.click('.send-btn');
      const bubble = page.locator('.msg.user .bubble', { hasText: 'how often should I water' });
      await bubble.waitFor();
      const flying = await bubble.evaluate((el) => el.closest('.msg').getAnimations({ subtree: true }).length);
      assert.ok(flying > 0, `${theme}: the sent message flies into place`);
      assert.ok(await buzz() > sendBuzz, `${theme}: sending buzzes`);
      await page.waitForFunction(() => [...document.querySelectorAll('.msg.assistant .markdown')].at(-1)?.textContent.includes('Water'), null, { timeout: 5000 });
      const fresh = await page.locator('.msg.assistant .markdown').last().locator('.fresh').count();
      assert.ok(fresh > 0, `${theme}: new words fade in while the reply streams (${fresh} fading)`);
      await page.locator('.msg.assistant').last().locator('.msg-actions').waitFor();
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.msg.assistant .markdown').last().locator('.fresh').count(), 0, `${theme}: the finished reply is plain text`);
      assert.match(await page.locator('.msg.assistant .markdown').last().innerText(), /Sure\. Water them in the morning so the leaves dry before evening, and mulch to keep the soil cool\./, `${theme}: the reply text is intact`);
      console.log(`PASS ${theme}: send flies in and buzzes, streamed words fade in, finished reply is plain text`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
