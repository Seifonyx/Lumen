// 2.0: on wide screens another chat can sit beside the one you're in (for reading; no actions), the divider
// resizes it and is remembered, Switch swaps the two, and documents sit beside the chat on iPad-wide screens.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const mk = (id, title, text, at) => ({ id, title, createdAt: at, updatedAt: at, model: 'gemini:gemini-flash-latest', messages: [{ id: id + 'u', role: 'user', text: `Question for ${title}`, createdAt: at }, { id: id + 'a', role: 'assistant', status: 'done', model: 'gemini:gemini-flash-latest', text, createdAt: at }] });

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, serviceWorkers: 'block' });
    await profile(ctx, 'side-by-side', 'light');
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await seed(page, 'side-by-side', [mk('main', 'Main work', 'Main answer', now), mk('ref', 'Reference', 'Reference answer with details', now - 1e5)]);
    await page.reload();
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await page.click('.chat-row:has-text("Main work") .chat-open');

    // ---- Open "Reference" beside it.
    const row = page.locator('.chat-row:has-text("Reference")');
    await row.hover();
    await row.getByRole('button', { name: 'Chat options' }).click();
    await page.getByRole('menuitem', { name: 'Open side by side' }).click();
    const side = page.locator('.side-chat');
    await side.locator('.msg.assistant:has-text("Reference answer")').waitFor();
    assert.equal(await side.locator('.msg-actions').count(), 0, 'reading only: no actions on its messages');
    assert.ok(await page.locator('.main .msg.assistant:has-text("Main answer")').isVisible(), 'the main chat stays');
    const [mainBox, sideBox] = await Promise.all([page.locator('.main').boundingBox(), side.boundingBox()]);
    assert.ok(sideBox.x >= mainBox.x + mainBox.width - 2, 'beside the chat, not over it');
    console.log('PASS another chat opens beside the current one, for reading');

    // ---- Drag the divider; remembered.
    const handle = side.locator('.pane-resizer');
    const hb = await handle.boundingBox();
    await page.mouse.move(hb.x + 5, hb.y + 300);
    await page.mouse.down();
    await page.mouse.move(hb.x - 150, hb.y + 300, { steps: 6 });
    await page.mouse.up();
    const wider = (await side.boundingBox()).width;
    assert.ok(Math.abs(wider - (sideBox.width + 155)) < 6, `the divider resizes it (${sideBox.width} → ${wider})`);
    assert.equal(Number(await page.evaluate(() => localStorage.getItem('mr.sideWidth'))), Math.round(wider));
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    assert.ok(Math.abs((await side.boundingBox()).width - (wider - 40)) < 3, 'arrow keys move the divider too');
    console.log('PASS the divider drags (and keys) and is remembered');

    // ---- Switch swaps the two; X closes.
    await side.getByRole('button', { name: 'Switch' }).click();
    await page.locator('.main .msg.assistant:has-text("Reference answer")').waitFor();
    await side.locator('.msg.assistant:has-text("Main answer")').waitFor();
    await side.getByRole('button', { name: 'Close side by side' }).click();
    await side.waitFor({ state: 'detached' });
    console.log('PASS Switch swaps the chats and X closes the side');

    // ---- iPad landscape: a document sits beside the chat (it used to cover it).
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.keyboard.press('Escape');
    await page.click('[aria-label="Add files or a repository"]');
    await page.getByRole('button', { name: 'Document canvas' }).click();
    const canvas = page.locator('.canvas-panel');
    await canvas.waitFor();
    const [m, c] = await Promise.all([page.locator('.main').boundingBox(), canvas.boundingBox()]);
    assert.ok(m.width > 300 && c.x >= m.x + m.width - 2, `the document sits beside the chat (${JSON.stringify([m, c])})`);
    assert.ok(await canvas.locator('.pane-resizer').count(), 'and has a divider');
    console.log('PASS documents sit beside the chat on iPad-wide screens');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
