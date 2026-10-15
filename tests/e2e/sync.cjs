// Two "devices" signed in as the same user (Firebase emulators), checking chats and settings sync.
const { chromium } = require('playwright');
const {openSettings,replyAction}=require('./helpers/ui.cjs');
// Settings is a page: on phones the section list shows first, and a section has a back arrow.
async function openTab(page, name) {
  if (await page.isVisible('.settings-back')) await page.click('.settings-back');
  await page.click(`.settings-tabs >> text=${name}`);
}
const path = require('path');
const OUT = path.join(__dirname, 'out');
require('fs').mkdirSync(OUT, { recursive: true });
const URL_ = 'http://localhost:5190/?emulator';
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };

const enc = (o) => `data: ${JSON.stringify(o)}\n\n`;
async function mockProviders(ctx, log) {
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) {
      return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', supportedGenerationMethods: ['generateContent'] }] } });
    }
    const body = JSON.parse(route.request().postData() || '{}');
    log.push(body);
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Synced Chat Title' }] } }] } });
    const last = body.contents.at(-1).parts.map((p) => p.text || (p.inline_data ? '[img]' : '')).join(' ');
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: enc({ candidates: [{ content: { parts: [{ text: `Reply to: ${last.slice(0, 120)}` }] }, finishReason: 'STOP' }] }) });
  });
  await ctx.route('**/openrouter.ai/**', (route) => route.fulfill({ json: { data: [] } }));
}

