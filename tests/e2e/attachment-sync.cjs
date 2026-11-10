// Small attachment originals sync: another device can reuse an image. A surviving fork
// keeps its shared cloud original even after the original uploading chat is deleted.
const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const base = 'http://127.0.0.1:8080/v1/projects/the-model-router/databases/(default)/documents';
const app = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const reply = (text) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n';
// A tiny valid PNG (a 2x2 lime square).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function device(browser, log) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  await ctx.addInitScript(() => { globalThis.__mrSyncMarginMs = 2000; });
  await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
    if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', supportedGenerationMethods: ['generateContent'] }] } });
    if (r.request().url().includes(':generateContent')) return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Image chat' }] } }] } });
    log.push(r.request().postData() || '');
    return r.fulfill({ contentType: 'text/event-stream', body: reply('Seen it.') });
  });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(app);
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  return { ctx, page };
}

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  try {
    const logA = [], logB = [];
    const A = await device(browser, logA);
    await A.page.waitForSelector('input[placeholder="AIza…"]');
    await A.page.fill('input[placeholder="AIza…"]', 'fixture');
    await A.page.getByRole('button', { name: /^Save keys?$/ }).click();
    await A.page.waitForTimeout(800);
    await A.page.locator('.settings-page [aria-label="Close"], .rc-page:not([hidden]) .rc-head .feature-exit, .rc-page:not([hidden]) .phone-navigation > button').click();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'att-'));
    fs.writeFileSync(path.join(dir, 'wound.png'), PNG);
    await A.page.locator('.composer input[type=file]').last().setInputFiles(path.join(dir, 'wound.png'));
    await A.page.locator('.composer').getByText('wound.png').waitFor();
    await A.page.fill('.composer textarea', 'Describe this photo.');
    await A.page.click('.send-btn');
    await A.page.locator('.msg.assistant').filter({ hasText: 'Seen it.' }).waitFor();
    const uid = await A.page.evaluate(() => JSON.parse(localStorage.getItem('mr.preview_user') || 'null')?.uid || Object.keys(localStorage).find((k) => k.startsWith('mr.sync.revs.'))?.slice(13));

    // The original is saved once under the account.
    let files;
    for (let i = 0; i < 30 && !files?.documents?.length; i++) { await A.page.waitForTimeout(500); files = await (await fetch(`${base}/modelRouter/${uid}/files`, { headers: { Authorization: 'Bearer owner' } })).json(); }
    assert.equal(files.documents?.length, 1, 'one stored original');

    // Device B continues the chat; the model still gets the image.
    const B = await device(browser, logB);
    await B.page.locator('.chat-row').filter({ hasText: /Image chat|Describe this photo/ }).first().click();
    await B.page.fill('.composer textarea', 'And what colour is it?');
    await B.page.click('.send-btn');
    await B.page.locator('.msg.assistant').nth(1).waitFor();
    const sent = logB.at(-1);
    // The image exactly as device A sent it (the app resizes photos before sending).
    const image = /"data":"([A-Za-z0-9+/=]{40,})"/.exec(logA[0])?.[1];
    assert.ok(image, 'device A sent the image');
    assert.ok(sent.includes(image), 'device B sent the image it never had locally');
    assert.doesNotMatch(sent, /Attached on another device/);

    // A native revision can reuse the same original while the upload owner's
    // chatId stays unchanged. Write a separate surviving fork through the real
    // Firestore emulator, then delete only the uploading chat on the web.
    const sharedOriginal = files.documents[0];
    const originalID = sharedOriginal.name.split('/').at(-1);
    const uploadOwner = sharedOriginal.fields.chatId.stringValue;
    const forkID = 'surviving-image-fork';
    const auth = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
    const forkURL = `${base}/modelRouter/${uid}/chats/${forkID}`;
    const str = (value) => ({ stringValue: value });
    const number = (value) => ({ integerValue: String(value) });
    const now = Date.now();
    const forkChat = await fetch(forkURL, {
      method: 'PATCH', headers: auth, body: JSON.stringify({ fields: {
        title: str('Surviving image fork'), createdAt: number(now),
        updatedAt: number(now), rev: number(now), deleted: { booleanValue: false },
        nativeRoot: str(uploadOwner), nativeParent: str(uploadOwner),
        ids: { arrayValue: { values: [str('fork-image')] } }, count: number(1),
      } }),
    });
    assert.ok(forkChat.ok, 'surviving fork metadata was saved');
    const forkMessage = await fetch(forkURL + '/messages/fork-image', {
      method: 'PATCH', headers: auth, body: JSON.stringify({ fields: {
        id: str('fork-image'), role: str('user'), text: str('Keep this image after parent deletion'),
        index: number(0), createdAt: number(now), status: str('done'),
        files: { arrayValue: { values: [{ mapValue: { fields: {
          id: str(originalID), name: str('wound.png'), mime: str('image/png'),
          kind: str('image'), stored: { booleanValue: true },
        } } }] } },
      } }),
    });
    assert.ok(forkMessage.ok, 'surviving fork keeps the shared attachment reference');

    await A.page.getByRole('button', { name: 'Chat options', exact: true }).first().click();
    await A.page.getByRole('menuitem', { name: /Delete/ }).click();
    let tombstone;
    for (let i = 0; i < 30; i++) {
      const response = await fetch(`${base}/modelRouter/${uid}/chats/${uploadOwner}`, { headers: auth });
      tombstone = response.ok ? (await response.json()).fields : null;
      if (tombstone?.deleted?.booleanValue === true) break;
      await A.page.waitForTimeout(500);
    }
    assert.equal(tombstone?.deleted?.booleanValue, true, 'uploading parent chat is tombstoned');
    const survivor = await (await fetch(forkURL + '/messages/fork-image', { headers: auth })).json();
    assert.equal(survivor.fields.files.arrayValue.values[0].mapValue.fields.id.stringValue, originalID,
      'surviving fork still references the original');
    const originalResponse = await fetch(`${base}/modelRouter/${uid}/files/${originalID}`, { headers: auth });
    assert.ok(originalResponse.ok, 'deleting the parent did not remove the shared cloud original');
    const originalAfter = await originalResponse.json();
    assert.equal(originalAfter.fields.data.stringValue, sharedOriginal.fields.data.stringValue,
      'surviving fork can still load the original bytes');
    console.log('PASS images sync across devices and a surviving fork retains its original after parent deletion');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
