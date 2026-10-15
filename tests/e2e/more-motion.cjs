// 1.7: the sliding selection on segmented controls lands on the option you pick; the bar marking the open
// chat glides to the chat you open; the usage gauges fill up from zero and their numbers count up.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const chats = ['First chat', 'Second chat', 'Third chat'].map((t, i) => ({ id: `mm${i}`, title: t, createdAt: now - i * 1e6, updatedAt: now - i * 1e6, model: 'gemini:gemini-flash-latest', messages: [{ id: `mm${i}u`, role: 'user', text: 'hello there', createdAt: now }, { id: `mm${i}a`, role: 'assistant', status: 'done', model: 'gemini:gemini-flash-latest', text: 'Hi!', createdAt: now }] }));
const near = (a, b, d = 2) => Math.abs(a - b) <= d;

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'more-motion', 'light');
    await ctx.addInitScript(() => { window.__mrMotion = true; });
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } }));
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.composer textarea');
    await seed(page, 'more-motion', chats);
    await page.reload();
    await page.waitForSelector('.composer textarea');

    // ---- The open-chat bar follows you.
    for (const title of ['First chat', 'Third chat']) {
      await page.click(`.chat-row:has-text("${title}") .chat-open`);
      await page.waitForTimeout(700);
      const [bar, row] = await Promise.all([page.locator('.active-indicator').boundingBox(), page.locator('.chat-row.active').boundingBox()]);
      assert.ok(near(bar.y, row.y + 9) && near(bar.x, row.x), `the bar sits on "${title}" (${JSON.stringify([bar, row])})`);
    }
    console.log('PASS the open-chat bar glides to the chat you open');

    // ---- The segmented thumb lands on your choice.
    await page.click('.sidebar-foot');
    await page.locator('.settings-tabs').getByRole('button', { name: 'General', exact: true }).click();
    const theme = page.getByRole('radiogroup', { name: 'Theme' });
    for (const name of ['Dark', 'Auto', 'Light']) {
      await theme.getByRole('radio', { name, exact: true }).click();
      await page.waitForTimeout(700);
      const [thumb, active] = await Promise.all([theme.locator('.seg-thumb').boundingBox(), theme.getByRole('radio', { name, exact: true }).boundingBox()]);
      assert.ok(near(thumb.x, active.x) && near(thumb.width, active.width), `the selection slides to ${name} (${JSON.stringify([thumb, active])})`);
    }
    await page.click('.settings-page [aria-label="Close"]');
    console.log('PASS the Theme selection slides to the option you pick');

    // ---- Usage gauges fill from zero.
    await page.click('.usage-chip');
    await page.locator('.usage-pop').waitFor();
    const fill = await page.locator('.um-gauge-fill').first().evaluate((el) => el.getAnimations().some((a) => a.animationName === 'gauge-fill'));
    assert.ok(fill, 'the usage gauge fills up when it opens');
    console.log('PASS usage gauges fill up as they open');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
