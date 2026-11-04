// Native-feeling Back on the Canvas phone (lib/navigation-coordinator.ts): one gesture owner and one transition system.
// Synthetic touches drive the Home Screen app's recognizer with motion on. For each journey it checks what is on screen
// at the start, middle and end of the gesture (the current screen follows the finger over the real or kept screen
// behind it, never a wrong one), that one completed swipe makes exactly one history traversal and no new entry, that
// short, reversed, canceled, interrupted and repeated gestures never navigate, and that every layer and transform is
// gone afterwards. Also: the drawer owns the root chat, sheets and sideways content keep their drags, an iOS browser tab
// leaves Back to Safari, taps slide like the gesture, and Reduce Motion keeps the finger but drops the motion.
// Safari's own native swipe and a physical iPhone are not covered here (see HANDOFF.md → Next).
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { profile } = require('./helpers/preview-profile.cjs');
const { openPlace } = require('./helpers/nav.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5190/';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
const evidence = process.env.NAV_EVIDENCE_DIR;
const engine = process.env.MR_WEBKIT ? 'webkit' : 'chromium';

async function run(browser, { width, height, theme, standalone = true, reduce = false }) {
  const tag = `${engine} ${width} ${theme}${standalone ? '' : ' browser tab'}${reduce ? ' reduced motion' : ''}`;
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, userAgent: iphone, serviceWorkers: 'block', reducedMotion: reduce ? 'reduce' : 'no-preference' });
  try {
    await context.route('**/*', (r) => new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort());
    await profile(context, `native-nav-${width}-${theme}-${standalone}-${reduce}`, theme);
    await context.addInitScript((standalone) => {
      Object.defineProperty(navigator, 'standalone', { value: standalone });
      window.__mrMotion = true;
      window.trace = { pops: [], go: 0, pushes: 0 };
      const go = history.go.bind(history), push = history.pushState.bind(history), back = history.back.bind(history);
      history.go = (...a) => { window.trace.go++; return go(...a); };
      history.back = (...a) => { window.trace.go++; return back(...a); };
      history.pushState = (...a) => { window.trace.pushes++; return push(...a); };
      addEventListener('popstate', (e) => window.trace.pops.push(e.state?.lumenScreen?.id));
    }, standalone);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    const composer = page.locator('.composer textarea');
    await composer.waitFor();
    if (!await page.locator('[data-lumen-canvas-shell]').count()) { console.log('SKIP ordinary build'); return; }
    await page.waitForTimeout(400);
    await composer.fill('Keep this unsent draft');
    const model = await page.locator('.composer .model-button').innerText();
    await page.locator('.composer input[type=file][multiple]').last().setInputFiles({ name: 'Pending notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment') });
    const attachment = page.getByRole('button', { name: 'Remove Pending notes.txt', exact: true });
    await attachment.waitFor();

    const entry = () => page.evaluate(() => history.state?.lumenScreen?.id);
    const trace = () => page.evaluate(() => JSON.parse(JSON.stringify(window.trace)));
    const shot = (name) => evidence && page.screenshot({ path: path.join(evidence, `${engine}-${width}-${theme}${standalone ? '' : '-tab'}${reduce ? '-reduced' : ''}-${name}.png`) });
    const frame = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    // One synthetic finger: start, move in steps (a frame apart), and optionally lift or cancel.
    const touch = (type, x, y = Math.round(height / 2)) => page.evaluate(({ type, x, y }) => {
      const target = window.__finger || document.elementFromPoint(Math.max(1, x), y) || document.body;
      const t = { identifier: 3, target, clientX: x, clientY: y };
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperties(e, { touches: { value: ['touchend', 'touchcancel'].includes(type) ? [] : [t] }, changedTouches: { value: [t] } });
      if (type === 'touchstart') window.__finger = target;
      const kept = target.dispatchEvent(e);
      if (type === 'touchend' || type === 'touchcancel') window.__finger = null;
      return kept;
    }, { type, x, y });
    const drag = async (to, { from = 6, steps = 8, y } = {}) => { const moved = [await touch('touchstart', from, y)]; for (let i = 1; i <= steps; i++) { moved.push(await touch('touchmove', from + (to - from) * i / steps, y)); await page.waitForTimeout(16); } await frame(); return moved; };
    const lift = async (x, type = 'touchend') => { await touch(type, x); };
    const gesture = () => page.evaluate(() => document.documentElement.dataset.navGesture || null);
    const offset = (selector) => page.locator(selector).first().evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).m41);
    const clean = async (selector) => {
      await page.waitForFunction(() => !document.documentElement.dataset.navGesture && !document.querySelector('.nav-layer'), null, { timeout: 4000 });
      assert.equal(await page.locator('.nav-layer, .page-swap-ghost').count(), 0, `${tag}: no layer left behind`);
      assert.equal(await page.locator(selector).first().evaluate((el) => getComputedStyle(el).transform), 'none', `${tag}: ${selector} is back in place`);
      assert.equal(await page.locator('.app > .main').evaluate((el) => el.inert && !document.querySelector('.hub-page, .settings-page, .rc-page:not([hidden]), .canvas-panel')), false, `${tag}: the chat is not left inert`);
    };
    /** Held at about half way: the screen is with the finger and `expect` is what shows behind it. */
    const held = async (selector, to, expect, name) => {
      await drag(to);
      assert.equal(await gesture(), expect.kind, `${tag}: behind ${selector}: ${expect.kind}`);
      const x = await offset(selector);
      assert(Math.abs(x - (to - 6)) <= 2, `${tag}: ${selector} follows the finger (${x} vs ${to - 6})`);
      if (expect.text) {
        const under = expect.kind === 'live' ? page.locator(expect.live || '.app > .main') : page.locator('.nav-layer[data-nav-entry]');
        assert.match(await under.first().innerText(), expect.text, `${tag}: the screen behind shows ${expect.text}`);
        if (!reduce) assert((await offset(expect.kind === 'live' ? (expect.live || '.app > .main') : '.nav-layer[data-nav-entry]')) < 0, `${tag}: the screen behind moves in from the left`);
      }
      if (name) await shot(name);
    };
    /** Complete a Back: exactly one traversal to `destination`, no new history entry. */
    const committed = async (before, destination, selector) => {
      await page.waitForFunction((id) => history.state?.lumenScreen?.id === id, destination);
      const after = await trace();
      assert.deepEqual(after.pops.slice(before.pops.length), [destination], `${tag}: one traversal`);
      assert.equal(after.go - before.go, 1, `${tag}: one history request`);
      assert.equal(after.pushes, before.pushes, `${tag}: no new entry`);
      await clean(selector);
    };
    const back = async (selector, destination, expect, name, release = Math.round(width * 0.62)) => {
      const before = await trace();
      await held(selector, release, expect, name);
      await lift(release);
      await committed(before, destination, expect.next || selector);
    };
    const backAtChat = async () => {
      await composer.waitFor();
      assert.equal(await composer.inputValue(), 'Keep this unsent draft', `${tag}: the draft survives`);
      assert.equal(await page.locator('.composer .model-button').innerText(), model, `${tag}: the model choice survives`);
      assert.equal(await attachment.count(), 1, `${tag}: the pending attachment survives`);
    };

    const root = await entry();
    if (!standalone) {
      // An iOS browser tab: Safari owns the edges and Back. The app never claims, prevents or traverses.
      await openPlace(page, 'Router');
      await page.locator('.rc-page').waitFor();
      const before = await trace();
      assert((await drag(300)).every(Boolean), `${tag}: the touch reaches the page untouched`);
      await lift(300);
      await page.waitForTimeout(400);
      assert.equal(await gesture(), null); assert.deepEqual(await trace(), before, `${tag}: no app traversal in a tab`);
      await page.goBack(); await composer.waitFor();
      await backAtChat();
      assert.deepEqual(errors, []);
      console.log(`PASS ${tag}: Safari keeps Back`);
      return;
    }

    // Router: chat → Router → Providers → Gemini detail, then back one step at a time.
    await openPlace(page, 'Router');
    await page.locator('.rc-page').waitFor();
    const router = await entry();
    await page.getByRole('navigation', { name: 'Router sections' }).getByRole('button', { name: 'Providers', exact: true }).click();
    const providers = await entry();
    await page.locator('[data-provider="gemini"]').click();
    await page.getByRole('region', { name: 'Provider detail' }).waitFor();
    await page.waitForTimeout(500);
    const detail = await entry();

    // Short, reversed, canceled and browser-interrupted gestures never navigate.
    let before = await trace();
    await drag(70); await lift(70); await clean('.rc-page');
    await drag(260); await touch('touchmove', 40); await page.waitForTimeout(16); await touch('touchmove', 20); await lift(20); await clean('.rc-page');
    await drag(300); await lift(300, 'touchcancel'); await clean('.rc-page');
    assert.equal(await entry(), detail); assert.deepEqual(await trace(), before, `${tag}: short, reversed and canceled drags stay`);
    await drag(250);
    await page.goBack();
    await page.waitForFunction((id) => history.state?.lumenScreen?.id === id, providers);
    await lift(250);
    await clean('.rc-page');
    await page.waitForTimeout(300);
    assert.equal(await entry(), providers, `${tag}: a lift after browser Back does not traverse again`);
    await page.goForward(); await page.getByRole('region', { name: 'Provider detail' }).waitFor(); await page.waitForTimeout(300);

    // Every frame from release to rest: the screen only moves on, and the screen behind (kept, then the real one) is
    // on display throughout; the layers come off in the same frame the destination is in place.
    before = await trace();
    await held('.rc-page', Math.round(width * 0.55), { kind: 'kept', text: /Providers/ }, 'router-detail-held');
    await page.evaluate(() => { window.__frames = []; const loop = () => { const el = document.querySelector('.rc-page'); const m = el ? new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).m41 : null; window.__frames.push({ x: m, gesture: document.documentElement.dataset.navGesture || null, under: document.querySelectorAll('.nav-layer[data-nav-entry]').length, list: Boolean(el && el.querySelector('[data-provider="gemini"]')), detail: Boolean(el && el.querySelector('[aria-label="Provider detail"]')) }); if (window.__frames.length < 90) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    await lift(Math.round(width * 0.55));
    await committed(before, providers, '.rc-page');
    await page.waitForFunction(() => window.__frames.length >= 90);
    const frames = await page.evaluate(() => window.__frames);
    const moving = frames.filter((f) => f.gesture);
    for (let i = 1; i < moving.length; i++) assert(moving[i].x >= moving[i - 1].x - 0.5, `${tag}: the release never moves backwards (${moving[i - 1].x} → ${moving[i].x})`);
    for (const f of frames) assert(f.gesture ? (f.under > 0 || f.list) : (f.list && !f.detail && f.x === 0), `${tag}: every frame shows the screen behind or the restored one (${JSON.stringify(f)})`);
    assert(frames.some((f) => !f.gesture), `${tag}: the transition finishes`);
    assert(await page.locator('[data-provider="gemini"]').isVisible(), `${tag}: Providers is restored`);
    // Two complete swipes in one task: the second waits for the first; one traversal only.
    before = await trace();
    await page.evaluate(() => {
      const fire = (type, x) => { const t = { identifier: 9, target: document.querySelector('.rc-page'), clientX: x, clientY: 400 }; const e = new Event(type, { bubbles: true, cancelable: true }); Object.defineProperties(e, { touches: { value: type === 'touchend' ? [] : [t] }, changedTouches: { value: [t] } }); t.target.dispatchEvent(e); };
      for (let n = 0; n < 2; n++) { fire('touchstart', 6); for (const x of [60, 140, 220, 300]) fire('touchmove', x); fire('touchend', 300); }
    });
    await committed(before, router, '.rc-page');
    await page.waitForTimeout(400);
    assert.equal(await entry(), router, `${tag}: repeated swipes make one traversal`);
    await back('.rc-page', root, { kind: 'live', text: /Message Lumen|Good (morning|afternoon|evening)/, next: '.app > .main' }, 'router-to-chat-held');
    await backAtChat();

    // Tapping Back slides like the gesture, with the same single traversal.
    await openPlace(page, 'Router');
    await page.locator('.rc-page').waitFor(); await page.waitForTimeout(400);
    before = await trace();
    await page.locator('.rc-page .phone-navigation button').first().click();
    if (!reduce) { await page.waitForFunction(() => document.querySelector('.nav-layer'), null, { timeout: 1500 }).catch(() => {}); assert(await page.locator('.nav-layer').count() > 0, `${tag}: a tap Back slides`); await shot('tap-back-mid'); }
    await committed(before, root, '.app > .main');
    await backAtChat();

    // Library → document → Library → chat.
    await openPlace(page, 'Library');
    const library = page.getByRole('main', { name: 'Library', exact: true });
    await library.waitFor(); await page.waitForTimeout(300);
    const libraryEntry = await entry();
    await page.getByRole('button', { name: 'New document' }).first().click();
    await page.locator('.canvas-panel').waitFor(); await page.waitForTimeout(500);
    // The document changed the Library, so its kept screen is not shown: the underlay is plain, never stale.
    await back('.canvas-panel', libraryEntry, { kind: 'none', next: '.hub-page' }, 'document-held');
    await library.waitFor();
    await back('.hub-page', root, { kind: 'live', text: /Message Lumen|Good (morning|afternoon|evening)/, next: '.app > .main' }, 'library-held');
    await backAtChat();

    // Settings → General → index → chat.
    await page.locator('.menu-btn').first().click();
    await page.locator('aside.cv-nav .cv-account').click();
    await page.locator('.settings-page').waitFor();
    const settings = await entry();
    await page.locator(':is(.settings-tabs, .si)').getByRole('button', { name: /^(General|Account:)/ }).first().click();
    await page.locator('.settings-page.has-section').waitFor(); await page.waitForTimeout(400);
    await back('.settings-page', settings, { kind: 'kept', text: /Personalization|Privacy/ }, 'settings-held');
    await back('.settings-page', root, { kind: 'live', text: /Message Lumen|Good (morning|afternoon|evening)/, next: '.app > .main' });
    await backAtChat();

    // Projects → new project → workspace → Projects → chat.
    await openPlace(page, 'All projects');
    await page.getByRole('main', { name: 'Projects', exact: true }).waitFor();
    const projects = await entry();
    await page.getByRole('button', { name: 'New project', exact: true }).first().click();
    await page.getByLabel('Project name', { exact: true }).fill('Native project');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.locator('.project-workspace-main').waitFor(); await page.waitForTimeout(500);
    await back('.app > .main', projects, { kind: 'none', next: '.hub-page' }, 'workspace-held');
    // An open menu owns the screen: Back never starts while it is up, and Escape still closes it.
    await page.getByRole('button', { name: 'More for Native project', exact: true }).click();
    await page.getByRole('menu').waitFor();
    before = await trace();
    await drag(Math.round(width * 0.7)); await lift(Math.round(width * 0.7));
    await page.waitForTimeout(300);
    assert.equal(await gesture(), null); assert.deepEqual(await trace(), before, `${tag}: an open menu keeps the gesture`);
    await page.keyboard.press('Escape'); await page.getByRole('menu').waitFor({ state: 'detached' });
    await back('.hub-page', root, { kind: 'live', text: /Message Lumen|Good (morning|afternoon|evening)/, next: '.app > .main' });
    await backAtChat();

    // The root chat: a right swipe is the drawer's, and Back never claims it.
    before = await trace();
    await drag(Math.round(width * 0.7), { from: 60 }); await lift(Math.round(width * 0.7));
    await page.locator('aside.cv-nav.open').waitFor();
    assert.equal(await gesture(), null); assert.deepEqual(await trace(), before, `${tag}: the drawer owns the root chat`);
    await page.locator('.scrim').click({ position: { x: width - 10, y: 200 } }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('aside.cv-nav.open'));

    await openPlace(page, 'Router'); await page.locator('.rc-page').waitFor(); await page.waitForTimeout(300);
    await page.getByRole('navigation', { name: 'Router sections' }).getByRole('button', { name: 'Providers', exact: true }).click();
    await page.waitForTimeout(300);
    // Sideways content that can still scroll back keeps the drag; from the edge, Back still wins.
    const chips = page.locator('.rc-page .phone-sections').first();
    if (await chips.count() && await chips.evaluate((el) => el.scrollWidth > el.clientWidth + 2)) {
      await chips.evaluate((el) => { el.scrollLeft = 80; });
      const box = await chips.boundingBox();
      before = await trace();
      await drag(Math.round(width * 0.7), { from: 120, y: Math.round(box.y + box.height / 2) }); await lift(Math.round(width * 0.7));
      await page.waitForTimeout(300);
      assert.equal(await gesture(), null); assert.deepEqual(await trace(), before, `${tag}: a scrolled chip rail keeps its drag`);
    }
    await back('.rc-page', await page.evaluate(() => history.state.lumenScreen.id) - 1, { kind: 'kept', text: /Models|Browse/ });
    await back('.rc-page', root, { kind: 'live', next: '.app > .main' });
    await backAtChat();

    assert.deepEqual(errors, [], `${tag}: no page errors`);
    console.log(`PASS ${tag}: Router, Library, document, Settings, Projects, drawer, menu and scroller ownership, tap Back`);
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch();
  try {
    await run(browser, { width: 390, height: 844, theme: 'light' });
    await run(browser, { width: 320, height: 640, theme: 'dark' });
    await run(browser, { width: 390, height: 844, theme: 'dark', reduce: true });
    await run(browser, { width: 390, height: 844, theme: 'light', standalone: false });
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
