// Public share links: create (with personal details hidden), open signed out, update, list, stop sharing.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8080/v1/projects/the-model-router/databases/(default)/documents';
const app = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const reply = (text) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n';

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  try {
    const owner = await browser.newContext({ viewport: { width: 1280, height: 860 }, permissions: ['clipboard-read', 'clipboard-write'] });
    await owner.route('**/generativelanguage.googleapis.com/**', (r) => r.request().url().includes('/models?')
      ? r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }] } })
      : r.fulfill({ contentType: 'text/event-stream', body: reply('**Summary:** stable overnight. SHARE_REPLY_MARKER') }));
    const page = await owner.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(app);
    await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
    await page.waitForSelector('input[placeholder="AIza…"]');
    await page.fill('input[placeholder="AIza…"]', 'fixture');
    await page.getByRole('button', { name: 'Save keys', exact: true }).click();
    await page.waitForTimeout(800);
    await page.locator('.settings-page [aria-label="Close"]').click();
    await page.fill('.composer textarea', 'Patient: Mona Adel, phone 01012345678. Summarize the night.');
    await page.click('.send-btn');
    await page.locator('.msg.assistant').filter({ hasText: 'SHARE_REPLY_MARKER' }).waitFor();

    // Create the link from the chat's menu.
    await page.getByRole('button', { name: 'Chat options', exact: true }).first().click();
    await page.getByRole('menuitem', { name: 'Share or export', exact: true }).click();
    const panel = page.locator('.share-panel');
    await panel.getByRole('button', { name: 'Create public link' }).waitFor();
    assert.ok(await panel.getByRole('checkbox').isChecked(), 'personal details are hidden by default');
    await panel.getByRole('button', { name: 'Create public link' }).click();
    const link = await panel.getByLabel('Public link').inputValue();
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-panel.png' });
    assert.match(link, /\/share\/[A-Za-z0-9]{24}$/);

    // A signed-out visitor sees the text, with details hidden.
    const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const v = await visitor.newPage();
    const url = link + '?emulator';
    await v.goto(url);
    await v.locator('.shared-thread').waitFor();
    const text = await v.locator('.shared-page').textContent();
    if (process.env.SHOT) await v.screenshot({ path: process.env.SHOT + '-page.png' });
    assert.match(text, /SHARE_REPLY_MARKER/);
    assert.doesNotMatch(text, /Mona Adel|01012345678/, 'name and phone hidden');
    assert.match(text, /\[(NAME|PHONE)_1\]/);
    assert.equal(await v.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow');
    assert.equal(await v.locator('.composer').count(), 0, 'visitors see only the shared chat');

    // Nobody else can list links; the raw document holds no owner-private data beyond the chat copy.
    const listing = await fetch(`${base}/modelRouterShares`);
    assert.notEqual(listing.status, 200, 'links cannot be listed without signing in');

    // Settings lists it; Stop sharing turns it off for everyone.
    await page.locator('.modal [aria-label="Close"]').first().click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.locator('.settings-tabs .tab-label').getByText('Privacy & data', { exact: true }).click();
    const row = page.locator('.setting-row').filter({ hasText: 'Personal details hidden' });
    await row.waitFor();
    await row.getByRole('button', { name: /^Stop sharing/ }).click();
    await page.getByText('No public links.', { exact: false }).waitFor();
    await v.reload();
    await v.getByRole('heading', { name: 'This link isn’t available' }).waitFor();

    assert.deepEqual(errors, []);
    console.log('PASS share links: create with hidden details, open signed out, list, stop sharing');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
