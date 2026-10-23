// 2.1: Study makes flashcards and a quiz from a chat; cards flip, "Not yet" brings a card back in the same round,
// "Knew it" schedules it later; the quiz shows right/wrong with the reason and keeps the score.
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/';
const now = Date.now();
const chat = { id: 'bio', title: 'Cell biology', createdAt: now, updatedAt: now, model: 'gemini:gemini-flash-latest', messages: [
  { id: 'u', role: 'user', text: 'Explain the parts of a cell', createdAt: now },
  { id: 'a', role: 'assistant', status: 'done', text: 'The mitochondria make energy (ATP). The nucleus holds DNA. Ribosomes build proteins. '.repeat(5), createdAt: now },
] };
const deck = { title: 'Cell basics', cards: [{ q: 'What makes ATP?', a: 'Mitochondria' }, { q: 'Where is DNA?', a: 'Nucleus' }, { q: 'What builds proteins?', a: 'Ribosomes' }],
  quiz: [{ q: 'Which part holds DNA?', options: ['Ribosome', 'Nucleus', 'Membrane', 'Mitochondria'], answer: 1, why: 'The nucleus stores the genetic material.' },
    { q: 'What do ribosomes build?', options: ['Proteins', 'Fats', 'Sugars', 'DNA'], answer: 0, why: 'Ribosomes translate RNA into proteins.' }] };

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'preview-study', 'light');
    let prompt = '', requests = 0;
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      const url = r.request().url();
      if (url.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', inputTokenLimit: 128000, supportedGenerationMethods: ['generateContent'] }] } });
      prompt = r.request().postData() || ''; requests++;
      return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(deck) + '\n```' }] } }] } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await seed(page, 'preview-study', [chat]);
    await page.reload();
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');

    // ---- Study remains available in Tools after removing the sidebar shortcut.
    await page.click(':is(.library-button, .cv-dest button):has-text("Tools")');
    await page.locator('.tool-card').filter({ has: page.locator('strong', { hasText: /^Study$/ }) }).click();
    await page.getByRole('button', { name: 'Make your first deck', exact: true }).click();
    await page.locator('.study-sources button', { hasText: 'Cell biology' }).click();
    const card = page.locator('.flashcard');
    await card.waitFor();
    assert.match(prompt, /mitochondria make energy/);
    assert.match(await page.locator('.study-head').textContent(), /3 left/);
    console.log('PASS Tools → Study makes a deck from a selected chat and starts the cards');

    // ---- Flip; Not yet → comes back at the end; Knew it → leaves the round.
    assert.match(await card.textContent(), /What makes ATP\?/);
    await card.click();
    await page.getByRole('button', { name: 'Not yet' }).click();
    assert.match(await page.locator('.study-head').textContent(), /3 left/, 'a missed card stays in the round');
    for (let k = 0; k < 3; k++) { await card.click(); await page.getByRole('button', { name: 'Knew it' }).click(); }
    await page.locator('.study-empty h3', { hasText: 'Round done' }).waitFor();
    assert.match(await page.locator('.study-empty').textContent(), /3 remembered · 1 missed along the way/);
    console.log('PASS flashcards flip and are scheduled by how well you knew them');

    // ---- Quiz.
    await page.getByRole('button', { name: 'Take the quiz' }).click();
    await page.locator('.quiz-option', { hasText: 'Ribosome' }).click();
    assert.ok(await page.locator('.quiz-option.wrong', { hasText: 'Ribosome' }).isVisible());
    assert.ok(await page.locator('.quiz-option.right', { hasText: 'Nucleus' }).isVisible());
    assert.ok(await page.getByText('The nucleus stores the genetic material.').isVisible());
    await page.getByRole('button', { name: /Next/ }).click();
    await page.locator('.quiz-option', { hasText: 'Proteins' }).click();
    await page.getByRole('button', { name: /See score/ }).click();
    await page.locator('.study-empty h3', { hasText: '1 of 2 right' }).waitFor();
    await page.getByRole('button', { name: /Retry 1 missed/ }).click();
    assert.match(await page.locator('.quiz-q').textContent(), /Which part holds DNA\?/);
    console.log('PASS the quiz marks answers, explains, scores and retries the missed ones');

    // ---- The deck list remembers progress (after closing and reopening).
    await page.keyboard.press('Escape'); // back to the decks
    await page.keyboard.press('Escape'); // closes Study
    await page.locator('.hub-page').waitFor({ state: 'detached' });
    const before = requests;
    await page.click(':is(.library-button, .cv-dest button):has-text("Tools")');
    await page.locator('.tool-card').filter({ has: page.locator('strong', { hasText: /^Study$/ }) }).click();
    const item = page.locator('.study-deck', { hasText: 'Cell basics' });
    await item.waitFor();
    assert.match(await item.textContent(), /3 cards · 2 questions/);
    assert.match(await item.textContent(), /Best quiz 1\/2/);
    assert.equal(requests, before, 'reopening Study does not make the deck again');
    console.log('PASS decks are kept with your progress');

    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
