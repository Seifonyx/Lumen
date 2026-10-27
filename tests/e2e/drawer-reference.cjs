// Approved drawer direction: actual builds, same fixtures before/after, no live accounts/inference.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process'), { createHash } = require('node:crypto');
const { chromium, webkit } = require('playwright'), AxeBuilder = require('@axe-core/playwright').default;
const { profile, seed } = require('./helpers/preview-profile.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5190/';
const before = process.env.DRAWER_BEFORE === '1', engine = process.env.MR_WEBKIT ? 'webkit' : 'chromium';
const sourceSha = process.env.DRAWER_SOURCE_SHA || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const out = process.env.DRAWER_OUT || `tests/e2e/out/drawer-reference/${before ? 'before' : 'after'}/${engine}`;
const now = 1793090000000;
const projects = ['Fieldwork', 'Reading room', 'Personal', 'Ideas and a deliberately long project name'].map((name, i) => ({ id: 'project-' + i, name, description: 'Synthetic review workspace.', instructions: i === 0 ? 'Keep evidence close to the question.' : '', createdAt: now - 1e8, updatedAt: now - i * 1e6, color: 'indigo' }));
const makeChat = (id, title, extra = {}, age = 0) => ({ id, title, createdAt: now - 1e8, updatedAt: now - age, messages: [{ id: id + '-question', role: 'user', text: 'Synthetic review notes.', createdAt: now - 1e8 }], ...extra });
const fixtures = {};
for (const state of ['empty', 'populated', 'dense', 'expanded']) fixtures[state] = {
  projects: state === 'empty' ? [] : projects,
  chats: [makeChat('origin', 'Notes from the first visit', { pinned: state !== 'empty' }, 120000), makeChat('reading', 'Weekend reading', {}, 4e6), ...(state === 'empty' ? [] : [makeChat('archived', 'Archived field notes', { archived: true }, 9e7), ...Array.from({ length: state === 'dense' ? 28 : 2 }, (_, i) => makeChat('loose-' + i, ['Interview questions', 'A useful synthesis', 'A long conversation title that must leave room for pins, drafts and actions'][i % 3] + (i > 2 ? ' ' + (i + 1) : ''), {}, (i + 1) * 5e6)), ...Array.from({ length: state === 'dense' ? 12 : 3 }, (_, i) => makeChat('field-' + i, ['Planning the first visit', 'What we learned', 'A very long fieldwork conversation title for the narrowest phone'][i % 3] + (i > 2 ? ' ' + (i + 1) : ''), { projectId: projects[0].id, pinned: i === 1 }, (i + 1) * 9000))])],
};
(async () => {
  fs.mkdirSync(out, { recursive: true }); const browser = await (engine === 'webkit' ? webkit : chromium).launch(); const results = [];
  try {
    for (const width of (process.env.DRAWER_WIDTHS || '320,390,430,1440').split(',').map(Number)) for (const theme of ['light', 'dark']) for (const state of (process.env.DRAWER_STATES || 'empty,populated,dense,expanded').split(',')) {
      const phone = width < 900, height = width === 320 ? 568 : width === 1440 ? 960 : width === 430 ? 932 : 844;
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: phone, colorScheme: theme, reducedMotion: 'reduce' });
      const uid = 'drawer-approved-' + state; await profile(ctx, uid, theme, { projects: fixtures[state].projects });
      await ctx.addInitScript(() => { if (window.top === window && 'serviceWorker' in navigator) navigator.serviceWorker.register = () => Promise.reject(new Error('Disabled for synthetic QA')); });
      const inference = [], errors = [];
      await ctx.route('**/*', r => {
        const u = new URL(r.request().url());
        if (/generateContent|chat\/completions|responses/.test(u.pathname)) inference.push(u.pathname);
        if (u.hostname === 'generativelanguage.googleapis.com' && u.pathname.endsWith('/models') && r.request().method() === 'GET') return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
        return u.origin === new URL(base).origin ? r.continue() : r.abort();
      });
      const page = await ctx.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
      await page.goto(base); await page.locator('.composer textarea').waitFor();
      if (!await page.locator('[data-lumen-canvas-shell]').count()) { console.log('Approved drawer: not applicable to ordinary presentation'); await ctx.close(); return; }
      await seed(page, uid, fixtures[state].chats); await page.reload(); await page.locator('.composer textarea').waitFor();
      const nav = page.locator('aside.cv-nav');
      const open = async () => { if (phone && !await nav.evaluate(el => el.classList.contains('open'))) await page.getByRole('button', { name: 'Open chats', exact: true }).click(); };
      await open(); await nav.getByRole('button', { name: 'Notes from the first visit', exact: true }).click(); await page.locator('.composer textarea').fill('Keep the approved drawer draft.'); await open();
      if (state === 'expanded') { await nav.locator('.cv-project-row').filter({ hasText: 'Fieldwork' }).click(); await nav.getByRole('button', { name: 'Planning the first visit', exact: true }).click(); await open(); }
      const shot = async suffix => { await page.evaluate(() => document.fonts.ready); if (!await page.locator('[role="menu"]:visible').count()) { await page.mouse.move(width - 1, height - 1); await page.evaluate(() => document.activeElement?.blur()); } await page.screenshot({ path: path.join(out, `${width}-${theme}-${state}${suffix ? '-' + suffix : ''}.png`), animations: 'disabled' }); };
      const audit = async () => { const a = await new AxeBuilder({ page }).include('aside.cv-nav').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert.deepEqual(a.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []); };
      const geometry = async () => {
        assert(await nav.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'drawer stays horizontally contained');
        const rects = await nav.locator('.cv-chats').evaluateAll(lists => lists.flatMap(list => { const rows = [...list.querySelectorAll(':scope > .chat-row .chat-open')].filter(el => !el.closest('[inert]')); return rows.map((el, i) => ({ title: el.title, height: el.getBoundingClientRect().height, overlap: i > 0 && el.getBoundingClientRect().top < rows[i - 1].getBoundingClientRect().bottom - .5 })); }));
        assert.deepEqual(rects.filter(r => r.overlap || r.height < (phone ? 44 : 36)), [], 'rows retain distinct hit areas');
        const titles = await nav.locator('.chat-open').evaluateAll(els => els.filter(el => !el.closest('[inert]')).map(el => el.getAttribute('title'))); assert.equal(new Set(titles).size, titles.length, 'a chat is not duplicated in visible sections');
        if (phone) { const targets = await nav.locator('.cv-dest button, .cv-project-row, .cv-section-add, .cv-new-pill, .cv-account, .cv-ask, .cv-more, .cv-new-here, .cv-empty, .cv-brief').evaluateAll(els => els.filter(el => !el.closest('[inert]')).map(el => ({ label: el.getAttribute('aria-label') || el.textContent, height: el.getBoundingClientRect().height }))); assert.deepEqual(targets.filter(t => t.height < 44), [], 'phone controls retain44px targets'); }
      };
      await nav.locator('.cv-tree').evaluate(el => el.scrollTop = 0);
      await shot('');
      if (!before) {
        assert(await nav.locator('.cv-chat-detail').count() > 0, 'the approved two-line chat treatment is present on phone and desktop');
        if (state === 'empty') { assert.equal(await nav.getByRole('button', { name: 'All projects', exact: true }).count(), 1, 'the Projects destination remains available in an empty workspace'); assert.equal(await nav.getByRole('button', { name: 'New project', exact: true }).count(), 1); assert.equal(await nav.getByText('Group related chats, files and instructions in a project', { exact: true }).count(), 0, 'empty Projects stays compact'); }
        await geometry(); await audit();
        const current = nav.locator('.chat-row.active'); await current.scrollIntoViewIfNeeded();
        const description = async button => button.evaluate(el => (el.getAttribute('aria-describedby') || '').split(' ').map(id => document.getElementById(id)?.textContent || '').join(' '));
        assert((await description(current.locator('.chat-open'))).includes(await current.locator('.cv-chat-detail').innerText()), 'spoken metadata is retained alongside pin/draft descriptions');
        if (state === 'populated') assert((await description(current.locator('.chat-open'))).includes('Pinned'));

        if (state === 'populated') {
          const hoverRow = nav.locator('.cv-loose .chat-row:not(.active)').first(); await hoverRow.locator('.chat-open').hover(); await audit();
          await page.screenshot({ path: path.join(out, `${width}-${theme}-${state}-hover.png`), animations: 'disabled' });
          await current.locator('.chat-open').focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
          assert(await current.locator('.chat-open').evaluate(el => el === document.activeElement), 'real Tab navigation reaches the current chat'); assert.notEqual(await current.locator('.chat-open').evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'keyboard focus remains visible');
          await page.screenshot({ path: path.join(out, `${width}-${theme}-${state}-focus.png`), animations: 'disabled' });
          await page.emulateMedia({ reducedMotion: 'no-preference' });
          await current.getByRole('button', { name: 'Chat options', exact: true }).click(); await page.getByRole('menuitem', { name: 'Rename', exact: true }).waitFor();
          const menu = page.getByRole('menu', { name: 'Chat options', exact: true });
          await menu.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))));
          const menuFits = () => menu.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; });
          assert(await menuFits(), 'the whole conversation menu escapes the tree and fits the viewport');
          if (phone) assert(await menu.getByRole('menuitem').evaluateAll(items => items.every(el => el.getBoundingClientRect().height >= 44)), 'phone menu actions have44px touch targets');
          await shot('menu');
          await menu.getByRole('menuitem', { name: 'Move to project', exact: true }).click(); await page.getByRole('menuitem', { name: 'Fieldwork', exact: true }).waitFor();
          assert(await menuFits(), 'expanded project choices stay bounded');
          await menu.focus(); await page.keyboard.press('End'); assert(await menu.getByRole('menuitem', { name: 'Delete', exact: true }).evaluate(el => el === document.activeElement), 'the final action stays keyboard reachable');
          await page.keyboard.press('Escape');
          await current.getByRole('button', { name: 'Chat options', exact: true }).press('ArrowDown');
          assert(await menu.getByRole('menuitem', { name: 'Rename', exact: true }).evaluate(el => el === document.activeElement), 'rapid keyboard reopening targets the live menu rather than its fading copy');
          await page.keyboard.press('Escape');
          const selectedId = await current.getAttribute('data-flip'), inactiveOptions = hoverRow.getByRole('button', { name: 'Chat options', exact: true });
          await inactiveOptions.focus(); await inactiveOptions.click(); await menu.getByRole('menuitem', { name: 'Rename', exact: true }).waitFor();
          assert.equal(await nav.locator('.chat-row.active').getAttribute('data-flip'), selectedId, 'an inactive chat menu does not select that conversation');
          await page.keyboard.press('Escape'); await page.emulateMedia({ reducedMotion: 'reduce' });
          assert(await inactiveOptions.evaluate(el => el === document.activeElement));
          if (!phone) { await nav.getByRole('button', { name: 'Collapse sidebar', exact: true }).click(); const rail = page.getByRole('navigation', { name: 'Navigation', exact: true }); await rail.waitFor(); assert.equal(await rail.getByRole('button').count(), 8); await page.screenshot({ path: path.join(out, `${width}-${theme}-collapsed.png`), animations: 'disabled' }); await rail.getByRole('button', { name: 'Expand sidebar', exact: true }).click(); await nav.waitFor(); }
        }
        if (state !== 'empty') {
          const folder = nav.locator('.cv-project-row').filter({ hasText: 'Fieldwork' }); await folder.focus(); await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /tree-keys/.test(e.name)));
          if (await folder.getAttribute('aria-expanded') === 'true') { await page.keyboard.press('ArrowLeft'); await page.waitForFunction(() => [...document.querySelectorAll('.cv-project-row')].find(el => el.textContent.includes('Fieldwork'))?.getAttribute('aria-expanded') === 'false'); }
          await page.keyboard.press('ArrowRight'); await page.waitForFunction(() => [...document.querySelectorAll('.cv-project-row')].find(el => el.textContent.includes('Fieldwork'))?.getAttribute('aria-expanded') === 'true');
          await nav.getByRole('searchbox', { name: 'Search chats', exact: true }).fill('Archived field'); await nav.getByRole('button', { name: 'Archived field notes', exact: true }).waitFor(); await geometry(); if (phone) { await nav.evaluate(el => el.closest('.app').style.setProperty('--fs', '24px')); const ask = nav.locator('.cv-ask'); assert(Number(await ask.evaluate(el => getComputedStyle(el).fontSize.replace('px',''))) >= 22, 'search action follows text size'); await geometry(); await nav.evaluate(el => el.closest('.app').style.removeProperty('--fs')); } await nav.getByRole('button', { name: 'Clear search', exact: true }).click();
        }
        if (state === 'dense') { await nav.locator('.cv-tree').evaluate(el => el.scrollTop = el.scrollHeight); await shot('scrolled'); await geometry(); }
        if (width === 430 && theme === 'light' && state === 'dense') { await nav.evaluate(el => el.closest('.app').style.setProperty('--fs', '20px')); await geometry(); await audit(); await shot('large-text'); await nav.evaluate(el => el.closest('.app').style.removeProperty('--fs')); }
        if (width === 390 && theme === 'dark' && state === 'populated') { await page.emulateMedia({ forcedColors: 'active' }); await shot('forced-colors'); await page.emulateMedia({ forcedColors: 'none' }); }
        await nav.getByRole('button', { name: 'New chat', exact: true }).click(); await page.locator('.composer textarea').waitFor(); await open(); const origin = nav.getByRole('button', { name: 'Notes from the first visit', exact: true }); assert((await description(origin)).includes('Unsent draft')); assert((await description(origin)).includes(await origin.locator('.cv-chat-detail').innerText())); await origin.click(); assert.equal(await page.locator('.composer textarea').inputValue(), 'Keep the approved drawer draft.');
        assert.deepEqual(inference, []); assert.deepEqual(errors, []);
      }
      results.push({ width, height, theme, state, passed: true }); console.log('PASS approved drawer', before ? 'before' : 'after', engine, width, theme, state); await ctx.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ sourceSha, fixtureSha256: createHash('sha256').update(JSON.stringify(fixtures)).digest('hex'), engine, before, syntheticOnly: true, physicalIPhone: false, results }, null, 2)); }
})().catch(e => { console.error(e); process.exit(1); });
