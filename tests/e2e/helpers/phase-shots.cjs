// Screens changed in a polish pass (not a test): node tests/e2e/helpers/phase-shots.cjs <outDir>
const { chromium } = require('playwright');
const path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2], url = 'http://localhost:5191/';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const now = Date.now();
const projects = [{ id: 'p1', name: 'Trip to Portugal', description: 'Plans, bookings and ideas.', instructions: 'Keep it relaxed.', color: 'indigo', createdAt: now - 9e8, updatedAt: now - 1e6 }, { id: 'p2', name: 'Spanish course', description: '', instructions: 'Correct my grammar.', color: 'green', createdAt: now - 9e8, updatedAt: now - 5e7 }];
const chats = [{ id: 'c1', title: 'A week in Lisbon', projectId: 'p1', createdAt: now - 3e6, updatedAt: now - 1e5, messages: [
  { id: 'm1', role: 'user', text: 'Plan a relaxed week in Lisbon.', createdAt: now - 3e6 },
  { id: 'm2', role: 'assistant', text: 'Here is a relaxed plan.\n\n```js\nconst trip = plan("Lisbon");\n```\n\n- Ride tram 28 early.', status: 'done', model: 'gemini:gemini-flash-latest', createdAt: now - 2e6 }] }];
const only = (process.env.ONLY || '').split(',').filter(Boolean);
(async () => {
  const browser = await chromium.launch();
  for (const theme of (process.env.THEMES || 'dark,light').split(',')) {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await profile(ctx, 'phase', theme);
    await ctx.addInitScript((projects) => { if (window.top !== window) return; for (const key of ['mr.settings', 'mr.account.phase']) { const v = JSON.parse(localStorage.getItem(key) || '{}'); if (key === 'mr.settings') v.projects = projects; else v.settings = { ...(v.settings || {}), projects }; localStorage.setItem(key, JSON.stringify(v)); } }, projects);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    const ready = async () => { await page.waitForSelector('.app:not(.app-skeleton) .composer textarea'); await page.waitForTimeout(400); };
    await page.goto(url); await ready(); await seed(page, 'phase', chats);
    const home = async () => { await page.goto(url); await ready(); };
    const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: path.join(out, `${theme}-${name}.png`) }); };
    const step = async (name, fn) => { if (only.length && !only.includes(name)) return; try { await fn(); await shot(name); } catch (e) { console.log('skip', name, e.message.split('\n')[0]); } };
    const lib = async (d) => { await home(); await page.evaluate((d) => window.dispatchEvent(new CustomEvent('mr:library', { detail: d })), d); await page.waitForSelector('.hub-page'); await page.waitForTimeout(400); };
    const settings = async (t) => { await home(); await page.click('.menu-btn'); await page.waitForTimeout(300); await page.click('.sidebar-foot'); await page.waitForTimeout(400); if (t) { await page.locator('.settings-tabs button', { hasText: t }).first().click(); await page.waitForTimeout(400); } };
    const chat = async () => { await home(); await page.click('.menu-btn'); await page.waitForTimeout(300); await page.locator('.sidebar').getByText('A week in Lisbon').click(); await page.waitForTimeout(600); await page.evaluate(() => { const m = document.querySelector('.messages'); m.scrollTop = m.scrollHeight; }); };
    await step('projects', () => lib('projects'));
    await step('project', async () => { await lib('projects'); await page.locator('.proj-open').first().click(); await page.waitForTimeout(700); });
    await step('chat', chat);
    await step('more-menu', async () => { await chat(); await page.locator('.msg.assistant .more-menu .msg-action').last().click(); });
    await step('usage', () => settings('Usage'));
    await step('personalize', () => settings('Personal'));
    await step('select-menu', async () => { await settings('Personal'); await page.locator('select[aria-label="Reply language"]').tap(); });
    await step('assistant-editor', async () => { await lib('tools-page'); await page.locator('.glass-tabbar button', { hasText: 'Assistants' }).click(); await page.locator('.hub-new').click(); });
    await step('keys', () => settings('API keys'));
    await step('memory', () => settings('Memory'));
    await step('tasks', () => settings('Scheduled'));
    await step('privacy', () => settings('Privacy'));
    await step('settings', () => settings(''));
    await step('prompts', async () => { await home(); await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'prompts' }))); await page.waitForTimeout(500); });
    await step('all-chats', async () => { await home(); await page.click('.menu-btn'); await page.waitForTimeout(300); await page.click('.view-all-chats'); });
    await step('sidebar', async () => { await home(); await page.click('.menu-btn'); });
    await step('plus', async () => { await home(); await page.locator('.composer .tool-btn').first().click(); });
    await step('collection', () => lib('collection'));
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
