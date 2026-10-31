// Sidebar → View all chats: select several, export them as one zip, then delete them together.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390]) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900, serviceWorkers: 'block', reducedMotion: 'reduce', acceptDownloads: true });
      await ctx.route('**/firestore.googleapis.com/**', (r) => r.abort());
      await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
        if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'] }] } });
        return r.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Sure.' }] }, finishReason: 'STOP' }] }) + '\n\n' });
      });
      await ctx.addInitScript(() => {
        if (localStorage.getItem('mr.preview_user')) return;
        const uid = 'preview-bulk';
        const settings = { autoIntroduced: true, autoTitle: false, enabledModels: ['gemini:gemini-flash-latest'], defaultModel: 'gemini:gemini-flash-latest' };
        localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'bulk@local.invalid', displayName: 'Bulk' }));
        localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
        localStorage.setItem('mr.settings', JSON.stringify(settings));
        localStorage.setItem('mr.installHint', '1');
      });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
      for (const text of ['first chat', 'second chat', 'third chat']) {
        await page.locator('.composer textarea').waitFor();
        await page.fill('.composer textarea', text);
        await page.click('.send-btn');
        await page.locator('.msg.assistant', { hasText: 'Sure.' }).waitFor();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+O' : 'Control+Shift+O');
        await page.waitForTimeout(300);
      }
      const openMenu = async () => { if (width < 900) { await page.click('.menu-btn'); await page.locator('.sidebar.open').waitFor(); } };
      await openMenu();
      await page.click('.view-all-chats, .cv-all');
      const dialog = page.getByRole('dialog', { name: 'All chats' });
      await dialog.waitFor();
      // A long list scrolls; it never squeezes its rows (2026-10-31: rows collapsed to 21 px once the list filled up).
      const rowH = await dialog.locator('.all-chats-list').evaluate((l) => { const h = () => l.firstElementChild.getBoundingClientRect().height, full = h(); l.style.maxHeight = '40px'; const squeezed = h(); l.style.maxHeight = ''; return { full, squeezed }; });
      assert.ok(rowH.full >= 40 && Math.abs(rowH.squeezed - rowH.full) < 1, `All chats rows keep their height in a full list (${JSON.stringify(rowH)})`);
      // (Canvas, and the iPhone glass look: rows are plain until you tap Select.)
      if (await dialog.locator('.all-chats-select').count()) await dialog.locator('.all-chats-select').click();
      await dialog.getByLabel('Select all chats').check();
      assert.match(await dialog.locator('.all-chats-head').textContent(), /3 selected/);
      const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Export' }).click()]);
      assert.match(download.suggestedFilename(), /Lumen chats \(3\)\.zip/);
      await dialog.getByLabel('Select all chats').uncheck();
      await dialog.getByLabel('Select first chat').check();
      await dialog.getByLabel('Select second chat').check();
      if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${width}.png` });
      assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), 'window fits');
      await dialog.getByRole('button', { name: 'Delete' }).click();
      await dialog.getByRole('alert').getByRole('button', { name: 'Delete' }).click();
      await dialog.locator('.all-chats-list li').nth(1).waitFor({ state: 'detached' });
      assert.deepEqual(await dialog.locator('.all-chats-title').allTextContents(), ['third chat']);
      await page.keyboard.press('Escape');
      const titles = await page.locator(':is(.chat-list, .cv-nav) .chat-title').allTextContents();
      assert.deepEqual(titles.filter((t) => t !== 'New chat'), ['third chat'], titles.join('|'));
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: several chats exported and deleted together`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
