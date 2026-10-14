// Design review screenshots (not a test): node tests/e2e/helpers/shots.cjs <outDir> [url]
// BROWSER=webkit runs the same screens in Safari's engine.
const engine = require('playwright')[process.env.BROWSER || 'chromium'];
const path = require('path');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2];
const url = process.argv[3] || 'http://localhost:5191/';
const now = Date.now();
const chats = [
  { id: 'c1', title: 'Quarterly staffing summary', createdAt: now - 3e6, updatedAt: now - 1e5, model: 'auto', messages: [
    { id: 'm1', role: 'user', text: 'Summarize the staffing numbers for Q3 and suggest two fixes.', createdAt: now - 3e6 },
    { id: 'm2', role: 'assistant', model: 'gemini:gemini-flash-latest', route: 'quick reply', status: 'done', createdAt: now - 2.9e6, text: '## Q3 staffing\n\nOvertime rose **18%** while missed shifts fell slightly.\n\n| Unit | Nurses | Overtime |\n|---|---|---|\n| ER | 42 | 1,240 h |\n| ICU | 30 | 860 h |\n\n**Two fixes**\n1. Add two night-shift seniors in ER.\n2. Cap consecutive shifts at three.\n\n```js\nconst rate = overtime / shifts;\n```' },
  ] },
  { id: 'c2', title: 'Arabic email to suppliers', createdAt: now - 9e7, updatedAt: now - 9e7, messages: [{ id: 'x', role: 'user', text: 'hi', createdAt: now - 9e7 }] },
  { id: 'c3', title: 'Fix login on Safari', createdAt: now - 4e8, updatedAt: now - 4e8, pinned: true, messages: [{ id: 'y', role: 'user', text: 'hi', createdAt: now - 4e8 }] },
];
(async () => {
  const browser = await engine.launch();
  for (const theme of ['light', 'dark']) for (const [w, h] of [[1280, 820], [390, 844]]) {
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, reducedMotion: 'reduce' });
    await profile(ctx, 'shots', theme);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('pageerror', e.message));
    await page.goto(url);
    await page.waitForSelector('.composer textarea');
    await seed(page, 'shots', chats);
    await page.reload();
    await page.waitForSelector('.composer textarea');
    const shot = async (n) => { await page.waitForTimeout(350); await page.screenshot({ path: path.join(out, `${w}-${theme}-${n}.png`) }); };
    await shot('1-empty');
    if (phone) { await page.click('.menu-btn'); await shot('2-sidebar'); }
    await page.click('text=Quarterly staffing summary');
    await page.waitForTimeout(400);
    await shot('3-chat');
    const add = page.locator('.composer button[aria-label^="Add"]').first();
    if (await add.count()) { await add.click(); await shot('4-add-menu'); await page.keyboard.press('Escape'); }
    const mp = page.locator('.composer .model-button').first();
    if (await mp.count()) { await mp.click(); await shot('5-models'); await page.keyboard.press('Escape'); }
    // A reply that takes a while, to see the routing line.
    await page.route('**/*:streamGenerateContent*', async (r) => { await new Promise((res) => setTimeout(res, 4000)); r.fallback(); });
    await page.fill('.composer textarea', 'What changed this week?');
    await page.click('.send-btn');
    await page.waitForSelector('.route-wait');
    await page.waitForTimeout(700);
    await shot('8-routing');
    await page.waitForSelector('.route-wait', { state: 'detached', timeout: 15000 }).catch(() => {});
    if (phone) await page.click('.menu-btn');
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await page.locator('.assistant-library').waitFor();
    await shot('6-library');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    if (phone) await page.click('.menu-btn');
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await shot('7-settings');
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
