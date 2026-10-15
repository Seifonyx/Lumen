// Frame-rate audit (not a test): replays the main animations on a phone-sized screen with the CPU slowed
// (CPU=4 by default, like a mid-range phone) and counts, from Chrome's own frame reports, how many frames a
// second actually showed the motion. A frame counts when it was presented and the moving thing was in it:
// animations on the graphics thread count every presented frame; JavaScript-driven ones only count frames
// where the page's main thread also made it in time.
// Usage: node tests/e2e/helpers/fps-audit.cjs <url> [label]
const { chromium } = require('playwright');
const { profile, seed } = require('./preview-profile.cjs');
const url = process.argv[2] || 'http://localhost:5191/?emulator';
const label = process.argv[3] || url;
const CPU = Number(process.env.CPU || 4);
const now = Date.now();
const long = Array.from({ length: 30 }, (_, i) => [
  { id: `u${i}`, role: 'user', text: `Question ${i}: how do I plan a team offsite?`, createdAt: now - 9e6 + i * 1000 },
  { id: `a${i}`, role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', createdAt: now - 9e6 + i * 1000 + 500, text: `## Answer ${i}\n\nPick a **date**, a place and three goals.\n\n| Step | Who |\n|---|---|\n| Venue | Lead |\n\n\`\`\`js\nconst goals = 3;\n\`\`\`` },
]).flat();

const touch = (page, points, { hold = false } = {}) => page.evaluate(async ([points, hold]) => {
  const [x0, y0] = points[0];
  const target = document.elementFromPoint(x0, y0);
  const mk = (x, y) => new Touch({ identifier: 5, target, clientX: x, clientY: y });
  const fire = (type, x, y, down = true) => target.dispatchEvent(new TouchEvent(type, { touches: down ? [mk(x, y)] : [], changedTouches: [mk(x, y)], bubbles: true, cancelable: true }));
  fire('touchstart', x0, y0);
  for (const [x, y, dt] of points.slice(1)) { await new Promise((ok) => setTimeout(ok, dt)); fire('touchmove', x, y); }
  if (!hold) { const [x, y] = points.at(-1); fire('touchend', x, y, false); }
}, [points, hold]);
const path = (x0, y0, x1, y1, steps, ms) => [[x0, y0, 0], ...Array.from({ length: steps }, (_, i) => [x0 + ((x1 - x0) * (i + 1)) / steps, y0 + ((y1 - y0) * (i + 1)) / steps, ms / steps])];

async function measure(browser, page, cdp, name, act, windowMs = 500) {
  await browser.startTracing(page, { categories: ['benchmark', 'cc', 'viz', 'devtools.timeline', 'blink.animations', 'devtools.timeline.async', 'disabled-by-default-devtools.timeline'] });
  await page.waitForTimeout(100);
  await act();
  // A marker in the trace at the moment the action finished (the release, the tap).
  await page.evaluate(() => console.timeStamp('mr-start'));
  await page.waitForTimeout(windowMs + 300);
  const events = JSON.parse((await browser.stopTracing()).toString()).traceEvents;
  const mark = events.find((e) => e.name === 'TimeStamp' && e.args?.data?.message === 'mr-start');
  const frames = events.filter((e) => e.name === 'PipelineReporter' && e.ph === 'b').sort((a, b) => a.ts - b.ts);
  if (!mark || !frames.length) return { name, fps: NaN };
  const start = mark.ts - 30000, end = start + windowMs * 1000;
  // One entry per frame (Chrome can report a frame more than once).
  const seen = new Map();
  for (const f of frames) {
    if (f.ts < start || f.ts > end) continue;
    const r = f.args.frame_reporter;
    const moved = (r.has_compositor_animation && /PRESENTED/.test(r.state)) || (r.has_main_animation && r.state === 'STATE_PRESENTED_ALL') || (r.scroll_state !== 'SCROLL_NONE' && /PRESENTED/.test(r.state));
    seen.set(r.frame_sequence, (seen.get(r.frame_sequence) || false) || moved);
  }
  const shown = [...seen.values()].filter(Boolean).length;
  if (process.env.DEBUG) {
    const main = events.find((e) => e.name === 'thread_name' && e.args?.name === 'CrRendererMain');
    const tasks = events.filter((e) => e.ph === 'X' && e.name === 'ThreadControllerImpl::RunTask' && e.tid === main?.tid && e.ts >= start && e.ts <= end && e.dur > 16000).map((e) => `${Math.round((e.ts - start) / 1000)}ms+${Math.round(e.dur / 1000)}`);
    const list = frames.filter((f) => f.ts >= start && f.ts <= end).map((f) => { const r = f.args.frame_reporter; return `${Math.round((f.ts - start) / 1000)}:${r.state.replace('STATE_', '').slice(0, 9)}${r.has_compositor_animation ? 'C' : ''}${r.has_main_animation ? 'M' : ''}`; });
    const anims = events.filter((e) => e.name === 'Animation');
    const info = (e) => { const b = anims.find((x) => (x.id2?.local ?? x.id) === (e.id2?.local ?? e.id) && x.args?.data?.nodeName); return b ? `${b.args.data.nodeName} ${b.args.data.name || ''}` : '?'; };
    const failed = anims.filter((e) => e.args?.data?.compositeFailed).map((e) => `${info(e)} [${e.args.data.compositeFailed}${e.args.data.unsupportedProperties ? ' ' + e.args.data.unsupportedProperties : ''}]`);
    console.log(name, 'tasks>16ms', tasks.join(' '), '\n  not on graphics thread:', [...new Set(failed)].join(' | ') || 'none');
  }
  return { name, fps: Math.round((shown / windowMs) * 1000) };
}

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await profile(ctx, 'fps', 'light');
  await ctx.addInitScript(() => { window.__mrMotion = true; });
  await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
    const u = r.request().url();
    if (u.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
    if (u.includes(':generateContent')) return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Title' }] } }] } });
    const words = 'Here is a streamed answer arriving in pieces. '.repeat(20).split(' ');
    return r.fulfill({ contentType: 'text/event-stream', body: words.map((w) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: w + ' ' }] } }] })}\n\n`).join('') });
  });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForSelector('.composer textarea');
  await seed(page, 'fps', [{ id: 'long', title: 'Team offsite', createdAt: now - 9e6, updatedAt: now, model: 'gemini:gemini-flash-latest', messages: long }]);
  await page.reload();
  await page.waitForSelector('.composer textarea');
  await page.click('.menu-btn'); await page.locator('.sidebar.open').waitFor(); await page.waitForTimeout(500);
  await page.click('text=Team offsite'); await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const results = [];

  // Sheet: open (CSS), drag down a little and let go (spring back), flick it closed.
  results.push(await measure(browser, page, cdp, 'sheet opens', () => page.click('.composer .model-button')));
  await page.waitForTimeout(400);
  const grip = async () => { const b = await page.locator('.models-pop.sheet .sheet-grip').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  let [gx, gy] = await grip();
  results.push(await measure(browser, page, cdp, 'sheet springs back after a drag', () => touch(page, path(gx, gy, gx, gy + 120, 10, 300))));
  await page.waitForTimeout(400);
  [gx, gy] = await grip();
  results.push(await measure(browser, page, cdp, 'sheet flicked closed', () => touch(page, path(gx, gy, gx, gy + 60, 3, 36))));
  await page.waitForTimeout(500);

  // Drawer: tap to open (CSS), swipe it closed (spring), swipe open (spring).
  results.push(await measure(browser, page, cdp, 'drawer opens (tap)', () => page.click('.menu-btn')));
  await page.waitForTimeout(500);
  results.push(await measure(browser, page, cdp, 'drawer swiped closed', () => touch(page, path(300, 420, 160, 420, 6, 90))));
  await page.waitForTimeout(500);
  results.push(await measure(browser, page, cdp, 'drawer swiped open', () => touch(page, path(60, 420, 200, 420, 6, 90))));
  await page.waitForTimeout(500);

  // Settings: open, push a section, swipe back.
  if (!(await page.locator('.sidebar.open').count())) { await page.click('.menu-btn'); await page.waitForTimeout(600); }
  await page.click('.sidebar-foot'); await page.locator('.settings-page').waitFor(); await page.waitForTimeout(600);
  results.push(await measure(browser, page, cdp, 'settings section slides in', () => page.locator('.settings-tabs').getByRole('button', { name: 'General', exact: true }).click()));
  await page.waitForTimeout(500);
  results.push(await measure(browser, page, cdp, 'settings swipe back', () => touch(page, path(6, 500, 220, 500, 6, 90))));
  await page.waitForTimeout(500);
  await page.click('.settings-page [aria-label="Close"]'); await page.waitForTimeout(600);

  // Sending a message (with the reply starting to stream).
  await page.fill('.composer textarea', 'And what about the budget?');
  results.push(await measure(browser, page, cdp, 'sending a message', () => page.click('.send-btn'), 600));
  await page.waitForTimeout(1500);

  await browser.close();
  return results;
}

(async () => {
  const runs = [];
  for (let i = 0; i < Number(process.env.RUNS || 3); i++) runs.push(await run());
  console.log(`\n${label} (CPU ${CPU}× slower, median of ${runs.length})`);
  runs[0].forEach((r, i) => {
    const v = runs.map((x) => x[i].fps).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
    console.log(`  ${r.name.padEnd(34)} ${String(v[Math.floor(v.length / 2)] ?? '–').padStart(3)} fps`);
  });
})().catch((e) => { console.error(e); process.exit(1); });
