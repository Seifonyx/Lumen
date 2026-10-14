// Motion and responsiveness audit (not a test): runs the main interactions with the CPU slowed 4× and records,
// for each one, the slowest tap-to-paint time (Event Timing), long tasks, layout shift, and a frame-by-frame
// screencast. Usage: node tests/e2e/helpers/motion-audit.cjs <outDir> [url]   (BROWSER is always Chromium:
// CPU throttling and the screencast are Chromium DevTools features.)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2], url = process.argv[3] || 'http://localhost:5191/';
const CPU = Number(process.env.CPU || 4);
fs.mkdirSync(out, { recursive: true });

const now = Date.now();
const long = Array.from({ length: 40 }, (_, i) => [
  { id: `u${i}`, role: 'user', text: `Question ${i}: how do I organise a weekly team meeting?`, createdAt: now - 9e6 + i * 1000 },
  { id: `a${i}`, role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', createdAt: now - 9e6 + i * 1000 + 500, text: `## Answer ${i}\n\nKeep it to **30 minutes**, share the agenda a day before, and end with owners for each action.\n\n| Step | Who |\n|---|---|\n| Agenda | Lead |\n| Notes | Rotating |\n\n\`\`\`js\nconst minutes = 30;\n\`\`\`` },
]).flat();
const chats = [
  { id: 'long', title: 'Weekly team meetings', createdAt: now - 9e6, updatedAt: now - 1e5, model: 'gemini:gemini-flash-latest', messages: long },
  ...Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, title: `Chat number ${i + 1}`, createdAt: now - (i + 2) * 8e7, updatedAt: now - (i + 2) * 8e7, messages: [{ id: `m${i}`, role: 'user', text: 'hi', createdAt: now - (i + 2) * 8e7 }] })),
];

