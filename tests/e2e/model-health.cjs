const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900 });
      await context.route('**/firestore.googleapis.com/**', r => r.abort());
      const probes = [];
      await context.route('**/generativelanguage.googleapis.com/**', r => {
        if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: ['gemini-flash-latest', 'gemini-missing-fixture', 'gemini-probe-missing', 'gemini-quota-fixture', 'gemini-after-quota', 'gemini-3.1-pro-preview', 'gemini-pro-latest'].map(name => ({ name: `models/${name}`, displayName: name, supportedGenerationMethods: ['generateContent'] })) } });
        if (r.request().url().includes(':generateContent')) {
          probes.push(r.request().postDataJSON());
          if (r.request().url().includes('gemini-probe-missing:')) return r.fulfill({ status: 404, json: { error: { message: 'Model gemini-probe-missing is not found' } } });
          if (r.request().url().includes('gemini-quota-fixture:')) return r.fulfill({ status: 429, json: { error: { message: 'FreeTier rate limit: 50' } } });
          return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'OK' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1 } } });
        }
        if (r.request().url().includes('gemini-missing-fixture:')) return r.fulfill({ status: 404, json: { error: { message: 'Model gemini-missing-fixture is not found' } } });
        return r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'A working model answered.' }] }, finishReason: 'STOP' }] }) + '\n\n' });
      });
      await context.addInitScript(() => {
        if (localStorage.getItem('mr.preview_user')) return;
        const uid = 'preview-model_health';
        const settings = { autoIntroduced: true, autoTitle: false, enabledModels: ['gemini:gemini-missing-fixture', 'gemini:gemini-flash-latest'], defaultModel: 'gemini:gemini-missing-fixture' };
        localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'health@local.invalid', displayName: 'Model health' }));
        localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
        localStorage.setItem('mr.settings', JSON.stringify(settings));
        localStorage.setItem('mr.installHint', '1');
      });
      const page = await context.newPage();
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
      await page.waitForSelector('.composer textarea');
      assert.equal(await page.locator('.sidebar h2').count(), 2);
      assert.ok(await page.locator('.sidebar h2').first().evaluate(el => {
        const heading = getComputedStyle(el);
        return Number(heading.fontWeight) >= 600 && parseFloat(heading.fontSize) >= 13;
      }), 'Section headings retain a distinct semibold hierarchy');
      await page.fill('.composer textarea', 'Hello');
      await page.click('.send-btn');
      await page.waitForSelector('.msg.assistant .markdown');
      assert.match(await page.locator('.msg.assistant .markdown').textContent(), /working model answered/);
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('mr.settings')).unavailableModels?.includes('gemini:gemini-missing-fixture'));
      assert.ok(await page.evaluate(() => !JSON.parse(localStorage.getItem('mr.settings')).enabledModels.includes('gemini:gemini-missing-fixture')));
      await page.waitForTimeout(1200);
      await page.reload();
      await page.waitForSelector('.composer textarea');
      if (width < 900) await page.click('.menu-btn');
      await page.click('.sidebar-foot');
      await page.locator('.settings-tabs').getByRole('button', { name: 'Models', exact: true }).click();
      await page.getByRole('button', { name: 'Browse models', exact: true }).click();
      assert.ok(!(await page.locator('.model-list.add').textContent()).includes('gemini-missing-fixture'));
      assert.ok(!(await page.locator('.model-list.add').textContent()).includes('gemini-3.1-pro-preview'));
      await page.getByRole('button', { name: 'Your models', exact: true }).click();
      assert.ok(await page.getByRole('button', { name: 'Restore all' }).isVisible(), 'removed models can be restored');
      // The model check: every catalogue model gets one tiny request.
      await page.getByRole('button', { name: 'Check models', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Check models' });
      await dialog.getByRole('radio', { name: /All models/ }).click();
      await dialog.getByRole('button', { name: 'Start check' }).click();
      await dialog.getByText('Check complete').waitFor({ timeout: 60000 });
      const removed = await dialog.locator('.mc-group').filter({ hasText: 'Removed' }).textContent();
      assert.match(removed, /gemini-probe-missing/);
      assert.match(removed, /Model not found/);
      assert.match(await dialog.locator('.mc-group').filter({ hasText: 'busy' }).textContent(), /gemini-quota-fixture/, 'rate-limited model kept');
      assert.ok(probes.every(body => body.contents[0].parts[0].text === 'Reply with the single word OK.'));
      assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('mr.settings')).unavailableModels.includes('gemini:gemini-probe-missing')));
      assert.ok(await page.evaluate(() => !JSON.parse(localStorage.getItem('mr.settings')).unavailableModels.includes('gemini:gemini-quota-fixture')));
      // Keep anyway brings it back.
      await dialog.locator('.mc-list li').filter({ hasText: 'gemini-probe-missing' }).getByRole('button', { name: 'Keep anyway' }).click();
      await page.waitForFunction(() => !JSON.parse(localStorage.getItem('mr.settings')).unavailableModels.includes('gemini:gemini-probe-missing'));
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'check fits the screen');
      if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${width}.png` });
      await dialog.getByRole('button', { name: 'Done' }).click();
      console.log(`PASS ${width}px: model check removes broken models, keeps busy ones, Keep anyway restores`);
      console.log(`PASS ${width}px: section headings, fallback, permanent model rejection, paid model filter, persistence and recovery control`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
