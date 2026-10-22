// Long chats: auto-compacting, what gets sent, divider, /compact, undo, new chat with summary, sync.
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
const big = (tag) => `${tag} ` + 'The quarterly figures went up again this period. '.repeat(1250); // ~60k chars

async function mock(ctx, log) {
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) {
      return route.fulfill({ json: { models: [
        { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
      ] } });
    }
    const body = route.request().postData() || '';
    if (url.includes(':generateContent')) {
      if (body.includes('You are compacting')) {
        log.summaries.push(body);
        if (log.failSummary) return route.fulfill({ status: 503, json: { error: { code: 503, message: 'overloaded' } } });
        if (log.delaySummary) await new Promise(resolve => setTimeout(resolve, log.delaySummary));
        return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: `## Goal\n- SUMMARY-${log.summaries.length}: user is reviewing quarterly figures\n## Key facts\n- figures went up` }] } }], usageMetadata: { promptTokenCount: 40000, candidatesTokenCount: 120 } } });
      }
      return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Compact Test' }] } }] } });
    }
    log.chats.push(JSON.parse(body));
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: `Reply ${log.chats.length}` }] }, finishReason: 'STOP' }] }) });
  });
}

const allText = (req) => req.contents.map((c) => c.parts.map((p) => p.text || '').join('')).join('\n');

async function device(browser, log) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mock(ctx, log);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
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

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const log = { chats: [], summaries: [] };
  const { page, errors } = await device(browser, log);
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.click('button:has-text("Save keys")');
  await page.waitForTimeout(1500);
  await openTab(page, 'General');
  check((await page.textContent('.settings-page')).includes('Compact long chats automatically'), 'setting is there');
  await page.click('.settings-page [aria-label="Close"]');

  await send(page, big('OLD-1'), 0);
  check(Boolean(await page.$('.usage-chip')), 'usage meter is there from the first message');
  await send(page, big('OLD-2'), 1);
  check(Boolean(await page.$('.usage-chip')), `usage meter shows the chat filling up (${(await page.textContent('.usage-chip').catch(() => '')).trim()})`);
  await send(page, big('OLD-3'), 2);
  check(log.summaries.length === 0, 'no compacting below the limit');

  // 4th long message pushes it over: compacted before the reply.
  await send(page, big('NEW-4'), 3);
  check(log.summaries.length === 1, 'chat compacted automatically');
  const s1 = log.summaries[0];
  check(s1.includes('OLD-1') && s1.includes('OLD-3') && !s1.includes('NEW-4'), 'summary covers the older messages, not the newest');
  const sent = allText(log.chats.at(-1));
  check(sent.includes('SUMMARY-1') && !sent.includes('OLD-1') && !sent.includes('OLD-3') && sent.includes('NEW-4'), 'model got the summary + newest message only');
  check(log.chats.at(-1).contents.length === 1 && log.chats.at(-1).contents[0].role === 'user', 'request starts with a user turn');
  const note = await page.textContent('.compact-note');
  check(/6 earlier messages summarized · saves ~\d+K tokens/.test(note), `divider shown (${note.trim()})`);
  check((await page.$$('.msg')).length === 8, 'whole chat still on screen');
  await page.click('.compact-note >> text=Show summary');
  check((await page.textContent('.compact-summary')).includes('SUMMARY-1'), 'summary can be read');
  await page.screenshot({ path: path.join(__dirname, 'out', 'compact-divider.png') });

  // Next short message: summary reused, no new summary.
  await send(page, 'and what about Q4?', 4);
  check(log.summaries.length === 1 && allText(log.chats.at(-1)).includes('SUMMARY-1') && allText(log.chats.at(-1)).includes('NEW-4'), 'summary reused on the next message');

  // /compact folds the earlier summary into a new one.
  await page.fill('.composer textarea', '/compact');
  await page.click('.send-btn');
  await page.waitForFunction(() => document.querySelector('.compact-note')?.textContent.includes('8 earlier'), null, { timeout: 15000 });
  check(log.summaries.length === 2 && log.summaries[1].includes('<earlier_summary>') && log.summaries[1].includes('SUMMARY-1') && log.summaries[1].includes('NEW-4'), '/compact folds the earlier summary in');
  check(log.chats.length === 5, '/compact is not sent as a message');

  // Second device sees the summary (synced).
  const log2 = { chats: [], summaries: [] };
  const B = await device(browser, log2);
  await B.page.click('.menu-btn');
  await B.page.click('.chat-row .chat-open >> nth=0');
  await B.page.waitForFunction(() => document.querySelector('.compact-note')?.textContent.includes('8 earlier'), null, { timeout: 10000 });
  check((await B.page.textContent('.compact-note')).includes('8 earlier'), 'summary synced to another device');
  await send(B.page, 'from my laptop', 5);
  check(log2.summaries.length === 0 && allText(log2.chats.at(-1)).includes('SUMMARY-2') && !allText(log2.chats.at(-1)).includes('OLD-1'), 'other device uses the synced summary');

  // Undo.
  await page.waitForFunction(() => [...document.querySelectorAll('.msg.user')].some((m) => m.textContent.includes('from my laptop')), null, { timeout: 10000 });
  await page.click('.compact-note >> text=Undo');
  await page.waitForFunction(() => !document.querySelector('.compact-note'), null, { timeout: 10000 });
  await B.page.waitForFunction(() => !document.querySelector('.compact-note'), null, { timeout: 10000 });
  check(!(await page.$('.compact-note')), 'undo removes the divider');
  // Turning auto off: full chat is sent.
  await page.click('.menu-btn');
  await page.click('.sidebar-foot, .cv-account');
  await openTab(page, 'General');
  await page.locator('.setting-row', { hasText: 'Compact long chats automatically' }).locator('input').click();
  await page.click('.settings-page [aria-label="Close"]');
  const nBefore = (await page.$$('.msg.assistant')).length;
  await send(page, 'one more', nBefore);
  check(log.summaries.length === 2 && allText(log.chats.at(-1)).includes('OLD-1'), 'with auto off, the full chat is sent');

  // Failed summary: still answers with the full chat.
  log.failSummary = true;
  await page.focus('.composer textarea').then(()=>page.click('.usage-chip'));
  await page.click('text=Compact now');
  await page.waitForSelector('.compact-note.working', { state: 'detached', timeout: 15000 });
  check(!(await page.$('.compact-note')), 'failed compaction leaves the chat as it was');
  log.failSummary = false;

  // New chat with summary.
  log.delaySummary = 1000; // Exercise the loading indicator before the completed continuation.
  await page.focus('.composer textarea').then(()=>page.click('.usage-chip'));
  await page.click('text=New chat with summary');
  await page.getByRole('note').filter({ hasText: 'Continues “' }).waitFor({ timeout: 15000 });
  await page.waitForSelector('.compact-note.working', { state: 'detached', timeout: 15000 });
  const cont = await page.getByRole('note').filter({ hasText: 'Continues “' }).textContent();
  check(/Continues “.*” · \d+ messages summarized/.test(cont) && (await page.$$('.msg')).length === 0, `new chat carries the summary (${cont.trim()})`);
  await send(page, 'continue from there', 0);
  const first = allText(log.chats.at(-1));
  check(first.includes('continues an earlier conversation') && first.includes('continue from there') && !first.includes('OLD-1'), 'new chat sends the summary, not the old messages');
  await page.screenshot({ path: path.join(__dirname, 'out', 'compact-continued.png') });

  check(![...errors, ...B.errors].length, `no page errors ${[...errors, ...B.errors].join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
