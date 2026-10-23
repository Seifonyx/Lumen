// Actual Canvas UI, synthetic accounts/catalogs and intercepted transport. No live inference.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { profile } = require('./helpers/preview-profile.cjs');

const base = process.env.MR_TEST_URL || 'http://localhost:5190/';
const before = process.env.PHASE4_BEFORE === '1'; // Only for matched baseline captures; never used in CI.
const out = process.env.PHASE4_OUT || 'tests/e2e/out/phase4';
const viewports = (process.env.PHASE4_VIEWPORTS || '1440x960,390x844,320x568,430x932').split(',').map(v => v.split('x').map(Number));
fs.mkdirSync(out, { recursive: true });
const model = (name, label) => ({ name: `models/${name}`, displayName: label, inputTokenLimit: 128000, supportedGenerationMethods: ['generateContent'] });
const initialModels = [model('gemini-flash-latest', 'Gemini Flash'), model('gemini-2.5-pro', 'Gemini 2.5 Pro')];

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  let applicable = false;
  const reports = [];
  try {
    for (const [width, height] of viewports) for (const theme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const errors = [], providerRequests = [];
      let failure = 0, large = false;
      // Deny all unhandled external traffic before installing the existing account fixture and explicit model endpoint.
      await ctx.route('**/*', r => new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort());
      await profile(ctx, `preview-phase4-${width}-${theme}`, theme, {
        defaultModel: 'auto', enabledModels: ['gemini:gemini-flash-latest', 'gemini:gemini-2.5-pro'],
      }, { providerConnections: { anthropic: 'SYNTHETIC_ONLY', providerAccess: { anthropic: false } } });
      await ctx.route('**/generativelanguage.googleapis.com/**', r => {
        providerRequests.push({ method: r.request().method(), url: r.request().url() });
        return failure ? r.fulfill({ status: failure, json: { error: { message: 'RAW_SYNTHETIC_SECRET_MUST_NOT_RENDER' } } })
          : r.fulfill({ json: { models: large ? [...initialModels, ...Array.from({ length: 143 }, (_, i) => model(`gemini-fixture-${i}`, `Synthetic long catalog model ${i} with a deliberately extended name`))] : initialModels } });
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(12000);
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(base);
      await page.locator('.composer textarea').waitFor();
      if (!await page.locator('.app[data-lumen-canvas-shell]').count()) {
        console.log('Not applicable to ordinary presentation; Canvas contract runs separately');
        await ctx.close();
        return;
      }
      applicable = true;
      const draft = 'Phase 4 draft: café 🌙';
      await page.locator('.composer textarea').fill(draft);
      const open = async () => {
        if (width < 900) await page.getByRole('button', { name: 'Open chats', exact: true }).first().click();
        await page.locator('aside.cv-nav').getByRole('button', { name: 'Models & routing', exact: true }).click();
      };
      await open();
      const rc = page.locator('.rc-page');
      await rc.getByRole('heading', { name: 'Routing Center', exact: true }).waitFor();
      await rc.getByRole('heading', { name: 'Routing Center', exact: true }).click();
      const shot = async name => {
        if ((width === 1440 || width === 390) && (!before || name === 'overview')) {
          await page.screenshot({ path: path.join(out, `${width}-${theme}-${name}.png`) });
        }
      };
      const tab = name => rc.getByRole('navigation', { name: 'Routing sections' }).getByRole('button', { name, exact: true }).click();
      await shot('overview');
      if (!before) await rc.getByRole('region', { name: 'Current routing mode' }).waitFor();
      await tab('Providers');
      await rc.locator('[data-provider="gemini"]').waitFor();
      await shot('providers');
      await rc.locator('[data-provider="gemini"]').click();
      const detail = rc.getByRole('region', { name: 'Provider detail' });
      await detail.getByRole('heading', { name: 'Google AI Studio', exact: true }).waitFor();
      await detail.getByRole('button', { name: 'Check connection', exact: true }).waitFor();
      await shot('detail');
      if (!before) {
        assert.match(await detail.innerText(), /not verified by discovery/);
        assert.match(await detail.innerText(), /Catalog ready/);
        assert.equal(await detail.getByRole('button', { name: 'Back to providers' }).isVisible(), width < 900);
        assert.match(await detail.locator('.rc-allowance').innerText(), /Unknown/);
      }
      if (width < 900) await detail.getByRole('button', { name: 'Back to providers' }).click();
      const search = rc.getByRole('searchbox', { name: 'Find a provider' });
      await search.fill('not-a-provider');
      await rc.locator('[data-provider]').first().waitFor({ state: 'hidden' });
      assert.equal(await rc.locator('[data-provider]').count(), 0);
      assert.equal(await rc.locator('.rc-provider-detail').count(), 0);
      await rc.getByRole('button', { name: 'Clear provider search' }).click();
      assert.equal(await search.inputValue(), '');
      await search.fill('anthropic');
      await rc.locator('[data-provider="anthropic"]').click();
      await detail.getByRole('heading', { name: 'Anthropic', exact: true }).waitFor();
      assert.match(await detail.innerText(), /Permission off/);
      if (!before) assert.match(await detail.innerText(), /not enabled/);
      if (width < 900) await detail.getByRole('button', { name: 'Back to providers' }).click();
      await search.fill('');
      if (!before) {
        await rc.getByRole('button', { name: /Filter providers:/ }).click();
        await page.getByRole('menuitemradio', { name: /Needs attention/ }).click();
        await rc.locator('[data-provider]').first().waitFor({ state: 'hidden' });
        assert.equal(await rc.locator('[data-provider]').count(), 0);
        assert.match(await rc.innerText(), /No providers match/);
        await rc.getByRole('button', { name: 'Reset provider filters' }).click();
        // Real catalog failure and recovery through the existing refresh owner; cached inventory stays reachable.
        await rc.locator('[data-provider="gemini"]').click();
        failure = 401;
        await detail.getByRole('button', { name: 'Check connection', exact: true }).click();
        await detail.locator('.rc-recovery').getByText(/provider refused/).waitFor();
        assert.match(await detail.innerText(), /Discovery failed/);
        assert.equal(await detail.locator('.rc-model').count(), 0, 'authentication failure removes unsafe cached models');
        assert(!/RAW_SYNTHETIC_SECRET/.test(await rc.innerText()));
        await detail.getByRole('button', { name: 'Check connection', exact: true }).waitFor({ state: 'visible' });
        failure = 0;
        large = true;
        await detail.getByRole('button', { name: 'Check connection', exact: true }).click();
        await detail.getByText('145 in catalog', { exact: true }).waitFor();
        assert.equal(await detail.locator('.rc-model').count(), 24);
        await detail.getByRole('button', { name: 'Next', exact: true }).click();
        assert.match(await detail.getByRole('navigation', { name: 'Model pages' }).innerText(), /25–48 of 145/);
        await detail.getByRole('searchbox', { name: 'Find a model' }).fill('fixture-142');
        await page.waitForFunction(() => document.querySelectorAll('.rc-provider-detail .rc-model').length === 1);
        assert.equal(await detail.locator('.rc-model').count(), 1);
        failure = 503;
        await detail.getByRole('button', { name: 'Check connection', exact: true }).click();
        await detail.locator('.rc-recovery').getByText(/could not list/).waitFor();
        assert.match(await detail.innerText(), /Cached catalog/);
        assert.equal(await detail.locator('.rc-model').count(), 1, 'non-auth failures preserve searchable cached models');
        assert(providerRequests.length >= 3);
        assert(providerRequests.every(r => r.method === 'GET' && new URL(r.url).pathname.endsWith('/models')), 'only catalog GETs, never inference');
      }
      await tab('Overview');
      await rc.getByRole('button', { name: 'Back to chat', exact: true }).click();
      assert.equal(await page.locator('.composer textarea').inputValue(), draft);
      await open();
      // Keyboard-focus evidence is separate from ordinary presentation captures above.
      await page.keyboard.press('Tab');
      assert(await rc.evaluate(el => el.contains(document.activeElement)));
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.deepEqual(audit.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), []);
      if (!before && width === 320) {
        // Synthetic 150% text scaling, not an iOS Dynamic Type/VoiceOver claim.
        await rc.evaluate(el => {
          for (const node of el.querySelectorAll('h1,h2,h3,p,button,label,small,.rc-label,.rc-tabs')) {
            node.style.fontSize = `${parseFloat(getComputedStyle(node).fontSize) * 1.5}px`;
          }
        });
        for (const button of await rc.locator('.rc-tabs button').all()) {
          assert(await button.evaluate(el => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight), 'section label remains readable at larger text');
        }
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert(await rc.evaluate(el => el.scrollWidth <= el.clientWidth));
      assert.deepEqual(errors, []);
      reports.push({ width, height, theme, passed: true, axe: 0, catalogModels: before ? 2 : 145, textScale: !before && width === 320 ? 1.5 : 1 });
      await ctx.close();
    }
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(out, `results-${process.env.MR_WEBKIT ? 'webkit' : 'chromium'}.json`), JSON.stringify({ applicable, before, physicalIPhone: false, reports }, null, 2));
  }
  console.log('PASS Routing Center/provider flows', reports.length);
})().catch(e => { console.error(e); process.exit(1); });
