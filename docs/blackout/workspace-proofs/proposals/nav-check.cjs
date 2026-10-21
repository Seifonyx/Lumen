// Canvas sidebar check (actual app, synthetic account, no network). Screens + behaviour for the sidebar refinement.
// Usage: W=393 H=852 OUT=dir [PORT=5195] [BEFORE=1] [MR_WEBKIT=1] node docs/blackout/workspace-proofs/proposals/nav-check.cjs
// BEFORE=1 only takes the screens the earlier sidebar can show (no collapse / row-action steps).
const { chromium, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { profile, seed } = require('../../../../tests/e2e/helpers/preview-profile.cjs');
const { chats, projects, now } = require('./fixture.cjs');
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900), OUT = process.env.OUT || '.', PORT = process.env.PORT || 5195, BEFORE = Boolean(process.env.BEFORE);
const phone = W < 900, engine = process.env.MR_WEBKIT ? webkit : chromium, tag = `${phone ? 'phone' : 'desktop'}${phone && W !== 393 ? W : ''}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const extraProjects = [
  { id: 'home', name: 'Home renovation', description: 'Kitchen first, then the small bathroom.', instructions: '', color: 'amber', createdAt: now - 9e8, updatedAt: now - 4e8 },
  { id: 'thesis', name: 'Thesis notes', description: 'Chapter outlines and reading notes.', instructions: 'Cite sources.', color: 'blue', createdAt: now - 9e8, updatedAt: now - 5e8 },
];
const titles = ['Pricing the first three offers', 'Portfolio order', 'Cold email draft', 'Studio name shortlist', 'Invoice template', 'Contract checklist', 'Website copy pass', 'Client onboarding', 'Moodboard notes', 'Rate card', 'Weekly review', 'Newsletter idea', 'Hiring a part-time assistant', 'Tax questions', 'Tile samples', 'Budget for the kitchen', 'Chapter 2 outline', 'Reading notes: Arendt'];
const extra = titles.map((title, i) => ({ id: 'x' + i, title, createdAt: now - (i + 1) * 72e6, updatedAt: now - (i + 1) * 72e6, model: 'auto', projectId: i < 9 ? 'studio' : i >= 14 && i < 16 ? 'home' : i >= 16 ? 'thesis' : undefined, messages: [{ id: 'm' + i, role: 'user', text: title, createdAt: now - (i + 1) * 72e6 }] }));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await engine.launch();
  const report = { W, H, engine: process.env.MR_WEBKIT ? 'webkit' : 'chromium', before: BEFORE, checks: {}, axe: {}, screens: [] };
  const open = async (owner, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: phone && !process.env.MR_WEBKIT ? true : undefined, hasTouch: phone, serviceWorkers: 'block', userAgent: phone ? UA : undefined, ...opts });
    await ctx.route('**/*', (r) => (new URL(r.request().url()).hostname === 'localhost' ? r.continue() : r.abort()));
    await profile(ctx, owner, 'dark', { projects: [...projects, ...extraProjects] });
    await ctx.addInitScript(() => { window.__blackoutHarness = true; });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${PORT}/docs/blackout/workspace-proofs/?proposal=canvas`); await page.locator('.composer textarea').waitFor();
    await seed(page, owner, [...chats, ...extra]); await page.reload(); await page.locator('.composer textarea').waitFor();
    await page.waitForFunction(async () => { const { useStore } = await import('/src/store.ts'); return useStore.getState().chats.length >= 25; });
    await page.evaluate(async () => { const { useStore } = await import('/src/store.ts'); useStore.getState().selectChat('launch'); });
    await page.getByText('Make the first week count.', { exact: true }).first().waitFor();
    return { ctx, page, errors };
  };
  const owner = 'preview-blackout-nav-' + (process.env.MR_WEBKIT ? 'wk' : 'cr') + W;
  const { ctx, page, errors } = await open(owner);
  const store = (fn) => page.evaluate(async (src) => { const { useStore } = await import('/src/store.ts'); return new Function('s', `return (${src})(s)`)(useStore.getState()); }, fn.toString());
  const settle = () => page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
  const shot = async (name, axe = false, include) => {
    await page.waitForTimeout(380); await settle();
    assert(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${name}: horizontal overflow`);
    const file = `canvas-${tag}-${name}.png`; await page.screenshot({ path: path.join(OUT, file) }); report.screens.push(file);
    if (axe) { let builder = new AxeBuilder({ page }); if (include) builder = builder.include(include); const scan = await builder.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze(); report.axe[name] = scan.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })); }
  };
  const openNav = async () => { if (phone && !(await page.locator('.pc-nav').count())) { await page.locator('[data-proposal-nav]').first().click(); await page.locator('.pc-nav').waitFor(); } };
  const closeNav = async () => { if (phone && (await page.locator('[data-proposal-nav-close]').count())) await page.locator('[data-proposal-nav-close]').click(); };
  const trace = []; const probe = async (label) => trace.push([label, await page.locator('.composer textarea').evaluate((el) => [el.value.length, el.selectionStart, el.selectionEnd])]);
  const expanded = (sel) => page.locator(sel).first().getAttribute('aria-expanded');

  // A draft with a selection must survive everything the sidebar does.
  const input = page.locator('.composer textarea');
  const draft = 'A draft the sidebar must not touch.';
  await input.click(); await input.fill(draft); await input.evaluate((el) => el.setSelectionRange(2, 7));
  await page.locator('.messages').evaluate((el) => (el.scrollTop = 0));

    await probe('start');
  await openNav(); await shot('nav-default', true);
  // Project expanded: open a second folder (Lisbon), which leaves Studio launch as it was.
  await page.locator('[data-proposal-space="trip"]').first().click();
  if (phone) await page.locator('[data-proposal-space="trip"]').first().scrollIntoViewIfNeeded();
  await shot('nav-project-expanded');

  if (!BEFORE) {
    const c = report.checks;
    c.folderIndependent = { trip: await expanded('[data-proposal-space="trip"]'), studio: await expanded('[data-proposal-space="studio"]') };
    assert.deepEqual(c.folderIndependent, { trip: 'true', studio: 'true' });
    await page.locator('[data-proposal-space="studio"]').first().click();
    c.studioClosed = { studio: await expanded('[data-proposal-space="studio"]'), trip: await expanded('[data-proposal-space="trip"]'), marker: await page.locator('[data-proposal-space="studio"] .pc-here').count() };
    assert.deepEqual(c.studioClosed, { studio: 'false', trip: 'true', marker: 1 });
    await page.locator('[data-proposal-space="studio"]').first().click();
    c.showMore = await page.locator('.pc-more').allTextContents(); assert.deepEqual(c.showMore, ['Show 7 more']);

    // Sections: Projects and Conversations fold independently; closed content is inert.
    const P = '[data-pc-section="projects"]', C = '[data-pc-section="conversations"]';
    await page.locator(P).click();
    c.projectsOnly = { projects: await expanded(P), conversations: await expanded(C), projectsInert: await page.locator(`[id="${await page.locator(P).getAttribute('aria-controls')}"]`).evaluate((el) => el.inert), loneRowVisible: await page.getByRole('button', { name: 'Notes for a quieter workspace', exact: true }).isVisible() };
    assert.deepEqual(c.projectsOnly, { projects: 'false', conversations: 'true', projectsInert: true, loneRowVisible: true });
    await page.locator(C).click();
    c.bothClosed = { projects: await expanded(P), conversations: await expanded(C), projectsMarker: await page.locator(`${P} .pc-here`).count() };
    assert.deepEqual(c.bothClosed, { projects: 'false', conversations: 'false', projectsMarker: 1 });
    await shot('nav-sections-collapsed', true);
    // Keyboard: Enter and Space toggle the focused heading.
    await page.locator(P).focus(); await page.keyboard.press('Enter'); const afterEnter = await expanded(P);
    await page.keyboard.press(' '); const afterSpace = await expanded(P);
    c.keyboardToggle = { afterEnter, afterSpace }; assert.deepEqual(c.keyboardToggle, { afterEnter: 'true', afterSpace: 'false' });
    await probe('sections-toggled');
    c.selectionBeforeReload = trace.find((t) => t[0] === 'sections-toggled')[1]; assert.deepEqual(c.selectionBeforeReload, [draft.length, 2, 7]);
    // Remembered per account (reload), and another account starts from its own defaults.
    await page.locator(P).click(); // Projects open, Conversations closed, Studio open, Lisbon open
    await page.reload(); await page.locator('.composer textarea').waitFor();
    await page.evaluate(async () => { const { useStore } = await import('/src/store.ts'); useStore.getState().selectChat('launch'); });
    await openNav();
    c.remembered = { projects: await expanded(P), conversations: await expanded(C), trip: await expanded('[data-proposal-space="trip"]'), keys: await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('lumen.blackout.canvasNav'))) };
    assert.deepEqual(c.remembered, { projects: 'true', conversations: 'false', trip: 'true', keys: [`lumen.blackout.canvasNav.${owner}`] });
    await probe('after-reload');
    // Search shows matches even inside folded sections, and disables the toggles meanwhile.
    if (phone) await page.getByRole('button', { name: 'Search conversations' }).click();
    await page.getByRole('searchbox', { name: 'Search conversations' }).fill('quieter');
    c.searchThroughFold = { visible: await page.getByRole('button', { name: 'Notes for a quieter workspace', exact: true }).isVisible(), toggleDisabled: await page.locator(C).isDisabled() };
    assert.deepEqual(c.searchThroughFold, { visible: true, toggleDisabled: true });
    await page.getByRole('searchbox', { name: 'Search conversations' }).fill('');
    await page.locator(C).click(); // reopen Conversations for the row tests
    if (phone) await page.getByRole('button', { name: 'Search conversations' }).click();

    await probe('after-search');
    // Row actions. Desktop: the ⋯ menu (also right-click); phone: long press opens production's ContextMenu.
    const rowFor = (t) => page.locator('.pc-row', { has: page.getByRole('button', { name: t, exact: true }) }).first();
    const menuFor = async (t) => {
      if (phone) {
        await rowFor(t).scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
        const box = await rowFor(t).boundingBox();
        if (report.engine === 'chromium') {
          const cdp = await ctx.newCDPSession(page); const x = box.x + 40, y = box.y + box.height / 2;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await page.waitForTimeout(650);
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else { await rowFor(t).hover(); await rowFor(t).dispatchEvent('contextmenu'); }
        return page.locator('.ctx-menu[role="menu"]');
      }
      await rowFor(t).hover(); await rowFor(t).getByRole('button', { name: `Options for ${t}` }).click();
      return page.locator('.pc-menu[role="menu"]');
    };
    const loose = 'Notes for a quieter workspace';
    let menu = await menuFor(loose);
    if (phone && report.engine !== 'chromium') { report.checks.longPress = 'not simulated in WebKit (no CDP touch); ⋯ on focus checked instead'; await rowFor(loose).getByRole('button', { name: `Options for ${loose}` }).focus(); await page.keyboard.press('ArrowDown'); menu = page.locator('.pc-menu[role="menu"]'); }
    await menu.waitFor();
    c.menuItems = await menu.locator('[role="menuitem"]').allTextContents();
    // The open menu overlays rows beneath it, so this state scans the menu itself (the page was scanned closed).
    await shot('row-menu', true, (await page.locator('.ctx-menu').count()) ? '.ctx-menu' : '.pc-menu');
    // Keyboard: arrows move, Escape closes (desktop dropdown returns focus to ⋯).
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    c.menuEscapeCloses = (await menu.count()) === 0; assert(c.menuEscapeCloses);
    const act = async (t, label, sub) => { const m = await menuFor(t); await m.waitFor(); await m.getByRole('menuitem', { name: label, exact: true }).click(); if (sub) { const target = phone ? page.locator('.ctx-menu[role="menu"]') : m; await target.getByRole('menuitem', { name: sub, exact: true }).click(); } await page.waitForTimeout(250); };
    if (!(phone && report.engine !== 'chromium')) {
      await act(loose, 'Pin'); c.pin = await store((s) => s.chats.find((x) => x.id === 'history-0').pinned); assert.equal(c.pin, true);
      await act(loose, 'Move to project', 'Lisbon in spring'); c.move = await store((s) => s.chats.find((x) => x.id === 'history-0').projectId); assert.equal(c.move, 'trip');
      await act('Reading list — October', 'Rename'); const edit = page.getByRole('textbox', { name: 'Chat name' }); await edit.fill('Reading list — November'); await edit.press('Enter');
      c.rename = await store((s) => s.chats.find((x) => x.id === 'history-4').title); assert.equal(c.rename, 'Reading list — November');
      await act('Weekly review', 'Archive'); c.archive = await store((s) => s.chats.find((x) => x.id === 'x10').archived); assert.equal(c.archive, true);
      c.archivedHidden = (await page.getByRole('button', { name: 'Weekly review', exact: true }).count()) === 0; assert(c.archivedHidden);
      await act('Newsletter idea', 'Share or export'); c.export = await store((s) => s.exportChatId); assert.equal(c.export, 'x11');
      await page.keyboard.press('Escape'); await page.waitForTimeout(300); await store((s) => s.setUi({ exportChatId: null }));
      await openNav();
      // Delete asks first: dismissing keeps the chat, accepting removes it.
      page.once('dialog', (d) => d.dismiss()); await act('Tax questions', 'Delete'); c.deleteCancelled = await store((s) => s.chats.some((x) => x.id === 'x13'));
      page.once('dialog', (d) => d.accept()); await openNav(); await act('Tax questions', 'Delete'); c.deleteAccepted = !(await store((s) => s.chats.some((x) => x.id === 'x13')));
      assert.deepEqual([c.deleteCancelled, c.deleteAccepted], [true, true]);
      if (!phone) { const m = await menuFor('Rate card'); await m.waitFor(); c.sideBySide = await m.getByRole('menuitem', { name: 'Open side by side' }).count(); await page.keyboard.press('Escape'); }
    }
    await probe('after-row-actions');
    // Account: avatar opens Settings.
    await openNav(); await page.getByRole('button', { name: 'Account and settings' }).click(); c.account = await store((s) => s.settingsOpen); assert.equal(c.account, true);
    await store((s) => s.setUi({ settingsOpen: false })); await page.waitForTimeout(250); await probe('after-settings');
    // Desktop collapse reuses production's state: button, persistence and ⌘⇧S.
    if (!phone) {
      await page.locator('[data-pc-collapse]').click(); await page.waitForTimeout(250);
      c.collapse = { navGone: (await page.locator('.pc-nav').count()) === 0, appCollapsed: await page.locator('.app.sidebar-collapsed').count(), showButton: await page.locator('[data-proposal-nav]').first().isVisible() };
      assert.deepEqual(c.collapse, { navGone: true, appCollapsed: 1, showButton: true });
      await shot('nav-collapsed', true);
      await page.reload(); await page.locator('.composer textarea').waitFor(); await page.evaluate(async () => { const { useStore } = await import('/src/store.ts'); useStore.getState().selectChat('launch'); }); await page.getByText('Make the first week count.', { exact: true }).first().waitFor(); c.collapseRemembered = (await page.locator('.pc-nav').count()) === 0; assert(c.collapseRemembered);
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+S' : 'Control+Shift+S'); await page.waitForTimeout(250);
      c.shortcutRestores = (await page.locator('.pc-nav').count()) === 1; assert(c.shortcutRestores);
    }
    await probe('after-collapse');
    // The draft and selection are untouched (after a reload the draft is the saved one; selection checked before).
    await closeNav();
    c.draft = await input.evaluate((el) => el.value); assert.equal(c.draft, draft);
    // Reduced motion: folds and chevrons don't animate.
    await page.emulateMedia({ reducedMotion: 'reduce' }); await openNav();
    c.reducedMotion = await page.locator('.pc-fold').first().evaluate((el) => getComputedStyle(el).transitionDuration.split(',').every((d) => parseFloat(d) === 0)); assert(c.reducedMotion);
    // Another account on this device starts with its own (default) section state.
    const second = await open(owner + '-b'); const p2 = second.page;
    if (phone) await p2.locator('[data-proposal-nav]').first().click();
    c.otherAccountDefaults = { projects: await p2.locator(P).getAttribute('aria-expanded'), conversations: await p2.locator(C).getAttribute('aria-expanded') };
    assert.deepEqual(c.otherAccountDefaults, { projects: 'true', conversations: 'true' }); await second.ctx.close();
  }
  report.trace = trace;
  report.errors = errors; assert.deepEqual(errors, []);
  for (const [k, v] of Object.entries(report.axe)) assert.deepEqual(v, [], `axe ${k}`);
  fs.writeFileSync(path.join(OUT, `nav-${tag}${process.env.MR_WEBKIT ? '-webkit' : ''}.json`), JSON.stringify(report, null, 1));
  console.log(`PASS canvas nav ${tag} ${W}x${H} ${report.engine}${BEFORE ? ' (before: screens only)' : ''}`, JSON.stringify(report.checks));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
