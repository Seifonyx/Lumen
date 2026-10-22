// CP02 browser contract: the Canvas composer and writing sheet in a committed synthetic review build, served
// through the real QA gate on loopback, in Chromium or Linux WebKit (MR_WEBKIT=1). Not a physical-iPhone result.
//
//   node scripts/qa/build.mjs --out /tmp/qa-build && QA_BUILD_DIR=/tmp/qa-build node tests/security/private-qa-canvas-composer.mjs
//
// Per viewport (1440×960, 390×844, 320×568, 390×480): resting → engaged → expanded → collapsed with the same
// mounted textarea, draft, selection/direction, undo and IME-safe Escape; nested picker/usage dialogs; focus
// containment; attachments; Send/Stop from the sheet; draft persistence; chat-switch reset; Incognito; banner
// clearance; simulated keyboard; touch-drag dismissal and cancellation (Chromium touch emulation); reviewer
// isolation; reduced motion; axe; and no request leaving the review origin. Screenshots go to CP02_OUT.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startLocalGate, REVIEWERS } from './private-qa-local-gate.mjs';
import { verifyBuild } from '../../scripts/qa/verify.mjs';

const buildDir = process.env.QA_BUILD_DIR;
assert.ok(buildDir, 'Set QA_BUILD_DIR to the output of scripts/qa/build.mjs');
const head = process.env.QA_EXPECTED_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.deepEqual(await verifyBuild(buildDir, head), [], 'build must match its manifest and commit before it is served');

const engineName = process.env.MR_WEBKIT ? 'webkit' : 'chromium';
const engine = process.env.MR_WEBKIT ? webkit : chromium;
const out = process.env.CP02_OUT || join('tests/e2e/out/cp02', engineName);
mkdirSync(out, { recursive: true });
const VIEWPORTS = (process.env.CP02_VIEWPORTS || '1440x960,390x844,320x568,390x480').split(',').map((v) => v.split('x').map(Number));
const gate = await startLocalGate(buildDir);
const browser = await engine.launch();
const results = [];
const DRAFT = 'Keep this exact draft: café 🌙 مرحبا.\nA second line, with a backwards selection.';

async function open(who, { width, height, reducedMotion = 'no-preference' }) {
  const phone = width < 900;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: phone && engineName === 'chromium', hasTouch: phone, reducedMotion,
    extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': await gate.token(who) } });
  const seen = { external: [], errors: [] };
  context.on('request', (r) => { if (!r.url().startsWith(gate.origin) && !/^(data|blob):/.test(r.url())) seen.external.push(r.url()); });
  await context.route((url) => !url.href.startsWith(gate.origin), (route) => route.abort('blockedbyclient'));
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(e.effectiveDirective + ' ' + String(e.blockedURI).slice(0, 120) + ' ' + String(e.sample || '').slice(0, 80) + ' @' + document.querySelector('.composer-wrap')?.dataset.composerState));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => seen.errors.push(e.message));
  page.setDefaultTimeout(15000);
  await page.goto(gate.buildUrl);
  await page.getByRole('textbox', { name: 'Message', exact: true }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  return { context, page, seen };
}

