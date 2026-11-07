const { closeSidebar } = require('./helpers/sidebar-search.cjs');
// Synthetic touches cover the app recognizer. Browser Back exercises popstate separately;
// Playwright does not drive Safari's native interactive edge gesture. In the Home Screen app Back goes up (out of a
// feature in one step; a Settings section to the list); in an iOS tab Safari's own Back steps through history.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const { openPlace } = require('./helpers/nav.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5190/';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
const artifacts = '.nav-layer,.page-swap-ghost';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function exercise(browser, standalone) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, userAgent: iphone, serviceWorkers: 'block',
  });
  try {
    await context.route('**/*', r => new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort());
    const uid = 'swipe-back-' + standalone;
    await profile(context, uid, standalone ? 'light' : 'dark');
    await context.addInitScript(standalone => {
      Object.defineProperty(navigator, 'standalone', { value: standalone });
      // Browser Back and Forward against the app's gestures need real history: as on Android, whose installed apps keep
      // it (an iOS Home Screen app keeps its stack in memory; native-navigation.cjs covers that).
      window.__mrRealHistory = true;
      window.trace = { requests: [], pops: [], pushes: [] };
      for (const method of ['back', 'go', 'pushState']) {
        const original = history[method].bind(history);
        history[method] = (...args) => {
          if (method === 'pushState') window.trace.pushes.push(args[0].lumenScreen.id);
          else window.trace.requests.push(method === 'back' ? -1 : args[0]);
          return original(...args);
        };
      }
      window.addEventListener('popstate', e => window.trace.pops.push(e.state?.lumenScreen?.id));
    }, standalone);
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('/privacy.html', base).href);
    const now = Date.now();
    await seed(page, uid, [{
      id: 'source', title: 'Gesture document', createdAt: now, updatedAt: now, messages: [],
      documents: [{ id: 'doc', name: 'Gesture.md', content: '# Synthetic', updatedAt: now }],
    }]);
    await page.goto(base);
    const composer = page.locator('.composer textarea');
    await composer.waitFor();
    if (!await page.locator('[data-lumen-canvas-shell]').count()) return;
    assert.equal(await page.locator('html').getAttribute('data-native-edge-back'), standalone ? null : '');
    if (await page.evaluate(() => CSS.supports('overscroll-behavior-x', 'auto'))) {
      assert.equal(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('overscroll-behavior-x')), standalone ? 'none' : 'auto');
    }
    await composer.fill('Keep the unsent swipe draft');
    const model = await page.locator('.composer .model-button').innerText();
    await page.locator('.composer input[type=file][multiple]').last().setInputFiles({
      name: 'Unsent notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment'),
    });
    const attachment = page.getByRole('button', { name: 'Remove Unsent notes.txt', exact: true });
    await attachment.waitFor();

    const entry = () => page.evaluate(() => history.state.lumenScreen.id);
    const trace = () => page.evaluate(() => window.trace);
    const root = await entry();
    const drawer = page.locator('aside.cv-nav');
    const focus = selector => page.waitForFunction(selector => document.activeElement?.matches(selector), selector);
    const clean = async selector => {
      await page.waitForFunction(() => !document.documentElement.dataset.navGesture && !document.querySelector('.nav-layer'), null, { timeout: 4000 });
      assert.equal(await page.locator(artifacts).count(), 0, 'no ghost, underlay or dim layer');
      assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).transform), 'none');
    };
    const screenshot = name => {
      if (process.env.SWIPE_EVIDENCE_DIR) return page.screenshot({
        path: path.join(process.env.SWIPE_EVIDENCE_DIR, (process.env.MR_WEBKIT ? 'webkit-' : 'chromium-') + name + '.png'),
        animations: 'disabled',
      });
    };
    // The previous transition finishes before the next finger lands; kept screens (.nav-layer) are never the surface.
    const swipe = async (surface, options = {}) => { await page.waitForFunction(() => !document.querySelector('.nav-layer'), null, { timeout: 4000 }); return page.locator(surface + ':not(.nav-layer)').first().evaluate(async (el, options) => {
      const { start = 5, end = 295, finish = 'touchend', times = 1, step = 0 } = options;
      const run = async id => {
        const fire = (type, x) => {
          const touch = { identifier: id, target: el, clientX: x, clientY: 180 };
          const event = new Event(type, { bubbles: true, cancelable: true });
          Object.defineProperties(event, {
            touches: { value: ['touchend', 'touchcancel'].includes(type) ? [] : [touch] },
            changedTouches: { value: [touch] },
          });
          return el.dispatchEvent(event);
        };
        fire('touchstart', start);
        const moves = [];
        for (const part of [0.25, 0.5, 0.75, 1]) {
          moves.push(fire('touchmove', start + (end - start) * part));
          if (step) await new Promise(r => setTimeout(r, step));
        }
        window.finishSwipe = () => fire('touchend', end);
        if (finish) fire(finish, end);
        return moves;
      };
      // Keep immediate repeats in the same JS task as the first history request.
      const moves = run(1);
      for (let i = 1; i < times; i++) run(i + 1);
      return moves;
    }, options); };
    const returnedToChat = async () => {
      await composer.waitFor();
      assert.equal(await entry(), root);
      assert.equal(await composer.inputValue(), 'Keep the unsent swipe draft');
      assert.equal(await page.locator('.composer .model-button').innerText(), model);
      assert.equal(await attachment.count(), 1);
      assert.equal(await drawer.evaluate(el => el.classList.contains('open')), false);
    };
    const checkTraversal = async (before, destination, scripted) => {
      await page.waitForFunction(id => history.state.lumenScreen.id === id, destination);
      const after = await trace();
      assert.deepEqual(after.pops.slice(before.pops.length), [destination], 'one traversal to the destination');
      const requests = after.requests.slice(before.requests.length);
      assert.equal(requests.length, scripted ? 1 : 0, 'one history request');
      assert(requests.every(delta => delta < 0), 'requests go back');
      assert.deepEqual(after.pushes, before.pushes, 'replay adds no history entry');
    };
    // `destination` is where the app's Back goes; `tab` where Safari's one-step Back goes, when that differs.
    const back = async (surface, destination, options, tab = destination) => {
      if (!standalone) destination = tab;
      const before = await trace();
      if (standalone) await swipe(surface, options);
      else {
        assert((await swipe(surface)).every(Boolean), 'browser edge touch was not intercepted');
        assert.deepEqual(await trace(), before, 'no script traversal in an iOS tab');
        await page.goBack();
      }
      await checkTraversal(before, destination, standalone);
    };

    // Library document exposes the same-screen clone and canceled traversal in the old build.
    await openPlace(page, 'Library');
    const library = page.getByRole('main', { name: 'Library', exact: true });
    const libraryEntry = await entry();
    const documentButton = page.getByRole('button', { name: 'Open Gesture.md', exact: true });
    await documentButton.click();
    const documentEntry = await entry();
    const panel = '.canvas-panel';
    await page.locator(panel).waitFor();
    const before = await trace();
    await swipe(panel, { end: 52, step: 100 }); // slow, partial release
    await swipe(panel, { finish: 'touchcancel' }); // beyond the commit threshold
    await delay(350);
    assert.equal(await entry(), documentEntry);
    assert.deepEqual(await trace(), before, 'partial and canceled gestures never traverse');
    await swipe(panel, { finish: null });
    if (standalone) {
      // A held Back follows the finger over the screen behind it (lib/navigation-coordinator.ts, native-navigation.cjs).
      await page.waitForFunction(selector => document.documentElement.dataset.navGesture && getComputedStyle(document.querySelector(selector)).transform !== 'none', panel);
    } else await clean(panel);
    await screenshot(standalone ? 'pwa-drag-held' : 'safari-edge-untouched');
    await page.evaluate(() => window.finishSwipe());
    if (standalone) {
      // The document was opened from Library (a root chosen in the drawer): Back goes up one level, to Library.
      await checkTraversal(before, libraryEntry, true);
      await library.waitFor();
      await clean('.hub-page');
      await screenshot('pwa-document-to-library');
      // Forward restores the document; browser Back from Library still returns to the chat as it was.
      await page.goForward(); await page.locator(panel).waitFor();
      await page.goBack(); await library.waitFor(); await page.goBack(); await returnedToChat();
      await page.goForward(); await library.waitFor();
      await page.goForward(); await page.locator(panel).waitFor();
    } else {
      await delay(350);
      assert.equal(await entry(), documentEntry);
      assert.deepEqual(await trace(), before);
      await back(panel, libraryEntry);
      await library.waitFor();
      await focus('.hub-page, .hub-page h1, .hub-page [aria-label="Open Gesture.md"]');
      await clean('.hub-page');
      await screenshot('safari-library-restored');
      await page.goForward();
      await page.locator(panel).waitFor();
    }

    // Browser Back during a held touch cancels the recognizer. A late lift cannot traverse again.
    assert.equal(await entry(), documentEntry);
    await swipe(panel, { finish: null });
    const beforeBrowser = await trace();
    await page.goBack();
    await library.waitFor();
    await page.evaluate(() => window.finishSwipe());
    await checkTraversal(beforeBrowser, libraryEntry, false);
    if (standalone) {
      // Library chosen in the drawer is a root (iOS model): its swipe shows the drawer, never a history step; browser Back
      // still returns to the chat it replaced.
      const beforeRoot = await trace();
      await swipe('.hub-page');
      await page.locator('aside.cv-nav.open').waitFor();
      assert.deepEqual(await trace(), beforeRoot, 'a root swipe is not a history step');
      await closeSidebar(page);
      await page.waitForFunction(() => !document.querySelector('aside.cv-nav.open'));
      await page.goBack();
    } else await back('.hub-page', root);
    await returnedToChat();
    // The app's own Back hands focus to the drawer button (the Home Screen app left through browser Back above).
    if (!standalone) await focus('.menu-btn');

    await openPlace(page, 'Router');
    const router = page.locator('.rc-page');
    await router.waitFor();
    const routerRoot = await entry();
    await page.getByRole('navigation', { name: 'Router sections' }).getByRole('button', { name: 'Providers', exact: true }).click();
    const providersEntry = await entry();
    await page.locator('[data-provider="gemini"]').click();
    const detail = page.getByRole('region', { name: 'Provider detail' });
    await detail.waitFor();
    const providerDetail = await entry();
    await screenshot(standalone ? 'pwa-provider-detail' : 'safari-provider-detail');
    // Router's tabs switch in place (iOS model): the Providers list is Router's own screen, not a step.
    assert.equal(providersEntry, routerRoot, 'a tab is not a history step');
    // Two swipes at once still make one traversal, up one level to the providers list. Forward restores the provider.
    await back('.rc-page', providersEntry, { times: 2 });
    await detail.waitFor({ state: 'hidden' });
    await clean('.rc-page');
    assert(await page.locator('.rc-page:not(.nav-layer) [data-provider="gemini"]').isVisible());
    await page.goForward();
    await detail.waitFor();
    assert.equal(await entry(), providerDetail);
    await back('.rc-page', providersEntry);
    // Router chosen in the drawer is a root: its swipe shows the drawer, so browser Back returns to the chat.
    if (standalone) await page.goBack(); else await back('.rc-page', root);
    await returnedToChat();

    await openPlace(page, 'All projects');
    const projects = page.getByRole('main', { name: 'Projects', exact: true });
    await projects.waitFor();
    const projectsEntry = await entry();
    await page.getByRole('button', { name: 'New project', exact: true }).first().click();
    await page.getByLabel('Project name', { exact: true }).fill('Gesture project');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
    await page.locator('.project-workspace-main').waitFor();
    // A project opened from All projects is a drill-down: Back goes up to All projects (a root chosen in the drawer).
    await back('.project-workspace-main', projectsEntry);
    await projects.waitFor();
    await clean('.hub-page');
    if (standalone) await page.goBack(); else await back('.hub-page', root);
    await returnedToChat();

    await page.locator('.menu-btn').first().click();
    await drawer.locator('.cv-account').click();
    await page.locator('.settings-page').waitFor();
    const settingsEntry = await entry();
    await page.locator(':is(.settings-tabs, .si)').getByRole('button', { name: /^(General|Account:)/ }).first().click();
    await page.locator('.settings-page.has-section').waitFor();
    await back('.settings-page', settingsEntry);
    await page.locator('.settings-page.has-section').waitFor({ state: 'detached' });
    await clean('.settings-page');
    // The Settings list chosen in the drawer is a root: browser Back returns to the chat.
    if (standalone) await page.goBack(); else await back('.settings-page', root);
    await returnedToChat();

    await page.getByRole('button', { name: 'Add photos, files or a repository' }).click();
    await page.getByRole('dialog', { name: 'Add to your message' }).getByRole('button', { name: 'Browse all tools' }).click();
    const picker = page.getByRole('dialog', { name: 'Tools', exact: true });
    await picker.waitFor();
    const beforePickerBack = await trace();
    await page.goBack();
    await picker.waitFor({ state: 'detached' });
    await checkTraversal(beforePickerBack, root, false);
    await returnedToChat();
    assert.equal(await page.locator('.attach-menu').count(), 0);
    await clean('.app > .main');

    if (!standalone) {
      assert((await swipe('.app > .main')).every(Boolean), 'Safari edge also yields in chat');
      assert.equal(await drawer.evaluate(el => el.classList.contains('open')), false);
    }
    await swipe('.app > .main', { start: 60 });
    await page.locator('aside.cv-nav.open').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS ' + (standalone ? 'Home Screen' : 'iOS browser tab') + ' history, cancel, rapid Back/Forward, focus and draft');
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    for (const standalone of [true, false]) await exercise(browser, standalone);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
