// Design review screenshots of Projects (not a test): node tests/e2e/helpers/project-shots.cjs <outDir> [url]
// BROWSER=webkit runs the same screens in Safari's engine.
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2];
const url = process.argv[3] || 'http://localhost:5191/';
const now = Date.now();
const projects = [
  { id: 'p1', name: 'Hospital reports', description: 'Monthly staffing and quality reports for the board.', instructions: 'Use hospital terms. Keep reports short and formal.', color: 'indigo', files: [{ id: 'f1', kind: 'text', name: 'Staffing policy.pdf', mime: 'application/pdf', size: 52000, text: 'Policy text' }, { id: 'f2', kind: 'text', name: 'Q3 numbers.xlsx', mime: 'text/plain', size: 8000, text: 'numbers' }], createdAt: now - 9e8, updatedAt: now - 1e6 },
  { id: 'p2', name: 'Arabic study', description: '', instructions: '', color: 'green', createdAt: now - 5e8, updatedAt: now - 5e8 },
];
const chats = [
  { id: 'c1', title: 'Q3 staffing summary', projectId: 'p1', createdAt: now - 3e6, updatedAt: now - 1e5, messages: [{ id: 'm1', role: 'user', text: 'Summarize Q3', createdAt: now - 3e6 }, { id: 'm2', role: 'assistant', text: 'Here is the summary.', status: 'done', model: 'gemini:gemini-flash-latest', createdAt: now - 2e6 }] },
  { id: 'c2', title: 'Board letter draft', projectId: 'p1', createdAt: now - 9e7, updatedAt: now - 9e7, messages: [{ id: 'x', role: 'user', text: 'hi', createdAt: now - 9e7 }] },
  { id: 'c3', title: 'Verb conjugation practice', projectId: 'p2', createdAt: now - 2e8, updatedAt: now - 2e8, messages: [{ id: 'y', role: 'user', text: 'hi', createdAt: now - 2e8 }] },
  { id: 'c4', title: 'Fix login on Safari', createdAt: now - 4e8, updatedAt: now - 4e8, messages: [{ id: 'z', role: 'user', text: 'hi', createdAt: now - 4e8 }] },
];
(async () => {
  const browser = await engine.launch();
  for (const theme of ['light', 'dark']) for (const [w, h] of [[1280, 820], [390, 844]]) {
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    await profile(ctx, 'shots-projects', theme);
    await ctx.addInitScript((projects) => {
      if (window.top !== window) return;
      for (const key of ['mr.settings', 'mr.account.shots-projects']) {
        const v = JSON.parse(localStorage.getItem(key) || '{}');
        if (key === 'mr.settings') v.projects = projects; else v.settings = { ...(v.settings || {}), projects };
        localStorage.setItem(key, JSON.stringify(v));
      }
    }, projects);
    const page = await ctx.newPage();
    // Sync is blocked on purpose here; WebKit reports those blocked requests as page errors.
    page.on('pageerror', (e) => { if (!/firestore\.googleapis\.com/.test(e.message)) console.log('pageerror', e.message); });
    await page.goto(url);
    await page.waitForSelector('.composer textarea');
    await seed(page, 'shots-projects', chats);
    await page.reload();
    await page.waitForSelector('.composer textarea');
    const shot = async (n) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${w}-${theme}-${n}.png`) }); };
    if (phone) await page.click('.menu-btn');
    await shot('p1-sidebar');
    await page.locator('.sidebar').getByText('Hospital reports', { exact: true }).first().click();
    await page.waitForTimeout(500);
    await shot('p2-workspace');
    await page.evaluate(() => document.querySelector('.project-page')?.scrollBy(0, 600));
    await shot('p3-workspace-scrolled');
    const settingsBtn = page.locator('.project-edit-btn');
    if (await settingsBtn.count()) { await settingsBtn.click().catch(() => {}); await shot('p4-manager'); }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
