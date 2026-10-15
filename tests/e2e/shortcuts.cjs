// Desktop keyboard shortcuts and the cheat sheet.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, serviceWorkers: 'block', reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    await profile(ctx, 'preview-shortcuts', 'light');
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
    await page.locator('.composer textarea').waitFor();
    const now = Date.now();
    await seed(page, 'preview-shortcuts', [{ id: 'k1', title: 'Shortcut chat', createdAt: now, updatedAt: now, messages: [{ id: 'u', role: 'user', text: 'hi', createdAt: now }, { id: 'a', role: 'assistant', text: 'LAST_REPLY_MARKER', status: 'done', createdAt: now }] }]);
    await page.reload(); await page.locator('.composer textarea').waitFor();
    await page.locator('.chat-row').filter({ hasText: 'Shortcut chat' }).click();
    await page.locator('body').click({ position: { x: 700, y: 300 } });

    await page.keyboard.press('Control+/');
    await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor();
    assert.ok(await page.getByText('Show or hide the sidebar').isVisible());
    await page.keyboard.press('Escape');

    await page.keyboard.press('/');
    assert.ok(await page.locator('.composer textarea').evaluate((el) => el === document.activeElement), '/ focuses the message box');
    await page.keyboard.type('?');
    assert.equal(await page.locator('.composer textarea').inputValue(), '?', 'single-key shortcuts do nothing while typing');
    await page.locator('.composer textarea').fill('');

    await page.keyboard.press('Control+Shift+S');
    await page.waitForFunction(() => document.querySelector('.app')?.classList.contains('sidebar-collapsed'));
    await page.keyboard.press('Control+Shift+S');
    await page.waitForFunction(() => !document.querySelector('.app')?.classList.contains('sidebar-collapsed'));

    await page.keyboard.press('Control+Shift+;');
    await page.getByText('Copied the last reply').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'LAST_REPLY_MARKER');

    await page.keyboard.press('Control+,');
    await page.locator('.settings-page').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.settings-page').waitFor({ state: 'detached' });

    // On computers the sidebar stays usable while Settings is open; using it leaves Settings.
    await page.keyboard.press('Control+,');
    await page.locator('.settings-page').waitFor();
    await page.locator('.chat-row').filter({ hasText: 'Shortcut chat' }).click();
    await page.locator('.settings-page').waitFor({ state: 'detached' });
    await page.locator('.msg.assistant').filter({ hasText: 'LAST_REPLY_MARKER' }).waitFor();

    await page.keyboard.press('Control+Shift+L');
    await page.locator('.hub-page h1', { hasText: 'Assistants' }).waitFor();
    await page.keyboard.press('Escape');

    page.once('dialog', (d) => d.accept());
    await page.keyboard.press('Control+Shift+Backspace');
    await page.locator('.chat-row').filter({ hasText: 'Shortcut chat' }).waitFor({ state: 'detached' });

    assert.deepEqual(errors.filter((m) => !m.includes('firestore')), []);
    console.log('PASS keyboard shortcuts and cheat sheet');
    await ctx.close();
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
