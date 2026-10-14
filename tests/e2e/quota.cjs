// Free-plan guard: incremental sync keeps reads low; slow + paused modes; catch-up after reset.
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
const EMU = 'http://127.0.0.1:8080/v1/projects/the-model-router/databases/(default)/documents';
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
async function setShared(reads) {
  await fetch(`${EMU}/modelRouterShared/quota-${day}`, { method: 'PATCH', headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body: JSON.stringify({ fields: { reads: { integerValue: String(reads) }, writes: { integerValue: '0' }, deletes: { integerValue: '0' }, day: { stringValue: day } } }) });
}
async function mock(ctx) {
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] } });
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Chat ' + Math.random().toString(36).slice(2, 6) }] } }] } });
    const body = JSON.parse(route.request().postData());
    const last = body.contents.at(-1).parts.map((p) => p.text || '').join('');
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: `Re: ${last}` }] }, finishReason: 'STOP' }] }) });
  });
}
async function device(browser, ctx) {
  ctx = ctx || (await browser.newContext({ viewport: { width: 1200, height: 800 } }));
  await mock(ctx);
  // A 4-second sync margin instead of a minute, so the "only what changed" check needn't wait a minute.
  await ctx.addInitScript(() => { window.__mrSyncMarginMs = 4000; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('.topbar:visible, .settings-page');
  return { ctx, page, errors };
}
const reads = (page) => page.evaluate(() => window.__quota.local().reads);
async function send(page, text) {
  const n = (await page.$$('.msg.assistant')).length;
  await page.fill('.composer textarea', text);
  await page.click('.send-btn');
  await page.waitForSelector(`.msg.assistant >> nth=${n} >> .model-tag`, { timeout: 20000 });
}

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const A = await device(browser);
  await A.page.waitForSelector('input[placeholder="AIza…"]');
  await A.page.fill('input[placeholder="AIza…"]', 'g');
  await A.page.click('text=Save keys');
  await A.page.waitForTimeout(1500);
  await A.page.click('.settings-page [aria-label="Close"]');
  // 6 chats x 4 messages.
  for (let c = 0; c < 6; c++) {
    if (c) await A.page.evaluate(()=>document.querySelector('.sidebar .new-chat').click());
    await send(A.page, `chat${c} one`);
    await send(A.page, `chat${c} two`);
  }
  await A.page.waitForTimeout(1500);

  // Fresh laptop: full first sync.
  const B = await device(browser);
  await B.page.waitForFunction(() => document.querySelectorAll('.chat-row').length >= 6, null, { timeout: 15000 });
  await B.page.waitForTimeout(2000);
  const first = await reads(B.page);
  console.log(`      first open reads: ${first}`);
  check(first >= 30, 'first open downloads everything (6 chats + 24 messages)');

  // One more change on A (B gets it live), then re-open B a bit later: only what changed.
  await B.page.waitForTimeout(6000);
  await send(A.page, 'one more');
  await B.page.waitForTimeout(3000);
  await B.page.reload();
  await B.page.waitForSelector('.topbar');
  await B.page.waitForFunction(() => document.querySelectorAll('.chat-row').length >= 6, null, { timeout: 15000 });
  await B.page.waitForTimeout(2500);
  const second = await reads(B.page);
  console.log(`      second open reads: ${second}`);
  check(second <= 8 && second < first / 2, `re-opening reads only a few documents (${second} vs ${first})`);

  // A adds to chat 0 → B gets just that.
  const before = await reads(B.page);
  await A.page.click('.chat-row .chat-open >> text=/./ >> nth=5').catch(() => {});
  await A.page.locator('.chat-row').last().locator('.chat-open').click();
  await send(A.page, 'live update');
  await B.page.waitForTimeout(2500);
  const delta = (await reads(B.page)) - before;
  console.log(`      live change reads: ${delta}`);
  check(delta <= 10, `a new message costs a few reads, not the whole chat (${delta})`);
  await B.page.locator('.chat-row', { hasText: await A.page.locator('.chat-row.active .chat-title').textContent() }).locator('.chat-open').click();
  const texts = await B.page.$$eval('.msg', (els) => els.map((e) => e.textContent));
  check(texts.length === 6 && texts[4].includes('live update') && texts[5].includes('Re: live update') && texts[0].includes('one'), 'other device shows the update in the right order');

  // Edit + regenerate style change: delete a chat on A → gone on B.
  const victim = await A.page.locator('.chat-row').first().locator('.chat-title').textContent();
  await A.page.locator('.chat-row').first().locator('[aria-label="Chat options"]').click();
  await A.page.click('.menu >> text=Delete');
  await B.page.waitForFunction((t) => ![...document.querySelectorAll('.chat-title')].some((e) => e.textContent === t), victim, { timeout: 10000 });
  check(true, 'delete still syncs');

  // Slow mode (≥60%): changes are batched.
  await setShared(31_000);
  await A.page.evaluate(() => window.__quota.start());
  await B.page.evaluate(() => window.__quota.start());
  check((await A.page.evaluate(() => window.__quota.level())) === 'slow', 'slow mode at 62% of reads');
  await send(A.page, 'batched message');
  await B.page.waitForTimeout(4000);
  check(!(await B.page.textContent('.thread')).includes('batched message'), 'slow mode: not sent straight away');
  await B.page.waitForFunction(() => document.querySelector('.thread')?.textContent.includes('batched message'), null, { timeout: 80000 });
  check(true, 'slow mode: arrives within about a minute');

  // Paused (≥90%).
  await setShared(46_000);
  await A.page.evaluate(() => window.__quota.start());
  await B.page.evaluate(() => window.__quota.start());
  await A.page.waitForSelector('.banner.info', { timeout: 5000 });
  check((await A.page.textContent('.banner.info')).includes('Sync is paused'), 'paused banner shown');
  await send(A.page, 'offline-ish message');
  check((await A.page.textContent('.thread')).includes('Re: offline-ish message'), 'chat still works while paused');
  await A.page.evaluate(()=>document.querySelector('.sidebar .new-chat').click());
  await send(A.page, 'brand new chat while paused');
  await B.page.waitForTimeout(3000);
  check(!(await B.page.textContent('.chat-list')).includes('brand new') && !(await B.page.textContent('.thread')).includes('offline-ish'), 'nothing synced while paused');
  // Usage tab card.
  await A.page.click('.sidebar-foot');
  await openTab(A.page, 'Usage');
  const card = await A.page.textContent('.firebase-card');
  check(/Reads46,\d{3} \/ 50,000/.test(card.replace(/\s+/g, '')) || /46,\d{3}/.test(card), `usage card shows counts (${card.slice(0, 90)})`);
  check(card.includes('Sync paused'), 'usage card explains the pause');
  await A.page.screenshot({ path: path.join(__dirname, 'out', 'firebase-card.png') });
  await A.page.click('.settings-page [aria-label="Close"]');

  // Reset → catches up.
  await setShared(0);
  await A.page.evaluate(() => window.__quota.start());
  await B.page.evaluate(() => window.__quota.start());
  await B.page.waitForFunction(() => document.querySelector('.chat-list')?.textContent.includes('Re: brand') || [...document.querySelectorAll('.chat-row')].length >= 6, null, { timeout: 20000 });
  await B.page.waitForTimeout(2000);
  const titles = await B.page.$$eval('.chat-row', (els) => els.length);
  check(titles === 6, `chat made while paused synced after reset (${titles} chats)`);
  check(!(await A.page.$('.banner.info')), 'banner gone after reset');

  check(![...A.errors, ...B.errors].length, `no page errors ${[...A.errors, ...B.errors].join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
