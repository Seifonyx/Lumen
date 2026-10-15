// 2.1.1: on phones the newer windows (Study, Ask your chats, Build a layout) keep a margin from the screen edges
// and nothing in them spills off the screen.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const { scan } = require('./helpers/fitscan.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const deck = { id: 'd1', title: 'A rather long deck title about cell biology and energy', source: { label: 'Cell biology' }, createdAt: now, updatedAt: now,
  cards: [{ id: 'c1', q: 'What is the main product of the light-dependent reactions of photosynthesis?', a: 'ATP and NADPH', box: 1, due: 0 }],
  quiz: [{ id: 'q1', q: 'Which molecule carries high-energy electrons to the Calvin cycle?', options: ['NADPH (nicotinamide adenine dinucleotide phosphate)', 'FADH2', 'Pyruvate', 'Acetyl-CoA'], answer: 0 }] };

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 320]) {
      const ctx = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      await profile(ctx, `phone-windows-${width}`, 'light');
      await ctx.addInitScript(([key, d]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify([d])); }, [`mr.study.phone-windows-${width}`, deck]);
      await ctx.route('**/generativelanguage.googleapis.com/**', (r) => r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } }));
      const page = await ctx.newPage();
      await page.goto(URL);
      await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
      const inset = async (sel, label) => {
        const box = await page.locator(sel).first().boundingBox();
        assert.ok(box.x >= 12 && box.x + box.width <= width - 12, `${width}px ${label}: ${Math.round(box.x)}–${Math.round(box.x + box.width)} keeps a margin`);
        assert.deepEqual(await scan(page), [], `${width}px ${label} fits`);
      };
      await page.click('.menu-btn'); await page.waitForTimeout(400);
      await page.click('.library-button:has-text("Tools")');
      await page.locator('.tool-card').filter({ has: page.locator('strong', { hasText: /^Study$/ }) }).click();
      await inset('.study-deck', 'Study decks');
      await page.getByRole('button', { name: 'Quiz' }).click();
      await inset('.quiz-option', 'quiz answers');
      await page.goto(URL); await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
      await page.click('.menu-btn'); await page.waitForTimeout(400);
      await page.fill('#chat-search', 'anything at all');
      await page.click('.ask-chats-btn');
      await inset('.ask-form', 'Ask your chats');
      console.log(`PASS ${width}px: new windows keep their margins and fit`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
