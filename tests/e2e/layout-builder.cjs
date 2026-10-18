// 2.1: Build a layout for a task: Lumen checks for new models first, ranks them for the task with reasons, and
// saves the layout (optionally for new chats).
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const g = (name, label) => ({ name: `models/${name}`, displayName: label, supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576 });

(async () => {
  const browser = await (process.env.MR_WEBKIT?webkit:chromium).launch();
  try { for (const width of [1280,390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 860 }, isMobile:width<900, hasTouch:width<900, serviceWorkers: 'block' });
    await profile(ctx, 'layout-builder-'+width, 'light');
    let listed = 0;
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      if (r.request().url().includes('/models?')) {
        listed++;
        // A new model shows up after the app first loaded its list.
        const models = [g('gemini-flash-latest', 'Gemini Flash'), g('gemini-flash-lite-latest', 'Gemini Flash-Lite'), g('gemma-4-31b-it', 'Gemma 4')];
        if (listed > 1) models.push(g('gemini-3-pro', 'Gemini 3 Pro'));
        return r.fulfill({ json: { models } });
      }
      return r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }) + '\n\n' });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => {if(!e.message.includes('firestore.googleapis.com'))errors.push(e.message);});
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    if(width<900)await page.locator('.menu-btn').click();
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
    await page.locator('.builder-name input').fill('Daily coding');
    await page.getByRole('button',{name:'Check again',exact:true}).click();
    await page.locator('.builder-picks li').first().waitFor();
    assert.equal(await page.locator('.builder-name input').inputValue(),'Daily coding','Recheck preserves the chosen name');
    assert.equal(await page.locator('.builder-picks li',{hasText:'Flash-Lite'}).locator('input').isChecked(),false,'Recheck preserves unchecked models');
    await page.locator('.builder-picks li',{hasText:'Gemma 4'}).locator('input').uncheck();
    await page.getByLabel('Use it for new chats').check();
    await page.getByRole('button', { name: 'Save layout' }).click();
    await page.locator('.toast', { hasText: 'Saved “Daily coding”' }).waitFor();
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
    await page.getByRole('button',{name:'Back',exact:true}).click();
    await page.getByLabel('Describe the work').fill('Research current sources and analyze screenshots');
    await page.getByRole('button',{name:'Build',exact:true}).click();
    await page.locator('.builder-picks li').first().waitFor();
    assert.equal(await page.locator('.builder-picks li',{hasText:'Gemma 4'}).count(),0,'Research plus screenshots requires both search and vision');
    console.log(`PASS ${width}px ${process.env.MR_WEBKIT?'webkit':'chromium'}: mixed capabilities and preserved recheck choices`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }} finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
