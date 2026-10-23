// 1.4, the rest of the "feels like an app" layer:
//  photo viewer: a picture grows out of the one you tapped, double-tap and pinch zoom, swipe down puts it
//                back; on computers a click zooms and Esc closes;
//  chats remember where you were when you come back to them (this session);
//  start-up: someone who has signed in before sees the app's frame (placeholders) before any code has run,
//            never a blank page, and it's replaced by the real app in the same layout;
//  menus grow out of the button that opened them.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
// A 320×200 picture: blue with a yellow square and a red circle.
const img = fs.readFileSync(path.join(__dirname, 'helpers', 'picture.b64'), 'utf8').trim();
const long = Array.from({ length: 16 }, (_, i) => [
  { id: `lu${i}`, role: 'user', text: `Question ${i}`, createdAt: now - 9e6 + i * 1000 },
  { id: `la${i}`, role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', createdAt: now - 9e6 + i * 1000 + 500, text: `Answer ${i}.\n\n${'A longer paragraph that takes up some room on the screen. '.repeat(4)}` },
]).flat();
const chats = [
  { id: 'pic', title: 'Holiday photo', createdAt: now - 4e5, updatedAt: now - 4e5, messages: [
    { id: 'p1', role: 'user', text: 'What is in this picture?', createdAt: now - 4e5, files: [{ id: 'f1', kind: 'image', name: 'holiday.png', mime: 'image/png', size: 1500, data: img, thumb: `data:image/png;base64,${img}` }] },
    { id: 'p2', role: 'assistant', status: 'done', model: 'gemini:gemini-flash-latest', text: 'A yellow square and a red circle on blue.', createdAt: now - 3e5 },
  ] },
  { id: 'long', title: 'Long reading', createdAt: now - 9e6, updatedAt: now - 2e5, messages: long },
];
const touches = (page, type, points) => page.evaluate(([type, points]) => {
  const target = document.querySelector('.image-viewer');
  const list = points.map(([x, y], i) => new Touch({ identifier: i + 1, target, clientX: x, clientY: y }));
  target.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : list, changedTouches: list, bubbles: true, cancelable: true }));
}, [type, points]);
const scale = (page) => page.locator('.iv-img').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).a);

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, theme] of [[390, 'light'], [1280, 'dark']]) {
      const phone = width < 900;
      const tag = `${width} ${theme}`;
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block' });
      await profile(ctx, `af-${width}`, theme);
      await ctx.addInitScript(() => { window.__mrMotion = true; });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(URL);
      await page.waitForSelector('.composer textarea');
      await seed(page, `af-${width}`, chats);

      // ---- Start-up: the frame is there before the app's code runs.
      const first = await ctx.newPage();
      await first.route('**/src/main.tsx*', (r) => r.abort());
      await first.route('**/assets/index-*.js', (r) => r.abort());
      await first.goto(URL);
      assert.equal(await first.locator('.app-skeleton').count(), 1, `${tag}: a returning visitor sees the app's frame before any code runs`);
      const frame = await first.locator('.app-skeleton .composer').boundingBox();
      await first.close();
      await page.reload();
      await page.waitForSelector('.composer textarea');
      const real = await page.locator('.composer').boundingBox();
      assert.equal(await page.locator('.app-skeleton').count(), 0);
      assert.ok(Math.abs(frame.y + frame.height - (real.y + real.height)) < 4 && Math.abs(frame.x - real.x) < 4, `${tag}: the frame's message box is where the real one appears (${JSON.stringify([frame, real])})`);

      // ---- Menus grow from their button
      if (!phone) {
        await page.click('.composer .model-button');
        const anim = await page.locator('.models-pop').evaluate((el) => el.getAnimations().map((a) => a.animationName));
        assert.ok(anim.includes('grow-in'), `${tag}: the model menu grows out of its button (${anim})`);
        await page.keyboard.press('Escape');
      }

      // ---- Photo viewer
      if (phone) { await page.click('.menu-btn'); await page.locator('.sidebar.open').waitFor(); await page.waitForTimeout(500); }
      await page.click('text=Holiday photo');
      await page.waitForTimeout(600);
      const thumb = await page.locator('.msg.user .thumb-btn img').boundingBox();
      await page.click('.msg.user .thumb-btn');
      await page.locator('.image-viewer').waitFor();
      // The first frame: cropped to the thumbnail, in its place.
      // Hold the opening at its first frame to measure it.
      await page.evaluate(() => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 0; }));
      const start = await page.locator('.iv-img').evaluate((el) => { const r = el.getBoundingClientRect(), m = /inset\(([\d.]+)% ([\d.]+)%/.exec(getComputedStyle(el).clipPath) || [0, 0, 0]; return { x: r.x + r.width * m[2] / 100, w: r.width * (1 - 2 * m[2] / 100), h: r.height * (1 - 2 * m[1] / 100) }; });
      assert.ok(Math.abs(start.w - thumb.width) < 40 && Math.abs(start.h - thumb.height) < 40, `${tag}: the picture starts from the one you tapped (${start.w.toFixed(0)}×${start.h.toFixed(0)} vs ${thumb.width.toFixed(0)}×${thumb.height.toFixed(0)})`);
      await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      await page.waitForTimeout(900);
      const open = await page.locator('.iv-img').boundingBox();
      assert.ok(open.width > width * 0.8 || open.height > 600, `${tag}: then fills the screen (${open.width.toFixed(0)}×${open.height.toFixed(0)})`);
      await page.screenshot({ path: process.env.SHOTS ? `${process.env.SHOTS}/af-${width}-viewer.png` : undefined });
      const cx = open.x + open.width / 2, cy = open.y + open.height / 2;
      if (phone) {
        // Double tap zooms in on that spot, again zooms out.
        for (let i = 0; i < 2; i++) { await touches(page, 'touchstart', [[cx, cy]]); await touches(page, 'touchend', [[cx, cy]]); await page.waitForTimeout(60); }
        await page.waitForTimeout(900);
        assert.ok(await scale(page) > 2, `${tag}: double tap zooms in`);
        for (let i = 0; i < 2; i++) { await touches(page, 'touchstart', [[cx, cy]]); await touches(page, 'touchend', [[cx, cy]]); await page.waitForTimeout(60); }
        await page.waitForTimeout(900);
        assert.ok(Math.abs(await scale(page) - 1) < 0.02, `${tag}: double tap again zooms out`);
        // Pinch out.
        await touches(page, 'touchstart', [[cx - 40, cy], [cx + 40, cy]]);
        for (let i = 1; i <= 8; i++) { await touches(page, 'touchmove', [[cx - 40 - i * 12, cy], [cx + 40 + i * 12, cy]]); await page.waitForTimeout(16); }
        const pinched = await scale(page);
        await touches(page, 'touchend', [[cx - 136, cy], [cx + 136, cy]]);
        assert.ok(pinched > 2, `${tag}: pinching zooms with the fingers (${pinched.toFixed(2)}×)`);
        await page.waitForTimeout(700);
        for (let i = 0; i < 2; i++) { await touches(page, 'touchstart', [[cx, cy]]); await touches(page, 'touchend', [[cx, cy]]); await page.waitForTimeout(60); }
        await page.waitForTimeout(900);
        // A short drag down springs back, a longer one puts it away.
        await touches(page, 'touchstart', [[cx, cy]]);
        for (let i = 1; i <= 6; i++) { await touches(page, 'touchmove', [[cx, cy + i * 10]]); await page.waitForTimeout(30); }
        const following = await page.locator('.iv-backdrop').evaluate((el) => Number(el.style.opacity));
        await touches(page, 'touchend', [[cx, cy + 60]]);
        assert.ok(following < 1 && following > 0.6, `${tag}: the background fades as you drag (${following.toFixed(2)})`);
        await page.waitForTimeout(900);
        assert.equal(await page.locator('.image-viewer').count(), 1, `${tag}: a short drag springs back`);
        await touches(page, 'touchstart', [[cx, cy]]);
        for (let i = 1; i <= 8; i++) { await touches(page, 'touchmove', [[cx, cy + i * 30]]); await page.waitForTimeout(16); }
        await touches(page, 'touchend', [[cx, cy + 240]]);
      } else {
        await page.mouse.click(cx, cy);
        await page.waitForTimeout(900);
        assert.ok(await scale(page) > 1.5, `${tag}: clicking the picture zooms in`);
        await page.keyboard.press('Escape');
      }
      await page.locator('.image-viewer').waitFor({ state: 'detached', timeout: 3000 });
      console.log(`PASS ${tag}: start-up frame, viewer grows from the picture, zoom (double tap / pinch / click), swipe or Esc to close`);

      // ---- Chats remember where you were
      const open2 = async (title) => {
        if (phone) { await page.click('.menu-btn'); await page.locator('.sidebar.open').waitFor(); await page.waitForTimeout(500); }
        await page.click(`.chat-row:has-text("${title}") .chat-open`);
        await page.waitForTimeout(800);
      };
      await open2('Long reading');
      await page.locator('.messages').evaluate((el) => { el.scrollTop = el.scrollHeight - el.clientHeight - 1500; el.dispatchEvent(new Event('scroll')); });
      // The spot is saved 150 ms after scrolling stops; give a busy machine room for that.
      await page.waitForTimeout(500);
      const was = await page.locator('.messages').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
      await open2('Holiday photo');
      await open2('Long reading');
      const back = await page.locator('.messages').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
      assert.ok(Math.abs(back - was) < 30, `${tag}: back in the same place (${was.toFixed(0)} → ${back.toFixed(0)} px from the end)`);
      console.log(`PASS ${tag}: chats remember where you were`);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
