// Design review screenshots of the iPhone look (not a test): node tests/e2e/helpers/glass-shots.cjs <outDir> [url]
// Runs as an iPhone (its user agent), light and dark, on the main screens.
const { chromium } = require('playwright');
const path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2];
const url = process.argv[3] || 'http://localhost:5191/';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const now = Date.now();
const long = ['## Planning a week in Lisbon', '', 'Here is a relaxed plan that mixes the classic sights with quieter neighbourhoods.', '',
  '**Day 1 — Alfama.** Walk up to the castle in the morning, then lose yourself in the lanes on the way down. Have lunch at a small tasca and listen to fado in the evening.', '',
  '**Day 2 — Belém.** The monastery, the tower and the famous custard tarts. Go early to beat the queues.', '',
  '**Day 3 — Sintra.** A day trip by train: palaces, gardens and forest paths. Wear good shoes.', '',
  '| Day | Area | Pace |', '|---|---|---|', '| 1 | Alfama | Easy |', '| 2 | Belém | Easy |', '| 3 | Sintra | Busy |', '',
  '**Day 4 — LX Factory and the river.** Bookshops, cafés and a sunset walk along the water.', '',
  '- Buy a Viva Viagem card for trams and trains.', '- Tram 28 is lovely but crowded; ride it early.', '- Many museums are free on Sunday mornings.'].join('\n');
const projects = [
  { id: 'p1', name: 'Trip to Portugal', description: 'Plans, bookings and ideas.', instructions: '', color: 'indigo', createdAt: now - 9e8, updatedAt: now - 1e6 },
  { id: 'p2', name: 'Arabic study', description: '', instructions: '', color: 'green', createdAt: now - 5e8, updatedAt: now - 5e8 },
];
const chats = [
  { id: 'c1', title: 'A week in Lisbon', projectId: 'p1', createdAt: now - 3e6, updatedAt: now - 1e5, messages: [
    { id: 'm1', role: 'user', text: 'Plan a relaxed week in Lisbon for two people who like food and walking.', createdAt: now - 3e6 },
    { id: 'm2', role: 'assistant', text: long, status: 'done', model: 'gemini:gemini-flash-latest', createdAt: now - 2e6 },
    { id: 'm3', role: 'user', text: 'Great, which day is best for rain?', createdAt: now - 2e5 },
    { id: 'm4', role: 'assistant', text: 'Day 2 works best on a rainy day: the monastery and the museums in Belém are all indoors, and the custard tart shop has plenty of seating.', status: 'done', model: 'gemini:gemini-flash-latest', createdAt: now - 1e5 }] },
  { id: 'c2', title: 'Verb conjugation practice', projectId: 'p2', createdAt: now - 2e8, updatedAt: now - 2e8, messages: [{ id: 'y', role: 'user', text: 'hi', createdAt: now - 2e8 }] },
  { id: 'c3', title: 'Fix login on Safari', createdAt: now - 4e8, updatedAt: now - 4e8, messages: [{ id: 'z', role: 'user', text: 'hi', createdAt: now - 4e8 }] },
  { id: 'c4', title: 'Birthday gift ideas', createdAt: now - 5e8, updatedAt: now - 5e8, messages: [{ id: 'w', role: 'user', text: 'hi', createdAt: now - 5e8 }] },
];
const only = (process.env.SHOTS || '').split(',').filter(Boolean);

