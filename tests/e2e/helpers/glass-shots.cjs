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
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
