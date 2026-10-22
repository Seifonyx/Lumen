// CP01 characterization only. Existing ordinary App and approved Canvas proof; no new presentation behavior.
// MR_TEST_URL=<ordinary build URL> CP01_PROOF_URL=<localhost proof URL> node tests/e2e/canvas-integration.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const { chats, projects } = require('../../docs/blackout/workspace-proofs/proposals/fixture.cjs');
const engine = process.env.MR_WEBKIT ? webkit : chromium;
const ordinary = process.env.MR_TEST_URL || 'http://localhost:5190/';
// Proof is served only by an explicitly started, loopback Vite server, never the production build.
const proof = process.env.CP01_PROOF_URL;
const out = process.env.CP01_OUT || path.join('tests/e2e/out', 'cp01');
const flash = 'gemini:gemini-flash-latest', pro = 'gemini:gemini-2.5-pro';
const text = 'Keep this exact draft: café 🌙.\nA second line, with a backwards selection.';
const launch = chats.find(c => c.id === 'launch');
const scenarios = (process.env.CP01_WIDTHS || '1440,390,320').split(',').map(Number);
const report = { engine: engine.name(), cases: [], physicalDevice: false, realProviderCalls: 0 };
const tick = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
async function selectedInput(input) {
  return input.evaluate(el => ({ same: el === window.__cp01Input, value: el.value,
    start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection }));
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await engine.launch();
  try {
    for (const mode of process.env.CP01_MODES ? process.env.CP01_MODES.split(',') : proof ? ['ordinary', 'canvas'] : ['ordinary']) for (const width of scenarios) {
      const height = width === 320 ? 568 : width === 390 ? 844 : 960;
      const phone = width < 900, owner = `preview-blackout-cp01-${mode}-${width}`;
      const url = mode === 'canvas' ? proof : ordinary;
      assert.equal(new URL(url).hostname, 'localhost', 'CP01 serves local evidence only');
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone,
        serviceWorkers: 'block', reducedMotion: 'reduce' });
      let release = () => {}, calls = 0, started;
      const startedRequest = new Promise(resolve => { started = resolve; });
      const errors = [], denied = new Set();
      try {
        await ctx.route('**/*', r => {
          if (new URL(r.request().url()).origin === new URL(url).origin) return r.continue();
          denied.add(new URL(r.request().url()).hostname); return r.abort();
        });
        await profile(ctx, owner, 'dark', { projects, enabledModels: [flash, pro], defaultModel: 'auto',
          layouts: [{ id: 'cp01', name: 'Foundation route', models: [flash, pro], mode: 'order', fallback: 'layout' }] });
        if (mode === 'canvas') await ctx.addInitScript(() => { window.__blackoutHarness = true; });
        await ctx.addInitScript(() => { localStorage.setItem('mr.modelCheck.background', JSON.stringify(Date.now())); });
        await ctx.route('**/generativelanguage.googleapis.com/**', async r => {
          if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: [
            { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-2.5-pro', displayName: 'Gemini Pro', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }
          ] } });
          calls++; started();
          await new Promise(resolve => { release = resolve; });
          try { await r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [
            { content: { parts: [{ text: 'Synthetic CP01 response.' }] }, finishReason: 'STOP' }
          ] }) + '\n\n' }); } catch { /* canonical Stop aborts the held synthetic request */ }
        });
        const page = await ctx.newPage(); ctx.__cp01Page = page; page.on('pageerror', e => errors.push(e.message));
        page.setDefaultTimeout(12000);
        await page.goto(url); await page.locator('.composer textarea').waitFor();
        await seed(page, owner, chats); await page.reload(); await page.locator('.composer textarea').waitFor();
        const openNav = async () => {
          if (!phone) return;
          await page.locator(mode === 'canvas' ? '[data-proposal-nav]' : '.menu-btn').first().click();
        };
        const chatRow = title => page.locator(mode === 'canvas' ? '.px-nav-host .pc-open' : '.sidebar .chat-open').filter({ hasText: title });
        const select = async title => {
          await openNav();
          const chat = chats.find(c => c.title === title);
          if (mode === 'canvas' && chat?.projectId) {
            const folder = page.locator(`[data-proposal-space="${chat.projectId}"]`);
            if (await folder.getAttribute('aria-expanded') === 'false') await folder.click();
          }
          await chatRow(title).click();
        };
        await select(launch.title);
        const input = page.locator('.composer textarea');
        if (mode === 'ordinary') {
          const appearance = () => page.evaluate(() => {
            const el = document.querySelector('.composer'), r = el.getBoundingClientRect(), style = getComputedStyle(el);
            return { x: r.x, y: r.y, width: r.width, height: r.height, color: style.color, background: style.backgroundColor };
          });
          const before = await appearance();
          await page.addStyleTag({ content: fs.readFileSync(path.resolve('src/styles/canvas.css'), 'utf8') });
          assert.deepEqual(await appearance(), before, 'loading token declarations cannot style the ordinary composer');
          const themeResults = await page.evaluate(() => {
            const root = document.documentElement, previous = root.dataset.theme;
            const scope = document.createElement('section'); scope.setAttribute('data-lumen-canvas-foundation', ''); document.body.append(scope);
            const result = [];
            for (const theme of ['light', 'dark', 'black']) {
              root.dataset.theme = theme;
              const local = getComputedStyle(scope), global = getComputedStyle(root);
              result.push({ theme, ink: local.getPropertyValue('--canvas-ink').trim(), expectedInk: global.getPropertyValue('--text').trim(),
                measure: local.getPropertyValue('--canvas-reading-measure').trim(), motion: local.getPropertyValue('--canvas-motion-duration').trim(),
                outside: global.getPropertyValue('--canvas-reading-measure').trim() });
            }
            if (previous === undefined) delete root.dataset.theme; else root.dataset.theme = previous;
            scope.remove(); return result;
          });
          for (const theme of themeResults) {
            assert.equal(theme.measure, '720px'); assert.equal(theme.ink, theme.expectedInk);
            assert.equal(theme.outside, '', 'scoped tokens never leak onto root');
            assert.equal(theme.motion, '0ms', 'reduced motion maps to zero duration');
          }
        }
        await input.fill(text); await input.evaluate(el => { el.focus(); el.setSelectionRange(8, 23, 'backward'); window.__cp01Input = el; });
        const expected = { same: true, value: text, start: 8, end: 23, direction: 'backward' };
        assert.deepEqual(await selectedInput(input), expected, 'canonical draft and backwards selection');
        if (mode === 'canvas') {
          await page.getByRole('button', { name: 'Expand writing', exact: true }).click();
          if (process.env.CP01_MUTATION === 'remount') await input.evaluate(el => el.replaceWith(el.cloneNode(true)));
          assert.deepEqual(await selectedInput(input), expected, 'expansion preserves mounted input and exact selection');
          assert(await input.evaluate(el => el === document.activeElement), 'expanded input keeps focus');
          await page.getByRole('button', { name: 'Collapse writing', exact: true }).click();
          assert.deepEqual(await selectedInput(input), expected, 'Done preserves input/draft/selection');
          await page.getByRole('button', { name: 'Expand writing', exact: true }).click();
          await page.keyboard.press('Escape');
          assert.deepEqual(await selectedInput(input), expected, 'Escape collapses without changing draft');
        }
        // Real ModelPicker keyboard navigation and actual selection, not a second picker or mock state.
        const picker = page.locator('.composer .model-button'); await picker.focus(); await page.keyboard.press('Enter');
        await page.getByRole('dialog', { name: 'Choose a model', exact: true }).waitFor();
        const option = page.getByRole('option').filter({ hasText: /Gemini.*Pro/i }).first();
        await option.click();
        await page.getByRole('dialog', { name: 'Choose a model', exact: true }).waitFor({ state: 'detached' });
        assert.match(await picker.innerText(), /Pro/i, 'real manual model selection reflected by composer');
        assert.equal(await input.inputValue(), text);
        for (const [optionText, shown] of [[/Foundation route/, /Foundation route/], [/^Auto/, /Auto/], [/Gemini.*Pro/i, /Pro/i]]) {
          await picker.focus(); await page.keyboard.press('Enter');
          const dialog = page.getByRole('dialog', { name: 'Choose a model', exact: true }); await dialog.waitFor();
          await page.keyboard.press('Tab');
          assert(await dialog.evaluate(el => el.contains(document.activeElement)), 'Tab remains inside the real picker');
          const choice = dialog.getByRole('option').filter({ hasText: optionText }).first();
          await choice.focus(); await page.keyboard.press('Enter');
          await dialog.waitFor({ state: 'detached' });
          assert.match(await picker.innerText(), shown);
          assert.deepEqual(await selectedInput(input), expected, 'Auto/manual/Layout changes preserve mounted input and backwards selection');
        }
        assert(await picker.evaluate(el => el === document.activeElement), 'picker restores trigger focus');
        const usage = page.locator('.composer .usage-chip'); await usage.focus(); await page.keyboard.press('Enter');
        await page.getByRole('dialog', { name: 'Usage', exact: true }).waitFor();
        assert.equal(await input.inputValue(), text, 'usage never submits the draft');
        await page.getByRole('button', { name: 'Close usage', exact: true }).click(); await tick(page);
        assert(await usage.evaluate(el => el === document.activeElement), 'usage restores trigger focus');
        assert.equal(calls, 0, 'picker/usage/expansion do not send inference');
        // Same chat across reload; cross-chat text stays per chat, selection is only promised while mounted.
        const other = chats.find(c => c.id !== 'launch' && !c.projectId);
        await select(other.title); await input.fill('OTHER_CHAT_DRAFT');
        await select(launch.title); assert.equal(await input.inputValue(), text, 'chat navigation restores its own draft');
        await page.reload(); await input.waitFor(); await select(launch.title);
        assert.equal(await input.inputValue(), text, 'account/chat draft survives reload and explicit chat selection');
        // Canonical project overview then return through history, preserving existing draft and model.
        await openNav();
        if (mode === 'canvas') await page.locator('.pc-brief').filter({ hasText: projects[0].description }).click();
        else await page.locator('.sidebar-project-item').filter({ hasText: projects[0].name }).click();
        await page.locator('.project-page').waitFor();
        await select(launch.title); assert.equal(await input.inputValue(), text, 'project round trip preserves draft');
        // Incognito starts from an empty chat; returning restores that unsent normal draft.
        await openNav();
        if (mode === 'canvas' && !phone) { await page.locator('.pc-dest button').filter({ hasText: 'New chat' }).click(); }
        else await page.locator(mode === 'canvas' ? '.pc-new-pill' : '.sidebar .new-chat').first().click();
        await input.fill(text);
        await page.getByRole('button', { name: 'Start incognito chat', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.composer textarea')?.value === '');
        await input.fill('CP01_PRIVATE_DRAFT');
        assert(!await page.evaluate(() => JSON.stringify(localStorage).includes('CP01_PRIVATE_DRAFT')));
        await page.getByRole('button', { name: 'End incognito chat', exact: true }).click();
        assert.equal(await input.inputValue(), text, 'exiting Incognito restores normal draft');
        // Exactly one synthetic dispatch, real Stop, no replay after transport settles.
        await input.fill('CP01_SYNTHETIC_SEND'); await page.getByRole('button', { name: 'Send', exact: true }).click();
        await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Synthetic provider request did not start')), 12000); startedRequest.then(() => { clearTimeout(timer); resolve(); }); });
        await page.getByRole('button', { name: 'Stop', exact: true }).click(); release();
        await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'detached' });
        assert.equal(calls, 1, 'one explicit Send; Stop cannot dispatch another request');
        // Cross-account reload must not expose first account's chat or draft.
        await input.fill('CP01_ACCOUNT_A_DRAFT');
        await page.evaluate(() => {
          const uid = 'preview-blackout-cp01-account-b';
          localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'fixture-b@local.invalid', displayName: 'Fixture B' }));
          localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ settings: { theme: 'dark', autoIntroduced: true, autoTitle: false, enabledModels: [], defaultModel: 'auto' } }));
        });
        await page.reload(); await input.waitFor({ state: 'attached' });
        assert.equal(await input.inputValue(), '', 'account B does not inherit account A draft');
        assert.equal(await page.getByText('CP01_SYNTHETIC_SEND', { exact: true }).count(), 0, 'account B does not inherit account A chat');
        // No layout overflow, page errors or hidden test tokens in the default app.
        assert(!await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1));
        assert.deepEqual(errors, [], 'page errors');
        if (mode === 'ordinary') assert.equal(await page.locator('[data-proposal-nav]').count(), 0, 'ordinary App has no Canvas proof controls');
        report.cases.push({ mode, width, height, status: 'passed', interceptedSends: calls, blockedExternal: [...denied] });
        console.log('PASS CP01 contracts', engine.name(), mode, `${width}x${height}`);
      } catch (error) {
        const page = ctx.__cp01Page;
        if (page && !page.isClosed()) {
          await page.screenshot({ path: path.join(out, `failure-${mode}-${width}.png`) }).catch(() => {});
          fs.writeFileSync(path.join(out, `failure-${mode}-${width}.txt`), await page.locator('body').innerText());
        }
        throw error;
      } finally { release(); await ctx.close(); }
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, `contracts-${engine.name()}.json`), JSON.stringify(report, null, 2)); }
})().catch(e => { console.error(e); process.exit(1); });
