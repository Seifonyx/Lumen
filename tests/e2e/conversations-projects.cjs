// Real application, identical synthetic content before/after; no external services/inference.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process'), { createHash } = require('node:crypto');
const { chromium, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { profile, seed } = require('./helpers/preview-profile.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5191/';
const before = process.env.CONVERSATIONS_BEFORE === '1', engine = process.env.MR_WEBKIT ? 'webkit' : 'chromium';
const out = process.env.CONVERSATIONS_OUT || `tests/e2e/out/conversations-projects/${before ? 'before' : 'after'}/${engine}`;
const source = process.env.CONVERSATIONS_SOURCE_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const now = 1793000000000;
const projects = [
  { id: 'studio', name: 'Studio launch', description: 'A considered beginning for our next chapter.', instructions: 'Keep plans practical. Write with clarity.', color: 'indigo', files: [{ id: 'brief', kind: 'text', name: 'Creative brief.md', text: 'Synthetic project notes.', mime: 'text/plain', size: 24 }], createdAt: now - 9e8, updatedAt: now - 1000 },
  { id: 'reading', name: 'Reading room', description: 'Ideas worth returning to.', instructions: '', color: 'green', createdAt: now - 5e8, updatedAt: now - 7e7 },
  { id: 'research', name: 'Product research & a deliberately long project name', description: 'Listening, learning and making better decisions.', instructions: 'Use only synthetic research.', color: 'amber', createdAt: now - 6e8, updatedAt: now - 9e7 },
];
const chat = (id, title, extra = {}, age = 0) => ({ id, title, createdAt: now - 1e8, updatedAt: now - age, messages: [{ id: `${id}-q`, role: 'user', text: `Synthetic notes for ${title}`, createdAt: now - 1e8 }, { id: `${id}-a`, role: 'assistant', text: 'Keep the essentials in view. Give every detail a purpose.', status: 'done', createdAt: now - age }], ...extra });
const chats = [chat('origin', 'A quieter way to work'), chat('pinned', 'Ideas worth keeping', { pinned: true }, 6e7), chat('week', 'Planning the week ahead', {}, 5e7), chat('long', 'An intentionally long conversation title that should leave room for its actions', {}, 7e7), chat('archive', 'Archived field notes', { archived: true }, 9e7), ...['Launch checklist', 'The story we want to tell', 'A first look at the identity', 'Notes from the working session', 'A thoughtful welcome', 'A place for loose ideas', 'The next small step'].map((name, i) => chat(`studio-${i}`, name, { projectId: 'studio', pinned: i === 1 }, (i + 1) * 1e6))];
(async () => {
  fs.mkdirSync(out, { recursive: true }); const browser = await (engine === 'webkit' ? webkit : chromium).launch(); const results = [];
  try {
    for (const width of (process.env.CONVERSATIONS_WIDTHS || '320,390,430,1440').split(',').map(Number)) for (const theme of ['light', 'dark']) {
      const phone = width < 900, height = width === 320 ? 568 : width === 1440 ? 960 : width === 430 ? 932 : 844;
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: phone, colorScheme: theme, reducedMotion: 'reduce' });
      await ctx.addInitScript(() => { if (window.top === window && 'serviceWorker' in navigator) navigator.serviceWorker.register = () => Promise.reject(new Error('Disabled for synthetic QA')); });
      await profile(ctx, 'conversations-projects', theme, { projects });
      // Install last: even the profile's provider response mocks must never run in this presentation checkpoint.
      const inference = [];
      await ctx.route('**/*', r => {
        const u = new URL(r.request().url());
        if (/generateContent|chat\/completions|responses/.test(u.pathname)) inference.push(u.pathname);
        // Startup catalogue discovery gets a local fixture, never a provider call. WebKit reports
        // aborted catalogue fetches as page errors, which would obscure actual UI errors.
        if (u.hostname === 'generativelanguage.googleapis.com' && u.pathname.endsWith('/models') && r.request().method() === 'GET') return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] } });
        return u.origin === new URL(base).origin ? r.continue() : r.abort();
      });
      const page = await ctx.newPage(); page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(base); await page.locator('.composer textarea').waitFor();
      await seed(page, 'conversations-projects', chats); await page.reload(); await page.locator('.composer textarea').waitFor();
      const drawer = page.locator('aside.cv-nav');
      const openDrawer = async () => { if (phone && !await drawer.evaluate(el => el.classList.contains('open'))) await page.locator('.menu-btn:visible, .hub-nav[aria-label="Open sidebar"]:visible').first().click(); };
      await openDrawer(); await drawer.getByRole('button', { name: 'A quieter way to work', exact: true }).click();
      await page.locator('.composer textarea').fill('Keep my original draft exactly.');
      const shot = async name => { await page.evaluate(() => document.fonts.ready); if (!await page.locator('[role="menu"]:visible').count()) await page.mouse.move(width - 1, height - 1); await page.evaluate(() => { if (!document.activeElement?.closest('[role="menu"]')) document.activeElement?.blur(); }); await page.screenshot({ path: path.join(out, `${width}-${theme}-${name}.png`), animations: 'disabled' }); };
      const audit = async selector => { const a = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); assert.deepEqual(a.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []); };
      await openDrawer(); const folder = drawer.locator('.cv-project-row').filter({ hasText: 'Studio launch' });
      if (await folder.getAttribute('aria-expanded') !== 'true') await folder.click();
      await shot('tree');
      if (!before) {
        assert.equal(await folder.locator('.cv-folder-icon').count(), 1, 'projects have recognizable folder icons');
        assert.equal((await drawer.locator('.cv-brief').first().innerText()).trim(), 'Project overview', 'overview is compact and predictable');
        assert.equal(await drawer.locator('.cv-loose .chat-open').first().getAttribute('title'), 'Ideas worth keeping', 'pins remain first');
        await audit('aside.cv-nav');
        for (const el of await drawer.locator('.cv-project-row, .chat-open, .cv-new-here').all()) if (await el.isVisible()) {
          const b = await el.boundingBox(); if (phone) assert(b.height >= 44, 'phone tree targets stay44px');
        }
        await folder.focus();
        await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /tree-keys/.test(e.name)));
        await page.keyboard.press('ArrowLeft'); await page.waitForFunction(() => [...document.querySelectorAll('.cv-project-row')].find(e => e.textContent.includes('Studio launch'))?.getAttribute('aria-expanded') === 'false');
        await page.keyboard.press('ArrowRight'); await page.waitForFunction(() => [...document.querySelectorAll('.cv-project-row')].find(e => e.textContent.includes('Studio launch'))?.getAttribute('aria-expanded') === 'true');
        await drawer.getByRole('searchbox', { name: 'Search chats', exact: true }).fill('Archived field');
        await drawer.getByRole('button', { name: 'Archived field notes', exact: true }).waitFor();
        await drawer.getByText('Archived', { exact: true }).waitFor();
        await drawer.getByRole('button', { name: 'Clear search', exact: true }).click();
      }
      await drawer.getByRole('button', { name: 'All projects', exact: true }).click();
      await page.getByRole('button', { name: 'Open Studio launch', exact: true }).waitFor(); await shot('projects');
      if (!before) {
        const search = page.getByRole('searchbox', { name: 'Search projects', exact: true });
        await search.fill('not a project'); await page.getByText('No projects match “not a project”.', { exact: true }).waitFor();
        const clearSize = await page.getByRole('button', { name: 'Clear project search', exact: true }).boundingBox();
        if (phone) assert(clearSize.width >= 44 && clearSize.height >= 44, 'clear search has a44px phone target');
        assert(clearSize.x >= 0 && clearSize.x + clearSize.width <= width, 'clear search remains inside the viewport');
        const searchSize = await search.boundingBox(); assert(searchSize.x + searchSize.width <= clearSize.x, 'search input leaves room for the clear control');
        await page.getByRole('button', { name: 'Clear project search', exact: true }).click();
        await page.getByRole('combobox', { name: 'Sort projects', exact: true }).selectOption('name');
        await page.getByRole('status').filter({ hasText: '3 projects' }).waitFor();
        await audit('.hub-page'); assert(await page.locator('.hub-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
      }
      await page.getByRole('button', { name: 'Open Studio launch', exact: true }).click();
      await page.locator('.project-page').waitFor(); await shot('overview');
      if (!before) {
        await audit('.project-page');
        assert(await page.locator('.project-page').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        if (phone) { await page.locator('.project-context-toggle').click(); await shot('context'); await audit('.project-page'); }
        // Opening a project must not consume the previous general-chat draft or send a request.
        if (phone) await page.locator('.phone-navigation').getByRole('button', { name: 'Return to chat', exact: true }).click();
        else { await openDrawer(); await drawer.getByRole('button', { name: 'A quieter way to work', exact: true }).click(); }
        assert.equal(await page.locator('.composer textarea').inputValue(), 'Keep my original draft exactly.');
        await openDrawer(); const active = drawer.locator('.chat-row.active');
        await active.getByRole('button', { name: 'Chat options', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Rename', exact: true }).waitFor(); await shot('chat-menu');
        await page.keyboard.press('Escape'); assert(await active.getByRole('button', { name: 'Chat options', exact: true }).evaluate(el => el === document.activeElement));
        assert.deepEqual(inference, [], 'browsing sends no provider requests'); assert.deepEqual(errors, []);
      }
      results.push({ width, theme, passed: true }); console.log('PASS Conversations & Projects', before ? 'before' : 'after', engine, width, theme); await ctx.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ sourceSha: source, fixtureSha256: createHash('sha256').update(JSON.stringify({ projects, chats })).digest('hex'), engine, before, syntheticOnly: true, physicalIPhone: false, results }, null, 2)); }
})().catch(e => { console.error(e); process.exit(1); });
