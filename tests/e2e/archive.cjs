// 2.1: archiving hides a chat from the sidebar without deleting it; search still finds it; All chats has an
// Archived view to bring chats back, one or several at a time.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const mk = (id, title, at) => ({ id, title, createdAt: at, updatedAt: at, model: 'gemini:gemini-flash-latest', messages: [{ id: id + 'u', role: 'user', text: `About ${title} zebra`, createdAt: at }, { id: id + 'a', role: 'assistant', status: 'done', text: 'Ok', createdAt: at }] });

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'archive', 'light');
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await seed(page, 'archive', [mk('a', 'Old project notes', now - 1e5), mk('b', 'Recipes', now - 2e5), mk('c', 'Taxes', now - 3e5)]);
    await page.reload();
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');

    const archiveVia = async (title) => {
      const row = page.locator(`.chat-row:has-text("${title}")`);
      await row.hover();
      await row.getByRole('button', { name: 'Chat options' }).click();
      await page.getByRole('menuitem', { name: /^.?\s*(Archive|Unarchive)$/ }).click();
    };
    await archiveVia('Old project notes');
    await page.locator('.chat-row:has-text("Old project notes")').waitFor({ state: 'detached' });
    await page.locator('.toast', { hasText: 'Archived' }).waitFor();
    console.log('PASS archiving hides a chat from the sidebar');

    await page.fill('#chat-search', 'zebra');
    await page.locator('.chat-row:has-text("Old project notes")').waitFor();
    assert.ok(await page.locator('.sidebar :text("Archived")').first().isVisible(), 'shown under Archived in search results');
    await page.fill('#chat-search', '');
    console.log('PASS search still finds archived chats');

    // All chats → Archived → Unarchive.
    await page.click('.view-all-chats, .cv-all');
    await page.getByRole('tab', { name: /Archived · 1/ }).click();
    await page.locator('.all-chats-title', { hasText: 'Old project notes' }).waitFor();
    assert.equal(await page.locator('.all-chats-list li').count(), 1);
    await page.getByLabel('Select Old project notes').check();
    await page.locator('.all-chats-actions').getByRole('button', { name: 'Unarchive' }).click();
    await page.getByRole('tab', { name: 'Chats' }).click();
    assert.equal(await page.locator('.all-chats-list li').count(), 3);
    // Bulk archive.
    await page.getByLabel('Select Recipes').check();
    await page.getByLabel('Select Taxes').check();
    await page.locator('.all-chats-actions').getByRole('button', { name: 'Archive' }).click();
    assert.equal(await page.locator('.all-chats-list li').count(), 1);
    console.log('PASS All chats archives and brings back several at once');

    // Kept after reload.
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await page.locator('.chat-row').first().waitFor();
    assert.equal(await page.locator('.chat-row').count(), 1);
    assert.ok(await page.locator('.chat-row:has-text("Old project notes")').isVisible());
    console.log('PASS archiving is saved');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
