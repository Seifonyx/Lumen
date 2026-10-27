// First approval gate only: one actual390px Light phone drawer. No other states or desktop.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { profile, seed } = require('./preview-profile.cjs');
const { execFileSync } = require('node:child_process');
const sourceSha = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const base = process.env.MR_TEST_URL || 'http://localhost:5192/';
const out = process.env.DRAWER_REFERENCE_OUT || 'tests/e2e/out/drawer-reference-approval';
const now = Date.now();
const projects = ['Fieldwork', 'Reading room', 'Personal', 'Ideas'].map((name, i) => ({ id: 'reference-project-' + i, name, description: 'Synthetic review workspace.', instructions: '', color: 'indigo', createdAt: now - 1e7, updatedAt: now - i * 1e6 }));
const chats = ['Notes from the first visit', 'Interview questions', 'A useful synthesis', 'Weekend reading'].map((title, i) => ({ id: 'reference-chat-' + i, title, pinned: i === 0, createdAt: now - 1e7, updatedAt: now - [120000, 5 * 3600000, 86400000, 3 * 86400000][i], messages: [{ id: 'message-' + i, role: 'user', text: 'Synthetic notes for visual review.', createdAt: now - 1e7 }] }));
chats.push({ id: 'reference-project-chat', title: 'Fieldwork planning', projectId: projects[0].id, createdAt: now - 1e7, updatedAt: now - 3600000, messages: [{ id: 'project-message', role: 'user', text: 'Synthetic project conversation.', createdAt: now - 3600000 }] });
(async () => {
  fs.mkdirSync(out, { recursive: true }); const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce', colorScheme: 'light' });
    await profile(context, 'reference-first-gate', 'light', { projects });
    const inference = [];
    await context.route('**/*', r => {
      const u = new URL(r.request().url());
      if (/generateContent|chat\/completions|responses/.test(u.pathname)) inference.push(u.pathname);
      if (u.hostname === 'generativelanguage.googleapis.com' && u.pathname.endsWith('/models') && r.request().method() === 'GET') return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
      return u.origin === new URL(base).origin ? r.continue() : r.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    await page.goto(base); await page.locator('.composer textarea').waitFor(); await seed(page, 'reference-first-gate', chats); await page.reload(); await page.locator('.composer textarea').waitFor();
    const nav = page.locator('aside.cv-nav'); const open = async () => { if (!await nav.evaluate(el => el.classList.contains('open'))) await page.getByRole('button', { name: 'Open chats', exact: true }).click(); };
    await open(); await nav.getByRole('button', { name: 'Notes from the first visit', exact: true }).click(); await page.locator('.composer textarea').fill('Keep my original draft.'); await open();
    assert.equal(await nav.locator('.cv-project-row').count(), 4); assert.equal(await nav.locator('.cv-loose .chat-row').count(), 4);
    assert.equal(await nav.locator('.chat-open[aria-current="page"]').count(), 1);
    const audit = await new AxeBuilder({ page }).include('aside.cv-nav').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
    const targets = await nav.locator('.cv-dest button, .cv-project-row, .cv-loose .chat-open, .cv-section-add, .cv-new-pill, .cv-account').evaluateAll(els => els.filter(el => !el.closest('[inert]')).map(el => ({ label: el.getAttribute('aria-label') || el.textContent, height: el.getBoundingClientRect().height })));
    assert.deepEqual(targets.filter(t => t.height < 44), [], 'all visible primary actions retain44px targets');
    const rows = await nav.locator('.cv-loose .chat-open').evaluateAll(els => els.map(el => ({ top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom })));
    assert(rows.every((row, i) => i === 0 || row.top >= rows[i - 1].bottom), 'conversation hit areas do not overlap');
    assert(await nav.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await page.evaluate(() => document.fonts.ready); await page.mouse.move(389, 843); await page.evaluate(() => document.activeElement?.blur());
    await page.screenshot({ path: path.join(out, '390-light-populated.png'), animations: 'disabled' });
    const active = nav.locator('.chat-row.active'); await active.getByRole('button', { name: 'Chat options', exact: true }).click(); await page.getByRole('menuitem', { name: 'Rename', exact: true }).waitFor(); await page.keyboard.press('Escape');
    assert(await active.getByRole('button', { name: 'Chat options', exact: true }).evaluate(el => el === document.activeElement));
    await nav.getByRole('button', { name: 'New chat', exact: true }).click(); await page.locator('.composer textarea').waitFor(); await open(); await nav.getByRole('button', { name: 'Notes from the first visit', exact: true }).click();
    assert.equal(await page.locator('.composer textarea').inputValue(), 'Keep my original draft.'); assert.deepEqual(inference, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ sourceSha, baseSha: '828a05c79debbdeba606e441bf7bbc57f811ca38', viewport: { width: 390, height: 844 }, theme: 'light', populated: true, syntheticOnly: true, physicalIPhone: false, axeViolations: 0, canonicalMenuAndDraftChecks: true, duplicateChats: false, nonOverlappingRows: true, targets }, null, 2));
    console.log('PASS first reference gate:390px Light,4 projects/4 general chats, axe,44px targets, menu focus, draft return, no inference.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
