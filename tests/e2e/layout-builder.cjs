// 2.1: Build a layout for a task: Lumen checks for new models first, ranks them for the task with reasons, and
// saves the layout (optionally for new chats).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const g = (name, label) => ({ name: `models/${name}`, displayName: label, supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576 });

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block' });
    await profile(ctx, 'layout-builder', 'light');
    let listed = 0;
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      if (r.request().url().includes('/models?')) {
        listed++;
        // A new model shows up after the app first loaded its list.
        const models = [g('gemini-flash-latest', 'Gemini Flash'), g('gemini-flash-lite-latest', 'Gemini Flash-Lite')];
        if (listed > 1) models.push(g('gemini-3-pro', 'Gemini 3 Pro'));
        return r.fulfill({ json: { models } });
      }
      return r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }) + '\n\n' });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await page.click('.sidebar-foot');
    await page.locator('.settings-tabs').getByRole('button', { name: 'Models', exact: true }).click();
    await page.locator('.models-nav button').filter({ hasText: 'Layouts' }).click();
    await page.getByRole('button', { name: 'Build for a task' }).click();
    const before = listed;
    await page.locator('.builder-tasks .writing-chip', { hasText: 'Max coding' }).click();
    await page.locator('.builder-picks li').first().waitFor();
    assert.ok(listed > before, 'checked for new models first');
    assert.match(await page.locator('.builder-fresh').textContent(), /Found 1 new model/);
    const first = page.locator('.builder-picks li').first();
    assert.match(await first.textContent(), /Gemini 3 Pro/, 'the new strongest model comes first');
    assert.match(await first.textContent(), /new/);
    assert.match(await first.textContent(), /strongest|code/);
    console.log('PASS checks for new models, then ranks them for the task with reasons');

    // Untick one, use for new chats, save.
    await page.locator('.builder-picks li', { hasText: 'Flash-Lite' }).locator('input').uncheck();
    await page.getByLabel('Use it for new chats').check();
    await page.getByRole('button', { name: 'Save layout' }).click();
    await page.locator('.toast', { hasText: 'Saved “Max coding”' }).waitFor();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mr.settings')));
    const layout = saved.layouts.at(-1);
    assert.deepEqual(layout.models, ['gemini:gemini-3-pro', 'gemini:gemini-flash-latest']);
    assert.equal(saved.defaultModel, `layout:${layout.id}`);
    console.log('PASS the built layout is saved (and used for new chats)');

    // A described task.
    await page.getByRole('button', { name: 'Build for a task' }).click();
    await page.getByLabel('Describe the work').fill('reading screenshots and photos');
    await page.getByRole('button', { name: 'Build', exact: true }).click();
    await page.locator('.builder-picks li').first().waitFor();
    assert.equal(await page.locator('.builder-name input').inputValue(), 'Reading screenshots and photos');
    console.log('PASS a described task gets its own layout');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
