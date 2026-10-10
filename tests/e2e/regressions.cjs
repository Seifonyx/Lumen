// Regression coverage for drafts, project reloads, comparison privacy, modal focus and phone layouts.
const { chromium } = require('playwright');
const path = require('node:path');
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
const PROJECT = 'regression-project';
const EMAIL = 'alice@example.com';

async function open(browser, mobile) {
  const ctx = await browser.newContext(mobile ? {
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  } : { viewport: { width: 1280, height: 820 } });
  const network = { offline: false };
  const requests = [];
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    if (network.offline) return route.abort('internetdisconnected');
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [
      { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
    ] } });
    const body = route.request().postDataJSON();
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Regression chat' }] } }] } });
    requests.push({ url, body });
    const email = JSON.stringify(body).match(/\[EMAIL_\d+\]/)?.[0];
    const text = email ? `Your address is ${email}.` : 'Regression answer.';
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) });
  });
  // Use the app's isolated local sandbox; no real account or paid provider is contacted.
  await ctx.route('**/firestore.googleapis.com/**', (route) => route.abort());
  await ctx.addInitScript(({ id }) => {
    if (window.top !== window) return;
    if (localStorage.getItem('mr.preview_user')) return;
    const uid = 'preview-regression_local';
    const settings = {
      enabledModels: ['gemini:gemini-flash-latest', 'gemini:gemini-2.5-pro'], defaultModel: 'gemini:gemini-flash-latest',
      autoIntroduced: true, autoTitle: false, theme: 'dark', privacyShield: true, privacyMode: 'auto', privacyRestore: true,
      projects: [{ id, name: 'Study', instructions: 'PROJECT_INSTRUCTIONS_MARKER: use these references.', defaultModel: 'gemini:gemini-2.5-pro', createdAt: 1, updatedAt: 1,
        files: [{ id: 'reference', kind: 'text', name: 'protocol.txt', mime: 'text/plain', size: 24, text: 'PROJECT_REFERENCE_MARKER' }] }],
    };
    localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'regression@local.invalid', displayName: 'Regression', photoURL: '' }));
    localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'test-key', settings }));
    localStorage.setItem('mr.settings', JSON.stringify(settings));
    localStorage.setItem('mr.activeProject', id);
  }, { id: PROJECT });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack || error.message));
  await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
  await page.waitForSelector('.topbar');
  return { ctx, page, errors, network, requests };
}

async function settings(page, name) {
  if (!(await page.locator('.settings-page').isVisible())) {
    if (await page.locator('.menu-btn').isVisible() && !(await page.locator('.sidebar.open').isVisible())) await page.click('.menu-btn');
    await page.click('.sidebar-foot');
  }
  if (await page.locator('.settings-back').isVisible()) await page.click('.settings-back');
  await page.locator('.settings-tabs button').filter({ hasText: name }).first().click();
}

