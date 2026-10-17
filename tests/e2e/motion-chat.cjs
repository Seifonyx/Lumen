// Fresh arrivals, restored history and a single Auto selection pulse, with real motion enabled.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.5 Mobile/15E148 Safari/604.1';
const only = process.env.MOTION_CASE;
const now = Date.now();

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    for (const [width, theme, reduced] of [[320, 'light', false], [390, 'dark', false], [1280, 'dark', false], [390, 'dark', true]]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900, reducedMotion: reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block', ...(width < 900 ? { userAgent: ua } : {}) });
      const account = `motion-chat-${width}-${reduced}`;
      await profile(ctx, account, theme, { defaultModel: 'auto' });
      await ctx.addInitScript(() => { window.__mrMotion = true; });
      let finish;
      let requests = 0;
      await ctx.route('**/generativelanguage.googleapis.com/**', async route => {
        const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
        if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
        if (route.request().url().includes('/models?')) return route.fulfill({ headers, json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
        requests++;
        await new Promise(resolve => { finish = resolve; });
        await route.fulfill({ headers, contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'A fresh answer with stable paragraphs.\n\nThe second paragraph stays readable.' }] }, finishReason: 'STOP' }] }) + '\n\n' });
      });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', error => {
        // The fake profile intentionally aborts Firestore; WebKit also reports that network abort here.
        if (error.message.includes('firestore.googleapis.com') && error.message.includes('due to access control checks')) return;
        errors.push(error.message);
      });
      const initialCatalog = page.waitForResponse(response => response.url().includes('generativelanguage.googleapis.com/v1beta/models?'));
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/');
      await page.locator('.composer textarea').waitFor();
      await (await initialCatalog).finished();
      await seed(page, account, [{ id: 'motion-reading', title: 'Motion reading', createdAt: now - 6e5, updatedAt: now, model: 'auto', messages: Array.from({ length: 12 }, (_, i) => ({ id: `old-${i}`, role: i % 2 ? 'assistant' : 'user', status: 'done', model: 'gemini:gemini-flash-latest', text: `Earlier message ${i}. ` + 'A readable piece of saved conversation. '.repeat(12), createdAt: now - 6e5 + i * 1000 })) }]);
      await page.reload();
      await page.locator('.composer textarea').waitFor();
      if (width < 900) await page.locator('.menu-btn').click();
      await page.locator('.chat-open').filter({ hasText: 'Motion reading' }).click();
      await page.locator('[data-message-id="old-11"]').waitFor();

      if (!only || only === 'history') {
        const animations = await page.locator('.message-row .msg').evaluateAll(els => els.map(el => getComputedStyle(el).animationName));
        assert.ok(animations.every(name => name === 'none'), `Restored history does not replay arrivals (${animations})`);
      }
      if (!only || only === 'route') {
        await page.locator('.composer textarea').fill('Give me a concise next step.');
        await page.locator('.send-btn').click();
        await page.locator('.route-wait').waitFor();
        const pulse = page.locator('.route-choice.selected');
        assert.equal(await pulse.count(), 1, 'Auto selection receives one quiet, explicit signal');
        assert.equal(await pulse.getAttribute('aria-hidden'), 'true', 'The pulse is decorative');
        const animation = await pulse.evaluate(el => ({ name: getComputedStyle(el, '::after').animationName, count: getComputedStyle(el, '::after').animationIterationCount }));
        if (reduced) assert.equal(animation.name, 'none', 'Reduced motion keeps the routing signal still');
        else { assert.notEqual(animation.name, 'none'); assert.equal(animation.count, '1', 'Routing pulse ends, rather than looping'); }
        await pulse.evaluate(el => { el.dataset.fixtureRetain = 'original'; });
        await page.waitForTimeout(1150);
        assert.equal(await pulse.getAttribute('data-fixture-retain'), 'original', 'Elapsed-time updates do not recreate the selection pulse');
        finish();
        await page.locator('.msg.assistant', { hasText: 'The second paragraph stays readable.' }).waitFor();
        await page.locator('.composer textarea').fill('NEXT_DRAFT');
        if (width < 900) await page.locator('.menu-btn').click();
        await page.locator('.sidebar').getByRole('button', { name: 'Library', exact: true }).click();
        await page.locator('.hub-page:not(.exit-ghost)').getByRole('button', { name: 'Close', exact: true }).click();
        assert.equal(await page.locator('.composer textarea').inputValue(), 'NEXT_DRAFT');
        assert.equal(requests, 1, 'Motion does not trigger additional inference');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS chat motion ${process.env.MR_WEBKIT ? 'webkit' : 'chromium'} ${width}px ${theme} ${reduced ? 'reduced' : 'motion'}: ${only || 'history, Auto pulse, reply, draft'}`);
      finish?.();
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
