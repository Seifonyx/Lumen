const {closeSettings}=require('./helpers/ui.cjs');
// Settings → Privacy & data → Delete my account and data removes the account's cloud data, its share
// links and the sign-in record, then signs out. A second account's data is left alone.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const FS = 'http://127.0.0.1:8080/v1/projects/the-model-router/databases/(default)/documents';
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;

const listAll = async (path) => {
  const r = await fetch(`${FS}/${path}`, { headers: { authorization: 'Bearer owner' } });
  return r.ok ? (await r.json()).documents || [] : [];
};

async function signedIn(browser, email) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/generativelanguage.googleapis.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'] }] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Title' }] } }] } });
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: 'Hello back.' }] }, finishReason: 'STOP' }] }) });
  });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate((e) => window.__testSignIn(e), email);
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g-key');
  await page.click('button:has-text("Save key")');
  await page.waitForTimeout(1500);
  await closeSettings(page);
  await page.fill('.composer textarea', `hello from ${email}`);
  await page.click('.send-btn');
  await page.locator('.msg.assistant', { hasText: 'Hello back.' }).waitFor();
  await page.waitForTimeout(2500); // let the chat sync
  const uid = await page.evaluate(() => window.__mrStore?.getState?.().user?.uid || null);
  return { ctx, page, errors, uid };
}

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  try {
    const other = await signedIn(browser, 'seifeldingamal2021@gmail.com');
    const me = await signedIn(browser, 'hebaghoneim8@gmail.com');
    const users = async () => (await (await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/the-model-router/accounts:query', { method: 'POST', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: '{}' })).json()).userInfo || [];
    const uidOf = async (email) => (await users()).find((u) => u.email === email)?.localId;
    const mine = await uidOf('hebaghoneim8@gmail.com'), theirs = await uidOf('seifeldingamal2021@gmail.com');
    assert.ok(mine && theirs, 'both accounts exist');
    assert.ok((await listAll(`modelRouter/${mine}/chats`)).length > 0, 'my chat synced before deleting');

    await me.page.click('.menu-btn');
    await me.page.click('.sidebar-foot, .cv-account');
    await me.page.locator(':is(.settings-tabs, .si)').getByRole('button', { name: 'Privacy & data', exact: true }).click();
    await me.page.getByRole('button', { name: 'Delete account' }).click();
    const dialog = me.page.getByRole('dialog', { name: 'Delete your account?' });
    await dialog.waitFor();
    const go = dialog.getByRole('button', { name: 'Delete everything' });
    assert.ok(await go.isDisabled(), 'needs the typed confirmation');
    await dialog.getByLabel('Type DELETE to confirm').fill('delete');
    await go.click();
    await me.page.waitForSelector('text=Continue with Google', { timeout: 20000 });

    assert.equal((await listAll(`modelRouter/${mine}/chats`)).length, 0, 'my chats are gone');
    assert.equal((await listAll(`modelRouter/${mine}/usage`)).length, 0, 'my usage is gone');
    const root = await fetch(`${FS}/modelRouter/${mine}`, { headers: { authorization: 'Bearer owner' } });
    assert.equal(root.status, 404, 'my keys and settings are gone');
    assert.ok(!(await users()).some((u) => u.localId === mine), 'my sign-in record is gone');
    assert.ok((await listAll(`modelRouter/${theirs}/chats`)).length > 0, "the other account's chats are untouched");
    assert.deepEqual(me.errors, []);
    console.log('PASS deleting an account removes its cloud data and sign-in, and nobody else’s');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