(async () => {
  const browser = await chromium.launch();
  for (const theme of (process.env.THEMES || 'light,dark').split(',')) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await profile(ctx, 'shots-glass', theme);
    await ctx.addInitScript((projects) => {
      if (window.top !== window) return;
      for (const key of ['mr.settings', 'mr.account.shots-glass']) {
        const v = JSON.parse(localStorage.getItem(key) || '{}');
        if (key === 'mr.settings') v.projects = projects; else v.settings = { ...(v.settings || {}), projects };
        localStorage.setItem(key, JSON.stringify(v));
      }
    }, projects);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    const ready = async () => { await page.waitForSelector('.app:not(.app-skeleton) .composer textarea'); await page.waitForTimeout(500); };
    await page.goto(url); await ready();
    await seed(page, 'shots-glass', chats);
    const shot = async (n) => { if (only.length && !only.includes(n)) return; await page.waitForTimeout(450); await page.screenshot({ path: path.join(out, `${theme}-${n}.png`) }); };
    const home = async () => { await page.goto(url); await ready(); };
    await home();
    await shot('1-new-chat');
    await page.click('.menu-btn'); await shot('2-sidebar');
    await page.locator('.sidebar').getByText('A week in Lisbon', { exact: true }).first().click();
    await page.waitForTimeout(600);
    await page.evaluate(() => { const m = document.querySelector('.messages'); if (m) m.scrollTop = 260; });
    await shot('3-chat');
    await page.evaluate(() => { const m = document.querySelector('.messages'); if (m) m.scrollTop = m.scrollHeight; });
    await page.locator('.composer .tool-btn').first().click(); await shot('4-plus-menu');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.locator('.composer .model-button').first().click().catch(() => {}); await shot('5-models');
    await home();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools-page' })));
    await page.waitForSelector('.hub-page'); await page.evaluate(() => document.querySelector('.hub-scroll')?.scrollBy(0, 180)); await shot('6-tools');
    await home();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'projects' })));
    await page.waitForSelector('.hub-page'); await shot('7-projects');
    await home();
    await page.click('.menu-btn'); await page.waitForTimeout(300);
    await page.click('.sidebar-foot'); await page.waitForTimeout(400); await shot('8-settings');
    await page.locator('.settings-tabs button').first().click(); await page.waitForTimeout(400); await shot('9-settings-general');
    await ctx.close();

    // Interactions, with motion on: a held button, a long-pressed reply, a page half swiped back.
    if (process.env.NO_INTERACTIONS) continue;
    const ictx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: 'block' });
    await profile(ictx, 'shots-glass', theme);
    await ictx.addInitScript(() => { window.__mrMotion = true; });
    const ip = await ictx.newPage();
    const iready = async () => { await ip.waitForSelector('.app:not(.app-skeleton) .composer textarea'); await ip.waitForTimeout(600); };
    await ip.goto(url); await iready();
    await seed(ip, 'shots-glass', chats); await ip.goto(url); await iready();
    const ishot = async (n) => { if (only.length && !only.includes(n)) return; await ip.screenshot({ path: path.join(out, `${theme}-${n}.png`) }); };
    const touchAt = (sel, moves = [], hold = true) => ip.evaluate(async ([sel, moves, hold]) => {
      const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const x0 = r.left + r.width / 2, y0 = r.top + Math.min(r.height / 2, 60);
      const target = document.elementFromPoint(x0, y0);
      const mk = (x, y) => new Touch({ identifier: 5, target, clientX: x, clientY: y });
      const fire = (type, x, y, down = true) => target.dispatchEvent(new TouchEvent(type, { touches: down ? [mk(x, y)] : [], changedTouches: [mk(x, y)], bubbles: true, cancelable: true }));
      target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, pointerType: 'touch', clientX: x0, clientY: y0 }));
      fire('touchstart', x0, y0);
      for (const [dx, dy] of moves) { await new Promise((ok) => setTimeout(ok, 16)); target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, isPrimary: true, pointerType: 'touch', clientX: x0 + dx, clientY: y0 + dy })); fire('touchmove', x0 + dx, y0 + dy); }
      if (!hold) fire('touchend', x0, y0, false);
    }, [sel, moves, hold]);
    await touchAt('.composer .tool-btn', [[6, -4], [10, -8]]);
    await ip.waitForTimeout(500); await ishot('10-press');
    await ip.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup')));
    await ip.click('.menu-btn'); await ip.waitForTimeout(500);
    await ip.locator('.sidebar').getByText('A week in Lisbon', { exact: true }).first().click();
    await ip.waitForSelector('.msg.assistant'); await ip.waitForTimeout(700);
    await ip.evaluate(() => { document.querySelector('.messages').scrollTop = 0; });
    await touchAt('.msg.assistant');
    await ip.waitForTimeout(1300); await ishot('11-long-press');
    await ip.keyboard.press('Escape'); await ip.waitForTimeout(500);
    await ip.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools-page' })));
    await ip.waitForSelector('.hub-page'); await ip.waitForTimeout(800);
    await touchAt('.hub-head', [[20, 2], [60, 4], [110, 5], [150, 6]]);
    await ip.waitForTimeout(250); await ishot('12-swipe-back');
    await ictx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
