// Conversation search (Canvas): the drawer and Jump to find the same chats; a chat found through a message shows an
// excerpt with the match set off and opens at that message, including deep in a long (virtualized) chat, below the
// iPhone glass bar, with focus on the message. Title matches, archived chats, project grouping, drafts and other
// accounts behave as before. Synthetic chats only (helpers/search-fixture.cjs). Chromium, or WebKit with MR_WEBKIT=1.
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs');
const AxeBuilder = require('@axe-core/playwright').default;
const { profile, seed } = require('./helpers/preview-profile.cjs');
const fx = require('./helpers/search-fixture.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/';
const engine = process.env.MR_WEBKIT ? 'webkit' : 'chromium';
const out = `tests/e2e/out/search-results/${engine}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const DRAFT = 'PRESERVED_DRAFT for later';

async function open(browser, width, height, theme) {
  const phone = width < 900;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: 'reduce', colorScheme: theme, ...(phone ? { userAgent: UA } : {}) });
  await profile(ctx, 'search', theme, { projects: fx.projects });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const ready = async () => { await page.locator('.app:not(.app-skeleton) .composer textarea').waitFor({ timeout: 20000 }); await page.waitForTimeout(500); };
  await page.goto(url); await ready();
  await seed(page, 'search', fx.chats);
  // Another account on this device, with a chat that would match: never found here.
  await seed(page, 'search-other', [{ id: 'other-1', title: 'Other account tram plan', createdAt: Date.now(), updatedAt: Date.now(), messages: [{ id: 'o1', role: 'user', text: 'tram tram tram', createdAt: Date.now() }] }]);
  await page.evaluate((id) => localStorage.setItem(`mr.draft.preview-search.${id}`, 'Bring a rain jacket'), fx.DRAFT_CHAT);
  await page.goto(url); await ready();
  return { ctx, page, errors, phone };
}

(async () => {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  fs.mkdirSync(out, { recursive: true });
  try {
    // ── iPhone (glass), 390 px, Light and Dark ─────────────────────────────────────────────────────────────────────
    for (const theme of ['light', 'dark']) {
      const { ctx, page, errors } = await open(browser, 390, 844, theme);
      try {
        if (!(await page.locator('[data-lumen-canvas-shell]').count())) { console.log('SKIP search-results: Canvas only (the ordinary build has the older drawer)'); return; }
        const drawer = page.locator('aside.cv-nav');
        const openDrawer = async () => { if (!(await drawer.evaluate((el) => el.classList.contains('open')))) { await page.locator('.menu-btn:visible').first().click(); await page.waitForTimeout(350); } };
        const search = async (q) => { await openDrawer(); await page.fill('#chat-search', q); await page.waitForTimeout(250); };
        const row = (title) => drawer.locator('.chat-open', { hasText: title });
        const topbarBottom = () => page.evaluate(() => document.querySelector('.main > .topbar').getBoundingClientRect().bottom);
        const landed = async (id) => {
          await page.locator(`[data-message-id="${id}"].message-jump-target`).waitFor({ timeout: 10000 });
          await page.waitForTimeout(300);
          const r = await page.locator(`[data-message-id="${id}"]`).evaluate((e) => { const r = e.getBoundingClientRect(), p = document.querySelector('.messages').getBoundingClientRect(); return { top: r.top, bottom: p.bottom }; });
          assert.ok(r.top >= (await topbarBottom()) - 1 && r.top < r.bottom - 40, `${theme}: ${id} lands below the glass bar, on screen (${JSON.stringify(r)})`);
          assert.equal(await page.evaluate(() => document.activeElement?.dataset.messageId), id, `${theme}: focus moves to the matching message`);
        };

        // A draft in the chat you're in survives a trip through search.
        await openDrawer(); await row('Birthday gift ideas').click(); await page.waitForTimeout(400);
        await page.locator('.composer textarea').fill(DRAFT);

        // Results: the same chats as before (title or any message, archived included, other accounts never).
        await search('tram');
        assert.equal(await drawer.locator('p.sr-only[role="status"]').textContent(), '5 conversations found', `${theme}: the count is announced`);
        assert.deepEqual((await drawer.locator('.cv-tree .chat-title').allTextContents()).sort(), ['Café notes', 'Lisbon getting around', 'Old Sintra plan', 'Porto week', 'Tram tickets'], `${theme}: matching chats only`);
        // Project chats stay in their folder; the label names the project.
        assert.equal(await drawer.locator('.cv-project', { hasText: 'Trip to Portugal' }).locator('.chat-open').count(), 2, `${theme}: project chats stay grouped`);
        const porto = row('Porto week');
        assert.equal(await porto.locator('mark.search-match').textContent(), 'tram', `${theme}: the matched word is set off`);
        assert.match(await porto.locator('.cv-chat-detail').textContent(), /take tram 1 along the Douro/, `${theme}: a readable excerpt, Markdown stripped`);
        assert.match(await porto.getAttribute('aria-label'), /^Porto week, in Trip to Portugal, one matching message: .*take tram 1/, `${theme}: VoiceOver hears title, project and excerpt`);
        assert.match(await row('Lisbon getting around').getAttribute('aria-label'), /3 matching messages: Evening trams/, `${theme}: several matches: counted, newest shown`);
        assert.equal(await row('Tram tickets').locator('mark').count(), 0, `${theme}: a title match keeps its time line`);
        assert.equal(await drawer.locator('.cv-archived .chat-open', { hasText: 'Old Sintra plan' }).locator('mark').count(), 1, `${theme}: archived matches stay under Archived, with their excerpt`);
        const mark = await porto.locator('mark.search-match').evaluate((m) => { const s = getComputedStyle(m); return { bg: s.backgroundColor, weight: Number(s.fontWeight) }; });
        assert.ok(mark.weight >= 600 && /rgba\(0, 0, 0, 0\)|transparent/.test(mark.bg), `${theme}: no highlighter on the match (${JSON.stringify(mark)})`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${theme}: nothing scrolls sideways`);
        if (theme === 'light') {
          const axe = await new AxeBuilder({ page }).include('aside.cv-nav').withTags(['wcag2a', 'wcag2aa']).analyze();
          assert.deepEqual(axe.violations.map((v) => v.id), [], `${theme}: axe on the results`);
        }
        await page.screenshot({ path: `${out}/390-${theme}-results.png` });

        // A match deep in a 400-message chat: opens there, not at the bottom.
        await porto.click();
        await landed(fx.LONG_HIT);
        if (await page.evaluate(() => Boolean(CSS.highlights))) assert.ok(await page.evaluate(() => CSS.highlights.has('lumen-search')), `${theme}: the words are marked for a moment`);
        assert.equal(await page.locator('.thread + .sr-only, .sr-only[role="status"]').filter({ hasText: 'Showing the matching reply.' }).count(), 1, `${theme}: the landing is announced`);
        await page.screenshot({ path: `${out}/390-${theme}-opened.png` });

        // The same result again, from the bottom of the open chat: lands again.
        await page.evaluate(() => { const m = document.querySelector('.messages'); m.scrollTop = m.scrollHeight; });
        await page.waitForTimeout(300);
        await search('douro'); await row('Porto week').click();
        await landed(fx.LONG_HIT);

        // Rapid changes: two results in one go; only the last one opens, at its own message.
        await search('tram');
        await drawer.evaluate((d) => { const b = [...d.querySelectorAll('.chat-open')]; b.find((x) => x.textContent.includes('Porto week')).click(); b.find((x) => x.textContent.includes('Lisbon getting around')).click(); });
        await landed('m-6');
        assert.equal(await page.locator('[data-message-id="long-37"]').count(), 0, `${theme}: the earlier result left nothing behind`);

        // Unicode and punctuation.
        await search('straßenbahn'); await row('Café notes').click();
        await landed('u-2');

        // A title match opens as before (no jump).
        await search('tickets'); await row('Tram tickets').click(); await page.waitForTimeout(800);
        assert.equal(await page.locator('.message-jump-target').count(), 0, `${theme}: a title match opens normally`);

        // The draft is still there; the draft-only chat is listed as before but its draft isn't searched.
        await search('rain jacket');
        assert.equal(await drawer.locator('.cv-tree .chat-open').count(), 0, `${theme}: drafts are not searched`);
        await page.fill('#chat-search', ''); await row('Birthday gift ideas').click(); await page.waitForTimeout(400);
        assert.equal(await page.locator('.composer textarea').inputValue(), DRAFT, `${theme}: the draft is kept`);
        assert.deepEqual(errors, []);
        console.log(`PASS search-results ${engine} 390 ${theme}`);
      } finally { await ctx.close(); }
    }

    // ── Computer: keyboard through the drawer and Jump to ─────────────────────────────────────────────────────────
    for (const [width, height, theme] of [[1280, 800, 'light'], [1440, 900, 'dark']]) {
      const { ctx, page, errors } = await open(browser, width, height, theme);
      try {
        const drawer = page.locator('aside.cv-nav');
        await page.locator('#chat-search').focus();
        await page.keyboard.type('douro');
        await page.waitForTimeout(250);
        // Down goes into the tree (the project folder first, as before), then on to the result.
        const focused = () => page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.textContent);
        for (let i = 0; i < 4 && !/^Porto week/.test(await focused()); i++) await page.keyboard.press('ArrowDown');
        assert.match(await focused(), /^Porto week, in Trip to Portugal, one matching message: .*Douro/, `${width}: the arrow keys reach the result`);
        await page.keyboard.press('Enter');
        await page.locator(`[data-message-id="${fx.LONG_HIT}"].message-jump-target`).waitFor();
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.activeElement?.dataset.messageId), fx.LONG_HIT, `${width}: keyboard focus lands on the message`);
        const seen = await page.evaluate((id) => { const r = document.querySelector(`[data-message-id="${id}"]`).getBoundingClientRect(), bar = document.querySelector('.main > .topbar').getBoundingClientRect(); return { top: r.top, bar: bar.bottom }; }, fx.LONG_HIT);
        assert.ok(seen.top >= seen.bar - 1, `${width}: the message starts below the top bar (${JSON.stringify(seen)})`);
        assert.equal(await page.locator(`[data-message-id="${fx.LONG_HIT}"]`).getAttribute('data-jump-keyboard'), 'true', `${width}: and shows its focus ring`);
        await page.screenshot({ path: `${out}/${width}-${theme}-opened.png` });

        // Jump to finds the same chats as the drawer for the same query.
        await page.locator('#chat-search').fill('tram'); await page.waitForTimeout(250);
        const drawerChats = (await drawer.locator('.cv-tree .chat-title').allTextContents()).sort();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
        const box = page.getByRole('combobox', { name: 'Search commands' });
        await box.fill('tram'); await page.waitForTimeout(250);
        const options = page.locator('.command-results [role="option"]');
        const chatsInJump = (await options.evaluateAll((els) => els.filter((e) => e.querySelector('.lucide-message-square, svg')).map((e) => e.querySelector('span').textContent))).filter((t) => drawerChats.includes(t)).sort();
        assert.deepEqual(chatsInJump, drawerChats, `${width}: Jump to and the drawer agree`);
        const lisbon = options.filter({ hasText: 'Lisbon getting around' });
        assert.match(await lisbon.getAttribute('aria-label'), /in Trip to Portugal, 3 matching messages: Evening trams/, `${width}: Jump to names the project and the excerpt`);
        assert.equal(await lisbon.locator('mark.search-match').textContent(), 'tram');
        await page.screenshot({ path: `${out}/${width}-${theme}-jumpto.png` });
        const index = Number(await lisbon.getAttribute('data-index'));
        for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
        await page.locator('[data-message-id="m-6"].message-jump-target').waitFor();
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => document.activeElement?.dataset.messageId), 'm-6', `${width}: Jump to opens at the message`);
        assert.deepEqual(errors, []);
        console.log(`PASS search-results ${engine} ${width} ${theme}`);
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
