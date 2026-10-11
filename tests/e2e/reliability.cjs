const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const sse = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text }, finish_reason: 'stop' }] })}\n\n`;
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900 });
      let mode = 'overloaded';
      const calls = [];
      const names = ['gemini-flash-latest', ...Array.from({ length: 40 }, (_, i) => `gemini-fixture-${i}`)];
      await context.route('**/firestore.googleapis.com/**', r => r.abort());
      await context.route('**/generativelanguage.googleapis.com/**', r => {
        if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: names.map(name => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'] })) } });
        calls.push('gemini');
        if (mode === 'hang') return;
        return r.fulfill({ status: 503, json: { error: { message: 'The model is overloaded' } } });
      });
      for (const [provider, domain, model] of [['openrouter', 'openrouter.ai', 'vendor/fixture:free'], ['groq', 'api.groq.com', 'openai/gpt-oss-120b'], ['cerebras', 'api.cerebras.ai', 'gpt-oss-120b']]) {
        await context.route(`**/${domain}/**`, r => {
          if (r.request().url().endsWith('/models')) return r.fulfill({ json: { data: [{ id: model, pricing: { prompt: '0', completion: '0' }, context_window: 131072 }] } });
          if (r.request().url().endsWith('/key')) return r.fulfill({ json: { data: { is_free_tier: true } } });
          calls.push(provider);
          if (provider === 'openrouter' && mode === 'overloaded') return r.fulfill({ status: 503, json: { error: { message: 'No available model provider' } } });
          return r.fulfill({ contentType: 'text/event-stream', body: sse(`Recovered using ${provider}.`) });
        });
      }
      await context.addInitScript(({ names }) => {
        if (localStorage.getItem('mr.preview_user')) return;
        const uid = 'preview-reliability';
        const settings = { autoIntroduced: true, autoTitle: false, autoSwitch: true, enabledModels: [...names.map(name => `gemini:${name}`), 'openrouter:vendor/fixture:free', 'groq:openai/gpt-oss-120b', 'cerebras:gpt-oss-120b'], defaultModel: 'gemini:gemini-flash-latest' };
        localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'reliability@local.invalid', displayName: 'Reliability' }));
        localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', openrouterKey: 'fixture', groqKey: 'fixture', cerebrasKey: 'fixture', settings }));
        localStorage.setItem('mr.settings', JSON.stringify(settings));
        localStorage.setItem('mr.installHint', '1');
      }, { names });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
      await page.waitForSelector('.composer textarea');
      await page.fill('.composer textarea', 'Hello'); await page.click('.send-btn');
      await page.waitForSelector('.msg.assistant .markdown');
      assert.deepEqual(calls, ['gemini', 'openrouter', 'groq']);
      assert.match(await page.locator('.msg.assistant .markdown').last().textContent(), /Recovered using groq/);
      await page.locator('.send-btn.stop').waitFor({ state: 'hidden' });
      assert.ok(await page.evaluate(() => !JSON.parse(localStorage.getItem('mr.settings')).unavailableModels?.length));
      console.log(`PASS ${width}px: crowded catalogue escapes overloaded providers without retiring them`);
      if (width === 390) {
        mode = 'hang'; calls.length = 0;
        await page.fill('.composer textarea', 'Check timeout recovery'); await page.click('.send-btn');
        await page.waitForFunction(() => document.querySelectorAll('.msg.assistant .markdown').length === 2, null, { timeout: 40000 });
        assert.equal(calls[0], 'gemini');
        assert.ok(calls.length === 2 && calls[1] !== 'gemini');
        await page.locator('.send-btn.stop').waitFor({ state: 'hidden' });
        assert.match(await page.locator('.msg.assistant').last().textContent(), /didn't respond in time/);
        console.log('PASS phone: real 25-second silent-request deadline switches providers and releases composer');
        calls.length = 0;
        await page.fill('.composer textarea', 'Stop this request'); await page.click('.send-btn');
        await page.locator('.send-btn.stop').click();
        await page.locator('.send-btn.stop').waitFor({ state: 'hidden' });
        await page.waitForTimeout(100);
        assert.ok(calls.length <= 1);
        assert.ok(!(await page.locator('.msg.assistant').last().textContent()).includes('No model could answer'));
        console.log('PASS phone: Stop cancels without a fallback or error');
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
