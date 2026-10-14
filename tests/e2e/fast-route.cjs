const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900 });
      const calls = [];
      await context.route('**/firestore.googleapis.com/**', r => r.abort());
      await context.route('**/generativelanguage.googleapis.com/**', r => {
        if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: ['gemini-2.5-flash-lite', 'gemma-4-31b-it'].map(name => ({ name: `models/${name}`, supportedGenerationMethods: ['generateContent'], inputTokenLimit: 131072 })) } });
        const name = /models\/([^:]+):/.exec(r.request().url())[1];
        calls.push({ name, at: Date.now(), payload: r.request().postDataJSON() });
        if (name === 'gemini-2.5-flash-lite') return; // real silent-request deadline
        return r.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'A quick answer.' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 } })}\n\n` });
      });
      await context.addInitScript(() => {
        if (localStorage.getItem('mr.preview_user')) return;
        const uid = 'preview-fast-route';
        const settings = { autoIntroduced: true, autoTitle: false, autoSwitch: true, defaultModel: 'auto', enabledModels: ['gemini:gemini-2.5-flash-lite', 'gemini:gemma-4-31b-it'] };
        localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'fast-route@local.invalid', displayName: 'Fast route' }));
        localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
        localStorage.setItem('mr.settings', JSON.stringify(settings));
        localStorage.setItem('mr.installHint', '1');
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
      await page.waitForSelector('.composer textarea');
      await page.fill('.composer textarea', 'hello'); await page.click('.send-btn');
      await page.waitForSelector('.reply-wait');
      assert.match(await page.locator('.reply-wait').textContent(), /Routing/);
      await page.waitForSelector('.msg.assistant .markdown', { timeout: 15000 });
      await page.locator('.send-btn.stop').waitFor({ state: 'hidden' });
      assert.deepEqual(calls.map(c => c.name), ['gemini-2.5-flash-lite', 'gemma-4-31b-it']);
      const wait = calls[1].at - calls[0].at;
      assert.ok(wait >= 7500 && wait < 14000, `simple Auto chat switched after ${wait}ms`);
      assert.equal(calls[0].payload.generationConfig.thinkingConfig.thinkingBudget, 0);
      await page.fill('.composer textarea', 'hello again'); await page.click('.send-btn');
      await page.waitForFunction(() => document.querySelectorAll('.msg.assistant .markdown').length === 2);
      assert.deepEqual(calls.map(c => c.name), ['gemini-2.5-flash-lite', 'gemma-4-31b-it', 'gemma-4-31b-it'], 'next turn avoids the stalled model');
      await page.locator('.send-btn.stop').waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: actual ${wait}ms Auto timeout, lightweight thinking and cooldown-aware next turn`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
