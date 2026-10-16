// Design audit screenshots of every screen on an iPhone (not a test): node tests/e2e/helpers/audit-shots.cjs <outDir> [url]
const { chromium } = require('playwright');
const path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2];
const url = process.argv[3] || 'http://localhost:5191/';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const now = Date.now();
const long = ['## Planning a week in Lisbon', '', 'Here is a relaxed plan that mixes the classic sights with quieter neighbourhoods.', '',
  '**Day 1 — Alfama.** Walk up to the castle, then lose yourself in the lanes. Lunch at a small tasca and fado in the evening.', '',
  '| Day | Area | Pace |', '|---|---|---|', '| 1 | Alfama | Easy |', '| 2 | Belém | Easy |', '',
  '```js', 'const trip = plan("Lisbon", { days: 4 });', '```', '',
  '- Buy a Viva Viagem card.', '- Ride tram 28 early.'].join('\n');
const projects = [{ id: 'p1', name: 'Trip to Portugal', description: 'Plans, bookings and ideas.', instructions: 'Keep it relaxed.', color: 'indigo', createdAt: now - 9e8, updatedAt: now - 1e6 }];
const chats = [
  { id: 'c1', title: 'A week in Lisbon', projectId: 'p1', createdAt: now - 3e6, updatedAt: now - 1e5, documents: [{ id: 'd1', name: 'Itinerary.md', content: '# Itinerary\n\nDay 1: Alfama\nDay 2: Belém', updatedAt: now - 1e5 }], messages: [
    { id: 'm1', role: 'user', text: 'Plan a relaxed week in Lisbon for two people.', createdAt: now - 3e6 },
    { id: 'm2', role: 'assistant', text: long, thinking: 'They want a relaxed plan, so few sights per day.', status: 'done', model: 'gemini:gemini-flash-latest', createdAt: now - 2e6 },
  ] },
  { id: 'c2', title: 'Birthday gift ideas', createdAt: now - 5e8, updatedAt: now - 5e8, messages: [{ id: 'w', role: 'user', text: 'hi', createdAt: now - 5e8 }] },
];

(async () => {
  const browser = await chromium.launch();
  for (const theme of (process.env.THEMES || 'dark,light').split(',')) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await profile(ctx, 'audit', theme);
    await ctx.addInitScript((projects) => {
      if (window.top !== window) return;
      for (const key of ['mr.settings', 'mr.account.audit']) {
        const v = JSON.parse(localStorage.getItem(key) || '{}');
        if (key === 'mr.settings') v.projects = projects; else v.settings = { ...(v.settings || {}), projects };
        localStorage.setItem(key, JSON.stringify(v));
      }
    }, projects);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    const ready = async () => { await page.waitForSelector('.app:not(.app-skeleton) .composer textarea'); await page.waitForTimeout(500); };
    await page.goto(url); await ready();
    await seed(page, 'audit', chats);
    let n = 0;
    const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: path.join(out, `${theme}-${String(++n).padStart(2, '0')}-${name}.png`) }); };
    const home = async () => { await page.goto(url); await ready(); };
    const lib = async (d) => { await home(); await page.evaluate((d) => window.dispatchEvent(new CustomEvent('mr:library', { detail: d })), d); await page.waitForSelector('.hub-page'); await page.waitForTimeout(400); };
    const step = async (name, fn) => { try { await fn(); await shot(name); } catch (e) { console.log('skip', name, e.message.split('\n')[0]); } };

    await step('welcome', home);
    await step('chat', async () => { await home(); await page.click('.menu-btn'); await page.waitForTimeout(300); await page.locator('.sidebar').getByText('A week in Lisbon').click(); await page.waitForTimeout(600); });
    await step('chat-end', async () => { await page.evaluate(() => { const m = document.querySelector('.messages'); m.scrollTop = m.scrollHeight; }); });
    await step('sidebar', async () => { await page.click('.menu-btn'); });
    await step('all-chats', async () => { await page.click('.view-all-chats'); });
    await step('plus', async () => { await home(); await page.locator('.composer .tool-btn').first().click(); });
    await step('models', async () => { await home(); await page.locator('.composer .model-button').first().click(); });
    await step('projects', () => lib('projects'));
    await step('project', async () => { await page.getByText('Trip to Portugal').first().click(); await page.waitForTimeout(500); });
    await step('collection', () => lib('collection'));
    await step('collection-docs', async () => { await page.locator('.glass-tabbar button', { hasText: 'Docs' }).click(); });
    await step('tools', () => lib('tools-page'));
    await step('tools-create', async () => { await page.locator('.glass-tabbar button', { hasText: 'Create' }).click(); });
    await step('tools-assistants', async () => { await page.locator('.glass-tabbar button', { hasText: 'Assistants' }).click(); });
    await step('assistant-editor', async () => { await page.locator('.hub-new').click(); });
    await step('study', async () => { await home(); await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:open-study'))); await page.waitForTimeout(600); });
    await step('prompts', async () => { await home(); await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'prompts' }))); await page.waitForTimeout(500); });
    for (const tab of ['', 'general', 'keys', 'connectors', 'models', 'usage', 'personalize', 'memory', 'tasks', 'privacy']) {
      await step(`settings-${tab || 'root'}`, async () => { await home(); await page.evaluate((t) => window.__store?.getState?.().setUi?.({ settingsOpen: true, settingsTab: t }), tab); if (!(await page.locator('.settings-page').count())) { await page.click('.menu-btn'); await page.waitForTimeout(300); await page.click('.sidebar-foot'); await page.waitForTimeout(400); if (tab) await page.locator('.settings-tabs button').nth(['general', 'keys', 'connectors', 'models', 'usage', 'personalize', 'memory', 'tasks', 'privacy'].indexOf(tab)).click(); } });
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
