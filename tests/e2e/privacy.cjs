// Privacy shield (off by default; ask / auto; masked history and titles; restored replies) and key safety.
const { chromium } = require('playwright');
// Settings is a page: on phones the section list shows first, and a section has a back arrow.
async function openTab(page, name) {
  if (await page.isVisible('.settings-back')) await page.click('.settings-back');
  await page.click(`.settings-tabs >> text=${name}`);
}
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 860 } });
  const log = { chats: [], titles: [] };
  let keyLocked = false;
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes('/models?')) {
      if (keyLocked && !req.headers()['referer']) return route.fulfill({ status: 403, json: { error: { code: 403, message: 'Requests from referer <empty> are blocked.', status: 'PERMISSION_DENIED' } } });
      return route.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] } });
    }
    const body = JSON.parse(req.postData());
    if (url.includes(':generateContent')) {
      log.titles.push(JSON.stringify(body));
      return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Follow-up for [NAME_1]' }] } }] } });
    }
    log.chats.push(body);
    const last = body.contents.at(-1).parts.map((p) => p.text || '').join('');
    const reply = /\[PHONE_1\]/.test(last) ? "I'll call [PHONE_1] about [NAME_1] today." : 'Noted.';
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: reply }] }, finishReason: 'STOP' }] }) });
  });
  await ctx.route('**/openrouter.ai/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/key')) return route.fulfill({ json: { data: { is_free_tier: false, limit: 0, usage: 0 } } });
    return route.fulfill({ json: { data: [] } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.fill('input[placeholder="sk-or-…"]', 'o');
  await page.click('text=Save keys');

  // ---- Key safety
  await page.waitForSelector('.key-safety .status:not(.wait), .key-safety .status.blocked', { timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('.key-safety .spin'));
  let ks = await page.textContent('.key-safety');
  check(/Works on any website/.test(ks) && /Lock it/.test(ks), 'unlocked Gemini key is flagged with steps');
  check(/Free models only \(\$0 limit\)/.test(ks), 'OpenRouter $0 cap recognised');
  keyLocked = true;
  await page.click('.key-safety >> text=Check again');
  await page.waitForFunction(() => document.querySelector('.key-safety')?.textContent.includes('Locked to this app'), null, { timeout: 10000 });
  check(true, 'locked Gemini key recognised');
  await page.screenshot({ path: require('path').join(__dirname, 'out', 'key-safety.png') });
  await page.click('.settings-page [aria-label="Close"]');

  const send = async (text) => {
    const n = (await page.$$('.msg.assistant')).length;
    await page.fill('.composer textarea', text);
    await page.click('.send-btn');
    return n;
  };
  const waitReply = (n) => page.waitForSelector(`.msg.assistant >> nth=${n} >> .model-tag`, { timeout: 20000 });
  const sent = () => JSON.stringify(log.chats.at(-1));

  // ---- Off by default
  let n = await send('call 01011112222 please');
  await waitReply(n);
  check(!(await page.$('.privacy-check')) && sent().includes('01011112222') && !(await page.$('.shield-on')), 'off by default: nothing is masked');

  // ---- Turn on (Ask me)
  await page.click('.sidebar-foot');
  await openTab(page, 'Privacy');
  check((await page.textContent('.privacy-preview')).includes('[NAME_1]') && (await page.textContent('.privacy-preview')).includes('[PHONE_1]'), 'settings preview shows what models would see');
  await page.locator('.setting-row', { hasText: 'Privacy shield' }).locator('input').click();
  check((await page.textContent('.privacy-tab')).includes('Ask me'), 'mode choice appears when on');
  await page.click('.settings-page [aria-label="Close"]');
  check(Boolean(await page.$('.shield-on')), 'shield icon in the message box');

  await page.evaluate(()=>document.querySelector('.sidebar .new-chat').click());
  await send('Patient Ahmed Mahmoud, phone 01012345678, needs a follow-up call');
  await page.waitForSelector('.privacy-check');
  const found = await page.textContent('.privacy-found');
  check(/Patient name/.test(found) && /Phone number/.test(found) && !found.includes('01012345678'), 'dialog lists what was found, partly hidden');
  await page.click('.privacy-check >> text=Edit message');
  check((await page.inputValue('.composer textarea')).includes('Ahmed Mahmoud') && log.chats.length === 1, 'Edit keeps the message and sends nothing');
  await page.click('.send-btn');
  await page.waitForSelector('.privacy-check');
  n = (await page.$$('.msg.assistant')).length;
  await page.click('.privacy-check >> text=Mask and send');
  await waitReply(n);
  check(sent().includes('[NAME_1]') && sent().includes('[PHONE_1]') && !sent().includes('01012345678') && !sent().includes('Ahmed Mahmoud'), 'model sees placeholders only');
  const replyText = await page.textContent('.msg.assistant >> nth=0 >> .markdown');
  check(replyText.includes("I'll call 01012345678 about Ahmed Mahmoud today."), `reply shows the real values (${replyText.trim()})`);
  check((await page.textContent('.privacy-note')).includes('2 personal details hidden'), 'note under the message');
  await page.waitForTimeout(1500);
  check(log.titles.length > 0 && !log.titles.at(-1).includes('Ahmed') && (await page.textContent('.chat-row.active')).includes('Follow-up for Ahmed Mahmoud'), 'title request masked, title shown with the real name');

  // History stays masked (including the assistant's restored reply).
  n = await send('thanks, what next?');
  await waitReply(n);
  check(!sent().includes('01012345678') && !sent().includes('Ahmed Mahmoud') && sent().includes('[PHONE_1]'), 'earlier messages stay masked in later requests');

  // Send as is.
  n = await send('email me at ahmed.ali@example.com');
  await page.waitForSelector('.privacy-check');
  await page.click('.privacy-check >> text=Send as is');
  await waitReply(n);
  check(sent().includes('ahmed.ali@example.com') && !sent().includes('01012345678'), '"Send as is" sends only that message unmasked');
  check((await page.textContent('.msg.user >> nth=-1')).includes('Sent without masking'), 'and says so');

  // Auto mode.
  await page.click('.sidebar-foot');
  await openTab(page, 'Privacy');
  await page.click('.privacy-tab .segmented >> text=Mask automatically');
  await page.click('.settings-page [aria-label="Close"]');
  n = await send('her national ID is 29001011234567');
  await waitReply(n);
  check(!(await page.$('.privacy-check')) && sent().includes('[NATIONAL_ID_1]') && !sent().includes('29001011234567'), 'auto mode masks without asking');
  await page.screenshot({ path: require('path').join(__dirname, 'out', 'privacy-chat.png') });

  check(!errors.length, `no page errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
