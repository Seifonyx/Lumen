// Answer details and Compare with… (Canvas): the model name under every finished reply opens one panel with what
// Lumen recorded (model, how it was chosen, sources, status, privacy, memory) and nothing it didn't; Compare with… opens
// the existing Compare sheet with that reply's own question, leaves the draft and attachments alone, sends nothing until
// you press Compare, and then sends only the conversation up to that question. Synthetic chats only
// (helpers/answer-fixture.cjs); model requests are answered locally. Chromium, or WebKit with MR_WEBKIT=1.
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs');
const AxeBuilder = require('@axe-core/playwright').default;
const { profile, seed } = require('./helpers/preview-profile.cjs');
const fx = require('./helpers/answer-fixture.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/';
const engine = process.env.MR_WEBKIT ? 'webkit' : 'chromium';
const out = `tests/e2e/out/answer-details/${engine}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const DRAFT = 'KEEP_THIS_DRAFT about trams';
const INVENTED = /\bcost\b|\$\d|confidence|verified by|tokens? used/i;

async function open(browser, width, height, theme) {
  const phone = width < 900;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme, ...(phone ? { userAgent: UA } : {}) });
  await profile(ctx, 'answers', theme, { enabledModels: fx.MODELS, defaultModel: fx.FLASH });
  const requests = [];
  await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
    if (r.request().url().includes('/models?')) return r.fulfill({ json: fx.CATALOG });
    requests.push({ url: r.request().url(), body: r.request().postData() || '' });
    return r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Fixture comparison answer.' }] }, finishReason: 'STOP' }] }) + '\n\n' });
  });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = async () => { await page.locator('.app:not(.app-skeleton) .composer textarea').waitFor({ timeout: 20000 }); await page.waitForTimeout(500); };
  await page.goto(url); await ready();
  await seed(page, 'answers', fx.chats);
  await page.reload(); await ready();
  return { ctx, page, errors, requests, phone };
}

(async () => {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  fs.mkdirSync(out, { recursive: true });
  try {
    const sizes = [[390, 844, 'light'], [390, 844, 'dark'], [320, 640, 'light'], [430, 932, 'dark'], [1280, 860, 'light'], [1440, 900, 'dark']];
    for (const [width, height, theme] of sizes) {
      const tag = `${width} ${theme}`;
      const { ctx, page, errors, requests, phone } = await open(browser, width, height, theme);
      try {
        if (!(await page.locator('[data-lumen-canvas-shell]').count())) { console.log('SKIP answer-details: Canvas only (the ordinary build keeps the older model line)'); return; }
        const openChat = async (title) => {
          if (phone && !(await page.locator('aside.cv-nav.open').count())) { await page.locator('.menu-btn:visible').first().click(); await page.waitForTimeout(350); }
          await page.locator('.chat-open', { hasText: title }).click(); await page.waitForTimeout(700);
        };
        const reply = (id) => page.locator(`[data-message-id="${id}"]`);
        const details = page.getByRole('dialog', { name: 'Answer details' });
        const show = async (id) => {
          await reply(id).scrollIntoViewIfNeeded();
          await reply(id).locator('.answer-details-btn').click();
          await details.waitFor(); await page.waitForTimeout(250);
          const text = await details.innerText();
          assert.doesNotMatch(text, INVENTED, `${tag}: ${id} shows only recorded facts`);
          return text;
        };
        const hide = async () => { await page.keyboard.press('Escape'); await details.waitFor({ state: 'detached' }); };
        const fits = async (what) => {
          const r = await details.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: innerWidth, h: innerHeight, bar: document.querySelector('.main > .topbar')?.getBoundingClientRect().bottom || 0, scroll: el.scrollWidth > el.clientWidth + 1 }; });
          assert.ok(r.left >= 0 && r.right <= r.w + 1 && r.bottom <= r.h + 1 && r.top >= (phone ? 0 : r.bar - 1) && !r.scroll, `${tag}: ${what} fits on screen (${JSON.stringify(r)})`);
        };

        await openChat('Weekend in Porto');
        await page.locator('.composer textarea').fill(DRAFT);
        await page.locator('.composer input[type=file]:not([accept="image/*"])').setInputFiles({ name: 'kept-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment.') });
        await page.locator('.composer .attachment:not(.loading)').waitFor();

        // The resting line stays quiet: one model name, no new buttons beside it.
        assert.equal(await reply('r-manual').locator('.msg-actions .answer-details-btn').count(), 1, `${tag}: one details button per reply`);
        assert.equal((await reply('r-manual').locator('.answer-details-btn').innerText()).trim(), 'Gemini 2.5 Pro', `${tag}: a model you picked shows just its name`);
        assert.match(await reply('r-old').locator('.answer-details-btn').getAttribute('aria-label'), /Answer details/, `${tag}: an older reply without a model still opens details`);

        // Auto: recorded reasons, alternatives, sources reachable inside the panel, and the Auto exclusion.
        let text = await show('r-auto');
        // Saved chats keep Auto's short reason; its longer reasons and alternatives exist only in the session that
        // made the reply (src/lib/db.ts doesn't load them; auto-explain covers that live panel). Nothing is filled in.
        assert.match(text, /Gemini Flash[\s\S]*Google AI Studio[\s\S]*Chosen by Auto[\s\S]*quick general question/, `${tag}: Auto's recorded reason`);
        assert.doesNotMatch(text, /Recorded alternatives/, `${tag}: no alternatives are shown when none were loaded`);
        assert.equal(await details.getByRole('link').count(), 2, `${tag}: both web sources are links in the panel`);
        assert.equal(await details.getByRole('link').first().getAttribute('href'), 'https://example.com/porto/transport');
        assert.ok(await details.getByRole('checkbox', { name: /Never use Gemini Flash in Auto/ }).count(), `${tag}: the Auto exclusion is kept`);
        await fits('Auto details');
        if (width === 390 || width === 1280) {
          const axe = await new AxeBuilder({ page }).include(phone ? '.modal' : '.answer-details-pop').analyze();
          assert.deepEqual(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), [], `${tag}: no accessibility violations in the panel`);
        }
        await page.screenshot({ path: `${out}/auto-${width}-${theme}.png` });
        await hide();
        if (!phone) assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-message-id]')?.dataset.messageId), 'r-auto', `${tag}: Escape returns focus to the model name`);

        // A model you picked: nothing invented about why; privacy and memory from what was recorded.
        text = await show('r-manual');
        assert.match(text, /No selection record[\s\S]*No selection reason was saved/, `${tag}: manual reply says no reason was saved`);
        assert.match(text, /2 personal details hidden from the model/, `${tag}: privacy shield note`);
        assert.match(text, /1 memory saved/, `${tag}: memory note`);
        await hide();

        // Layout, a switch while answering, stopped, failed, combined, unknown.
        assert.match(await show('r-layout'), /Via Max writing[\s\S]*long writing/, `${tag}: layout and its recorded reason`); await hide();
        text = await show('r-switch');
        assert.match(text, /Switched while answering[\s\S]*Gemini 2\.5 Pro hit its usage limit/, `${tag}: recorded fallback`);
        assert.match(text, /Porto guide\.pdf[\s\S]*PDF page 3/, `${tag}: document source listed`);
        await hide();
        assert.match(await show('r-stop'), /Stopped before it finished/, `${tag}: stopped reply`); await hide();
        assert.match(await show('r-error'), /Didn’t finish/, `${tag}: failed reply`); await hide();
        assert.match(await show('r-combined'), /Combined in Compare/, `${tag}: combined answer`); await hide();
        assert.match(await show('r-old'), /Model not recorded[\s\S]*No selection record/, `${tag}: unknown metadata stays unknown`); await hide();

        // Compare refuses honestly when the question can't be repeated as asked.
        await show('r-missing');
        assert.ok(await details.getByRole('button', { name: 'Compare with…' }).isDisabled(), `${tag}: no comparison without the original file`);
        assert.match(await details.innerText(), /ticket\.pdf isn’t on this device/, `${tag}: says which file is missing`);
        await hide();

        // Repeated opens: one panel at a time, nothing left behind.
        for (let i = 0; i < 4; i++) { await reply('r-auto').locator('.answer-details-btn').click(); await details.waitFor(); await hide(); }
        assert.equal(await page.locator('.answer-details-pop, .modal:has(.ad-body)').count(), 0, `${tag}: repeated opens leave nothing open`);

        if (width === 390 || width === 1280) {
          // Compare with…: the reply's question, prefilled; nothing sent by opening it; the draft and file stay.
          const before = requests.length;
          await show('r-manual');
          await details.getByRole('button', { name: 'Compare with…' }).click();
          const sheet = page.locator('.modal:has(.compare-picker)');
          await sheet.waitFor();
          assert.equal(await sheet.locator('.compare-prompt').inputValue(), 'Same plan, cheaper please', `${tag}: the reply's own question is prefilled`);
          assert.match(await sheet.innerText(), /Fresh answers to this reply’s question[\s\S]*Each selected model gets one request/, `${tag}: says it makes new requests`);
          assert.equal(await sheet.locator('.compare-model-row.selected', { hasText: 'Gemini 2.5 Pro' }).count(), 1, `${tag}: starts from the model that answered`);
          await sheet.locator('.compare-prompt').fill('Same plan, cheaper please, edited');
          await page.waitForTimeout(300);
          assert.equal(requests.length, before, `${tag}: opening Compare sends nothing`);
          await page.screenshot({ path: `${out}/compare-${width}-${theme}.png` });
          await sheet.getByRole('button', { name: 'Cancel' }).click();
          await sheet.waitFor({ state: 'detached' });
          assert.equal(await page.locator('.composer textarea').inputValue(), DRAFT, `${tag}: the draft is untouched`);
          assert.equal(await page.locator('.composer .attachment').count(), 1, `${tag}: the attachment is untouched`);
          if (!phone) assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('answer-details-btn')), true, `${tag}: focus returns to the model name`);

          // From the ⋯ menu, then Compare: two requests, with the conversation up to that question only.
          await reply('r-manual').scrollIntoViewIfNeeded();
          await reply('r-manual').getByRole('button', { name: 'More actions' }).click();
          await page.getByRole('menuitem', { name: 'Compare with…' }).click();
          await sheet.waitFor();
          await sheet.getByRole('button', { name: 'Compare', exact: true }).click();
          await page.getByRole('dialog', { name: 'Model comparison' }).waitFor();
          await page.waitForFunction((n) => document.querySelectorAll('.comparison-card .comparison-save').length >= 2 || n, false, { timeout: 15000 }).catch(() => {});
          const sent = requests.slice(before);
          assert.equal(sent.length, 2, `${tag}: one request per chosen model`);
          for (const r of sent) {
            assert.match(r.body, /Same plan, cheaper please/, `${tag}: the question is sent`);
            assert.match(r.body, /Plan a weekend in Porto/, `${tag}: earlier conversation is sent`);
            assert.doesNotMatch(r.body, /Skip the cable car|Write it up as a short guide|KEEP_THIS_DRAFT|Synthetic attachment/, `${tag}: not the original answer, later turns, the draft or the composer file`);
          }
          await page.getByRole('dialog', { name: 'Model comparison' }).getByRole('button', { name: 'Close', exact: true }).last().click();
          await page.waitForTimeout(400);
          assert.equal(await page.locator('.composer textarea').inputValue(), DRAFT, `${tag}: the draft survives a comparison`);
          assert.equal(await page.locator('.composer .attachment').count(), 1, `${tag}: the attachment survives a comparison`);
          assert.equal((await reply('r-manual').locator('.markdown').innerText()).trim(), 'Skip the cable car and walk the riverside instead.', `${tag}: the original reply is unchanged`);

          // A coding chat: an app-added message sits between question and reply, so no guess is made.
          await openChat('Fix the build');
          await show('c-r2');
          assert.match(await details.innerText(), /can’t tell which question this reply answers/, `${tag}: ambiguous turn refused`);
          await hide();
        }

        if (!phone) {
          // Keyboard: Enter opens with focus inside, Tab reaches the panel's controls, Escape returns.
          await openChat('Weekend in Porto');
          await reply('r-layout').locator('.answer-details-btn').focus();
          await page.keyboard.press('Enter');
          await details.waitFor();
          assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Answer details', `${tag}: focus moves into the panel`);
          await page.keyboard.press('Tab');
          assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest('.answer-details-pop'))), `${tag}: Tab stays with the panel's controls`);
          await hide();
          assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-message-id]')?.dataset.messageId), 'r-layout', `${tag}: focus back on the model name`);
        }
        assert.deepEqual(errors, [], `${tag}: no page errors`);
        console.log(`PASS ${engine} ${tag}: Answer details and Compare with…`);
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
