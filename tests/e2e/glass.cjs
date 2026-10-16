// 2.3: the iPhone glass look. Only iPhones get it (not Android, not computers), it can be switched off for a
// device that stutters, the chat runs under the floating bars without hiding the first or last message, and
// the floating tab bar moves between pages.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const OLD_IPHONE = IPHONE.replace(/18_5/g, '15_7');
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const now = Date.now();
const chat = { id: 'g1', title: 'Glass chat', createdAt: now, updatedAt: now, messages: Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? 'assistant' : 'user', text: `${i === 0 ? 'FIRST' : i === 11 ? 'LAST' : 'Middle'} message ${i}. `.repeat(i % 2 ? 6 : 1), status: 'done', model: 'gemini:gemini-flash-latest', createdAt: now - (12 - i) * 1000 })) };

(async () => {
  const browser = await chromium.launch();
  const open = async (ua, uid, init) => {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, userAgent: ua, serviceWorkers: 'block' });
    await profile(ctx, uid, 'light');
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    return { ctx, page, glass: () => page.evaluate(() => document.documentElement.classList.contains('glass')) };
  };
  try {
    let t = await open(ANDROID, 'glass-android');
    assert.equal(await t.glass(), false, 'Android keeps the regular look'); await t.ctx.close();
    t = await open(OLD_IPHONE, 'glass-old');
    assert.equal(await t.glass(), false, 'iOS 15 keeps the regular look'); await t.ctx.close();
    t = await open(IPHONE, 'glass-off', () => localStorage.setItem('mr.glass', 'off'));
    assert.equal(await t.glass(), false, 'a device that stuttered keeps the regular look'); await t.ctx.close();
    console.log('PASS glass only where it runs well');

    t = await open(IPHONE, 'glass-on');
    const { page } = t;
    assert.equal(await t.glass(), true, 'iPhones get glass');
    const blur = await page.$eval('.composer', (e) => getComputedStyle(e).backdropFilter);
    assert.match(blur, /blur/, 'the message box is see-through glass');
    await seed(page, 'glass-on', [chat]);
    await page.reload(); await page.waitForSelector('.composer textarea');
    await page.click('.menu-btn'); await page.waitForTimeout(400);
    await page.locator('.sidebar').getByText('Glass chat', { exact: true }).click();
    await page.waitForSelector('.msg'); await page.waitForTimeout(600);
    // Scrolled to the end: the last message sits above the floating message box.
    const scrollEnd = () => page.evaluate(() => { const m = document.querySelector('.messages'); m.scrollTop = m.scrollHeight; });
    await scrollEnd(); await page.waitForTimeout(300);
    const below = await page.evaluate(() => {
      const last = [...document.querySelectorAll('.msg')].pop().getBoundingClientRect();
      const box = document.querySelector('.composer').getBoundingClientRect();
      return { last: last.bottom, box: box.top, height: innerHeight };
    });
    assert.ok(below.last <= below.box, `the last message (ends ${Math.round(below.last)}) is above the message box (${Math.round(below.box)})`);
    assert.ok(below.box > below.height - 200, 'the message box floats at the bottom');
    // Scrolled to the top: the first message sits below the floating bar.
    await page.evaluate(() => { document.querySelector('.messages').scrollTop = 0; }); await page.waitForTimeout(200);
    const top = await page.evaluate(() => ({ first: document.querySelector('.msg').getBoundingClientRect().top, bar: document.querySelector('.topbar .menu-btn').getBoundingClientRect().bottom }));
    assert.ok(top.first >= top.bar, `the first message (${Math.round(top.first)}) starts below the top bar (${Math.round(top.bar)})`);
    console.log('PASS the chat runs under the bars without hiding messages');

    // Tab bar between pages (Projects shows the app's pages).
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'projects' })));
    await page.waitForSelector('.glass-tabbar');
    assert.equal(await page.locator('.glass-tabbar [aria-current="page"]').innerText(), 'Projects');
    // 2.5.0: Projects looks like Tools and Collection: centred title, + at the top left, one search field.
    assert.equal(await page.locator('.hub-page.has-bar').count(), 1, 'Projects has the compact iPhone header');
    assert.equal(await page.locator('.hub-new').getAttribute('aria-label'), 'New project');
    assert.equal(await page.locator('.hub-actions').count(), 0, 'no big New project button');
    await page.locator('.glass-tabbar button', { hasText: 'Chats' }).click();
    await page.waitForSelector('.hub-page', { state: 'detached' });
    await page.waitForSelector('.composer textarea');
    // Real touch input has implicit pointer capture: hover/enter events cannot implement scrubbing.
    const touch = await page.context().newCDPSession(page);
    const scrub = async (indices, finish = 'release') => {
      const nav = page.locator('.glass-tabbar');
      const before = await nav.locator('[aria-current="page"]').innerText();
      const points = await nav.locator('button').evaluateAll(buttons => buttons.map(b => {
        const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }));
      const send = (type, point) => touch.send('Input.dispatchTouchEvent', { type, touchPoints: point ? [{ ...point, id: 1 }] : [] });
      await send('touchStart', points[indices[0]]);
      for (const i of indices) {
        await send('touchMove', points[i]);
        await page.waitForFunction(i => document.querySelector('.glass-tabbar').style.getPropertyValue('--i') === String(i), i);
        assert.equal(await nav.locator('[aria-current="page"]').innerText(), before, 'Preview must not navigate before release');
      }
      if (finish === 'outside') await send('touchMove', { x: points[indices.at(-1)].x, y: points[0].y - 100 });
      await send(finish === 'cancel' ? 'touchCancel' : 'touchEnd');
      await page.waitForFunction(() => !document.querySelector('.glass-tabbar').classList.contains('held'));
      assert.equal(await nav.locator('[aria-current="page"]').innerText(), finish === 'release' ? await nav.locator('button').nth(indices.at(-1)).innerText() : before);
      assert.equal(await page.locator('.app.swipe-revealing').count(), 0, 'Tab scrubbing must not trigger back navigation');
    };
    // 2.4.14: Tools shows its categories in the tab bar, one at a time, and no Connected apps.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools-page' })));
    await page.waitForSelector('.glass-tabbar.page-sections');
    assert.deepEqual(await page.$$eval('.glass-tabbar button', (b) => b.map((x) => x.textContent)), ['Research', 'Create', 'Analyze', 'Learn', 'Assistants']);
    await page.locator('.glass-tabbar button', { hasText: 'Learn' }).click();
    assert.ok(await page.locator('.tool-card', { hasText: 'Study partner' }).isVisible(), 'the chosen category shows');
    assert.equal(await page.locator('.tool-card', { hasText: 'Deep research' }).count(), 0, 'only the chosen category shows');
    // 2.4.15: the title sits in the top bar, the search box only searches this tab, and + makes something new for it.
    assert.equal(await page.locator('.hub-head').isVisible(), false, 'no big heading or grey description');
    assert.equal(await page.locator('.hub-new').count(), 0, 'no + on Tools (2.4.17)');
    await page.fill('input[aria-label="Search tools"]', 'research');
    assert.equal(await page.locator('.tool-card', { hasText: 'Deep research' }).count(), 0, 'search stays inside the tab');
    await page.fill('input[aria-label="Search tools"]', '');
    assert.equal(await page.getByText('Connected apps').count(), 0, 'connected apps live in Settings');
    await scrub([0, 1, 2, 3]);
    await scrub([3, 2, 1, 0]);
    await scrub([0, 1, 2], 'cancel');
    await scrub([0, 1], 'outside');
    console.log('PASS Tools touch scrubbing previews, commits on release and cancels safely');
    // 2.4.17: the + appears only where it adds something (Assistants), and the assistant editor returns to
    // Tools → Assistants (no old Assistants page on iPhone).
    await page.locator('.glass-tabbar button', { hasText: 'Assistants' }).click();
    assert.equal(await page.locator('.hub-new').getAttribute('aria-label'), 'New assistant');
    await page.locator('.hub-new').click();
    await page.waitForSelector('input[aria-label="Library item name"]');
    // 2.5.0: dropdowns open an iOS menu; choosing in it changes the setting.
    const model = page.locator('select[aria-label="Assistant model"]');
    await model.tap();
    await page.waitForSelector('.glass-select-menu [role="option"][aria-selected="true"]');
    assert.equal((await page.locator('.glass-select-menu [aria-selected="true"]').innerText()).trim(), 'Auto · choose for the task');
    await page.locator('.glass-select-menu [role="option"]').nth(1).click();
    await page.waitForSelector('.glass-select-menu', { state: 'detached' });
    assert.equal(await model.inputValue(), 'gemini:gemini-flash-latest', 'the choice reaches the app');
    await page.locator('.hub-nav[aria-label="Back"]').click();
    await page.waitForSelector('.glass-tabbar.page-sections');
    assert.equal(await page.locator('.glass-tabbar [aria-current="page"]').innerText(), 'Assistants', 'back in Tools → Assistants');
    assert.equal(await page.locator('.lib-section').count(), 0, 'not the old Assistants page');
    await page.locator('.hub-close').click();
    await page.waitForSelector('.hub-page', { state: 'detached' });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'assistants' })));
    await page.waitForSelector('.glass-tabbar.page-sections');
    assert.equal(await page.locator('.glass-tabbar [aria-current="page"]').innerText(), 'Assistants', 'the Assistants page opens as Tools → Assistants');
    await page.locator('.hub-close').click();
    await page.waitForSelector('.hub-page', { state: 'detached' });
    // Collection's filters are its tab bar.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'collection' })));
    await page.waitForSelector('.glass-tabbar.page-sections');
    assert.deepEqual(await page.$$eval('.glass-tabbar button', (b) => b.map((x) => x.textContent)), ['All', 'Photos', 'Docs', 'Files', 'Made'], 'no Search tab: the search box covers it');
    assert.equal(await page.locator('.coll-filters').count(), 0, 'no filter chips at the top');
    await scrub([0, 1, 2, 3, 4]);
    await scrub([4, 3, 2, 1, 0]);
    await scrub([0, 2], 'cancel');
    await scrub([0, 1], 'outside');
    const photosTab = page.locator('.glass-tabbar button', { hasText: 'Photos' });
    await photosTab.focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.glass-tabbar [aria-current="page"]').innerText(), 'Photos', 'Keyboard activation still works');
    console.log('PASS Library touch scrubbing in both directions, cancellation and keyboard activation');

    await page.locator('.glass-tabbar button', { hasText: 'Photos' }).click();
    assert.equal(await page.locator('.hub-new').getAttribute('aria-label'), 'Add photos');
    assert.ok(await page.locator('.hub-empty button', { hasText: 'Add photos' }).isVisible(), 'an empty tab offers to add something');
    // Files also holds the files uploaded for Lumen to search; the tab bar steps aside while typing.
    await page.locator('.glass-tabbar button', { hasText: 'Files' }).click();
    await page.waitForSelector('.coll-searchable .knowledge-library');
    assert.equal(await page.locator('.hub-new').getAttribute('aria-label'), 'Upload a file');
    await page.evaluate(() => document.documentElement.classList.add('kb-open'));
    assert.equal(await page.locator('.glass-tabbar').isVisible(), false, 'tab bar hidden while typing');
    await page.evaluate(() => document.documentElement.classList.remove('kb-open'));
    await page.locator('.hub-close').click();
    await page.waitForSelector('.hub-page', { state: 'detached' });
    console.log('PASS the tab bar moves between pages');

    // 2.5.1: All chats has a Select mode (rows are plain until then) and iPhone sheets have no ✕.
    await page.click('.menu-btn'); await page.waitForTimeout(400);
    await page.click('.view-all-chats');
    await page.waitForSelector('.all-chats');
    assert.equal(await page.locator('.all-chats input[type="checkbox"]').count(), 0, 'no checkboxes until Select');
    assert.equal(await page.locator('.all-chats-actions').count(), 0, 'no action row until Select');
    assert.equal(await page.locator('.modal [aria-label="Close"]').isVisible(), false, 'no ✕ on the sheet');
    await page.click('.all-chats-select');
    await page.locator('.all-chats-open').first().click();
    assert.equal(await page.locator('.all-chats-list li.checked').count(), 1, 'tapping a row selects it');
    assert.ok(await page.locator('.all-chats-actions .btn', { hasText: 'Archive' }).isEnabled());
    await page.keyboard.press('Escape');
    await page.waitForSelector('.all-chats', { state: 'detached' });
    console.log('PASS select mode and sheets without ✕');
    await t.ctx.close();

    // 2.3.1: in the sidebar, the account picture and New chat sit on one line with no extra gap below,
    // and "Your chats will appear here" is centred.
    t = await open(IPHONE, 'glass-empty');
    await t.page.click('.menu-btn'); await t.page.waitForTimeout(600);
    const side = await t.page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const a = r('.sidebar-footer .sidebar-foot'), n = r('.sidebar-footer .new-chat'), sb = r('.sidebar'), e = r('.empty-list');
      return { avatar: a.top + a.height / 2, button: n.top + n.height / 2, gap: sb.bottom - n.bottom, empty: e.left + e.width / 2, middle: sb.left + sb.width / 2 };
    });
    assert.ok(Math.abs(side.avatar - side.button) <= 1, `account picture (${side.avatar}) and New chat (${side.button}) line up`);
    assert.ok(side.gap <= 24, `no big gap under New chat (${Math.round(side.gap)}px)`);
    assert.ok(Math.abs(side.empty - side.middle) <= 2, 'the empty message is centred');
    console.log('PASS sidebar footer lines up and the empty message is centred');
    await t.ctx.close();

    // Computers never see the tab bar.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await profile(ctx, 'glass-desktop', 'light');
    const desk = await ctx.newPage();
    await desk.goto(URL); await desk.waitForSelector('.composer textarea');
    await desk.evaluate(() => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools-page' })));
    await desk.waitForSelector('.hub-page');
    assert.equal(await desk.evaluate(() => document.documentElement.classList.contains('glass')), false);
    assert.equal(await desk.locator('.glass-tabbar').count(), 0, 'no tab bar on computers');
    console.log('PASS computers keep their look');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
