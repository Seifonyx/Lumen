// The iPhone Home Screen app's status bar (src/lib/status-bar.ts). iOS 26 colours that bar from the page (a full-width
// fixed layer at the top, otherwise the page background) and only takes the colour again when such a layer appears or
// disappears; Lumen shows a thin strip in the colour already at the top, once its own first frame is on screen and when
// the theme changes, so the bar matches the page (the owner's launch band disappeared only when the drawer's scrim came
// and went). Checked here: once per launch, after the start-up frame, in the page's own colour in Light and Dark and on
// a restored Router screen (whose grey the page background takes, and gives back on the chat), again on a theme change, thin, fixed, untouchable, hidden from VoiceOver, gone within a
// second, nothing on the page moving; never in a Safari tab or the ordinary build. iOS's own sampling of the strip is
// a physical-iPhone check. A Home Screen app is emulated with navigator.standalone. Synthetic profile; every request
// off the preview origin is blocked.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { profile } = require('./helpers/preview-profile.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5190';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

const record = () => {
  window.__strips = [];
  const t0 = performance.now();
  new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) if (n.classList?.contains('status-bar-sample')) {
        const s = getComputedStyle(n), composer = document.querySelector('.composer')?.getBoundingClientRect().top;
        window.__strips.push({ at: Math.round(performance.now() - t0), color: s.backgroundColor, height: s.height, pointer: s.pointerEvents, position: s.position, top: s.top, aria: n.getAttribute('aria-hidden'), startup: Boolean(document.querySelector('.app-skeleton')), composer });
      }
      for (const n of m.removedNodes) if (n.classList?.contains('status-bar-sample')) window.__strips.push({ removed: Math.round(performance.now() - t0) });
    }
  }).observe(document, { childList: true, subtree: true });
};
// What is on screen at the top centre (the strip excluded): the first opaque background there.
const topColor = () => {
  for (const el of document.elementsFromPoint(innerWidth / 2, 4)) {
    if (el.classList.contains('status-bar-sample')) continue;
    const c = getComputedStyle(el).backgroundColor, a = c.includes('/') ? Number(c.split('/').pop().replace(/[^\d.]/g, '')) : ((c.match(/[\d.]+/g) || [])[3] ?? 1);
    if (c !== 'transparent' && Number(a) >= 0.99) return c;
  }
  return getComputedStyle(document.body).backgroundColor;
};

