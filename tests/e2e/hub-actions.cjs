// Hub navigation, direct tool setup, draft safety and accessible page structure.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const AxeBuilder = require('@axe-core/playwright').default;
const { profile } = require('./helpers/preview-profile.cjs');
const all = [[320, 740, 'light'], [390, 844, 'dark'], [844, 390, 'dark'], [1280, 844, 'light']];
const matrix = process.env.MR_TEST_WIDTH ? all.filter(v => v[0] === Number(process.env.MR_TEST_WIDTH)) : all;
const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
const models = ['gemini-flash-latest', 'gemini-2.5-pro'];

(async () => {
  const engine = process.env.MR_WEBKIT ? webkit : chromium;
  const browser = await engine.launch();
  fs.mkdirSync('tests/e2e/out', { recursive: true });
  try {
    for (const [width, height, theme] of matrix) {
      const phone = width < 900;
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block', reducedMotion: width === 320 ? 'reduce' : 'no-preference', ...(phone ? { userAgent: ua } : {}) });
      await profile(ctx, `hub-actions-${width}`, theme, { enabledModels: models.map(id => `gemini:${id}`) });
      const requests = [];
      await ctx.route('**/generativelanguage.googleapis.com/**', route => {
        const url = route.request().url();
        if (url.includes('/models?')) return route.fulfill({ json: { models: models.map(id => ({ name: `models/${id}`, displayName: id, supportedGenerationMethods: ['generateContent'] })) } });
        if (url.includes(':streamGenerateContent')) requests.push(route.request().postData());
        return route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Comparison fixture answer.' }] }, finishReason: 'STOP' }] }) + '\n\n' });
      });
      const page = await ctx.newPage();
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/');
      const input = page.locator('.composer textarea');
      await input.waitFor();
      const canvas=Boolean(await page.locator('.app[data-lumen-canvas-shell]').count());
      await input.fill('PRESERVED_DRAFT');
      await page.locator('.composer input[type="file"][accept*=".txt"]').setInputFiles({ name: 'reference.txt', mimeType: 'text/plain', buffer: Buffer.from('REFERENCE_MARKER') });
      await page.getByRole('button', { name: 'Remove reference.txt', exact: true }).waitFor();

      const openTools = async () => {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools-page' })));
        await page.getByRole('main', { name: 'Tools', exact: true }).waitFor();
      };
      const section = async name => {
        if (phone && !canvas) await page.locator('.glass-tabbar').getByRole('button', { name, exact: true }).click();
      };
      const structure = async name => {
        await page.locator('.hub-page').evaluate(async el => {
          await document.fonts.ready;
          await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})));
        });
        assert.equal(await page.getByRole('main').count(), 1, 'One exposed main landmark');
        assert.equal(await page.getByRole('heading', { level: 1 }).count(), 1, 'One exposed page heading');
        assert.equal(await page.getByRole('heading', { name, level: 1, exact: true }).count(), 1);
        assert.equal(await page.title(), `${name} · Lumen`);
        const scan = await new AxeBuilder({ page }).analyze();
        assert.deepEqual(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
        if (phone) {
          const visible = await page.locator(canvas?'.phone-navigation':'.hub-bar').evaluate((el,canvas) => {
            const title = [...el.querySelectorAll(canvas?'h1':'.hub-bar-title')].find(e => e.getClientRects().length)?.getBoundingClientRect();
            if (!title) return false;
            const buttons = [...el.querySelectorAll('button')].map(e => e.getBoundingClientRect());
            return buttons.every(r => r.width >= 44 && r.height >= 44 && (r.right <= title.left + 1 || r.left >= title.right - 1));
          },canvas);
          assert.ok(visible, 'Header title and 44px actions do not overlap');
        }
      };
      await openTools();
      await structure('Tools');
      if(phone&&canvas){
        assert.equal(await page.locator('.glass-tabbar').count(),0);
        await page.locator('.phone-navigation [aria-label^="Return to "]').click();await page.locator('.hub-page').waitFor({state:'detached'});
        await page.locator('.menu-btn').click();await page.locator('.sidebar.open').waitFor();
        await page.locator('.sidebar').getByRole('button',{name:'Library',exact:true}).click();await page.getByRole('main',{name:'Library',exact:true}).waitFor();await structure('Library');
        await page.locator('.phone-navigation [aria-label^="Return to "]').click();await page.locator('.hub-page').waitFor({state:'detached'});await openTools();
      }else{
      if (phone) {
        const menu = page.locator('.hub-bar').getByRole('button', { name: 'Open sidebar', exact: true });
        const start = await menu.boundingBox();
        await section('Assistants');
        await page.getByRole('button', { name: 'New assistant', exact: true }).waitFor();
        assert.equal((await menu.boundingBox()).x, start.x, 'Menu stays in place when creation appears');
        await structure('Tools');
        await menu.click();
        await page.locator('.sidebar.open').waitFor();
        assert.equal(await page.locator('.sidebar').evaluate(el => el.inert), false);
        await page.locator('.sidebar').getByRole('button', { name: 'Library', exact: true }).click();
        await page.getByRole('main', { name: 'Library', exact: true }).waitFor();
        await structure('Library');
        assert.equal((await menu.boundingBox()).x, start.x, 'Library keeps the same navigation position');
        if (width !== 844) await page.screenshot({ path: `tests/e2e/out/${engine.name()}-hub-actions-${width}-${theme}.png` });
        await menu.click();
        await page.locator('.sidebar.open').waitFor();
        await page.locator('.sidebar').getByRole('button', { name: 'Tools', exact: true }).click();
        await page.getByRole('main', { name: 'Tools', exact: true }).waitFor();
      }
      }
      await section('Create');
      assert.equal(await page.getByRole('button', { name: /^Writing tools/ }).count(), 0);
      assert.match(await page.locator('article.tool-contextual').innerText(), /Select text in a reply/);
      await section('Analyze');
      await page.getByRole('button', { name: /^Compare models/ }).click();
      const dialog = page.getByRole('dialog', { name: 'Compare models', exact: true });
      await dialog.waitFor();
      if(canvas)await page.waitForFunction(()=>document.querySelector('.hub-page')?.closest('[inert]'));else await page.locator('.hub-page').waitFor({ state: 'detached' });
      const question = dialog.getByRole('textbox', { name: 'Question', exact: true });
      assert.equal(await question.inputValue(), 'PRESERVED_DRAFT');
      assert.equal(requests.length, 0, 'Opening setup never sends a model request');
      await question.fill('EDITED_DRAFT');
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      if(canvas){await page.locator('.hub-page .phone-navigation [aria-label^="Return to "], .hub-page :is(.hub-close,.feature-exit)').click();await page.locator('.hub-page').waitFor({state:'detached'});}
      assert.equal(await input.inputValue(), 'EDITED_DRAFT');
      assert.equal(await page.getByRole('button', { name: 'Remove reference.txt', exact: true }).count(), 1);
      assert.equal(requests.length, 0, 'Cancel preserves text/files without sending');
      await page.getByRole('button', { name: 'Remove reference.txt', exact: true }).click();
      await input.fill('');
      await openTools();
      await section('Analyze');
      await page.getByRole('button', { name: /^Compare models/ }).click();
      await dialog.waitFor();
      const compare = dialog.getByRole('button', { name: 'Compare', exact: true });
      assert.equal(await compare.isDisabled(), true, 'Empty comparison cannot submit');
      await question.fill('QUESTION_MARKER: Compare these approaches.');
      assert.equal(await compare.isEnabled(), true);
      if (phone) {
        const visible = Math.min(460, height - 140);
        await question.focus();
        await page.evaluate(v => {
          Object.defineProperty(visualViewport, 'height', { configurable: true, value: v });
          Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 40 });
          visualViewport.dispatchEvent(new Event('resize'));
        }, visible);
        await page.waitForFunction(v => {
          const r = document.querySelector('.compare-picker')?.closest('.modal')?.getBoundingClientRect();
          return r && r.top >= 39 && r.bottom <= v + 41;
        }, visible, { timeout: 5000 }).catch(async error => {
          const bounds = await dialog.evaluate(el => ({ modal: el.getBoundingClientRect().toJSON(), backdrop: el.parentElement.getBoundingClientRect().toJSON(), root: document.documentElement.className, height: getComputedStyle(document.documentElement).getPropertyValue('--vv-h') }));
          console.error('Keyboard frame:', JSON.stringify(bounds));
          throw error;
        });
        await compare.scrollIntoViewIfNeeded();
        assert.ok(await compare.evaluate((el, v) => { const r = el.getBoundingClientRect(); return r.top >= 39 && r.bottom <= v + 41; }, visible), 'Compare remains reachable above the keyboard');
        if (width !== 844) await page.screenshot({ path: `tests/e2e/out/${engine.name()}-hub-compare-${width}-${theme}.png` });
        await question.blur();
        await page.evaluate(h => {
          Object.defineProperty(visualViewport, 'height', { configurable: true, value: h });
          Object.defineProperty(visualViewport, 'offsetTop', { configurable: true, value: 0 });
          visualViewport.dispatchEvent(new Event('resize'));
        }, height);
      }
      await ctx.setOffline(true);
      await page.waitForFunction(() => !navigator.onLine);
      await compare.click();
      assert.equal(requests.length, 0, 'Offline submission cannot dispatch');
      assert.equal(await question.inputValue(), 'QUESTION_MARKER: Compare these approaches.');
      await ctx.setOffline(false);
      await page.waitForFunction(() => navigator.onLine);
      await compare.click();
      await page.waitForFunction(() => document.querySelectorAll('.comparison-card .comparison-save').length === 2);
      assert.equal(requests.length, 2, 'Explicit comparison sends exactly one request per selected model');
      assert.ok(requests.every(body => body.includes('QUESTION_MARKER')));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      console.log(`PASS hub actions ${engine.name()} ${width}x${height} ${theme}: stable navigation, headings/landmarks, direct setup, contextual guidance, draft/files, offline recovery and explicit comparison`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
