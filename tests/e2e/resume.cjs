// Where you left off (src/lib/resume.ts): a relaunch (iOS ending the Home Screen app, a refresh, a closed tab) opens
// the same conversation at the same message, or the same place, without the view moving once it is drawn. Never across
// accounts, after signing out or from incognito; New chat, a deleted chat and a missing message fall back as before.
// Playwright cannot end an iOS process; a reload is the same cold start (the app is rebuilt from storage), and the
// hidden-app write is driven with a visibilitychange. Synthetic accounts; every request off the preview origin is blocked.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { profile, seed, previewUid } = require('./helpers/preview-profile.cjs');
const { openChat } = require('./helpers/open-chat.cjs');
const { openPlace } = require('./helpers/nav.cjs');
const base = process.env.MR_TEST_URL || 'http://localhost:5190';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const A = 'preview-resume-a', B = 'preview-resume-b';
const now = Date.now();
const paragraph = (i) => Array.from({ length: 5 }, (_, j) => `Paragraph ${j + 1} of message ${i}: the quick reading fixture keeps going so that every reply is several lines tall on a phone.`).join('\n\n');
const long = { id: 'resume-long', title: 'Reading position fixture', createdAt: now - 4e5, updatedAt: now - 2e5, model: 'gemini:gemini-flash-latest',
  messages: Array.from({ length: 40 }, (_, i) => ({ id: `rm-${i}`, role: i % 2 ? 'assistant' : 'user', text: i % 2 ? paragraph(i) : `Question ${i}`, createdAt: now - 4e5 + i, ...(i % 2 ? { status: 'done', model: 'gemini:gemini-flash-latest' } : {}) })) };
const short = { id: 'resume-short', title: 'Second fixture chat', createdAt: now - 3e5, updatedAt: now - 3e5, messages: [{ id: 'rs-0', role: 'user', text: 'Hello there', createdAt: now - 3e5 }] };
const snapshot = (page, uid) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), `mr.resume.${uid}`);
const hide = (page) => page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; });
// The message at the top of the conversation's view, measured as the app does.
const topOf = (page) => page.evaluate(() => {
  const el = document.querySelector('.app:not(.app-skeleton) .messages'); if (!el) return null;
  const top = el.getBoundingClientRect().top;
  for (const row of el.querySelectorAll('[data-message-id]')) { const r = row.getBoundingClientRect(); if (r.bottom > top + 1) return { id: row.dataset.messageId, offset: Math.round(r.top - top) }; }
  return null;
});