async function setup(browser, { width, theme, height = width < 900 ? 844 : 820 }) {
  const phone = width < 900;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1 });
  await profile(ctx, 'audit', theme);
  await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
    const u = r.request().url();
    if (u.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
    if (u.includes(':generateContent')) return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Title' }] } }] } });
    const words = 'Here is a fairly long streamed answer that arrives in many small pieces so we can watch the list grow. '.repeat(6).split(' ');
    const body = words.map((w) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: w + ' ' }] } }] })}\n\n`).join('') + `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'STOP' }] })}\n\n`;
    await new Promise((ok) => setTimeout(ok, 300));
    return r.fulfill({ contentType: 'text/event-stream', body });
  });
  // Collect Event Timing, long tasks and layout shifts from the start.
  await ctx.addInitScript(() => {
    window.__mrMotion = true; // animations on under automation (see src/lib/motion.ts)
    window.__audit = { events: [], long: [], shifts: [] };
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__audit.events.push({ name: e.name, start: e.startTime, duration: e.duration, input: e.processingStart - e.startTime, processing: e.processingEnd - e.processingStart, id: e.interactionId }))).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch {}
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__audit.long.push({ start: e.startTime, duration: e.duration }))).observe({ type: 'longtask', buffered: true }); } catch {}
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__audit.shifts.push({ start: e.startTime, value: e.value, nodes: (e.sources || []).map((s) => s.node && (s.node.className || s.node.nodeName)).filter(Boolean).map(String).slice(0, 3) }); })).observe({ type: 'layout-shift', buffered: true }); } catch {}
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, phone };
}

/** Runs `fn` as one measured interaction: CPU throttled, screencast frames saved, metrics for that window. */
async function measure(s, name, fn, results) {
  const { page, cdp } = s;
  const dir = path.join(out, name.replace(/[^a-z0-9]+/gi, '-').toLowerCase());
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const onFrame = async (f) => { frames.push({ t: f.metadata.timestamp, data: f.data }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} };
  cdp.on('Page.screencastFrame', onFrame);
  await page.screenshot({ path: path.join(dir, 'before.png') });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const t0 = await page.evaluate(() => performance.now());
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 70, everyNthFrame: 1 });
  let error = '';
  const wall = Date.now();
  try { await fn(); } catch (e) { error = e.message.split('\n')[0]; }
  await page.waitForTimeout(900);
  const ms = Date.now() - wall;
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.screenshot({ path: path.join(dir, 'after.png') });
  const m = await page.evaluate((t0) => ({
    events: window.__audit.events.filter((e) => e.start >= t0),
    long: window.__audit.long.filter((e) => e.start >= t0),
    shifts: window.__audit.shifts.filter((e) => e.start >= t0),
  }), t0);
  frames.forEach((f, i) => fs.writeFileSync(path.join(dir, `f${String(i).padStart(3, '0')}.jpg`), Buffer.from(f.data, 'base64')));
  fs.writeFileSync(path.join(dir, 'times.json'), JSON.stringify(frames.map((f) => f.t)));
  const slowest = m.events.reduce((a, e) => (e.duration > (a?.duration || 0) ? e : a), null);
  const r = {
    name, error, wallMs: ms, frames: frames.length,
    slowestEvent: slowest ? { type: slowest.name, duration: Math.round(slowest.duration), input: Math.round(slowest.input), processing: Math.round(slowest.processing) } : null,
    longTasks: m.long.length, longestTask: Math.round(Math.max(0, ...m.long.map((l) => l.duration))),
    cls: Number(m.shifts.reduce((a, s) => a + s.value, 0).toFixed(4)), shiftNodes: [...new Set(m.shifts.flatMap((s) => s.nodes))].slice(0, 4),
  };
  results.push(r);
  console.log(JSON.stringify(r));
}

const click = (page, sel) => page.locator(sel).first().click();

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const [width, theme] of [[390, 'light'], [390, 'dark'], [1280, 'light']]) {
    const s = await setup(browser, { width, theme });
    const { page, phone } = s;
    const tag = `${width}-${theme}`;
    await page.goto(url);
    await page.waitForSelector('.composer textarea');
    await seed(page, 'audit', chats);
    // Cold start, measured from navigation (theme flash, startup long tasks, shifts while loading).
    await measure(s, `${tag} cold start`, async () => { await page.reload(); await page.waitForSelector('.composer textarea'); await page.waitForTimeout(1500); }, results);
    const openSidebar = async () => { if (phone) { await click(page, '.menu-btn'); await page.locator('.sidebar.open').waitFor(); await page.waitForTimeout(400); } };
    await measure(s, `${tag} open sidebar`, openSidebar, results);
    await measure(s, `${tag} open long chat`, async () => { await page.click('text=Weekly team meetings'); await page.locator('.msg.assistant').last().waitFor(); }, results);
    await measure(s, `${tag} type in composer`, async () => { await page.click('.composer textarea'); await page.keyboard.type('Planning a launch party for the team', { delay: 30 }); }, results);
    await measure(s, `${tag} send and stream`, async () => { await page.click('.send-btn'); await page.locator('.msg.assistant .caret').waitFor({ state: 'detached', timeout: 20000 }); }, results);
    await measure(s, `${tag} model picker`, async () => { await click(page, '.composer .model-button'); await page.locator('.models-pop').waitFor(); await page.waitForTimeout(300); await page.keyboard.press('Escape'); await page.locator('.models-pop').waitFor({ state: 'detached' }); }, results);
    await measure(s, `${tag} plus menu`, async () => { await page.locator('.composer button[aria-label^="Add"]').first().click(); await page.locator('.attach-menu').waitFor(); await page.waitForTimeout(300); await page.keyboard.press('Escape'); }, results);
    await measure(s, `${tag} usage`, async () => { await click(page, '.usage-chip'); await page.locator('.usage-pop').waitFor(); await page.waitForTimeout(300); await page.keyboard.press('Escape'); }, results);
    await measure(s, `${tag} chat menu and pin`, async () => { await openSidebar(); await page.locator('.chat-row').filter({ hasText: 'Chat number 3' }).locator('[aria-label="Chat options"]').click({ force: true }); await page.getByRole('menuitem', { name: /^Pin$/ }).click(); await page.waitForTimeout(600); }, results);
    await measure(s, `${tag} new chat`, async () => { if (phone) { if (!(await page.locator('.sidebar.open').count())) await openSidebar(); } await click(page, '.sidebar .new-chat'); await page.waitForTimeout(500); }, results);
    await measure(s, `${tag} open settings`, async () => { await openSidebar(); await click(page, '.sidebar-foot'); await page.locator('.settings-page').waitFor(); await page.waitForTimeout(300); }, results);
    for (const tab of ['API keys', 'Models', 'Usage', 'Privacy & data']) {
      await measure(s, `${tag} settings tab ${tab}`, async () => { if (await page.locator('.settings-back').isVisible()) await page.click('.settings-back'); await page.locator('.settings-tabs').getByRole('button', { name: tab, exact: true }).click(); await page.waitForTimeout(400); }, results);
    }
    await measure(s, `${tag} theme switch`, async () => { if (await page.locator('.settings-back').isVisible()) await page.click('.settings-back'); await page.locator('.settings-tabs').getByRole('button', { name: 'General', exact: true }).click(); await page.waitForTimeout(200); const target = theme === 'dark' ? 'Light' : 'Dark'; await page.getByRole('radio', { name: target, exact: true }).first().click(); await page.waitForTimeout(500); }, results);
    await measure(s, `${tag} close settings`, async () => { await page.click('.settings-page [aria-label="Close"]'); await page.waitForTimeout(400); }, results);
    await measure(s, `${tag} all chats delete`, async () => { await openSidebar(); await click(page, '.view-all-chats'); const d = page.getByRole('dialog', { name: 'All chats' }); await d.waitFor(); await d.getByLabel('Select Chat number 5').check(); await d.getByRole('button', { name: 'Delete' }).click(); await d.getByRole('alert').getByRole('button', { name: 'Delete' }).click(); await page.waitForTimeout(600); await page.keyboard.press('Escape'); }, results);
    if (!phone) await measure(s, `${tag} command palette`, async () => { await page.keyboard.press('Control+k'); await page.waitForTimeout(400); await page.keyboard.type('weekly', { delay: 40 }); await page.waitForTimeout(300); await page.keyboard.press('Escape'); }, results);
    await s.ctx.close();
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 1));
  await browser.close();
})();
