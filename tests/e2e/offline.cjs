// Offline mode (the app opens and shows chats with no connection) and the "new version" prompt.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
const SW = path.join(__dirname, '..', '..', 'dist', 'sw.js');
const original = fs.readFileSync(SW, 'utf8');

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Offline Test' }] } }] } });
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: 'Hello from before' }] }, finishReason: 'STOP' }] }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto('http://localhost:5190/?emulator');
    await page.waitForFunction(() => typeof window.__testSignIn === 'function');
    await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
    await page.waitForSelector('input[placeholder="AIza…"]');
    await page.fill('input[placeholder="AIza…"]', 'g');
    await page.click('button:has-text("Save keys")');
    await page.waitForTimeout(1500);
    await page.click('.settings-page [aria-label="Close"]');
    await page.fill('.composer textarea', 'hi');
    await page.click('.send-btn');
    await page.waitForSelector('.msg.assistant .model-tag', { timeout: 20000 });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30000 });
    const cached = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('model-router-')).length);
    check(cached === 1, 'app saved on the device');
    await page.waitForTimeout(1500);

    // ---- Offline
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('.topbar', { timeout: 20000 });
    check(true, 'app opens with no connection');
    await page.waitForSelector('.banner.offline', { timeout: 5000 });
    check((await page.textContent('.banner.offline')).includes("You're offline"), 'offline banner');
    await page.waitForTimeout(2500);
    check(!(await page.$('.settings-page')), 'keys and settings loaded from the device (no API-key prompt)');
    check((await page.textContent('.model-button')).includes('Auto'), 'model list available offline');
    await page.click('.menu-btn');
    await page.click('.chat-row .chat-open');
    await page.waitForSelector('.msg.assistant');
    check((await page.textContent('.thread')).includes('Hello from before'), 'old chats readable offline');
    await page.fill('.composer textarea', 'can I send?');
    await page.click('.send-btn');
    await page.waitForTimeout(500);
    check((await page.inputValue('.composer textarea')) === 'can I send?' && (await page.textContent('.toasts, body')).includes("You're offline"), 'sending offline keeps the message and explains');
    await page.screenshot({ path: path.join(__dirname, 'out', 'offline.png') });

    await ctx.setOffline(false);
    await page.waitForFunction(() => !document.querySelector('.banner.offline'), null, { timeout: 5000 });
    check(true, 'banner goes away when back online');

    // ---- New version
    fs.writeFileSync(SW, original + '\n// next version\n');
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await page.waitForSelector('.update-bar', { timeout: 30000 });
    check((await page.textContent('.update-bar')).includes('new version'), 'update prompt appears');
    await page.screenshot({ path: path.join(__dirname, 'out', 'update-bar.png') });
    await Promise.all([page.waitForEvent('load', { timeout: 20000 }), page.click('.update-bar >> text=Reload')]);
    await page.waitForSelector('.topbar', { timeout: 20000 });
    const active = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting === null);
    check(active && !(await page.$('.update-bar')), 'reload switches to the new version');
    check(!errors.length, `no page errors ${errors.join(' | ')}`);
  } finally {
    fs.writeFileSync(SW, original);
  }
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  fs.writeFileSync(SW, original);
  console.error(e);
  process.exit(2);
});