const box = (page) => page.getByRole('textbox', { name: 'Message', exact: true });
// Evidence screenshots. Playwright's WebKit capture can insert its own inline <style>, which the review CSP
// (rightly) refuses; reports raised during a capture are kept separately as tooling, never hidden.
const toolingCsp = [];
async function shot(page, path) {
  const before = await page.evaluate(() => window.__cspViolations.length);
  await page.screenshot({ path, caret: 'initial' });
  await page.waitForTimeout(150); // violation reports are delivered asynchronously
  const during = await page.evaluate((n) => window.__cspViolations.splice(n), before);
  assert.ok(during.every((v) => /^style-src-elem inline\b/.test(v)), `only the capture's own style may be refused: ${during}`);
  toolingCsp.push(...during.map((v) => `${path}: ${v}`));
}
const settle = (page, ms = 350) => page.waitForTimeout(ms);
const stateOf = (page) => page.evaluate(() => document.querySelector('.composer-wrap')?.getAttribute('data-composer-state'));
const textareaInfo = (page) => page.evaluate(() => {
  const el = document.querySelector('#message-input');
  return { same: el === window.__cp02Input, value: el.value, start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection, focused: document.activeElement === el };
});
const geometry = (page) => page.evaluate(() => {
  const r = (el) => { const b = el?.getBoundingClientRect(); return b && { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height }; };
  const vv = window.visualViewport;
  return { form: r(document.querySelector('.composer')), wrap: r(document.querySelector('.composer-wrap')), banner: r(document.querySelector('.qa-banner')),
    viewport: { width: innerWidth, height: innerHeight, vvHeight: vv?.height ?? innerHeight }, overflow: document.documentElement.scrollWidth - innerWidth };
});
async function expand(page) {
  await page.getByRole('button', { name: 'Expand writing', exact: true }).click();
  await settle(page);
  assert.equal(await stateOf(page), 'expanded');
}
async function draftKeys(page) {
  return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mr.draft.')).map((k) => [k, localStorage.getItem(k)])));
}
/** Chromium only: a real touch sequence (touchstart/move/end or cancel) through the DevTools protocol. */
async function touchDrag(page, { from, dy, steps, stepMs, end = 'touchEnd' }) {
  const cdp = await page.context().newCDPSession(page);
  const point = (y) => [{ x: from.x, y, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(from.y) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(from.y + (dy * i) / steps) });
    await page.waitForTimeout(stepMs);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
  await cdp.detach();
}

