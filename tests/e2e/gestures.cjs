// Gestures on phones, with real touch sequences:
//  sheets: a quick flick closes even a short drag, a slow short drag springs back, pulling up rubber-bands,
//          and a sheet that's springing back can be caught mid-flight without jumping;
//  drawer: a quick short swipe opens it, a slow partial one doesn't, pulling it past open resists, and a
//          drawer sliding open from a tap can be caught where it is;
//  settings: swiping from the left edge of a section goes back to the list (a short swipe doesn't).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();

/** Touch path: points [x, y, msSincePrevious]; `hold` keeps the finger down at the end (no touchend), and
 *  `lift` ends a held touch where it is (on the element it started on, as a real finger would). */
const touch = (page, points, { hold = false } = {}) => page.evaluate(async ([points, hold]) => {
  const [x0, y0] = points[0];
  const target = document.elementFromPoint(x0, y0);
  window.__held = hold ? target : null;
  const mk = (x, y) => new Touch({ identifier: 3, target, clientX: x, clientY: y });
  const fire = (type, x, y, down = true) => target.dispatchEvent(new TouchEvent(type, { touches: down ? [mk(x, y)] : [], changedTouches: [mk(x, y)], bubbles: true, cancelable: true }));
  fire('touchstart', x0, y0);
  for (const [x, y, dt] of points.slice(1)) { await new Promise((ok) => setTimeout(ok, dt)); fire('touchmove', x, y); }
  if (!hold) { await new Promise((ok) => setTimeout(ok, 8)); const [x, y] = points.at(-1); fire('touchend', x, y, false); }
}, [points, hold]);
const lift = (page, x, y) => page.evaluate(([x, y]) => {
  const target = window.__held; window.__held = null;
  const t = new Touch({ identifier: 3, target, clientX: x, clientY: y });
  target.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t], bubbles: true, cancelable: true }));
}, [x, y]);
const path = (x0, y0, x1, y1, steps, ms) => [[x0, y0, 0], ...Array.from({ length: steps }, (_, i) => [x0 + ((x1 - x0) * (i + 1)) / steps, y0 + ((y1 - y0) * (i + 1)) / steps, ms / steps])];
const translateY = (loc) => loc.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).m42);
const translateX = (loc) => loc.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform).m41);

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await profile(ctx, 'gestures', 'light');
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.composer textarea');
    await seed(page, 'gestures', [{ id: 'g', title: 'Gesture chat', createdAt: now, updatedAt: now, messages: [{ id: 'g1', role: 'user', text: 'hi', createdAt: now }, { id: 'g2', role: 'assistant', status: 'done', model: 'gemini:gemini-flash-latest', text: 'Hello!', createdAt: now }] }]);
    await page.reload();
    await page.waitForSelector('.composer textarea');

    // ---- Sheets (model picker)
    const sheet = page.locator('.models-pop.sheet');
    const grip = async () => { const b = await page.locator('.models-pop.sheet .sheet-grip').boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    const openPicker = async () => { await page.click('.composer .model-button'); await sheet.waitFor(); await page.waitForTimeout(300); };

    await openPicker();
    let [gx, gy] = await grip();
    await touch(page, path(gx, gy, gx, gy - 120, 12, 360), { hold: true });
    const up = await translateY(sheet);
    assert.ok(up < -4 && up > -70, `sheet: pulling up 120px resists (moved ${up.toFixed(0)}px)`);
    await lift(page, gx, gy - 120);
    await page.waitForTimeout(700);
    assert.ok(Math.abs(await translateY(sheet)) < 1, 'sheet: rubber band settles back');

    [gx, gy] = await grip();
    await touch(page, path(gx, gy, gx, gy + 60, 12, 480));
    await page.waitForTimeout(700);
    assert.ok(await sheet.isVisible() && Math.abs(await translateY(sheet)) < 1, 'sheet: a slow short drag springs back');

    [gx, gy] = await grip();
    await touch(page, path(gx, gy, gx, gy + 160, 16, 640));
    await page.waitForTimeout(60);
    const [cx, cy] = await grip(); // where the sheet is now
    const flying = await translateY(sheet);
    await touch(page, [[cx, cy, 0]], { hold: true }); // catch it
    const caught = await translateY(sheet);
    await page.waitForTimeout(120);
    const held = await translateY(sheet);
    assert.ok(flying > 20 && Math.abs(caught - flying) < 25 && Math.abs(held - caught) < 2, `sheet: caught mid-flight without a jump (${flying.toFixed(0)} → ${caught.toFixed(0)} → ${held.toFixed(0)})`);
    await lift(page, cx, cy);
    await page.waitForTimeout(700);

    [gx, gy] = await grip();
    await touch(page, path(gx, gy, gx, gy + 50, 3, 36));
    await sheet.waitFor({ state: 'detached', timeout: 2000 });
    console.log('PASS sheets: flick closes, slow short drag springs back, pull-up rubber-bands, caught mid-flight');

    // ---- Drawer
    const sidebar = page.locator('.sidebar');
    const width = (await sidebar.boundingBox()).width;
    await touch(page, path(60, 420, 100, 420, 3, 36));
    await page.locator('.sidebar.open').waitFor({ timeout: 2000 });
    await page.waitForTimeout(600);
    assert.ok(Math.abs(await translateX(sidebar)) < 1, 'drawer: a quick short swipe opens it fully');
    await touch(page, path(width + 20, 420, width + 140, 420, 12, 360), { hold: true });
    const past = await translateX(sidebar);
    assert.ok(past > 2 && past < 60, `drawer: pulling past open resists (${past.toFixed(0)}px for 120px)`);
    await lift(page, width + 140, 420);
    await page.waitForTimeout(600);
    assert.ok(Math.abs(await translateX(sidebar)) < 1, 'drawer: settles back to open');
    assert.match(await page.evaluate(() => document.elementFromPoint(360, 420)?.className), /scrim/, 'drawer: the dimmed area beside it can be tapped');
    await page.mouse.click(360, 420);
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.sidebar.open').count(), 0, 'drawer: tapping beside it closes it');
    await touch(page, path(60, 420, 140, 420, 12, 600));
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.sidebar.open').count(), 0, 'drawer: a slow partial swipe leaves it closed');
    await page.click('.menu-btn');
    await page.waitForTimeout(90);
    const sliding = await translateX(sidebar);
    await touch(page, [[200, 420, 0]], { hold: true });
    const frozen = await translateX(sidebar);
    await page.waitForTimeout(150);
    const still = await translateX(sidebar);
    assert.ok(sliding < -10 && sliding > -width + 10 && Math.abs(frozen - sliding) < 40 && Math.abs(still - frozen) < 2, `drawer: caught while opening from a tap (${sliding.toFixed(0)} → ${frozen.toFixed(0)} → ${still.toFixed(0)})`);
    await lift(page, 200, 420);
    await page.waitForTimeout(600);
    console.log('PASS drawer: quick swipe opens, slow partial does not, past-open resists, caught mid-slide');

    // ---- Settings edge swipe-back
    if (!(await page.locator('.sidebar.open').count())) { await page.click('.menu-btn'); await page.locator('.sidebar.open').waitFor(); await page.waitForTimeout(400); }
    await page.click('.sidebar-foot');
    await page.locator('.settings-page').waitFor();
    await page.locator('.settings-tabs').getByRole('button', { name: 'General', exact: true }).click();
    await page.locator('.settings-page.has-section').waitFor();
    await touch(page, path(6, 500, 66, 500, 8, 480));
    await page.waitForTimeout(700);
    assert.equal(await page.locator('.settings-page.has-section').count(), 1, 'settings: a short edge swipe stays in the section');
    await touch(page, path(6, 500, 150, 500, 10, 300), { hold: true });
    const mid = await translateX(page.locator('.settings-page:not(.swipe-under)'));
    assert.ok(mid > 100, `settings: the section follows the finger (${mid.toFixed(0)}px)`);
    await touch(page, path(150, 500, 300, 500, 6, 60));
    await page.waitForFunction(() => !document.querySelector('.settings-page.has-section'), null, { timeout: 2000 });
    await page.waitForTimeout(400);
    assert.ok(Math.abs(await translateX(page.locator('.settings-page:not(.swipe-under)'))) < 1 && await page.locator('.swipe-under').count() === 0, 'settings: back on the list, nothing left over');
    console.log('PASS settings: edge swipe-back follows the finger, goes back past halfway, short swipe stays');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
