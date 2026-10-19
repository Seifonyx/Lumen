// Design check (not a test): finds text that spills out of its own box or out of the button, pill or card around it.
// node tests/e2e/helpers/textfit.cjs [url]
// BROWSER=webkit runs the same screens in Safari's engine.
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const { profile, seed } = require('./preview-profile.cjs');
const url = process.argv[2] || 'http://localhost:5191/';
const now = Date.now();
const chats = [{ id: 'c1', title: 'Quarterly staffing summary for the hospital board and nursing leads', createdAt: now - 3e6, updatedAt: now - 1e5, messages: [
  { id: 'm1', role: 'user', text: 'Summarize Q3.', createdAt: now - 3e6 },
  { id: 'm2', role: 'assistant', model: 'gemini:gemini-flash-latest', route: 'quick reply', status: 'done', createdAt: now - 2.9e6, text: 'Overtime rose **18%**.' }] }];
const BOXES = 'button, .btn, [class*="pill"], [class*="chip"], .status, .badge, .settings-card, .setting-row, .modal, .menu, .popover, .project-card, .library-card, .usage-stat, .composer, .segmented';
function check(BOXES) {
  const out = [];
  const name = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('svg, .katex, .cm-editor, pre, table, .sheet-preview, .deck-preview, [aria-hidden="true"], .sidebar:not(.open) .sidebar-scroll')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    { const er = el.getBoundingClientRect(); if (er.width <= 2 || er.height <= 2 || cs.position === 'absolute' && cs.clip !== 'auto') continue; }
    const range = document.createRange(); range.selectNodeContents(n);
    const t = range.getBoundingClientRect();
    if (!t.width || !t.height) continue;
    // Walk up to the boxes that should contain this text; ellipsis/clip boxes are intentional.
    for (let a = el; a && a !== document.body; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.textOverflow === 'ellipsis' || ['hidden', 'clip'].includes(s.overflowX) && a !== el) break;
      if (['auto', 'scroll'].includes(s.overflowX) || ['auto', 'scroll'].includes(s.overflowY)) break;
      if (a === el || a.matches(BOXES)) {
        const r = a.getBoundingClientRect();
        if (!r.width) continue;
        const over = Math.max(r.left - t.left, t.right - r.right, a === el ? 0 : r.top - t.top, a === el ? 0 : t.bottom - r.bottom);
        if (over > 2) { out.push(`${name(a)} ← "${n.textContent.trim().slice(0, 40)}" spills ${Math.round(over)}px`); break; }
      }
      if (a.matches(BOXES)) break;
    }
  }
  return [...new Set(out)];
}
(async () => {
  const browser = await engine.launch();
  const all = [];
  for (const [w, h] of [[1280, 820], [390, 844], [320, 640]]) for (const big of [false, true]) {
    const theme = 'light';
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    await profile(ctx, 'textfit', theme);
    if (big) await ctx.addInitScript(() => { const s = JSON.parse(localStorage.getItem('mr.settings') || '{}'); s.fontSize = 'large'; localStorage.setItem('mr.settings', JSON.stringify(s)); const a = JSON.parse(localStorage.getItem('mr.account.preview-textfit') || '{}'); a.settings = { ...(a.settings || {}), fontSize: 'large' }; localStorage.setItem('mr.account.preview-textfit', JSON.stringify(a)); localStorage.setItem('mr.preview_user', JSON.stringify({ uid: 'preview-textfit', email: 'a.very.long.address.for.testing@hospital-example.invalid', displayName: 'シSeifシ Gamal Abdelrahman' })); });
    const page = await ctx.newPage();
    await page.goto(url); await page.waitForSelector('.composer textarea');
    await seed(page, 'textfit', chats); await page.reload(); await page.waitForSelector('.composer textarea');
    const run = async (label) => { await page.waitForTimeout(250); for (const p of await page.evaluate(check, BOXES)) all.push(`${w}${big ? ' L' : ''} ${label}: ${p}`); };
    await run('empty chat');
    if (phone) { await page.click('.menu-btn'); await run('sidebar'); }
    await page.locator('.chat-row').first().click(); await run('chat');
    await page.locator('.composer .model-button').first().click().catch(() => {}); await run('model picker'); await page.keyboard.press('Escape');
    if (phone) await page.click('.menu-btn');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    for (const tab of ['Assistants', 'Prompts', 'Tools', 'Tasks', 'Knowledge']) { await page.getByRole('tab', { name: tab }).click(); await run(`library ${tab}`); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    if (phone) await page.click('.menu-btn');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    for (const tab of ['General', 'API keys', 'Connectors', 'Models', 'Usage', 'Personalization', 'Memory', 'Privacy & data']) {
      if (await page.locator('.settings-back').isVisible()) await page.locator('.settings-back').click();
      await page.locator('.settings-tabs .tab-label').getByText(tab, { exact: true }).click();
      await page.evaluate(() => document.querySelectorAll('.settings-panel details').forEach((d) => { d.open = true; }));
      if (tab === 'Models') for (const sub of ['Browse models', 'Layouts', 'Your models']) { await page.getByRole('tab', { name: sub }).click().catch(() => {}); await run(`settings Models/${sub}`); }
      else await run(`settings ${tab}`);
    }
    await ctx.close();
  }
  await browser.close();
  console.log(all.length ? all.join('\n') : 'no spills');
})().catch((e) => { console.error(e); process.exit(1); });
