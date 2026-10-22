// Settings → Models → Review opens for older accounts, whose removed models have no recorded reasons.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'] }] } }));
    await ctx.addInitScript(() => {
      if (localStorage.getItem('mr.preview_user')) return;
      const uid = 'preview-removed-empty';
      const settings = { autoIntroduced: true, enabledModels: ['gemini:gemini-flash-latest'], defaultModel: 'gemini:gemini-flash-latest', unavailableModels: ['gemini:gemini-old-fixture'] };
      localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'empty@local.invalid', displayName: 'Empty' }));
      localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
      localStorage.setItem('mr.settings', JSON.stringify(settings));
      localStorage.setItem('mr.installHint', '1');
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && /Maximum update depth|getSnapshot/.test(m.text())) errors.push(m.text()); });
    await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
    await page.waitForSelector('.composer textarea');
    await page.click('.menu-btn');
    await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: 'Models', exact: true }).click();
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Removed models' });
    await dialog.waitFor();
    assert.match(await dialog.textContent(), /gemini-old-fixture[\s\S]*Removed before reasons were recorded/);
    await dialog.getByRole('button', { name: 'Done' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.deepEqual(errors, []);
    console.log('PASS Review opens for removals without recorded reasons');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
