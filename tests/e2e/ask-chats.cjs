// 2.1: Ask your chats finds chats by meaning (different words), answers from them with numbered links that open
// the chat, and only re-reads chats that changed.
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/';
const now = Date.now();
const mk = (id, title, q, a, at) => ({ id, title, createdAt: at, updatedAt: at, model: 'gemini:gemini-flash-latest', messages: [{ id: id + 'u', role: 'user', text: q, createdAt: at }, { id: id + 'a', role: 'assistant', status: 'done', text: a, createdAt: at }] });
// A toy "meaning": money/vehicle words point one way, baking words another.
const vec = (t) => [/car|loan|vehicle|financ|money/i.test(t) ? 1 : 0, /cake|bake|recipe|oven/i.test(t) ? 1 : 0, 0.05];

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'preview-ask-chats', 'light');
    let embedded = 0, answerPrompt = '';
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      const url = r.request().url();
      if (url.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', inputTokenLimit: 128000, supportedGenerationMethods: ['generateContent'] }] } });
      const body = r.request().postDataJSON();
      if (url.includes(':batchEmbedContents')) {
        if (body.requests[0].taskType === 'RETRIEVAL_DOCUMENT') embedded += body.requests.length;
        return r.fulfill({ json: { embeddings: body.requests.map((q) => ({ values: vec(q.content.parts[0].text) })) } });
      }
      answerPrompt = JSON.stringify(body);
      return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'You picked the 5-year car loan at 4% [1].' }] } }] } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await seed(page, 'preview-ask-chats', [
      mk('car', 'Buying a car', 'Should I take the 5-year car loan at 4%?', 'Yes, the 5-year loan is cheaper overall.', now - 1e5),
      mk('cake', 'Birthday cake', 'Best chocolate cake recipe?', 'Bake at 180C for 35 minutes.', now - 2e5),
    ]);
    await page.reload();
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');

    // Different words from the chat: "vehicle financing".
    await page.fill('#chat-search', 'what did I decide on vehicle financing');
    await page.locator('.ask-chats-btn').click();
    await page.locator('.ask-answer').waitFor();
    assert.match(await page.locator('.ask-answer').textContent(), /5-year car loan/);
    assert.equal(embedded, 2, 'each exchange read once');
    const hits = page.locator('.ask-hits li');
    assert.equal(await hits.count(), 1, 'only the related chat');
    assert.match(await hits.first().textContent(), /Buying a car/);
    assert.match(answerPrompt, /5-year car loan at 4%/);
    assert.doesNotMatch(answerPrompt, /chocolate cake/);
    console.log('PASS finds the chat by meaning and answers from it');

    // Asking again: nothing new to read.
    await page.getByRole('button', { name: 'Ask', exact: true }).click();
    await page.locator('.ask-answer').waitFor();
    assert.equal(embedded, 2, 'unchanged chats are not read again');
    console.log('PASS only changed chats are read again');

    // The number opens the chat.
    await page.locator('.ask-cite').first().click();
    await page.locator('.main .msg.assistant:has-text("the 5-year loan is cheaper")').waitFor();
    console.log('PASS a citation opens its chat');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
