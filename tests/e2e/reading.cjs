// Phase 3 slice 1 (Canvas): reading and message presentation, on the synthetic chat-fixture conversation (long Markdown,
// a table, code, sources, attachments, a failed and a stopped reply). The ordinary build has none of this and is
// skipped. Desktop 1440 and iPhone 390/320, Light and Dark; axe on each. Chromium with an emulated touch phone.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { default: AxeBuilder } = require('@axe-core/playwright');
const { seedChat } = require('./helpers/chat-fixture.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';

async function open(browser, width, height, theme) {
  const phone = width < 900;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme });
  await seedChat(ctx, { theme });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  await page.locator('.composer textarea').waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  return { ctx, page, errors, phone };
}
const box = (page, sel) => page.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, width: r.width }; });

(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, height] of [[1440, 900], [390, 844], [320, 568]]) for (const theme of ['light', 'dark']) {
      const { ctx, page, errors, phone } = await open(browser, width, height, theme);
      try {
        if (!(await page.locator('[data-lumen-canvas-shell]').count())) { console.log('SKIP reading: the ordinary build has no Canvas reading styles'); return; }
        if (phone) { await page.click('.menu-btn'); await page.waitForTimeout(400); }
        const folder = page.locator('.cv-project-row', { hasText: 'Studio launch' });
        if (await folder.getAttribute('aria-expanded') === 'false') await folder.click();
        await page.locator('.chat-row', { hasText: 'Launch plan, three weeks' }).first().locator('.chat-open').click();
        await page.locator('[data-message-id="r2"] table').waitFor();
        await page.waitForTimeout(500);
        const tag = `${width} ${theme}`;

        // A stopped reply says so; finished ones don't.
        assert.equal(await page.locator('[data-message-id="r8"] .cv-stopped').textContent(), 'Stopped', `${tag}: stopped label`);
        assert.equal(await page.locator('[data-message-id="r4"] .cv-stopped').count(), 0);
        // Attachments: the picture as a thumbnail, the file with its type and size.
        assert.equal(await page.locator('[data-message-id="r1"] .msg-thumb').count(), 1);
        assert.equal((await page.locator('[data-message-id="r1"] .cv-file-meta').textContent()).trim(), 'PDF · 90 KB');
        // Headings are sized against the body text (em), quotes carry no box.
        const type = await page.evaluate(() => {
          const md = document.querySelector('[data-message-id="r2"] .markdown');
          const q = md.querySelector('blockquote');
          return { body: parseFloat(getComputedStyle(md).fontSize), h2: parseFloat(getComputedStyle(md.querySelector('h2')).fontSize), quoteBg: getComputedStyle(q).backgroundColor };
        });
        assert.ok(type.h2 / type.body > 1.12 && type.h2 / type.body < 1.3, `${tag}: h2 steps up modestly from the body ${JSON.stringify(type)}`);
        assert.equal(type.quoteBg, 'rgba(0, 0, 0, 0)', `${tag}: quote without a fill`);
        // Wide content scrolls inside its own frame, never the page.
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: no page overflow`);
        assert.equal(await page.locator('[data-message-id="r2"] .code-block pre').last().evaluate((el) => getComputedStyle(el).overflowX), 'auto');
        // The model line under each reply: one row; on computers the name stays visible without hovering, even when Auto picked it.
        const line = await box(page, '[data-message-id="r2"] .msg.assistant > .msg-actions');
        assert.ok(line.height <= (phone ? 48 : 32), `${tag}: one line under a reply (${line.height}px)`);
        if (!phone) assert.equal(await page.locator('[data-message-id="r2"] .route-why-wrap').evaluate((el) => getComputedStyle(el).opacity), '1', `${tag}: model name visible`);
        if (phone) {
          // Your message's folded actions take no room: the answer starts right under the question.
          const q = await box(page, '[data-message-id="r3"] .bubble'), a = await box(page, '[data-message-id="r4"] .markdown');
          assert.ok(a.top - q.bottom <= 30, `${tag}: question → answer gap ${a.top - q.bottom}px`);
          assert.equal((await box(page, '[data-message-id="r3"] .user-actions')).height, 0);
          // Sources: one swipeable line.
          assert.ok((await box(page, '[data-message-id="r2"] .sources')).height <= 36, `${tag}: sources on one line`);
        }
        // Text size (Settings or Dynamic Type) scales headings with the body.
        await page.evaluate(() => document.documentElement.style.setProperty('--fs', '22px'));
        await page.waitForTimeout(150);
        const big = await page.locator('[data-message-id="r2"] h2').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        assert.ok(big > type.h2 + 4, `${tag}: headings follow the text size (${type.h2} → ${big})`);
        await page.evaluate(() => document.documentElement.style.removeProperty('--fs'));
        // Accessibility of the conversation (contrast included) in this theme.
        if (phone && await page.locator('.cv-nav.open').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
        const axe = await new AxeBuilder({ page }).include('.messages').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), [], `${tag}: axe`);
        assert.deepEqual(errors, []);
        console.log(`PASS reading ${tag}`);
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
