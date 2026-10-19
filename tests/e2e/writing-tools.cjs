// 2.1: select words in a reply → Writing tools → an action (Shorter, Translate…) shows the result first; "Use in
// reply" puts it in place of the selection, or Copy. Also inside Select text.
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/';
const now = Date.now();
const chat = { id: 'wt', title: 'Writing', createdAt: now, updatedAt: now, model: 'gemini:gemini-flash-latest', messages: [
  { id: 'u', role: 'user', text: 'Write me a note', createdAt: now },
  { id: 'a', role: 'assistant', status: 'done', model: 'gemini:gemini-flash-latest', text: 'First line stays.\n\nThis sentence is quite long and wordy and could be much shorter than it is.\n\nLast line stays.', createdAt: now },
] };

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'preview-writing-tools', 'light');
    const asks = [];
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      const url = r.request().url();
      if (url.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', inputTokenLimit: 128000, supportedGenerationMethods: ['generateContent'] }] } });
      const body = r.request().postData() || '';
      asks.push(body);
      const out = body.includes('Translate it into French') ? 'Cette phrase est courte.' : 'This sentence is short.';
      return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: out }] } }] } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    // Seed on the same origin without warming optional modules. WebKit can keep
    // an already-loaded module in memory across reloads, bypassing route holds.
    const fixture=new globalThis.URL('/__writing_fixture__',URL).href;
    await ctx.route(fixture,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Fixture seed</title>'}));
    await page.goto(fixture);
    await seed(page, 'preview-writing-tools', [chat]);
    let releaseTools,toolsHeld=false;
    const toolsReady=new Promise(resolve=>{releaseTools=resolve;});
    await ctx.route('**/SelectionTools-*.js',async route=>{toolsHeld=true;await toolsReady;await route.continue();});
    const requestedTools=page.waitForRequest('**/SelectionTools-*.js');
    await page.goto(URL);
    await requestedTools;
    await page.click('.chat-row:has-text("Writing") .chat-open');
    const p = page.locator('.msg.assistant .markdown p', { hasText: 'quite long' });
    await p.waitFor();

    // Select the sentence.
    await p.scrollIntoViewIfNeeded();
    await p.selectText();
    assert(toolsHeld,'the optional selection-tools chunk is held until after selection');
    assert.match(await page.evaluate(()=>getSelection()?.toString() || ''),/quite long and wordy/);
    releaseTools();
    await page.locator('.selection-tools-btn').waitFor();
    await page.locator('.selection-tools-btn').click();
    await page.locator('.writing-chip', { hasText: 'Shorter' }).click();
    await page.locator('.writing-result', { hasText: 'This sentence is short.' }).waitFor();
    assert.match(asks.at(-1), /noticeably shorter/);
    assert.match(asks.at(-1), /quite long and wordy/);
    await page.getByRole('button', { name: 'Use in reply' }).click();
    await page.locator('.msg.assistant .markdown p', { hasText: 'This sentence is short.' }).waitFor();
    assert.ok(await page.locator('.msg.assistant .markdown p', { hasText: 'First line stays.' }).isVisible());
    assert.equal(await page.locator('.msg.assistant .markdown p', { hasText: 'quite long' }).count(), 0);
    console.log('PASS select → Shorter → Use in reply changes just that part');

    // Translate from the Select text view.
    await page.locator('.msg.assistant').hover();
    await page.locator('.msg.assistant .msg-actions button[aria-haspopup="menu"]').last().click();
    await page.getByRole('menuitem', { name: 'Select text' }).click();
    const view = page.locator('.selectable-text');
    await view.waitFor();
    await view.evaluate((el) => { const t = el.firstChild; const i = t.textContent.indexOf('Last line stays.'); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 'Last line stays.'.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await page.locator('.text-selection-writing .writing-chip', { hasText: 'Translate' }).click();
    await page.locator('.text-selection-writing .writing-chip', { hasText: 'French' }).click();
    await page.locator('.text-selection-writing .writing-result', { hasText: 'Cette phrase est courte.' }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Copy' }).last().isVisible());
    console.log('PASS Select text has the same tools (Translate)');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
