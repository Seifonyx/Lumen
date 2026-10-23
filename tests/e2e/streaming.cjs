// Phase 3 slice 3 (Canvas): a reply streaming in, on the synthetic chat-fixture conversation with a local streamed
// reply (helpers/stream-fixture.cjs: no network, no inference). The ordinary build is skipped. Desktop 1440 and iPhone
// 390: the view follows the reply while you are at the bottom; scrolling away holds your place and offers "Writing…";
// that pill brings you back and the view follows again; headings keep their space while streaming (no jump when the
// reply completes); Stop marks the reply "Stopped", turns Stop back into Send/voice and, on computers, returns the
// keyboard to the message box; no long tasks while text arrives. Chromium with an emulated touch phone.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { seedChat } = require('./helpers/chat-fixture.cjs');
const { streamReplies } = require('./helpers/stream-fixture.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      const phone = width < 900;
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await seedChat(ctx, {});
      await streamReplies(ctx, { packets: 150, every: 50 });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        await page.goto(url);
        await page.locator('.composer textarea').waitFor({ timeout: 20000 });
        if (!(await page.locator('[data-lumen-canvas-shell]').count())) { console.log('SKIP streaming: the ordinary build has no Canvas shell'); return; }
        if (phone) { await page.click('.menu-btn'); await page.waitForTimeout(400); }
        const folder = page.locator('.cv-project-row', { hasText: 'Studio launch' });
        if (await folder.getAttribute('aria-expanded') === 'false') await folder.click();
        await page.locator('.chat-row', { hasText: 'Launch plan, three weeks' }).first().locator('.chat-open').click();
        await page.locator('[data-message-id="r8"]').waitFor();
        const gap = () => page.evaluate(() => { const l = document.querySelector('.messages'); return l.scrollHeight - l.scrollTop - l.clientHeight; });
        const top = () => page.evaluate(() => document.querySelector('.messages').scrollTop);
        // At the end of the conversation (the follow lands before the next paint; a sample can fall between a new line
        // and its follow, so this waits for the end rather than reading one instant).
        const atEnd = (why) => page.waitForFunction(() => { const l = document.querySelector('.messages'); return l.scrollHeight - l.scrollTop - l.clientHeight <= 4; }, null, { timeout: 1500 }).catch(() => assert.fail(why));
        const tag = `${width}`;

        await page.fill('.composer textarea', 'Walk me through the launch again, in detail.');
        await page.click('.composer .send-btn');
        await page.locator('.composer .send-btn.stop').waitFor();
        const t0 = await page.evaluate(() => performance.now());
        // Following: the newest words stay in view.
        await page.waitForTimeout(1600);
        await atEnd(`${tag}: follows the reply`);
        // Headings keep their space while the reply is still arriving.
        await page.locator('.message-row:last-child .markdown h2').first().waitFor({ timeout: 5000 });
        const h2 = await page.locator('.message-row:last-child .markdown h2').first().evaluate((el) => parseFloat(getComputedStyle(el).marginTop));
        assert.ok(h2 >= 16, `${tag}: a streamed heading keeps its space above (${h2}px)`);
        // Scrolling away holds your place and offers a way back.
        const box = await page.locator('.messages').boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        for (let i = 0; i < 7; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(16); }
        await page.waitForTimeout(250);
        assert.ok(await gap() >= 400, `${tag}: scrolling up moves away from the end (${await gap()}px)`);
        const held = await top();
        await page.waitForTimeout(1000);
        assert.ok(Math.abs((await top()) - held) <= 1, `${tag}: stays where you scrolled while the reply grows`);
        const pill = page.getByRole('button', { name: 'Reply being written, scroll to it' });
        await pill.waitFor();
        assert.match(await pill.innerText(), /Writing/);
        await pill.click();
        await atEnd(`${tag}: the pill brings you back to the newest words`);
        await page.waitForTimeout(600);
        await atEnd(`${tag}: and the view follows again`);
        // Stop.
        await page.click('.composer .send-btn.stop');
        await page.locator('.message-row:last-child .cv-stopped').waitFor();
        assert.equal(await page.locator('.composer .send-btn.stop').count(), 0, `${tag}: Stop turns back`);
        await page.waitForTimeout(200);
        const focus = await page.evaluate(() => document.activeElement?.id);
        if (!phone) assert.equal(focus, 'message-input', `${tag}: the keyboard returns to the message box`);
        else assert.notEqual(focus, 'message-input', `${tag}: phones keep the keyboard down`);
        const long = await page.evaluate((t) => window.__stream.longTasks.filter(([s, d]) => s > t + 300 && d >= 100), t0);
        assert.deepEqual(long, [], `${tag}: no long tasks while text arrives`);
        assert.deepEqual(errors, []);
        console.log(`PASS streaming ${tag}: follow, hold, Writing… pill, return, headings, Stop, focus`);
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
