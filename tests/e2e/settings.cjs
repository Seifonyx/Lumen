const { backSettingsSection, closeSettings } = require('./helpers/ui.cjs');
// Settings page: desktop section list + panel; phone menu → section → back; Esc closes.
const { chromium } = require('playwright');
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };

async function open(browser, mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 820 } });
  await ctx.route('**/generativelanguage.googleapis.com/**', (r) => r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'] }] } }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForFunction(() => document.querySelector('.settings-page') || document.querySelector('.topbar')?.offsetParent);
  return { page, errors };
}

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();

  // Desktop
  const D = await open(browser, false);
  await D.page.waitForSelector('input[placeholder="AIza…"]');
  check((await D.page.textContent('.settings-heading h2')) === 'API keys', 'first sign-in opens API keys as a page');
  check(await D.page.isVisible('.sidebar') && await D.page.isVisible('.settings-tabs'), 'desktop: sidebar and section list stay visible');
  check(!(await D.page.isVisible('.main')), 'desktop: chat hidden while settings is open');
  await D.page.fill('input[placeholder="AIza…"]', 'g');
  await D.page.click('button:has-text("Save keys")');
  await D.page.waitForTimeout(1200);
  await D.page.click('.settings-tabs >> text=Memory');
  check((await D.page.textContent('.settings-heading h2')) === 'Memory' && await D.page.isVisible('.memory-tab'), 'desktop: switching sections');
  check(!(await D.page.isVisible('.settings-back')), 'desktop: no back arrow');
  await D.page.click('.settings-tabs >> text=General');
  await D.page.screenshot({ path: require('path').join(__dirname, 'out', 'settings-desktop.png') });
  await D.page.keyboard.press('Escape');
  await D.page.waitForSelector('.app:not(.app-skeleton) .topbar');
  check(!(await D.page.$('.settings-page')), 'Esc closes settings');
  check((await D.page.textContent('.disclaimer')) === 'AI can make mistakes. Check important info.', 'warning under the message box has no "patient"');
  await D.page.click('.sidebar-foot, .cv-account');
  check((await D.page.textContent('.settings-heading h2')) === 'General', 'desktop: opening from the sidebar shows General');
  await D.page.click('.settings-page [aria-label="Close"]');

  // Phone
  const P = await open(browser, true);
  // Onboarding can land directly in API Keys, without a previous Settings index entry.
  if (!(await P.page.locator('.settings-page').isVisible())) {
    await P.page.locator('.composer textarea').waitFor();
    await P.page.click('.menu-btn');
    await P.page.click('.sidebar-foot, .cv-account');
  }
  // A first-sign-in deep link may show Keys; allow the lazy screen to mount before
  // distinguishing an actual subsection from an index screen still rendering.
  await P.page.locator('.settings-tabs').waitFor({ state: 'attached' });
  if (!(await P.page.locator('.settings-tabs').isVisible())) {
    check(await P.page.locator('.settings-page .phone-navigation button[aria-label^="Return to "], .settings-page .settings-back').isVisible(), 'phone: direct-entry settings subsection offers Back');
    await closeSettings(P.page);
  }
  if (!(await P.page.locator('.settings-page').isVisible())) {
    await P.page.locator('.composer textarea').waitFor();
    await P.page.click('.menu-btn');
    await P.page.click('.sidebar-foot, .cv-account');
  }
  await P.page.locator('.settings-tabs').waitFor({ state: 'visible' });
  const rows = await P.page.$$eval('.settings-tabs button', (b) => b.map((x) => x.querySelector('.tab-label').textContent));
  check(rows.length === 9 && rows.includes('Connectors') && rows[0] === 'General' && !rows.includes('Layouts'), `phone: section menu (${rows.join(', ')})`);
  check(!(await P.page.isVisible('.settings-panel')), 'phone: menu first, no sideways tabs');
  const box = await P.page.locator('.settings-tabs').boundingBox();
  check(box.width <= 390 && (await P.page.evaluate(() => document.querySelector('.settings-tabs').scrollWidth <= document.querySelector('.settings-tabs').clientWidth)), 'phone: nothing scrolls sideways');
  await P.page.click('.settings-tabs >> text=Models');
  const modern = await P.page.locator('.settings-page .phone-navigation').isVisible();
  check((modern ? await P.page.locator('.settings-page .phone-navigation button[aria-label^="Return to "]').isVisible() && (await P.page.locator('.phone-navigation h1').textContent()).includes('Models') : await P.page.isVisible('.settings-back') && (await P.page.textContent('.settings-title')).includes('Models')) && !(await P.page.isVisible('.settings-tabs')), 'phone: section opens with contextual Back');
  await P.page.waitForTimeout(500);
  await P.page.screenshot({ path: require('path').join(__dirname, 'out', 'settings-phone-section.png') });
  await backSettingsSection(P.page);
  check(await P.page.isVisible('.settings-tabs') && !(await P.page.isVisible('.settings-panel')), 'phone: back returns to the menu');
  await P.page.screenshot({ path: require('path').join(__dirname, 'out', 'settings-phone-menu.png') });
  await P.page.click('.settings-tabs >> text=Usage');
  await closeSettings(P.page);
  await P.page.locator('.settings-page').waitFor({ state: 'hidden' });
  await P.page.locator('.composer textarea').waitFor({ state: 'visible' });
  check(true, 'phone: close returns to the chat');

  check(![...D.errors, ...P.errors].length, `no page errors ${[...D.errors, ...P.errors].join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