async function device(browser, name, email, mobile) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 820 } });
  const log = [];
  await mockProviders(ctx, log);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(URL_);
  await page.waitForSelector('.google-btn');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate((e) => window.__testSignIn(e), email);
  await page.waitForSelector('.app:not(.app-skeleton) .topbar:visible, .settings-page');
  return { ctx, page, errors, log, name };
}

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();

  // ---- Phone: first sign-in, enter keys
  const A = await device(browser, 'phone', 'hebaghoneim8@gmail.com', true);
  await A.page.waitForSelector('input[placeholder="AIza…"]');
  check((await A.page.textContent('.settings-heading h2')) === 'API keys', 'first sign-in opens API keys');
  await A.page.screenshot({ path: path.join(OUT, 'a1-keys.png') });
  await A.page.fill('input[placeholder="AIza…"]', 'test-gemini-key');
  await A.page.click('button:has-text("Save keys")');
  await A.page.waitForTimeout(1500);
  check(true, 'keys saved and models loaded');
  await openTab(A.page, 'Personalization');
  await A.page.fill('.field-block textarea', 'Use metric units.');
  await A.page.click('.settings-page [aria-label="Close"]');

  // ---- Phone: chat with an image, rename + pin
  await A.page.setInputFiles('.composer input[type=file][multiple]', path.join(__dirname, 'fixtures', 'photo.png'));
  await A.page.waitForFunction(() => document.querySelectorAll('.attachment').length === 1 && !document.querySelector('.attachment.loading'));
  await A.page.fill('.composer textarea', 'Hello from phone');
  await A.page.click('.send-btn');
  await A.page.waitForSelector('.msg.assistant .model-tag', { timeout: 15000 });
  check(A.log.filter((b) => b.systemInstruction).at(-1).systemInstruction.parts[0].text.includes('Use metric units.'), 'custom instructions used');
  await A.page.waitForTimeout(800);
  await A.page.click('.menu-btn');
  check((await A.page.textContent('.chat-list')).includes('Synced Chat Title'), 'chat titled on phone');
  await A.page.click('.chat-row [aria-label="Chat options"]');
  await A.page.click('.menu >> text=Pin');
  await A.page.click('.close-sidebar');
  await A.page.waitForTimeout(1500);

  // ---- Laptop: same account
  const B = await device(browser, 'laptop', 'hebaghoneim8@gmail.com', false);
  await B.page.waitForSelector('.model-button', { timeout: 15000 }); await B.page.waitForTimeout(1500);
  check(!(await B.page.$('.settings-page')), 'keys loaded automatically on laptop (no prompt)');
  await B.page.waitForFunction(() => document.querySelector('.chat-list')?.textContent.includes('Synced Chat Title'), null, { timeout: 15000 });
  check((await B.page.textContent('.chat-list section:first-child .group-label')) === 'Pinned', 'pin synced');
  await B.page.click('text=Synced Chat Title');
  await B.page.waitForSelector('.msg.assistant');
  check((await B.page.textContent('.msg.user .bubble')) === 'Hello from phone', 'messages synced');
  check(await B.page.$('.msg.user .msg-thumb'), 'image thumbnail synced');
  await B.page.click('.sidebar-foot');
  await openTab(B.page, 'Personalization');
  check((await B.page.inputValue('.field-block textarea')) === 'Use metric units.', 'custom instructions synced');
  await B.page.click('.settings-page [aria-label="Close"]');

  // ---- Laptop replies in the same chat; phone sees it live
  await B.page.fill('.composer textarea', 'Follow-up from laptop');
  await B.page.click('.send-btn');
  await B.page.waitForSelector('.msg.assistant >> nth=1 >> .model-tag', { timeout: 15000 });
  const sent = JSON.stringify(B.log.filter((b) => b.systemInstruction).at(-1).contents);
  // Small originals sync, so the laptop can still send the phone's photo.
  check(!sent.includes('Attached on another device') && sent.includes('inline_data'), 'small photo from the other device is sent with the chat');
  await A.page.click('.menu-btn');
  await A.page.click('.chat-row .chat-open');
  await A.page.waitForFunction(() => [...document.querySelectorAll('.msg.user .bubble')].some((b) => b.textContent === 'Follow-up from laptop'), null, { timeout: 15000 });
  check(true, 'phone received laptop message live');
  check(await A.page.$('.msg.user .msg-thumb'), 'phone kept its own image');

  // ---- Rename on laptop -> phone
  await B.page.locator('.chat-row', { hasText: 'Synced Chat Title' }).locator('[aria-label="Chat options"]').click();
  await B.page.click('.menu >> text=Rename');
  await B.page.fill('.chat-row.editing input', 'Renamed on laptop');
  await B.page.keyboard.press('Enter');
  await A.page.click('.menu-btn').catch(() => {});
  await A.page.waitForFunction(() => document.querySelector('.chat-list')?.textContent.includes('Renamed on laptop'), null, { timeout: 15000 });
  check(true, 'rename synced');

  // ---- Delete on phone -> gone on laptop
  await A.page.locator('.chat-row', { hasText: 'Renamed on laptop' }).locator('[aria-label="Chat options"]').click();
  await A.page.click('.menu >> text=Delete');
  await B.page.waitForFunction(() => !document.querySelector('.chat-list')?.textContent.includes('Renamed on laptop'), null, { timeout: 15000 });
  check(true, 'delete synced');

  // ---- Reload laptop: still consistent
  await B.page.reload();
  await B.page.waitForSelector('.app:not(.app-skeleton) .topbar');
  await B.page.waitForTimeout(1500);
  check(!(await B.page.textContent('.chat-list')).includes('Renamed on laptop'), 'deleted chat stays deleted after reload');

  // Saved helpers and their immutable chat instructions cross devices.
  await B.page.getByRole('button', { name: 'Library', exact: true }).click();
  await B.page.getByRole('button', { name: 'New assistant', exact: true }).click();
  await B.page.getByLabel('Library item name').fill('Synced helper');
  await B.page.getByLabel('Library instructions').fill('Use HELPER_SYNC_MARKER in your reply.');
  await B.page.getByRole('button', { name: 'Save', exact: true }).click();
  // Observe the cloud write before reloading the other device (settings writes are debounced).
  const accountUid = await B.page.evaluate(() => Object.keys(localStorage).find(key => key.startsWith('mr.account.'))?.slice('mr.account.'.length));
  const settingsDeadline = Date.now() + 15000;
  let helperSaved = false;
  while (Date.now() < settingsDeadline) {
    const response = await fetch(`http://127.0.0.1:8080/v1/projects/the-model-router/databases/(default)/documents/modelRouter/${accountUid}`, { headers: { Authorization: 'Bearer owner' } });
    const account = await response.json();
    const helpers = account.fields?.settings?.mapValue?.fields?.assistants?.arrayValue?.values || [];
    helperSaved = helpers.some(item => item.mapValue?.fields?.name?.stringValue === 'Synced helper');
    if (helperSaved) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!helperSaved) throw new Error('The saved helper did not reach Firestore within 15 seconds.');
  await B.page.locator('.library-card').filter({ has: B.page.getByRole('heading', { name: 'Synced helper', exact: true }) }).getByRole('button', { name: 'Start chat', exact: true }).click();
  await B.page.fill('.composer textarea', 'Test helper sync');
  await B.page.click('.send-btn');
  await B.page.waitForSelector('.msg.assistant .model-tag');
  await B.page.waitForTimeout(1800);
  await A.page.reload();
  await A.page.waitForSelector('.app:not(.app-skeleton) .topbar');
  await A.page.click('.menu-btn');
  await A.page.getByRole('button', { name: 'Library', exact: true }).click();
  await A.page.getByRole('heading', { name: 'Synced helper', exact: true }).waitFor();
  check(true, 'saved assistant library synced to phone');
  await A.page.getByRole('button', { name: 'Close', exact: true }).click();
  await A.page.click('.menu-btn');
  await A.page.getByRole('button', { name: 'Synced Chat Title', exact: true }).click();
  await A.page.waitForSelector('.assistant-badge');
  await A.page.fill('.composer textarea', 'Continue synced helper');
  await A.page.click('.send-btn');
  await A.page.waitForSelector('.msg.assistant >> nth=1 >> .model-tag');
  check(JSON.stringify(A.log.at(-1)).includes('HELPER_SYNC_MARKER'), 'chat helper instructions synced and used on phone');

  // Canvas text and edits sync even when a chat has no messages.
  await replyAction(B.page,'Edit in canvas','first');
  await B.page.fill('.canvas-text', 'CANVAS_FROM_LAPTOP');
  await B.page.waitForTimeout(2000);
  await A.page.getByRole('button', { name: 'Open canvas', exact: true }).click();
  await A.page.waitForFunction(() => document.querySelector('.canvas-text')?.value === 'CANVAS_FROM_LAPTOP');
  check(true, 'canvas document synced to phone');
  await A.page.fill('.canvas-text', 'CANVAS_FROM_PHONE');
  await B.page.waitForFunction(() => document.querySelector('.canvas-text')?.value === 'CANVAS_FROM_PHONE');
  check(true, 'canvas edits synced live back to laptop');
  await A.page.getByRole('button', { name: 'Close canvas', exact: true }).click();
  await B.page.getByRole('button', { name: 'Close canvas', exact: true }).click();
  await B.page.evaluate(()=>document.querySelector('.sidebar .new-chat').click());
  await B.page.keyboard.press('Control+k');
  await B.page.getByLabel('Search commands').fill('Open document canvas');
  await B.page.keyboard.press('Enter');
  await B.page.fill('.canvas-text', 'CANVAS_WITHOUT_MESSAGES');
  await B.page.getByLabel('Canvas filename').fill('Standalone.md');
  await B.page.waitForTimeout(2200);
  await A.page.reload();
  await A.page.waitForSelector('.app:not(.app-skeleton) .topbar');
  await A.page.click('.menu-btn');
  await A.page.getByRole('button', { name: 'Document.md', exact: true }).click();
  await A.page.getByRole('button', { name: 'Open canvas', exact: true }).click();
  await A.page.waitForFunction(() => document.querySelector('.canvas-text')?.value === 'CANVAS_WITHOUT_MESSAGES');
  check(true, 'standalone canvas chat without messages synced');
  await B.page.screenshot({ path: path.join(OUT, 'b-final.png') });
  const errs = [...A.errors, ...B.errors];
  console.log('errors:', errs);
  check(errs.length === 0, 'no page errors');
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
