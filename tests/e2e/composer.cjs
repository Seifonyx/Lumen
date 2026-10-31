// Phase 3 slice 2 (Canvas): the composer on phones and computers, on the synthetic chat-fixture account. The ordinary
// build is skipped. Phones (320/390/430, plain and the iPhone glass look) keep one row at rest and two while writing,
// Send always on the line; small controls answer a 44 pt touch; the writing sheet keeps its title's width; an Enter
// that confirms an IME candidate (Safari: keyCode 229) never sends, and a plain Enter still does (computers); the
// floating composer never covers the last message. Chromium with an emulated touch phone.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { default: AxeBuilder } = require('@axe-core/playwright');
const { seedChat } = require('./helpers/chat-fixture.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const rect = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width }; });

async function open(browser, width, height, { glass = false, theme = 'light' } = {}) {
  const phone = width < 900;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme });
  await seedChat(ctx, { theme });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + (glass ? '&glass' : ''));
  await page.locator('.composer textarea').waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  return { ctx, page, errors, phone };
}

(async () => {
  const browser = await chromium.launch();
  try {
    // Phones: rows, Send on the line, touch targets, model name, sheet title.
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) for (const glass of [false, true]) {
      const { ctx, page, errors } = await open(browser, width, height, { glass, theme: glass ? 'light' : 'dark' });
      try {
        if (!(await page.locator('[data-lumen-canvas-composer]').count())) { console.log('SKIP composer: the ordinary build has no Canvas composer'); return; }
        const tag = `${width}${glass ? ' glass' : ''}`;
        const box = page.locator('.composer textarea'), form = page.locator('.composer');
        // At rest: one row; "Message Lumen" on one line; the model is announced by name.
        assert.equal(await page.locator('.composer-wrap').getAttribute('data-composer-state'), 'resting');
        const rest = await rect(form);
        assert.ok(rest.height <= 64, `${tag}: one row at rest (${rest.height}px)`);
        const lh = await box.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
        assert.ok((await rect(box)).height <= lh + 24, `${tag}: placeholder on one line`);
        if (glass) {
          // iPhone glass (owner, 2026-10-30): at rest + · message · dictate · talk; the model appears once the box opens.
          assert.equal(await page.locator('.composer .model-button').isVisible(), false, `${tag}: no model at rest`);
          assert.ok(await page.locator('.composer .dictation-btn').isVisible(), `${tag}: dictate at rest`);
        } else {
          assert.equal(await page.getByRole('button', { name: /Gemini Flash/ }).count() >= 1, true, `${tag}: model button named`);
          // The model's name is readable at rest at every width (narrower than 380 px the box says "Message").
          const name = await page.locator('.composer .model-name-text').evaluate((el) => ({ w: el.clientWidth, full: el.scrollWidth <= el.clientWidth + 1 }));
          assert.ok(name.w > 40 && name.full, `${tag}: the model's name is readable at rest`);
        }
        // The model's name never squeezes the empty box below its placeholder (audit 2026-10-31: "Message Lum").
        assert.ok(await box.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), `${tag}: the placeholder fits the message box at rest`);
        assert.equal(await box.getAttribute('placeholder'), width < 380 ? 'Message' : 'Message Lumen');
        const restSend = await rect(page.locator('.composer :is(.send-btn, .voice-start)').first());
        assert.ok(restSend.right <= rest.right && restSend.top >= rest.top, `${tag}: voice/Send inside the capsule`);
        // Writing: the text, then one row of controls with Send on it.
        await box.click(); await box.fill('Can you make it warmer?');
        await page.waitForTimeout(250);
        const send = await rect(page.locator('.composer .send-btn'));
        const add = await rect(page.locator('.composer .composer-bar > .tool-btn').first());
        assert.ok(Math.abs(send.top - add.top) < 6, `${tag}: Send on the same row as + (${send.top} vs ${add.top})`);
        const engaged = await rect(form);
        assert.ok(engaged.height <= 124, `${tag}: two rows while writing (${engaged.height}px)`);
        assert.ok(await page.locator('.composer .model-name-text').evaluate((el) => el.clientWidth > 40 && el.scrollWidth <= el.clientWidth + 1), `${tag}: the model's name is readable while writing`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${tag}: no page overflow`);
        // Small controls answer a 44 pt touch: the edges of a 44×44 square around Expand reach it.
        const ex = await rect(page.locator('.canvas-expand'));
        const hit = await page.evaluate(({ x, y }) => [[-20, 0], [20, 0], [0, -20], [0, 20]].every(([dx, dy]) => document.elementFromPoint(x + dx, y + dy)?.closest('.canvas-expand')), { x: ex.left + ex.width / 2, y: ex.top + ex.height / 2 });
        assert.ok(hit, `${tag}: Expand answers a 44pt touch`);
        // The writing sheet: the count sits under the title, Done on the right.
        await page.locator('.canvas-expand').click();
        await page.locator('.canvas-sheet-head').waitFor();
        const title = await rect(page.locator('#canvas-writing-title')), count = await rect(page.locator('.canvas-sheet-count'));
        assert.ok(count.top >= title.bottom - 2, `${tag}: count beneath the title`);
        assert.ok(title.width >= width * 0.5, `${tag}: the title keeps the width (${title.width}px)`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        assert.equal(await box.inputValue(), 'Can you make it warmer?', `${tag}: the draft is kept`);
        if (width === 390 && !glass) {
          const axe = await new AxeBuilder({ page }).include('.composer-wrap').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          assert.deepEqual(axe.violations.map((v) => v.id), [], `${tag}: axe`);
        }
        assert.deepEqual(errors, []);
        console.log(`PASS composer phone ${tag}`);
      } finally { await ctx.close(); }
    }

    // Computers: Enter confirming an IME candidate never sends; a plain Enter does; the composer never covers the
    // last message, however tall the draft.
    {
      const { ctx, page, errors } = await open(browser, 1440, 900);
      try {
        if (!(await page.locator('[data-lumen-canvas-composer]').count())) return;
        const box = page.locator('.composer textarea');
        // One shape at rest and while writing: focusing the box moves nothing under the pointer.
        const plus = page.locator('.composer .composer-bar > .tool-btn').first();
        await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(250);
        const restPlus = await rect(plus);
        await box.click(); await page.waitForTimeout(250);
        const focusPlus = await rect(plus);
        assert.ok(Math.abs(restPlus.top - focusPlus.top) < 1 && Math.abs(restPlus.left - focusPlus.left) < 1, `+ stays put on focus (${restPlus.top} → ${focusPlus.top})`);
        await box.fill('こんにちは');
        const before = await page.locator('.message-row').count();
        await box.evaluate((el) => {
          const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
          Object.defineProperty(e, 'keyCode', { get: () => 229 });
          el.dispatchEvent(e);
        });
        await page.waitForTimeout(400);
        assert.equal(await page.locator('.message-row').count(), before, 'IME Enter (keyCode 229) does not send');
        assert.equal(await box.inputValue(), 'こんにちは');
        await box.press('Enter');
        await page.getByText('Fixture reply.').waitFor({ timeout: 10000 });
        assert.equal(await box.inputValue(), '', 'a plain Enter sends');
        // A tall draft: the end of the conversation stays above the floating composer.
        await box.fill(Array.from({ length: 9 }, (_, i) => `Line ${i + 1} of a long draft`).join('\n'));
        await page.waitForTimeout(300);
        await page.evaluate(() => { const l = document.querySelector('.messages'); l.scrollTop = l.scrollHeight; });
        await page.waitForTimeout(300);
        const last = await rect(page.locator('.message-row').last()), comp = await rect(page.locator('.composer'));
        assert.ok(last.bottom <= comp.top + 1, `the last message ends above the composer (${last.bottom} vs ${comp.top})`);
        assert.deepEqual(errors, []);
        console.log('PASS composer desktop: IME Enter, Enter sends, composer clear of the last message');
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
