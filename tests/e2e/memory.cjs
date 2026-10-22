const { chromium } = require('playwright');
// Settings is a page: on phones the section list shows first, and a section has a back arrow.
async function openTab(page, name) {
  if (await page.isVisible('.settings-back')) await page.click('.settings-back');
  await page.click(`.settings-tabs >> text=${name}`);
}
const path = require('path');
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;
const chunk = (t) => sse({ candidates: [{ content: { parts: [{ text: t }] } }] });

async function mock(ctx, log) {
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Memory Test' }] } }] } });
    const body = JSON.parse(route.request().postData());
    log.push(body);
    const last = body.contents.at(-1).parts.map((p) => p.text || '').join('');
    let parts = ['Sure.'];
    if (/I work as/.test(last)) parts = ['Noted — I', "'ll keep that in mind.\n\n[[reme", 'mber: Works as a clinical pharmacist in Cairo]]'];
    if (/forget/.test(last)) parts = ['Done, forgotten.\n[[forget: Works as a clinical pharmacist in Cairo]]'];
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: parts.map(chunk).join('') + sse({ candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }) });
  });
}
async function device(browser, log) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mock(ctx, log);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  return { page, errors };
}
async function send(page, text, n) {
  await page.fill('.composer textarea', text);
  await page.click('.send-btn');
  await page.waitForSelector(`.msg.assistant >> nth=${n} >> .model-tag`, { timeout: 20000 });
}
const sys = (log) => log.at(-1).systemInstruction.parts[0].text;
async function openMemory(page) {
  await page.click('.menu-btn');
  await page.click('.sidebar-foot, .cv-account');
  await openTab(page, 'Memory');
  await page.waitForSelector('.memory-tab');
}

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const log = [];
  const { page, errors } = await device(browser, log);
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.click('button:has-text("Save keys")');
  await page.waitForTimeout(1500);
  await page.click('.settings-page [aria-label="Close"]');

  await send(page, 'hello', 0);
  check(sys(log).includes('# Memory') && sys(log).includes('no saved memories'), 'memory instructions sent (empty)');

  await send(page, 'I work as a clinical pharmacist in Cairo', 1);
  const reply = await page.textContent('.msg.assistant >> nth=1');
  check(reply.includes("Noted — I'll keep that in mind.") && !reply.includes('[[') && !reply.includes('remember:'), 'marker hidden from the reply');
  check(Boolean(await page.$('.msg.assistant >> nth=1 >> .memory-tag')), '"Memory updated" shown');
  await page.click('.msg.assistant >> nth=1 >> .memory-tag');
  check((await page.textContent('.memory-changes')).includes('Saved: Works as a clinical pharmacist in Cairo'), 'chip lists what was saved');
  await page.screenshot({ path: path.join(__dirname, 'out', 'memory-chip.png') });

  // New chat uses it.
  await page.evaluate(()=>document.querySelector('.sidebar .new-chat').click());
  await send(page, 'what is my job?', 0);
  check(sys(log).includes('- Works as a clinical pharmacist in Cairo'), 'new chat gets the memory');
  check(!JSON.stringify(log.at(-1).contents).includes('[['), 'no markers in what models see');

  // /remember — no model call.
  const calls = log.length;
  await page.fill('.composer textarea', '/remember Prefers short answers with bullet points');
  await page.click('.send-btn');
  await page.waitForTimeout(800);
  check(log.length === calls && (await page.$$('.msg')).length === 2, '/remember saves without sending a message');

  // Second device sees both.
  const B = await device(browser, []);
  await B.page.waitForTimeout(2500);
  await openMemory(B.page);
  const listB = await B.page.textContent('.memory-list');
  check(listB.includes('Works as a clinical pharmacist in Cairo') && listB.includes('Prefers short answers'), 'memories synced to other device');
  check((await B.page.textContent('.memory-tab')).includes('Remembered facts (2/200)'), 'count shown');
  // Edit on device B.
  await B.page.locator('.memory-row', { hasText: 'Prefers short answers' }).locator('[aria-label="Edit"]').click();
  await B.page.fill('.memory-row.editing textarea', 'Prefers short answers in Arabic');
  await B.page.click('.memory-row.editing [aria-label="Save"]');
  await B.page.screenshot({ path: path.join(__dirname, 'out', 'memory-tab.png') });
  await page.waitForTimeout(1500);
  await send(page, 'next', 1);
  check(sys(log).includes('- Prefers short answers in Arabic'), 'edit from other device used');

  // Forget via chat.
  await send(page, 'please forget where I work', 2);
  check((await page.textContent('.msg.assistant >> nth=2')).includes('Done, forgotten.') && !(await page.textContent('.msg.assistant >> nth=2')).includes('[['), 'forget reply clean');
  await page.click('.msg.assistant >> nth=2 >> .memory-tag');
  check((await page.textContent('.msg.assistant >> nth=2 >> .memory-changes')).includes('Removed: Works as a clinical pharmacist'), 'chip shows removal');
  await B.page.waitForTimeout(1500);
  check(!(await B.page.textContent('.memory-list')).includes('pharmacist'), 'removal synced');

  // Turn memory off.
  await openMemory(page);
  await page.locator('.setting-row', { hasText: 'Use memory' }).locator('input').click();
  await page.click('.settings-page [aria-label="Close"]');
  await send(page, 'and now?', 3);
  check(!sys(log).includes('# Memory'), 'memory off: nothing sent');
  await openMemory(page);
  await page.locator('.setting-row', { hasText: 'Use memory' }).locator('input').click();
  // Delete all.
  await page.getByRole('button',{name:'Clear all',exact:true}).click();
  await page.waitForTimeout(800);
  check((await page.textContent('.memory-tab')).includes('Remembered facts (0/200)') && (await page.textContent('.memory-tab')).includes('No memories saved yet'), 'delete all');
  await page.click('.settings-page [aria-label="Close"]');

  // Reload: replies stay clean.
  await page.reload();
  await page.waitForSelector('.app:not(.app-skeleton) .topbar');
  await page.click('.menu-btn');
  await page.click('.chat-row .chat-open >> nth=1');
  await page.waitForSelector('.msg.assistant');
  check(!(await page.textContent('.thread')).includes('[['), 'stored replies have no markers after reload');

  check(![...errors, ...B.errors].length, `no page errors ${[...errors, ...B.errors].join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
