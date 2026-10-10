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
      for (const theme of ['light', 'dark']) {
        const label = `${width}px ${theme}`;
        const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile,
          ...(mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' } : {}) });
        await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
        await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
          const url = r.request().url();
          if (url.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 1048576 }] } });
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
        await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
        await page.waitForSelector('.main.is-empty');
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
        for (const name of ['General', 'API keys', 'Models', 'Usage', 'Personalization', 'Memory', 'Privacy', 'Data']) {
          if (await page.locator('.settings-back').isVisible()) await page.click('.settings-back');
          await page.locator('.settings-tabs button').filter({ hasText: name }).first().click();
          const issues = await scan(page);
          check(issues.length === 0, `${label}: ${name} settings fit${issues.length ? ' ' + JSON.stringify(issues) : ''}`);
        }
        check(errors.length === 0, `${label}: no browser errors (${errors.join(' | ')})`);
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