(async () => {
  const engine = process.env.MR_WEBKIT ? webkit : chromium, browser = await engine.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: !process.env.MR_WEBKIT, userAgent: UA, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await ctx.route('**/*', (r) => new URL(r.request().url()).origin === new URL(base).origin ? r.continue() : r.abort());
    await profile(ctx, A, 'light');
    // From the first frame after each load, the conversation's top message, every frame: it must not move once drawn.
    await ctx.addInitScript(() => {
      window.__tops = [];
      const tick = () => {
        const el = document.querySelector('.app:not(.app-skeleton) .messages');
        const rows = el ? el.querySelectorAll('[data-message-id]') : [];
        if (el && rows.length) {
          const top = el.getBoundingClientRect().top;
          for (const row of rows) { const r = row.getBoundingClientRect(); if (r.bottom > top + 1) { window.__tops.push(`${row.dataset.messageId}@${Math.round(r.top - top)}`); break; } }
        }
        if (window.__tops.length < 90) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const page = await ctx.newPage(); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', (e) => { errors.push(e.message); console.log('pageerror', e.message); });
    const ready = async () => { await page.locator('.app:not(.app-skeleton) .composer textarea').waitFor({ state: 'attached', timeout: 20000 }); await page.waitForTimeout(300); };
    const drawer = async () => {
      if (await page.locator('aside.cv-nav.open').count()) return;
      await page.locator('.phone-navigation:visible > button[aria-label="Open navigation"], .menu-btn:visible').first().click();
      await page.locator('aside.cv-nav.open').waitFor();
      await page.waitForTimeout(400);
    };
    const newChat = async () => { await drawer(); await page.locator('aside.cv-nav').getByRole('button', { name: 'New chat', exact: true }).click(); };
    const open = async (title) => { await drawer(); await openChat(page, title); await page.locator('aside.cv-nav.open').waitFor({ state: 'detached' }).catch(() => {}); await page.waitForTimeout(400); };
    // A cold start is done when the app (not its start-up frame) shows its message box; the load event can trail behind
    // lazy styles of a restored place on a busy machine, so it is not what is waited for.
    const relaunch = async () => { await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await page.waitForTimeout(900); };
    await page.goto(base); await ready();
    if (!await page.locator('[data-lumen-canvas-shell]').count()) { console.log('SKIP resume: not the Canvas presentation'); return; }
    await seed(page, A, [long, short]);
    await relaunch();
    assert.equal(await page.locator('.messages [data-message-id]').count(), 0, 'a first launch (nothing saved) opens a new chat');

    // 1. A conversation, read to the middle, reopens at the same message, without moving once drawn.
    await open('Reading position fixture');
    await page.locator('[data-message-id="rm-39"]').waitFor({ state: 'attached' });
    await page.locator('.messages').evaluate((el) => { el.scrollTop = el.scrollHeight * 0.4; });
    await page.waitForTimeout(500);
    const before = await topOf(page);
    assert.ok(before && before.id !== 'rm-0' && before.id !== 'rm-39', `reading the middle of the chat (${JSON.stringify(before)})`);
    await page.locator('.composer textarea').fill('Unsent draft for the long chat');
    await hide(page);
    const saved = await snapshot(page, previewUid(A));
    assert.equal(saved.chat, 'resume-long', 'hiding the app saves the open chat at once');
    assert.equal(saved.anchor.id, before.id, 'and the message at the top of the view');
    assert.deepEqual(Object.keys(saved).sort(), ['anchor', 'chat', 'place', 'v', 'workspace'], 'only ids, a place and an offset are saved');
    assert.ok(!JSON.stringify(saved).includes('Paragraph') && !JSON.stringify(saved).includes('Unsent draft'), 'no message text or draft in the snapshot');
    await relaunch();
    const after = await topOf(page);
    assert.equal(after?.id, before.id, 'the relaunch opens the same message at the top');
    assert.ok(Math.abs(after.offset - before.offset) <= 2, `at the same height (${before.offset} → ${after.offset})`);
    const tops = [...new Set(await page.evaluate(() => window.__tops))];
    assert.ok(tops.length >= 1 && tops.every((t) => { const [id, y] = t.split('@'); return id === before.id && Math.abs(Number(y) - before.offset) <= 2; }), `the view never moved once drawn: ${tops.join(', ')}`);
    assert.equal(await page.locator('.composer textarea').inputValue(), 'Unsent draft for the long chat', 'the chat\'s draft is still there');

    // 2. A place chosen in the drawer reopens as that place, a root (its control opens the drawer), with the chat under it.
    await openPlace(page, 'Router');
    const router = page.locator('.rc-page:not([hidden])');
    await router.waitFor();
    await page.waitForTimeout(600);
    assert.equal((await snapshot(page, previewUid(A))).place?.kind, 'router', 'opening Router is saved shortly after');
    await relaunch();
    await router.waitFor();
    assert.equal(await page.locator('.phone-navigation:visible > button[aria-label="Open navigation"]').count(), 1, 'restored Router is a root: its control opens the drawer');
    assert.equal(await page.locator('.phone-navigation:visible > button[aria-label="Back"]').count(), 0, 'with no Back to a new chat');
    await newChat();
    await page.waitForTimeout(600);

    // 3. New chat is respected: the next launch is a new chat, not the conversation before it.
    assert.equal(await page.locator('.messages [data-message-id]').count(), 0, 'New chat shows an empty chat');
    await relaunch();
    assert.equal(await page.locator('.messages [data-message-id]').count(), 0, 'after New chat, a relaunch stays on a new chat');
    assert.equal(await router.count(), 0, 'and Router is not reopened');

    // 4. A deleted chat (or one this device no longer has) opens a new chat.
    await open('Second fixture chat');
    await page.locator('[data-message-id="rs-0"]').waitFor({ state: 'attached' });
    await hide(page);
    // Deleted (here, or on another device and synced away): the chat is no longer in this account's store.
    await page.evaluate((uid) => new Promise((resolve, reject) => { const r = indexedDB.open('model-router-account-' + uid); r.onsuccess = () => { const tx = r.result.transaction('chats', 'readwrite'); tx.objectStore('chats').delete('resume-short'); tx.oncomplete = () => { r.result.close(); resolve(); }; tx.onerror = reject; }; r.onerror = reject; }), previewUid(A));
    await relaunch();
    assert.equal(await page.locator('.messages [data-message-id]').count(), 0, 'a chat that is gone opens a new chat');

    // 5. Incognito saves nothing and clears what was there.
    await open('Reading position fixture');
    await page.locator('[data-message-id="rm-39"]').waitFor({ state: 'attached' });
    await hide(page);
    assert.equal((await snapshot(page, previewUid(A))).chat, 'resume-long');
    await newChat();
    await page.getByRole('button', { name: 'Start incognito chat', exact: true }).click();
    await page.getByRole('button', { name: 'End incognito chat', exact: true }).waitFor();
    await hide(page);
    assert.equal(await snapshot(page, previewUid(A)), null, 'an incognito chat clears the saved spot');
    await relaunch();
    assert.equal(await page.getByRole('button', { name: 'End incognito chat', exact: true }).count(), 0, 'a relaunch never returns to incognito');
    assert.equal(await page.locator('.messages [data-message-id]').count(), 0, 'it opens a new chat');

    // 6. Accounts are kept apart: B never opens A's chat, and A still returns to its own.
    await open('Reading position fixture');
    await page.locator('[data-message-id="rm-39"]').waitFor({ state: 'attached' });
    await hide(page);
    assert.equal((await snapshot(page, previewUid(A))).chat, 'resume-long');
    await page.evaluate((uid) => { localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'b@local.invalid', displayName: 'Account B' })); localStorage.setItem(`mr.account.${uid}`, localStorage.getItem('mr.account.preview-resume-a')); }, B);
    await relaunch();
    assert.equal(await page.locator('.messages [data-message-id]').count(), 0, "account B opens a new chat, never A's");
    assert.equal(await page.locator('.chat-row', { hasText: 'Reading position fixture' }).count(), 0, "and has none of A's chats");
    assert.equal((await snapshot(page, B))?.chat ?? null, null, "B's own spot is its new chat, never A's chat");
    assert.equal((await snapshot(page, previewUid(A))).chat, 'resume-long', "A's spot is untouched by B");
    await page.evaluate((uid) => localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'fixture@local.invalid', displayName: 'Fixture' })), previewUid(A));
    await relaunch();
    await page.locator('[data-message-id="rm-39"]').waitFor({ state: 'attached' });
    assert.ok(await page.locator('.messages [data-message-id]').count() > 0, 'back on A, its chat reopens');

    // 7. Signing out forgets: the next sign-in starts on a new chat.
    await openPlace(page, 'Settings');
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settings.getByRole('button', { name: /^(General|Account:)/ }).first().click();
    await settings.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).waitFor();
    assert.equal(await snapshot(page, previewUid(A)), null, 'signing out removes the saved spot');
    await page.waitForTimeout(600);
    assert.equal(await snapshot(page, previewUid(A)), null, 'and nothing writes it back while signed out');
    await page.evaluate((uid) => localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'fixture@local.invalid', displayName: 'Fixture' })), previewUid(A));
    await relaunch();
    assert.equal(await page.locator('.messages [data-message-id]').count(), 0, 'signing in again opens a new chat');

    assert.deepEqual(errors, [], 'no page errors');
    console.log('PASS resume');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