try {
  for (const [width, height] of VIEWPORTS) {
    const phone = width < 900;
    const tag = `${width}x${height}`;
    const record = { viewport: tag, engine: engineName, checks: [] };
    const pass = (name, detail) => record.checks.push(detail === undefined ? name : { name, detail });
    const { context, page, seen } = await open(REVIEWERS.owner, { width, height });
    try {
      await page.evaluate(() => { window.__cp02Input = document.querySelector('#message-input'); });

      // Resting: one capsule. (Desktop focuses the message box on load, which is already "engaged".)
      await page.evaluate(() => document.activeElement?.blur());
      await settle(page);
      assert.equal(await stateOf(page), 'resting');
      assert.equal(await page.getByRole('button', { name: 'Expand writing', exact: true }).isVisible(), false, 'expand appears only while writing');
      await shot(page, join(out, `${tag}-1-resting.png`));
      pass('resting capsule');

      // Engaged: focus and text; then a backwards selection inside the draft.
      await box(page).click();
      assert.equal(await stateOf(page), 'engaged');
      await box(page).fill(DRAFT);
      await box(page).evaluate((el) => el.setSelectionRange(5, 12, 'backward'));
      await shot(page, join(out, `${tag}-2-engaged.png`));
      const before = await geometry(page);
      pass('engaged on focus/text');

      // Expanded: same element, value, selection and direction; focus stays in the message box.
      await expand(page);
      let t = await textareaInfo(page);
      assert.deepEqual(t, { same: true, value: DRAFT, start: 5, end: 12, direction: 'backward', focused: true });
      const sheet = page.getByRole('dialog', { name: /./ }).filter({ has: page.locator('#message-input') });
      assert.equal(await sheet.count(), 1, 'the expanded form is a labelled dialog');
      assert.match(await page.locator('.canvas-sheet-count').innerText(), /^\d+ words? · ~\d+(\.\d+)?[KM]? tokens$/);
      const g = await geometry(page);
      assert.ok(Math.abs(g.wrap.height - before.wrap.height) <= 1, `composer keeps its place in the page (${before.wrap.height} → ${g.wrap.height})`);
      assert.ok(g.form.top >= (g.banner?.bottom ?? 0) - 0.5, 'sheet starts below the review banner');
      assert.ok(g.form.bottom <= g.viewport.height + 0.5 && g.form.left >= 0 && g.form.right <= g.viewport.width + 0.5, 'sheet fits the viewport');
      assert.ok(g.overflow <= 0, 'no horizontal overflow');
      await shot(page, join(out, `${tag}-3-expanded.png`));
      pass('expanded keeps textarea/selection/direction/focus', { sheetTop: g.form.top, bannerBottom: g.banner?.bottom, sheetHeight: g.form.height });

      // Focus is contained in the sheet.
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => Boolean(document.activeElement?.closest('.composer'))), `Tab ${i + 1} stays in the sheet`);
      }
      await box(page).focus();
      pass('Tab stays in sheet');

      // Nested dialogs stack above it: Escape closes the picker / usage first, the sheet stays.
      await page.locator('.composer .model-button').click();
      const picker = page.getByRole('dialog', { name: 'Choose a model', exact: true });
      await picker.waitFor();
      await page.keyboard.press('Escape');
      await picker.waitFor({ state: 'hidden' });
      assert.equal(await stateOf(page), 'expanded', 'Escape in the picker closes only the picker');
      await page.locator('.composer .usage-chip').click();
      const usage = page.getByRole('dialog', { name: 'Usage', exact: true });
      await usage.waitFor();
      await page.keyboard.press('Escape');
      await usage.waitFor({ state: 'hidden' });
      assert.equal(await stateOf(page), 'expanded', 'Escape in usage closes only usage');
      assert.equal((await textareaInfo(page)).value, DRAFT);
      pass('nested picker/usage own Escape');

      // IME: an Escape that cancels a composition does not collapse the sheet.
      await box(page).focus();
      await box(page).evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: true })));
      await settle(page, 100);
      assert.equal(await stateOf(page), 'expanded', 'composing Escape keeps the sheet');
      pass('IME Escape ignored');

      // Typing in the sheet, then undo after collapsing: one native undo history.
      await box(page).evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
      await page.keyboard.type(' Plus');
      const typed = `${DRAFT} Plus`;
      assert.equal((await textareaInfo(page)).value, typed);
      await box(page).evaluate((el) => el.setSelectionRange(3, 8, 'backward'));
      await page.keyboard.press('Escape');
      await settle(page);
      assert.notEqual(await stateOf(page), 'expanded', 'Escape in the message box collapses');
      t = await textareaInfo(page);
      assert.deepEqual({ ...t, value: t.value === typed }, { same: true, value: true, start: 3, end: 8, direction: 'backward', focused: true }, 'collapse restores selection and focus');
      await box(page).evaluate((el) => el.setSelectionRange(el.value.length, el.value.length));
      // Native undo (granularity is the engine's): repeat until the text typed in the sheet is gone.
      let undone = typed, presses = 0;
      while (undone !== DRAFT && presses < ' Plus'.length) {
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z');
        undone = (await textareaInfo(page)).value;
        presses++;
      }
      record.undo = undone === DRAFT ? `restored in ${presses}` : undone === typed ? 'not undone' : 'partial';
      if (engineName === 'chromium') assert.equal(undone, DRAFT, 'undo spans expand/collapse');
      pass('undo after collapse', record.undo);
      await box(page).fill(DRAFT);

      // Done button + draft persistence (per account and chat).
      await expand(page);
      await page.getByRole('button', { name: 'Done, collapse writing', exact: true }).click();
      await settle(page);
      assert.equal(await stateOf(page), 'engaged');
      assert.deepEqual(Object.values(await draftKeys(page)), [DRAFT], 'one saved draft for this chat');
      const savedDraft = await draftKeys(page);
      const title = (await page.locator('.canvas-sheet-head strong').count()) ? '' : await page.locator('.topbar').innerText();
      await page.reload();
      await box(page).waitFor({ timeout: 20000 });
      await settle(page, 500);
      assert.deepEqual(await draftKeys(page), savedDraft, 'draft is still stored after reload');
      // The review opens a new chat after a reload; return to the chat the draft belongs to.
      if (phone) { await page.getByRole('button', { name: 'Open chats', exact: true }).first().click(); await settle(page, 500); }
      // With the Canvas tree the chat sits in its project folder ("Studio launch"), closed when another chat is open.
      const folder = page.locator('.sidebar .cv-project-row', { hasText: 'Studio launch' });
      if (await folder.count() && await folder.getAttribute('aria-expanded') === 'false') { await folder.click(); await settle(page); }
      await page.locator('.sidebar').getByText(/A launch worth remember/).first().click();
      await settle(page, 600);
      assert.ok(title.includes('A launch worth remember'), 'draft was written in the launch chat');
      assert.equal(await box(page).inputValue(), DRAFT, 'draft restored in its chat after reload');
      assert.notEqual(await stateOf(page), 'expanded', 'a reload starts collapsed');
      await page.evaluate(() => { window.__cp02Input = document.querySelector('#message-input'); });
      pass('Done + draft persistence');

      // Attachments: picked from inside the sheet, shown in it, kept on collapse.
      await box(page).click();
      await expand(page);
      await page.locator('.composer input[type=file][multiple]:not([accept="image/*"])').setInputFiles({ name: 'synthetic-notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Synthetic attachment only.') });
      const chip = page.locator('.composer .attachment:not(.loading)');
      await chip.first().waitFor();
      assert.equal(await page.locator('.composer[role=dialog] .attachment').count(), 1, 'attachment shown inside the sheet');
      assert.equal(await stateOf(page), 'expanded');
      await page.keyboard.press('Escape');
      await settle(page);
      assert.equal(await stateOf(page), 'engaged', 'an attachment keeps the composer engaged');
      assert.equal(await chip.count(), 1);
      await page.getByRole('button', { name: 'Remove synthetic-notes.txt', exact: true }).click();
      await settle(page, 500);
      pass('attachments in sheet');

      // Send from the sheet returns to the conversation; Stop stays reachable and works.
      await expand(page);
      await box(page).fill('[synthetic:slow] please write slowly');
      const repliesBefore = await page.locator('.msg.assistant').count();
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await settle(page, 200);
      assert.notEqual(await stateOf(page), 'expanded', 'Send collapses the sheet');
      await page.getByRole('button', { name: 'Stop', exact: true }).click();
      await settle(page, 1500);
      assert.equal(await page.locator('.msg.assistant').count(), repliesBefore + 1, 'Stop leaves one partial reply');
      assert.equal(await page.getByRole('button', { name: 'Stop', exact: true }).count(), 0);
      assert.equal(await box(page).inputValue(), '');
      pass('Send collapses; Stop works');

      // A different chat starts collapsed, and drafts stay per chat.
      await box(page).fill('Draft for the first chat');
      await expand(page);
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+O' : 'Control+Shift+O');
      await settle(page, 600);
      assert.notEqual(await stateOf(page), 'expanded', 'switching chats collapses the sheet');
      assert.equal(await box(page).inputValue(), '', 'the new chat has its own (empty) draft');
      assert.equal(await page.evaluate(() => document.querySelector('#message-input') === window.__cp02Input), true, 'still the same mounted textarea');
      pass('chat switch resets presentation, keeps per-chat drafts');

      // Incognito: the sheet works and nothing is stored.
      const keysBefore = await draftKeys(page);
      await page.getByRole('button', { name: 'Start incognito chat', exact: true }).click();
      await settle(page, 500);
      await box(page).click();
      await box(page).fill('Incognito words stay unsaved');
      await expand(page);
      await shot(page, join(out, `${tag}-4-incognito-expanded.png`));
      await page.keyboard.press('Escape');
      await settle(page);
      assert.deepEqual(await draftKeys(page), keysBefore, 'incognito drafts are never stored');
      await box(page).fill('');
      await page.getByRole('button', { name: 'End incognito chat', exact: true }).click();
      await settle(page, 500);
      pass('incognito');

      // Simulated keyboard (Linux engines have none): the sheet fits the visible area above it.
      if (phone) {
        await box(page).click();
        await box(page).fill(DRAFT);
        await expand(page);
        const vvh = Math.round(height * 0.55);
        await page.evaluate((h) => { const r = document.documentElement; r.classList.add('kb-open'); r.style.setProperty('--vv-h', `${h}px`); r.style.setProperty('--vv-top', '0px'); }, vvh);
        await settle(page);
        const k = await geometry(page);
        assert.ok(k.form.bottom <= vvh + 0.5, `sheet ends above the simulated keyboard (${k.form.bottom} ≤ ${vvh})`);
        assert.ok(k.form.top >= (k.banner?.bottom ?? 0) - 0.5, 'and below the banner');
        assert.ok(k.form.height >= 120, 'with room to write');
        await shot(page, join(out, `${tag}-5-expanded-keyboard.png`));
        await page.evaluate(() => { const r = document.documentElement; r.classList.remove('kb-open'); r.style.removeProperty('--vv-h'); r.style.removeProperty('--vv-top'); });
        pass('simulated keyboard', { visibleHeight: vvh, sheetBottom: k.form.bottom });

        // Touch drag on the header (Chromium touch emulation): a short slow drag springs back, an interrupted
        // drag is restored, a flick puts writing away and leaves the form untransformed.
        if (engineName === 'chromium') {
          const headBox = await page.locator('.canvas-sheet-head').boundingBox();
          const from = { x: headBox.x + headBox.width / 3, y: headBox.y + headBox.height / 2 };
          await touchDrag(page, { from, dy: 40, steps: 8, stepMs: 40 });
          await settle(page, 700);
          assert.equal(await stateOf(page), 'expanded', 'a short slow drag springs back');
          await touchDrag(page, { from, dy: 260, steps: 6, stepMs: 16, end: 'touchCancel' });
          await settle(page, 700);
          assert.equal(await stateOf(page), 'expanded', 'a cancelled drag restores the sheet');
          assert.equal(await page.locator('.composer').evaluate((f) => f.style.transform), '', 'and leaves it in place');
          await touchDrag(page, { from, dy: 320, steps: 6, stepMs: 12 });
          await settle(page, 900);
          assert.notEqual(await stateOf(page), 'expanded', 'a flick down puts writing away');
          assert.equal(await page.locator('.composer').evaluate((f) => f.style.transform), '', 'the collapsed form is not left translated');
          assert.equal(await box(page).inputValue(), DRAFT, 'and the draft is kept');
          pass('touch drag spring-back / cancel / dismiss');
        }
      }

      // (Read before axe, which injects its own styles.)
      const state = await page.evaluate(() => ({ csp: window.__cspViolations, blocked: window.__qaBlockedHosts || [] }));
      // Accessibility of the expanded sheet.
      if (await stateOf(page) !== 'expanded') { await box(page).click(); await expand(page); }
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      record.axe = axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
      assert.deepEqual(record.axe, [], `axe (expanded) at ${tag}`);
      await page.keyboard.press('Escape');
      pass('axe expanded');

      assert.deepEqual(seen.external, [], 'no request leaves the review origin');
      assert.deepEqual(state.csp, []);
      assert.deepEqual(state.blocked, []);
      assert.deepEqual(seen.errors, []);
      record.external = seen.external.length;
      record.errors = seen.errors.length;
    } finally {
      await context.close();
    }

    // Reviewer isolation: another reviewer's review starts empty and collapsed.
    {
      const other = await open(REVIEWERS.second, { width, height });
      assert.equal(await box(other.page).inputValue(), '');
      assert.notEqual(await stateOf(other.page), 'expanded');
      assert.deepEqual(Object.values(await draftKeys(other.page)).filter((v) => v.includes('exact draft')), []);
      await other.context.close();
      record.checks.push('second reviewer isolated');
    }

    // Reduced motion: the sheet and scrim appear without animation.
    {
      const rm = await open(REVIEWERS.owner, { width, height, reducedMotion: 'reduce' });
      await box(rm.page).click();
      await box(rm.page).fill('Reduced motion');
      await expand(rm.page);
      const anim = await rm.page.evaluate(() => [getComputedStyle(document.querySelector('.composer')).animationName, getComputedStyle(document.querySelector('.canvas-writing-scrim')).animationName]);
      assert.deepEqual(anim, ['none', 'none']);
      await rm.context.close();
      record.checks.push('reduced motion');
    }
    results.push(record);
    console.log(`PASS ${engineName} ${tag}: ${record.checks.length} checks, undo ${record.undo}`);
  }
} finally {
  writeFileSync(join(out, 'cp02-results.json'), JSON.stringify({ engine: engineName, commit: head, physicalDevice: false, screenshotToolingCsp: toolingCsp, results }, null, 2));
  await browser.close();
  await gate.close();
}
console.log(`CP02 Canvas composer contract passed in ${engineName} at ${VIEWPORTS.map((v) => v.join('x')).join(', ')}`);