(async () => {
  const engine = process.env.MR_WEBKIT ? webkit : chromium, browser = await engine.launch();
  const name = process.env.MR_WEBKIT ? 'webkit' : 'chromium';
  try {
    const launch = async ({ scheme, standalone = true, resume }) => {
      const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: !process.env.MR_WEBKIT, userAgent: UA, colorScheme: scheme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      await ctx.route('**/*', (r) => new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort());
      await profile(ctx, `preview-status-bar-${scheme}`, 'system');
      if (standalone) await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true, configurable: true }));
      if (resume) await ctx.addInitScript((r) => { localStorage.setItem('mr.signedIn', '1'); localStorage.setItem(`mr.resume.${r.uid}`, JSON.stringify(r.snapshot)); }, resume);
      await ctx.addInitScript(record);
      const page = await ctx.newPage(); page.setDefaultTimeout(15000);
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base);
      await page.locator('.app:not(.app-skeleton) .composer textarea').waitFor({ state: 'attached' });
      await page.waitForTimeout(1500);
      return { ctx, page, errors };
    };
    const strips = (p) => p.evaluate(() => window.__strips);
    const canvas = async (p) => (await p.locator('[data-lumen-canvas-shell]').count()) > 0;

    for (const scheme of ['light', 'dark']) {
      const { ctx, page, errors } = await launch({ scheme });
      const list = await strips(page), shown = list.filter((s) => !s.removed);
      if (!await canvas(page)) {
        assert.equal(list.length, 0, 'ordinary build: no strip');
        console.log(`PASS status bar ${name}: ordinary build leaves the status bar alone`);
        await ctx.close(); return;
      }
      assert.equal(shown.length, 1, `${scheme}: the strip shows once per launch (${JSON.stringify(list)})`);
      const [s] = shown, removed = list.find((x) => x.removed);
      assert.equal(s.startup, false, `${scheme}: after Lumen's own first frame, not the start-up frame`);
      assert.equal(s.color, await page.evaluate(topColor), `${scheme}: in the colour already at the top (${s.color})`);
      assert.equal(s.color, scheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(22, 22, 24)', `${scheme}: the page's own colour`);
      assert.ok(removed && removed.removed - s.at >= 400 && removed.removed - s.at <= 1000, `${scheme}: gone within a second (${removed && removed.removed - s.at} ms)`);
      assert.deepEqual([s.position, s.top, s.height, s.pointer, s.aria], ['fixed', '0px', '6px', 'none', 'true'], `${scheme}: thin, fixed at the top, untouchable, hidden from VoiceOver`);
      assert.equal(s.composer, await page.evaluate(() => document.querySelector('.composer')?.getBoundingClientRect().top), `${scheme}: nothing on the page moves`);
      assert.ok(await page.locator('.topbar .menu-btn').evaluate((el) => el.getBoundingClientRect().top >= 6), `${scheme}: the strip stays above the bar's buttons`);

      // The theme changes on the iPhone while Lumen is open: the bar takes the new colour.
      await page.emulateMedia({ colorScheme: scheme === 'light' ? 'dark' : 'light' });
      await page.waitForTimeout(1200);
      const again = (await strips(page)).filter((x) => !x.removed);
      assert.equal(again.length, 2, `${scheme} → other: shown again on a theme change`);
      assert.equal(again[1].color, scheme === 'light' ? 'rgb(22, 22, 24)' : 'rgb(255, 255, 255)', 'in the new theme\'s colour');
      assert.deepEqual(errors, [], 'no page errors');
      await ctx.close();
    }

    // Restored to a place (#132): the colour of that screen's top.
    const uid = 'preview-status-bar-light';
    const restored = await launch({ scheme: 'light', resume: { uid, snapshot: { v: 1, chat: null, workspace: null, place: { kind: 'router', section: 'models' }, anchor: null } } });
    await restored.page.locator('.rc-page:not([hidden])').waitFor();
    const r = (await strips(restored.page)).filter((x) => !x.removed);
    assert.ok(r.length >= 1, 'restored Router: the strip shows');
    assert.equal(r.at(-1).color, await restored.page.evaluate(topColor), `restored Router: in the colour at its top (${r.at(-1).color})`);
    assert.equal(r.at(-1).color, 'rgb(242, 242, 247)', "Router's grouped grey");
    assert.equal(await restored.page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(242, 242, 247)', "the page background is that screen's, so the bar keeps it once the strip goes");
    // Back to the chat: the white page again, and iOS is told.
    await restored.page.locator('.phone-navigation:visible > button[aria-label="Open navigation"]').click();
    await restored.page.locator('aside.cv-nav.open').waitFor();
    await restored.page.locator('aside.cv-nav').getByRole('button', { name: 'New chat', exact: true }).click();
    await restored.page.waitForTimeout(1500);
    const back = (await strips(restored.page)).filter((x) => !x.removed);
    assert.equal(back.at(-1).color, 'rgb(255, 255, 255)', 'the chat: white again');
    assert.equal(await restored.page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(255, 255, 255)', 'and the page background with it');
    await restored.ctx.close();

    // A Safari tab: Safari colours its own bars; Lumen adds nothing.
    const tab = await launch({ scheme: 'light', standalone: false });
    assert.equal((await strips(tab.page)).length, 0, 'Safari tab: no strip');
    await tab.ctx.close();

    console.log(`PASS status bar ${name}: once after the first frame, page colour in Light, Dark and a restored Router, again on a theme change; none in a Safari tab`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
