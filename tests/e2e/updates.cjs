// App updates with the real service worker (src/pwa/sw.js, src/pwa/register.ts, src/lib/update-safety.ts). A local
// proxy serves this build as version 1 and then as versions 2, 3 and 4 (a changed service worker and a marker in the
// page), so the browser really installs, waits and activates. Checked: no update shown at first install; a new version
// downloads while the app keeps working and nothing reloads (also on hide and return); Canvas shows no banner, only
// Settings → General (the ordinary build keeps its bar); Update waits, saying why, during a reply and with attached
// files; it reloads exactly once, back to the same screen, chat, reading position and draft; offline the app still
// opens; another window's update never reloads this one, which offers to reload; and a version still waiting when the
// last window closes is what Lumen opens next. Synthetic account; nothing leaves this machine.
const assert = require('node:assert/strict');
const http = require('node:http');
const { chromium, webkit } = require('playwright');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const { openChat } = require('./helpers/open-chat.cjs');
const { openPlace, leavePlace } = require('./helpers/nav.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5190';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const UID = 'preview-updates';
const now = Date.now();
const paragraph = (i) => Array.from({ length: 4 }, (_, j) => `Paragraph ${j + 1} of message ${i}, long enough to fill several lines on a phone.`).join('\n\n');
const long = { id: 'upd-long', title: 'Update fixture chat', createdAt: now - 4e5, updatedAt: now - 2e5, model: 'gemini:gemini-flash-latest',
  messages: Array.from({ length: 30 }, (_, i) => ({ id: `um-${i}`, role: i % 2 ? 'assistant' : 'user', text: i % 2 ? paragraph(i) : `Question ${i}`, createdAt: now - 4e5 + i, ...(i % 2 ? { status: 'done', model: 'gemini:gemini-flash-latest' } : {}) })) };

// The server: what this build would look like as a later release.
const server = { version: 1, offline: false };
const proxy = http.createServer(async (req, res) => {
  if (server.offline) { req.socket.destroy(); return; }
  try {
    const url = new URL(req.url, base);
    const upstream = await fetch(new URL(url.pathname + url.search, base));
    let body = Buffer.from(await upstream.arrayBuffer());
    if (server.version > 1 && url.pathname === '/sw.js') body = Buffer.from(body.toString().replace(/const VERSION = '([^']+)'/, (_, v) => `const VERSION = '${v}-v${server.version}'`));
    if (server.version > 1 && (upstream.headers.get('content-type') || '').includes('text/html')) body = Buffer.from(body.toString().replace('<head>', `<head><meta name="lumen-test-build" content="${server.version}">`));
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(502); res.end(); }
});

(async () => {
  await new Promise((r) => proxy.listen(0, '127.0.0.1', r));
  const origin = `http://localhost:${proxy.address().port}`;
  // Nothing may leave this machine. Chromium's request routing (below) also covers a page a service worker controls;
  // WebKit's does not, so WebKit goes through a proxy that does not exist for everything but this machine.
  const engine = process.env.MR_WEBKIT ? webkit : chromium;
  const browser = await engine.launch(process.env.MR_WEBKIT ? { proxy: { server: 'http://127.0.0.1:9', bypass: 'localhost,127.0.0.1' } } : {});
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: !process.env.MR_WEBKIT, userAgent: UA, reducedMotion: 'reduce' });
    await ctx.route('**/*', (r) => new URL(r.request().url()).origin === origin ? r.continue() : r.abort());
    await profile(ctx, UID, 'light');
    // Each page load in a tab counts, so a second (unwanted) reload shows.
    await ctx.addInitScript(() => { const n = Number(sessionStorage.getItem('__loads') || 0) + 1; sessionStorage.setItem('__loads', String(n)); window.__alive = true; });
    const errors = [];
    const tab = async () => { const p = await ctx.newPage(); p.setDefaultTimeout(15000); p.on('pageerror', (e) => { errors.push(e.message); console.log('pageerror', e.message); }); return p; };
    const ready = async (p) => { await p.locator('.app:not(.app-skeleton) .composer textarea').waitFor({ state: 'attached', timeout: 30000 }); await p.waitForTimeout(400); };
    const build = (p) => p.evaluate(() => document.querySelector('meta[name="lumen-test-build"]')?.getAttribute('content') || '1');
    const loads = (p) => p.evaluate(() => Number(sessionStorage.getItem('__loads')));
    const alive = (p) => p.evaluate(() => window.__alive === true);
    const controlled = (p) => p.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30000 });
    const waiting = async (p) => {
      for (let i = 0; i < 60; i++) {
        if (await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r?.update().catch(() => {}); return Boolean(r?.waiting); })) return;
        await p.waitForTimeout(500);
      }
      throw new Error('no new version waiting');
    };
    const hide = (p, state) => p.evaluate((s) => { Object.defineProperty(document, 'visibilityState', { value: s, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; }, state);
    const drawer = async (p) => {
      if (!await p.locator('[data-lumen-canvas-shell]').count()) { // ordinary build: its sidebar slides in on phones
        if (!await p.locator('.sidebar.open').count()) { await p.locator('.menu-btn:visible, [aria-label="Open chats"]:visible').first().click(); await p.waitForTimeout(400); }
        return;
      }
      if (await p.locator('aside.cv-nav.open').count()) return;
      await p.locator('.phone-navigation:visible > button[aria-label="Open navigation"], .menu-btn:visible').first().click();
      await p.locator('aside.cv-nav.open').waitFor(); await p.waitForTimeout(300);
    };
    const open = async (p, title) => { await drawer(p); await openChat(p, title); await p.locator('aside.cv-nav.open').waitFor({ state: 'detached' }).catch(() => {}); await p.waitForTimeout(400); };
    const settings = (p) => p.getByRole('dialog', { name: 'Settings', exact: true });
    const general = async (p) => { await openPlace(p, 'Settings'); await settings(p).getByRole('button', { name: /^(General|Account:)/ }).first().click(); await settings(p).getByText('Lumen', { exact: false }).first().waitFor(); };
    const about = (p) => settings(p).locator('.setting-row', { hasText: /latest version|new version|Available once|Send or remove|Updating/ }).first();
    const leaveSettings = async (p) => { await leavePlace(p, '.settings-page'); await p.waitForTimeout(300); };
    const topOf = (p) => p.evaluate(() => {
      const el = document.querySelector('.app:not(.app-skeleton) .messages'); const top = el.getBoundingClientRect().top;
      for (const row of el.querySelectorAll('[data-message-id]')) { const r = row.getBoundingClientRect(); if (r.bottom > top + 1) return { id: row.dataset.messageId, offset: Math.round(r.top - top) }; }
      return null;
    });

    // First install: no update is offered.
    let page = await tab();
    await page.goto(origin); await ready(page);
    const canvas = await page.locator('[data-lumen-canvas-shell]').count() > 0;
    await controlled(page);
    await seed(page, UID, [long]);
    await page.close(); page = await tab(); await page.goto(origin); await ready(page);
    // (Playwright's WebKit loads a fresh tab's first page twice here, with or without this change; what is checked
    // below is that nothing loads it again.)
    const opened = await loads(page);
    assert.equal(await page.locator('.update-bar').count(), 0, 'first install: no update bar');
    if (canvas) {
      await openPlace(page, 'Settings');
      assert.ok(!(await settings(page).locator('.si-account').innerText()).includes('Update ready'), 'first install: nothing offered in Settings');
      await settings(page).getByRole('button', { name: /^(General|Account:)/ }).first().click();
      assert.match(await about(page).innerText(), /latest version/);
      await leaveSettings(page);
    }

    // A new version downloads while the app keeps working; nothing reloads, also when the app is hidden and returns.
    await open(page, 'Update fixture chat');
    server.version = 2;
    await waiting(page);
    await hide(page, 'hidden'); await page.waitForTimeout(300); await hide(page, 'visible'); await page.waitForTimeout(1500);
    assert.ok(await alive(page) && await build(page) === '1' && await loads(page) === opened, 'still the same page, version 1, after the download and a hide and return');
    if (canvas) assert.equal(await page.locator('.update-bar').count(), 0, 'Canvas: no banner over the chat');
    else await page.locator('.update-bar').waitFor();
    const box = page.locator('.composer textarea');
    await box.fill('Still typing while it downloads'); await box.fill('');

    // During a reply: Update waits and says why. (Holding a reply open needs request routing, which Playwright applies
    // to a service-worker-controlled page in Chromium only; WebKit runs the other cases.)
    if (canvas && !process.env.MR_WEBKIT) {
      let release; const held = new Promise((r) => { release = r; });
      const reply = 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Fixture reply completed.' }] }, finishReason: 'STOP' }] }) + String.fromCharCode(10, 10);
      await page.route('**/generativelanguage.googleapis.com/**', async (r) => { if (r.request().url().includes('/models?')) return r.fallback(); await held; await r.fulfill({ contentType: 'text/event-stream', body: reply }).catch(() => {}); });
      await box.fill('A question while an update waits');
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByRole('button', { name: 'Stop', exact: true }).waitFor();
      await general(page);
      await settings(page).getByRole('button', { name: 'Update now' }).click();
      await about(page).getByText('Available once the reply finishes.').waitFor();
      assert.ok(await alive(page) && await build(page) === '1', 'a reply in progress: no reload');
      release();
      await leaveSettings(page);
      await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'detached' });
      await page.unroute('**/generativelanguage.googleapis.com/**');
    }
    if (canvas) {
      // With a file attached but not sent (it exists only in memory): Update waits.
      await page.locator('input[type="file"][multiple]:not([accept="image/*"])').first().setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic notes') });
      await page.getByRole('button', { name: 'Remove notes.txt' }).waitFor();
      await general(page);
      await settings(page).getByRole('button', { name: 'Update now' }).click();
      await about(page).getByText('Send or remove the attached files first.').waitFor();
      assert.ok(await alive(page) && await build(page) === '1', 'an unsent attachment: no reload');
      await leaveSettings(page);
      await page.getByRole('button', { name: 'Remove notes.txt' }).click();

      // Idle with a typed draft, reading the middle of the chat: Update reloads once, back to where you were.
      await page.locator('.messages').evaluate((el) => { el.scrollTop = el.scrollHeight * 0.4; });
      await page.waitForTimeout(500);
      const spot = await topOf(page);
      await box.fill('Draft kept across the update');
      await page.waitForTimeout(300);
      await openPlace(page, 'Settings');
      assert.ok((await settings(page).locator('.si-account').innerText()).includes('Update ready'), 'Settings says an update is ready on the row that leads to it');
      await settings(page).getByRole('button', { name: /^(General|Account:)/ }).first().click();
      assert.match(await about(page).innerText(), /new version is ready/);
      const before = await loads(page);
      const button = settings(page).getByRole('button', { name: 'Update now' });
      await button.click(); await button.click({ timeout: 1000 }).catch(() => {});
      await page.waitForFunction(() => document.querySelector('meta[name="lumen-test-build"]')?.getAttribute('content') === '2', null, { timeout: 30000 });
      await ready(page); await page.waitForTimeout(2500);
      assert.equal(await loads(page), before + 1, 'exactly one reload');
      await settings(page).waitFor();
      assert.match(await about(page).innerText(), /latest version/, 'back on Settings → General, now up to date');
      // Settings reopened as a root (a place chosen in the drawer); the chat is chosen from the drawer, as before.
      await leaveSettings(page);
      await open(page, 'Update fixture chat');
      await page.locator(`[data-message-id="${spot.id}"]`).waitFor({ state: 'attached' });
      const after = await topOf(page);
      assert.equal(after.id, spot.id, 'the same chat at the same message');
      assert.ok(Math.abs(after.offset - spot.offset) <= 2, `at the same height (${spot.offset} → ${after.offset})`);
      assert.equal(await box.inputValue(), 'Draft kept across the update', 'the draft is kept');
      await box.fill('');
    } else {
      // Ordinary build: its bar's Reload goes through the same checks and reloads once.
      const before = await loads(page);
      await page.locator('.update-bar').getByRole('button', { name: 'Reload' }).click();
      await page.waitForFunction(() => document.querySelector('meta[name="lumen-test-build"]')?.getAttribute('content') === '2', null, { timeout: 30000 });
      await ready(page); await page.waitForTimeout(2500);
      assert.equal(await loads(page), before + 1, 'ordinary: exactly one reload');
    }

    // Offline: the app still opens from the copy on the device, and a failed check changes nothing.
    server.offline = true;
    const offline = await tab(); await offline.goto(origin); await ready(offline);
    assert.equal(await build(offline), '2', 'offline: the installed version opens');
    await offline.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); await r?.update().catch(() => {}); });
    assert.equal(await offline.locator('.update-bar').count(), 0, 'a failed check shows nothing');
    await offline.close();
    server.offline = false;

    // Two windows: updating in one never reloads the other, which keeps working and offers to reload.
    server.version = 3;
    await waiting(page);
    const other = await tab(); await other.goto(origin); await ready(other);
    assert.equal(await build(other), '2', 'a window opening while another is open does not take the update over');
    assert.ok(await alive(page) && await build(page) === '2', 'nor is the first window reloaded');
    if (canvas) {
      await general(other);
      await settings(other).getByRole('button', { name: 'Update now' }).click();
      await other.waitForFunction(() => document.querySelector('meta[name="lumen-test-build"]')?.getAttribute('content') === '3', null, { timeout: 30000 });
      await page.waitForTimeout(1500);
      assert.ok(await alive(page) && await build(page) === '2', 'the other window is not reloaded');
      await openPlace(page, 'Library');
      await page.locator('.hub-page').first().waitFor();
      assert.ok(await alive(page), 'and still opens screens it had not loaded yet');
      await leavePlace(page, '.hub-page');
      await openPlace(page, 'Settings');
      assert.ok((await settings(page).locator('.si-account').innerText()).includes('Update ready'), 'it offers to reload into the new version');
      await settings(page).getByRole('button', { name: /^(General|Account:)/ }).first().click();
      const before = await loads(page);
      await settings(page).getByRole('button', { name: 'Update now' }).click();
      await page.waitForFunction(() => document.querySelector('meta[name="lumen-test-build"]')?.getAttribute('content') === '3', null, { timeout: 30000 });
      await ready(page); await page.waitForTimeout(1500);
      assert.equal(await loads(page), before + 1, 'which reloads it once');
    }
    await other.close();

    // A version waiting when the last Lumen window closes is used when Lumen next opens, with nothing to choose.
    server.version = 4;
    await waiting(page);
    assert.equal(await build(page), canvas ? '3' : '2', 'the open window keeps running its version');
    await page.close();
    page = await tab(); await page.goto(origin); await ready(page);
    assert.equal(await build(page), '4', 'opened again: the new version');
    const shown = await loads(page); await page.waitForTimeout(1500);
    assert.equal(await loads(page), shown, 'and nothing reloads it once shown');

    assert.deepEqual(errors, [], 'no page errors');
    console.log(`PASS updates ${process.env.MR_WEBKIT ? 'webkit' : 'chromium'} ${canvas ? 'canvas' : 'ordinary'}`);
  } finally { await browser.close(); proxy.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
