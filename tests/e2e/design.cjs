// Visual and interaction regressions for the shared product design. Only local data / mocked AI.
const { chromium } = require('playwright');
const path = require('node:path');
const { scan } = require('./helpers/fitscan.cjs');
let failures = 0;
const check = (ok, label) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`); if (!ok) failures++; };
const inside = (box, width, height) => box && box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1;
(async () => {
  const browser = await chromium.launch();
  try {
    for (const [width, height, mobile] of [[1280, 820, false], [390, 844, true], [320, 720, true]]) {
      for (const theme of ['light', 'dark', 'black']) {
        const label = `${width}px ${theme}`;
        const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile,
          ...(mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}) });
        await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
        await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
          const url = r.request().url();
          if (url.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576 }, { name: 'models/gemini-pro-test', displayName: 'Gemini Pro Test', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576 }] } });
          return r.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: '## A clearer summary\n\n- Review the actions.\n- Share progress with the team.' }] }, finishReason: 'STOP' }] }) + '\n\n' });
        });
        await ctx.addInitScript(({ theme }) => {
          if (window.top !== window || localStorage.getItem('mr.preview_user')) return;
          const uid = 'preview-design_test';
          const settings = { theme, autoIntroduced: true, autoTitle: false, enabledModels: ['gemini:gemini-flash-latest'], defaultModel: 'gemini:gemini-flash-latest' };
          localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'design@local.invalid', displayName: 'Design', photoURL: '' }));
          localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'test-key', settings }));
          localStorage.setItem('mr.settings', JSON.stringify(settings));
          localStorage.setItem('mr.installHint', '1');
        }, { theme });
        const page = await ctx.newPage(), errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('.main.is-empty');
        if (theme === 'black') check(await page.evaluate(() => document.documentElement.dataset.appearance === 'black' && getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)'), `${label}: true black background survives reload`);
        check(inside(await page.locator('.composer').boundingBox(), width, height) && (await scan(page)).length === 0, `${label}: welcome screen and composer fit`);
        check(await page.locator('.suggestion').count() === 4 && await page.locator('.suggestion svg').first().evaluate((el) => getComputedStyle(el).padding === '0px'), `${label}: four readable starter actions with visible icons`);
        if (!mobile) {
          await page.click('[aria-label="Collapse sidebar"]');
          check(!(await page.locator('.sidebar').isVisible()), `${label}: sidebar collapses`);
          await page.reload(); await page.waitForSelector('.topbar');
          check(!(await page.locator('.sidebar').isVisible()) && await page.locator('[aria-label="Expand sidebar"]').isVisible(), `${label}: focused layout persists after reload`);
          await page.click('[aria-label="Expand sidebar"]');
        } else {
          await page.evaluate(() => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 460 }); window.visualViewport.dispatchEvent(new Event('resize')); });
          await page.waitForFunction(() => document.documentElement.classList.contains('kb-open'));
          check(inside(await page.locator('.composer').boundingBox(), width, 460) && !(await page.locator('.starter-actions').isVisible()), `${label}: welcome composer fits with simulated iOS keyboard`);
          await page.evaluate((height) => { Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: height }); window.visualViewport.dispatchEvent(new Event('resize')); }, height);
          await page.waitForFunction(() => !document.documentElement.classList.contains('kb-open'));
        }
        await page.screenshot({ path: path.join(__dirname, 'out', `design-home-${width}-${theme}.png`) });
        const add = mobile ? '[aria-label="Add photos, files or a repository"]' : '[aria-label="Add files or a repository"]';
        await page.click(add);
        check(await page.locator('.sheet-row').count() === (mobile ? 3 : 2) && await page.locator('.sheet').evaluate((el) => el.contains(document.activeElement)), `${label}: unified add menu has correct actions and keyboard focus`);
        if (!mobile) check(await page.locator('.sheet-popover-backdrop').isVisible() && inside(await page.locator('.sheet').boundingBox(), width, height), `${label}: add menu opens beside the composer and fits on screen`);
        await page.keyboard.press('Shift+Tab');
        check(await page.locator('.sheet-row').last().evaluate((el) => el === document.activeElement), `${label}: add menu traps keyboard focus`);
        await page.keyboard.press('Escape');
        check(!(await page.locator('.sheet').isVisible()) && await page.locator(add).evaluate((el) => el === document.activeElement), `${label}: Escape returns focus to add button`);
        await page.click(add);
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        if (!mobile) await page.locator('.sheet').waitFor({ state: 'hidden' });
        check(await page.locator('.sheet').isVisible() === mobile, `${label}: resize dismisses desktop popover but preserves phone sheet`);
        if (mobile) await page.keyboard.press('Escape');
        await page.click(add);
        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: /Photos & files/ }).click();
        await (await chooser).setFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Weekly review notes') });
        await page.waitForSelector('.attachment:not(.loading)');
        check(await page.locator('.attachment').count() === 1 && !(await page.locator('.sheet').isVisible()), `${label}: merged menu attaches files`);
        await page.fill('.composer textarea', 'Summarize the weekly notes.');
        await page.click('.send-btn'); await page.waitForSelector('.msg.assistant .markdown');
        check(!(await page.locator('.starter-actions').isVisible()) && (await scan(page)).length === 0, `${label}: conversation replaces welcome and stays readable`);
        if (mobile) await page.click('.menu-btn');
        await page.click('.sidebar-foot');
        if (mobile) await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 0);
        for (const name of ['General', 'API keys', 'Models', 'Usage', 'Personalization', 'Memory', 'Privacy & data']) {
          if (await page.locator('.settings-back').isVisible()) await page.click('.settings-back');
          await page.locator('.settings-tabs button').filter({ hasText: name }).first().click();
          const issues = await scan(page);
          check(issues.length === 0, `${label}: ${name} settings fit${issues.length ? ' ' + JSON.stringify(issues) : ''}`);
          if (name === 'General') {
            await page.getByRole('radio', { name: 'True black', exact: true }).click();
            check(await page.evaluate(() => document.documentElement.dataset.appearance === 'black' && JSON.parse(localStorage.getItem('mr.settings')).theme === 'black'), `${label}: True black saves the appearance choice`);
            await page.getByRole('radio', { name: theme === 'black' ? 'True black' : theme === 'dark' ? 'Dark' : 'Light', exact: true }).click();
          }
          if (name === 'Models') {
            check(!(await page.locator('.model-list.add').isVisible()) && !(await page.locator('.layouts-tab').isVisible()), `${label}: models starts with a focused saved list`);
            await page.locator('.models-nav button').filter({ hasText: 'Browse models' }).click();
            await page.getByLabel('Search available models').fill('Pro Test');
            check(await page.locator('.model-list.add .model-row').count() === 1 && (await scan(page)).length === 0, `${label}: model catalogue search fits`);
            await page.getByRole('button', { name: 'Add Gemini Pro Test', exact: true }).click();
            await page.locator('.models-nav button').filter({ hasText: 'Your models' }).click();
            const pro = page.locator('.saved-model', { hasText: 'Gemini Pro Test' });
            await pro.getByRole('button', { name: 'Options for Gemini Pro Test', exact: true }).click();
            await pro.getByRole('button', { name: 'Move up', exact: true }).click();
            check((await page.locator('.saved-model').first().textContent()).includes('Gemini Pro Test') && (await scan(page)).length === 0, `${label}: model options reorder without crowding`);
            await pro.locator('.star').click();
            check(await pro.locator('.star').evaluate(el => el.classList.contains('on')), `${label}: saved model can become the default`);
            await page.screenshot({ path: path.join(__dirname, 'out', `models-${width}-${theme}.png`) });
            await pro.getByRole('button', { name: 'Remove', exact: true }).click();
            check(await page.locator('.saved-model').count() === 1, `${label}: model removal retains the other saved model`);
            await page.locator('.models-nav button').filter({ hasText: 'Layouts' }).click();
            check(await page.locator('.layouts-tab').isVisible() && (await scan(page)).length === 0, `${label}: layouts remain accessible in a dedicated view`);
            await page.locator('.models-nav button').filter({ hasText: 'Your models' }).click();
          }
          if (name === 'Privacy & data') {
            check(await page.getByRole('button', { name: 'Back up', exact: true }).isVisible() && await page.getByRole('button', { name: 'Restore', exact: true }).isVisible(), `${label}: merged tab keeps backup controls`);
            check(!(await page.getByLabel('Sample text to mask').isVisible()), `${label}: privacy preview starts collapsed`);
            await page.locator('.privacy-tester summary').click();
            await page.getByLabel('Sample text to mask').fill('Contact me at test@example.com');
            check((await page.locator('.privacy-preview').textContent()).includes('[EMAIL_1]'), `${label}: expandable privacy preview masks details locally`);
            await page.screenshot({ path: path.join(__dirname, 'out', `privacy-data-${width}-${theme}.png`) });
          }
        }
        check(errors.length === 0, `${label}: no browser errors (${errors.join(' | ')})`);
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
