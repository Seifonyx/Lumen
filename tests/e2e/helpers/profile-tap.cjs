// Profiles one interaction with the long chat open (CPU 4×) and prints where the time went, by function.
// Usage: node tests/e2e/helpers/profile-tap.cjs <scenario> [url]   scenario: picker | plus | usage | newchat | open
const { chromium } = require('playwright');
const { profile, seed } = require('./preview-profile.cjs');
const which = process.argv[2] || 'picker', url = process.argv[3] || 'http://localhost:5191/';
const now = Date.now();
const long = Array.from({ length: 40 }, (_, i) => [
  { id: `u${i}`, role: 'user', text: `Question ${i}: how do I organise a weekly team meeting?`, createdAt: now - 9e6 + i * 1000 },
  { id: `a${i}`, role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', createdAt: now - 9e6 + i * 1000 + 500, text: `## Answer ${i}\n\nKeep it to **30 minutes**.\n\n| Step | Who |\n|---|---|\n| Agenda | Lead |\n\n\`\`\`js\nconst minutes = 30;\n\`\`\`` },
]).flat();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await profile(ctx, 'prof', 'light');
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector('.composer textarea');
  await seed(page, 'prof', [{ id: 'long', title: 'Weekly team meetings', createdAt: now, updatedAt: now, model: 'gemini:gemini-flash-latest', messages: long }]);
  await page.reload();
  await page.waitForSelector('.composer textarea');
  const cdp = await ctx.newCDPSession(page);
  if (which !== 'open') { await page.click('.menu-btn'); await page.click('text=Weekly team meetings'); await page.locator('.msg.assistant').last().waitFor(); await page.waitForTimeout(800); }
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Profiler.start');
  if (which === 'picker') { await page.click('.composer .model-button'); await page.locator('.models-pop').waitFor(); }
  if (which === 'plus') { await page.getByRole('button', { name: /^Add (?:photos, )?files or a repository$/ }).click(); await page.locator('.attach-menu').waitFor(); }
  if (which === 'usage') { await page.click('.usage-chip'); await page.locator('.usage-pop').waitFor(); }
  if (which === 'newchat') { await page.click('.menu-btn'); await page.click('.sidebar .new-chat'); }
  if (which === 'open') { await page.click('.menu-btn'); await page.click('text=Weekly team meetings'); await page.locator('.msg.assistant').last().waitFor(); }
  await page.waitForTimeout(600);
  const { profile: p } = await cdp.send('Profiler.stop');
  // Self time per function, then inclusive time for named app functions.
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const dt = p.timeDeltas; let i = 0;
  for (const s of p.samples) { const n = byId.get(s); const key = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(key, (self.get(key) || 0) + (dt[i++] || 0)); }
  const top = [...self.entries()].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)')).sort((a, b) => b[1] - a[1]).slice(0, 18);
  console.log(`${which}: total sampled ${(dt.reduce((a, b) => a + b, 0) / 1000).toFixed(0)} ms`);
  for (const [k, v] of top) console.log(`${(v / 1000).toFixed(1).padStart(7)} ms  ${k}`);
  // Which React components rendered (by inclusive time of functions whose names start with a capital letter).
  const parent = new Map(); p.nodes.forEach((n) => (n.children || []).forEach((c) => parent.set(c, n.id)));
  const incl = new Map(); i = 0;
  for (const s of p.samples) { const seen = new Set(); let id = s; while (id) { const n = byId.get(id); const name = n.callFrame.functionName; if (/^[A-Z][A-Za-z]+$/.test(name) && !seen.has(name)) { seen.add(name); incl.set(name, (incl.get(name) || 0) + (dt[i] || 0)); } id = parent.get(id); } i++; }
  console.log('components (inclusive):', [...incl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${(v / 1000).toFixed(0)}ms`).join(', '));
  await browser.close();
})();
