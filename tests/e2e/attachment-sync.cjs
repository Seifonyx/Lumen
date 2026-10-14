// Small attachment originals sync: device A attaches an image, device B continues the chat and the model
// still receives the image; deleting the chat removes the stored copy.
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
    await A.page.getByRole('button', { name: 'Save keys', exact: true }).click();
    await A.page.waitForTimeout(800);
    await A.page.locator('.settings-page [aria-label="Close"]').click();
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

    // Deleting the chat removes the stored original.
    await A.page.getByRole('button', { name: 'Chat options', exact: true }).first().click();
    await A.page.getByRole('menuitem', { name: /Delete/ }).click();
    for (let i = 0; i < 30 && files.documents?.length; i++) { await A.page.waitForTimeout(500); files = await (await fetch(`${base}/modelRouter/${uid}/files`, { headers: { Authorization: 'Bearer owner' } })).json(); }
    assert.ok(!files.documents?.length, 'stored original removed with the chat');
    console.log('PASS small attachment originals sync between devices and are removed with the chat');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
