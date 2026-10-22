// 2.0: a reply that finishes in another chat says so in the app (with a way to open it); one that finishes
// while you're in another app or tab sets the icon badge and, if you turned it on, shows a notification.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const other = { id: 'other', title: 'Other chat', createdAt: now - 1e6, updatedAt: now - 1e6, model: 'gemini:gemini-flash-latest', messages: [{ id: 'o1', role: 'user', text: 'hi', createdAt: now - 1e6 }, { id: 'o2', role: 'assistant', status: 'done', text: 'Hello', createdAt: now - 1e6 }] };
const sse = (text) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n';

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'notifications', 'light', { notifyReplies: true });
    await ctx.addInitScript(() => {
      window.__notes = []; window.__badge = [];
      window.Notification = class { static permission = 'granted'; static requestPermission() { return Promise.resolve('granted'); } constructor(title, o) { window.__notes.push({ title, body: o.body, tag: o.tag }); } close() {} };
      navigator.setAppBadge = (n) => { window.__badge.push(n); return Promise.resolve(); };
      navigator.clearAppBadge = () => { window.__badge.push(0); return Promise.resolve(); };
    });
    await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
      if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
      await new Promise((res) => setTimeout(res, 1500));
      return r.fulfill({ contentType: 'text/event-stream', body: sse('**The answer** is 42.') });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await seed(page, 'notifications', [other]);
    await page.reload();
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');

    // ---- In another chat when it finishes: a note with Open.
    await page.fill('.composer textarea', 'What is the answer?');
    await page.click('.send-btn');
    await page.click('.chat-row:has-text("Other chat") .chat-open');
    const toast = page.locator('.toast', { hasText: 'Reply ready in' });
    await toast.waitFor();
    await toast.getByRole('button', { name: 'Open' }).click();
    await page.locator('.msg.assistant:has-text("The answer is 42.")').waitFor();
    assert.deepEqual(await page.evaluate(() => window.__notes), [], 'no system notification while you are looking');
    console.log('PASS a reply finishing in another chat says so, and Open goes there');

    // ---- Away (another app or tab): badge + notification with the reply's start.
    await page.fill('.composer textarea', 'And again?');
    await page.click('.send-btn');
    await page.evaluate(() => { document.hasFocus = () => false; });
    await page.waitForFunction(() => window.__notes.length > 0);
    const [note] = await page.evaluate(() => window.__notes);
    assert.equal(note.body, 'The answer is 42.');
    assert.equal(await page.evaluate(() => window.__badge[0]), 1, 'the icon shows one unseen reply');
    await page.evaluate(() => { document.hasFocus = () => true; window.dispatchEvent(new Event('focus')); });
    assert.equal(await page.evaluate(() => window.__badge.at(-1)), 0, 'coming back clears the badge');
    console.log('PASS away: the icon badge and a notification');

    // ---- The setting.
    await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: 'General', exact: true }).click();
    const toggle = page.locator('.settings-page:not(.exit-ghost)').getByLabel('Notify me when a reply is ready');
    assert.ok(await toggle.isChecked());
    await toggle.uncheck();
    await page.click('.settings-page [aria-label="Close"]');
    await page.fill('.composer textarea', 'Once more?');
    await page.click('.send-btn');
    await page.evaluate(() => { document.hasFocus = () => false; });
    await page.locator('.msg.assistant').nth(2).locator('.model-tag').waitFor();
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__notes.length), 1, 'off: no more notifications');
    console.log('PASS the notification setting turns them off');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
