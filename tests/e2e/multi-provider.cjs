const {openSettingsSection,closeSettings}=require('./helpers/ui.cjs');
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const AxeBuilder = require('@axe-core/playwright').default;
const { profile } = require('./helpers/preview-profile.cjs');
const { scan } = require('./helpers/fitscan.cjs');
const fs = require('node:fs');
const DEFAULT_RELAY = 'https://model-router-provider-relay.model-router.workers.dev';
const providers = {
  mistral: ['Mistral', 'https://api.mistral.ai/v1'],
  cohere: ['Cohere', 'https://api.cohere.ai'],
  nvidia: ['NVIDIA NIM', 'https://relay.fixture/nvidia'],
  huggingface: ['Hugging Face', 'https://router.huggingface.co/v1'],
  deepseek: ['DeepSeek', 'https://api.deepseek.com'],
  alibaba: ['Alibaba Cloud', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'],
  cloudflare: ['Cloudflare Workers AI', 'https://relay.fixture/cloudflare'],
  aion: ['Aion Labs', 'https://api.aionlabs.ai/v1'],
};
const openSettings = async page => {
  if (await page.locator('.menu-btn').isVisible()) await page.locator('.menu-btn').click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await openSettingsSection(page,'API keys');
};

const sse = item => `data: ${JSON.stringify(item)}\n\ndata: [DONE]\n\n`;
(async () => {
  fs.mkdirSync('tests/e2e/out', { recursive: true });
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    const cases = [[1280, 844, 'light'], [320, 740, 'light'], [390, 844, 'dark'], [430, 932, 'black'], [844, 390, 'dark']];
    for (const [width, height, theme] of cases) {
      const useDefaultRelay = width === 1280 || width === 320;
      const uid = `preview-multi-provider-${width}-${theme}`;
      const ctx = await browser.newContext({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900, serviceWorkers: 'block' });
      // Windows WebKit's blocked-worker shim resolves register() with undefined.
      // Model a denied registration so the app uses its normal online fallback.
      await ctx.addInitScript(() => {
        if ('serviceWorker' in navigator) navigator.serviceWorker.register = async () => { throw new Error('Service workers disabled in provider fixture'); };
      });
      await profile(ctx, uid, theme);
      // Return an explicit permission error instead of a network abort: WebKit
      // can surface aborted Firestore long-polls as unrelated page errors.
      await ctx.route('**/firestore.googleapis.com/**', route => route.fulfill({
        status: 403, headers: {
          'access-control-allow-origin': new URL(process.env.MR_TEST_URL || 'http://localhost:5190').origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': '*',
        },
        json: { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Production Firestore disabled in provider fixture' } },
      }));
      const calls = [], errors = [], blockedFixtureErrors = [];
      for (const [id, [label, base]] of Object.entries(providers)) {
        const routedBase = useDefaultRelay && ['nvidia', 'cloudflare'].includes(id) ? `${DEFAULT_RELAY}/${id}` : base;
        await ctx.route(`${routedBase}/**`, route => {
          const request = route.request();
          calls.push({ id, url: request.url(), auth: request.headers().authorization, body: request.postDataJSON() });
          if (request.url().includes('/models')) {
            const m = { id: `${id}-chat`, name: id === 'cloudflare' ? '@cf/meta/current-chat' : `${id}-chat`, display_name: id === 'cloudflare' ? 'Current Chat' : `${id.charAt(0).toUpperCase() + id.slice(1)} Chat`, capabilities: { completion_chat: true }, endpoints: ['chat'], task: { name: 'Text Generation' }, context_length: 128000 };
            return route.fulfill({ json: id === 'cohere' ? { models: [m] } : id === 'cloudflare' ? { success: true, result: [m] } : { data: [m] } });
          }
          const body = request.postDataJSON();
          return route.fulfill(body.stream ? { contentType: 'text/event-stream', body: sse({ choices: [{ delta: { content: `Reply from ${label}`, reasoning_content: 'Check complete.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5 } }) } : { json: { choices: [{ message: { content: 'Provider chat' } }] } });
        });
      }
      const page = await ctx.newPage();
      page.on('pageerror', error => {
        // Only the explicitly blocked production Firestore long-poll is expected.
        // Keep provider failures and all JavaScript exceptions as test failures.
        if (error.message.includes('/firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?') && error.message.endsWith('due to access control checks.')) blockedFixtureErrors.push(error.message);
        else errors.push(error.message);
      });
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190');
      await page.locator('.composer textarea').waitFor();
      await openSettings(page);
      for (const [id, [label]] of Object.entries(providers)) {
        const row = page.locator(`[data-provider="${id}"]`);
        await row.locator('summary').click();
        assert.equal(await row.getByRole('checkbox').isChecked(), false);
        await page.getByRole('textbox', { name: `${label} API key`, exact: true }).fill(`synthetic-${id}`);
      }
      assert.equal(calls.length, 0, 'Filling keys does not send requests');
      await page.getByRole('button', { name: /^Save keys?$/ }).click();
      await page.waitForFunction(uid => !!JSON.parse(localStorage.getItem(`mr.account.${uid}`)).providerConnections?.aion, uid);
      assert.equal(calls.length, 0, 'Saving disabled connections does not fetch catalogues');
      const relay = page.locator('.provider-relay');
      await relay.locator('summary').click();
      if (!useDefaultRelay) await page.getByRole('textbox', { name: 'Provider relay URL' }).fill('https://relay.fixture');
      else assert.equal(await page.getByRole('textbox', { name: 'Provider relay URL' }).inputValue(), '');
      await page.getByRole('textbox', { name: 'Cloudflare account ID' }).fill('a'.repeat(32));
      for (const [id] of Object.entries(providers)) await page.locator(`[data-provider="${id}"]`).getByRole('checkbox').check();
      await page.getByRole('button', { name: /^Save keys?$/ }).click();
      await page.waitForFunction(uid => JSON.parse(localStorage.getItem(`mr.account.${uid}`)).providerConnections?.providerAccess?.aion === true, uid);
      for (let i = 0; i < 40 && calls.filter(c => c.url.includes('/models')).length < 8; i++) await page.waitForTimeout(250);
      if (calls.length < 8) console.error('CATALOG DIAGNOSTICS', await page.locator('.settings-panel').innerText());
      assert.equal(calls.filter(c => c.url.includes('/models')).length, 8);
      for (const id of Object.keys(providers)) assert(calls.some(c => c.id === id && c.auth === `Bearer synthetic-${id}`));
      assert.deepEqual(await scan(page), [], 'Settings fit the viewport');
      const a11y = await new AxeBuilder({ page }).include('.settings-page').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.deepEqual(a11y.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(',')}`), []);
      const targets = await page.locator('.provider-connection summary, .provider-consent, .provider-field input').evaluateAll(items => items.filter(el => el.getBoundingClientRect().height > 0).map(el => el.getBoundingClientRect().height));
      assert(targets.every(h => h >= 44), 'New touch targets are at least 44px');
      for (const id of Object.keys(providers).filter(id => id !== 'mistral')) await page.locator(`[data-provider="${id}"] summary`).click();
      // Toasts dismiss themselves; don't race a click against their exit animation.
      await page.locator('.toast').last().waitFor({state:'detached'});
      await page.locator('[data-provider="mistral"] summary').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/e2e/out/multi-provider-${width}-${theme}.png` });
      await relay.scrollIntoViewIfNeeded();
      assert.deepEqual(await scan(page), [], 'Relay details fit the viewport');
      await page.screenshot({ path: `tests/e2e/out/multi-provider-relay-${width}-${theme}.png` });
      await closeSettings(page);
      // Use every provider through the actual picker, composer and rendered response.
      for (const [id, [label]] of Object.entries(providers)) {
        await page.locator('.model-button').click();
        // Labels are model names, provider names are separate group headings.
        const title = id === 'cloudflare' ? 'Current Chat' : `${id.charAt(0).toUpperCase() + id.slice(1)} Chat`;
        await page.locator('.models-pop').getByText(title, { exact: true }).click();
        await page.locator('.composer textarea').fill(`hello ${id}`);
        await page.locator('.send-btn').click();
        await page.locator('.msg.assistant .markdown').filter({ hasText: `Reply from ${label}` }).waitFor();
        await page.waitForFunction(() => !document.querySelector('.stop-btn'));
        assert(calls.some(c => c.id === id && c.body?.stream === true && c.body.messages.at(-1).content.includes(`hello ${id}`)));
      }
      await openSettings(page);
      const aion = page.locator('[data-provider="aion"]');
      await aion.locator('summary').click();
      await aion.getByRole('checkbox').uncheck();
      await page.getByRole('button', { name: /^Save keys?$/ }).click();
      await page.waitForFunction(uid => JSON.parse(localStorage.getItem(`mr.account.${uid}`)).providerConnections.providerAccess.aion === false, uid);
      await closeSettings(page);
      await page.reload();
      await page.locator('.composer textarea').waitFor();
      await page.locator('.model-button').click();
      assert.equal(await page.locator('.models-pop').getByText('Aion Chat', { exact: true }).count(), 0, 'Disabled provider stays absent after reload');
      await page.keyboard.press('Escape');
      await page.evaluate(() => { localStorage.setItem('mr.preview_user', JSON.stringify({ uid: 'preview-multi-provider-other', email: 'other@local.invalid', displayName: 'Other' })); });
      await page.reload();
      await page.locator('.settings-page').waitFor();
      await page.locator('[data-provider="aion"] summary').click();
      assert.equal(await page.getByRole('textbox', { name: 'Aion Labs API key' }).inputValue(), '');
      assert.equal(await page.locator('[data-provider="aion"]').getByRole('checkbox').isChecked(), false);
      assert.deepEqual(errors, []);
      if (blockedFixtureErrors.length) console.log(`Fixture: ${blockedFixtureErrors.length} blocked production Firestore long-poll errors (WebKit)`);
      console.log(`PASS multi-provider ${width}×${height} ${theme}: eight replies, billing gates, reload, account isolation, touch targets, overflow and accessibility`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
