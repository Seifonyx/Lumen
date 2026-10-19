// Design review screenshots of the secondary screens (not a test): node tests/e2e/helpers/more-shots.cjs <outDir> [url] [light|dark] [width]
// BROWSER=webkit runs the same screens in Safari's engine.
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2];
const url = process.argv[3] || 'http://localhost:5191/';
const themes = process.argv[4] ? [process.argv[4]] : ['light', 'dark'];
const widths = process.argv[5] ? [Number(process.argv[5])] : [1280, 390];
const now = Date.now();
const chats = [
  { id: 'doc', title: 'Board report draft', createdAt: now - 4e6, updatedAt: now - 2e5, messages: [{ id: 'a', role: 'user', text: 'Draft the board report.', createdAt: now - 4e6 }, { id: 'b', role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', text: 'Here is a first draft in the canvas.', createdAt: now - 3.9e6 }],
    documents: [{ id: 'd1', name: 'Board report.md', content: '# Q3 staffing report\n\nOvertime rose **18%** while missed shifts fell slightly.\n\n## Recommendations\n\n1. Add two night-shift seniors in ER.\n2. Cap consecutive shifts at three.\n', updatedAt: now - 2e5 }] },
  { id: 'code', title: 'Fix login on Safari', createdAt: now - 9e6, updatedAt: now - 5e5, repo: { owner: 'demo', repo: 'app', branch: 'main', defaultBranch: 'main' }, messages: [{ id: 'c', role: 'user', text: 'Why does login fail on Safari?', createdAt: now - 9e6 }] },
];
(async () => {
  const browser = await engine.launch();
  for (const theme of themes) for (const w of widths) {
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 820 }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    await profile(ctx, 'more-shots', theme);
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => r.request().url().includes('/models?') ? r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] }] } }) : r.fallback());
    await ctx.addInitScript(() => { for (const k of ['mr.settings', 'mr.account.preview-more-shots']) { const v = JSON.parse(localStorage.getItem(k) || '{}'); const s = k === 'mr.settings' ? v : (v.settings ||= {}); s.enabledModels = ['gemini:gemini-flash-latest', 'gemini:gemini-2.5-pro']; localStorage.setItem(k, JSON.stringify(v)); } });
    const page = await ctx.newPage();
    // Sync is blocked on purpose here; WebKit reports those blocked requests as page errors.
    page.on('pageerror', (e) => { if (!/firestore\.googleapis\.com/.test(e.message)) console.log('pageerror', e.message); });
    await page.goto(url); await page.waitForSelector('.composer textarea');
    await seed(page, 'more-shots', chats); await page.reload(); await page.waitForSelector('.composer textarea');
    const shot = async (n) => { await page.waitForTimeout(400); await page.screenshot({ path: path.join(out, `${w}-${theme}-${n}.png`) }); };
    const step = async (n, fn) => { try { await fn(); await shot(n); } catch (e) { console.log(`${w}-${theme} ${n}: ${e.message.split('\n')[0]}`); } await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(200); };
    const menu = async () => { if (phone && !(await page.locator('.sidebar.open').count())) await page.click('.menu-btn'); };
    await step('a-library-prompts', async () => { await menu(); await page.getByRole('button', { name: 'Library', exact: true }).click(); await page.getByRole('tab', { name: 'Prompts' }).click(); });
    await step('b-library-tools', async () => { await menu(); await page.getByRole('button', { name: 'Library', exact: true }).click(); await page.getByRole('tab', { name: 'Tools' }).click(); });
    await step('c-library-tasks', async () => { await menu(); await page.getByRole('button', { name: 'Library', exact: true }).click(); await page.getByRole('tab', { name: 'Tasks' }).click(); });
    await step('d-library-knowledge', async () => { await menu(); await page.getByRole('button', { name: 'Library', exact: true }).click(); await page.getByRole('tab', { name: 'Knowledge' }).click(); });
    await step('e-documents', async () => { await menu(); await page.getByRole('button', { name: 'Documents', exact: true }).click(); });
    await step('f-palette', async () => { await page.keyboard.press('Control+k'); await page.waitForSelector('.command-search input'); });
    // Compare needs a typed message and two available models; it's covered by tests/e2e/layout.cjs instead.
    await step('h-canvas', async () => { await menu(); await page.locator('.chat-row').filter({ hasText: 'Board report draft' }).click(); await page.waitForTimeout(300); await page.locator('[aria-label="Open canvas"]').click(); await page.waitForSelector('.canvas, .canvas-panel'); });
    await page.reload(); await page.waitForSelector('.composer textarea');
    await step('i-repo', async () => { await menu(); await page.locator('.chat-row').filter({ hasText: 'Fix login on Safari' }).click(); await page.waitForTimeout(300); await page.getByRole('button', { name: 'Show repository' }).click(); await page.waitForTimeout(800); });
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