async function run(browser, mobile) {
  const { ctx, page, errors, network, requests } = await open(browser, mobile);
  const label = mobile ? 'phone' : 'desktop';

  await page.keyboard.press('Control+k');
  await page.waitForSelector('.command-search input');
  await page.keyboard.type('Memory');
  check(await page.locator('.command-search input').inputValue() === 'Memory', `${label}: Ctrl+K focuses search immediately`);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  check(await page.locator('.settings-page').isVisible() && (await page.locator('.settings-title').textContent()).includes(mobile ? 'Memory' : 'Settings'), `${label}: command can open Memory using the keyboard`);
  await page.locator('.settings-page [aria-label="Close"]').click();

  await page.reload();
  await page.waitForSelector('.topbar');
  if (mobile) await page.click('.menu-btn');
  check(await page.locator('.project-switcher select').inputValue() === PROJECT, `${label}: project selection survives reload`);
  if (mobile) await page.locator('.sidebar [aria-label="Close menu"]').click();
  check((await page.locator('.model-button').textContent()).includes('Gemini 2.5 Pro'), `${label}: project default model is shown before the first message`);
  await page.fill('.composer textarea', 'Use the project references after reload.');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant .markdown');
  check(requests.length === 1 && requests[0].url.includes('gemini-2.5-pro') && JSON.stringify(requests[0].body).includes('PROJECT_INSTRUCTIONS_MARKER') && JSON.stringify(requests[0].body).includes('PROJECT_REFERENCE_MARKER'), `${label}: first message after reload uses project instructions, files and model`);
  await page.reload();
  await page.waitForSelector('.topbar');
  if (mobile) await page.click('.menu-btn');
  check(await page.locator('.chat-row').count() === 1, `${label}: the saved chat stays inside the selected project's list`);
  if (mobile) await page.locator('.sidebar [aria-label="Close menu"]').click();

  const draft = 'Keep this offline comparison draft';
  await page.fill('.composer textarea', draft);
  await page.locator('.composer input[type=file][multiple]').setInputFiles({ name: 'draft.txt', mimeType: 'text/plain', buffer: Buffer.from('Unsent attachment') });
  await page.waitForSelector('.attachment:not(.loading)');
  await page.click('.compare-trigger');
  const before = requests.length;
  network.offline = true;
  await ctx.setOffline(true);
  await page.click('.compare-picker-actions .primary');
  check(await page.locator('.composer textarea').inputValue() === draft && await page.locator('.attachment').count() === 1, `${label}: offline Compare preserves text and attachment`);
  check(await page.evaluate((draft) => Object.keys(localStorage).some((key) => key.startsWith('mr.draft.') && localStorage.getItem(key) === draft), draft), `${label}: offline Compare retains the saved draft`);
  check(requests.length === before && await page.locator('.comparison-card').count() === 0, `${label}: offline Compare starts no requests`);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await ctx.setOffline(false);
  network.offline = false;
  await page.locator('.attachment button').click();

  await page.fill('.composer textarea', `My email is ${EMAIL}; repeat it.`);
  await page.click('.compare-trigger');
  await page.click('.compare-picker-actions .primary');
  await page.waitForSelector('.comparison-save');
  await page.waitForFunction(() => document.querySelectorAll('.comparison-save').length === 2);
  check((await page.locator('.comparison-answer').allTextContents()).every((text) => text.includes(EMAIL) && !text.includes('[EMAIL_1]')), `${label}: comparison restores private details locally`);
  check(!requests.some((request) => JSON.stringify(request.body).includes(EMAIL)), `${label}: actual private details never leave the browser`);
  await page.locator('.comparison-save').first().click();
  check((await page.locator('.msg.assistant .markdown').last().textContent()).includes(EMAIL), `${label}: continuing a comparison keeps the restored answer`);

  await settings(page, 'Privacy');
  await page.locator('.setting-row').filter({ hasText: 'Restore real values in replies' }).locator('input.switch').uncheck();
  await page.locator('.settings-page [aria-label="Close"]').click();
  await page.fill('.composer textarea', `My email is ${EMAIL}; compare again.`);
  await page.click('.compare-trigger');
  await page.click('.compare-picker-actions .primary');
  await page.waitForFunction(() => document.querySelectorAll('.comparison-save').length === 2);
  check((await page.locator('.comparison-answer').allTextContents()).every((text) => text.includes('[EMAIL_1]') && !text.includes(EMAIL)), `${label}: disabling restoration keeps comparisons masked`);
  await page.locator('.comparison-actions button').click();

  await settings(page, 'Privacy');
  await page.getByRole('radio', { name: 'Ask me', exact: true }).click();
  await page.locator('.settings-page [aria-label="Close"]').click();
  await page.fill('.composer textarea', `Email ${EMAIL} in a comparison.`);
  await page.click('.compare-trigger');
  await page.click('.compare-picker-actions .primary');
  await page.waitForSelector('.privacy-check');
  network.offline = true;
  await ctx.setOffline(true);
  await page.getByRole('button', { name: 'Mask and send' }).click();
  check((await page.locator('.composer textarea').inputValue()).includes(EMAIL) && await page.locator('.privacy-check').isVisible() && await page.locator('.comparison-card').count() === 0, `${label}: going offline during privacy approval preserves the draft`);
  await page.getByRole('button', { name: 'Edit message' }).click();
  await ctx.setOffline(false);
  network.offline = false;

  if (mobile) {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.click('.menu-btn');
    await page.click('[aria-label="Manage projects"]');
    await page.locator('.project-manage-row').first().click();
    const fits = await page.locator('.project-form-actions').evaluate((row) => {
      const bounds = row.getBoundingClientRect();
      return row.scrollWidth <= row.clientWidth + 1 && [...row.querySelectorAll('button')].every((button) => {
        const box = button.getBoundingClientRect();
        return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
      });
    });
    check(fits, 'phone: project editor actions fit at 320px');
    await page.screenshot({ path: path.join(__dirname, 'out', 'regression-project-320.png') });
    await page.locator('.modal [aria-label="Close"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await settings(page, 'Personalization');
    // Exercise the actual iOS handler with a synthetic keyboard viewport. Physical Safari still needs checking.
    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 460 });
      window.visualViewport.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(() => document.documentElement.classList.contains('kb-open'));
    const touch = async (selector) => page.locator(selector).evaluate((target) => {
      const point = new Touch({ identifier: 1, target, clientX: 30, clientY: 100 });
      const event = new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [point], targetTouches: [point], changedTouches: [point] });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    });
    check(!(await touch('.settings-scroll')) && !(await touch('.settings-panel textarea')), 'iOS simulation: settings and textarea scrolling allowed with keyboard open');
    check(await touch('.settings-top'), 'iOS simulation: app chrome still blocks page panning');
    await page.locator('.settings-page [aria-label="Close"]').click();
    check(await touch('.composer textarea'), 'iOS simulation: composer drag still cannot pan the page');
    check(!(await touch('.messages')), 'iOS simulation: chat history scrolling stays enabled');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.command-search input');
    await page.fill('.command-search input', '');
    const modalScrollable = await page.locator('.modal-body').evaluate((body) => { body.style.maxHeight = '100px'; return body.scrollHeight > body.clientHeight; });
    check(modalScrollable && !(await touch('.modal-body')), 'iOS simulation: scrollable dialogs stay usable with the keyboard open');
    await page.keyboard.press('Escape');
  }
  check(errors.length === 0, `${label}: no browser errors (${errors.join(' | ')})`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try { await run(browser, false); await run(browser, true); }
  finally { await browser.close(); }
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(2); });
