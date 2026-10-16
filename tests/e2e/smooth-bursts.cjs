// 2.4.7: a reply that arrives in bursts (big pieces every few seconds, as some providers and networks send it)
// flows in at a steady pace instead of jumping, and ends showing the whole reply.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/';

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await profile(ctx, 'smooth-bursts', 'dark');
    await ctx.addInitScript(() => {
      window.__mrMotion = true; // the pacing is motion; tests normally turn motion off
      const nativeFetch = window.fetch;
      const words = 'Lisbon is a city of hills and light where trams climb narrow streets past tiled walls'.split(' ');
      const piece = (n) => Array.from({ length: 40 }, (_, i) => words[(n * 40 + i) % words.length]).join(' ') + ' ';
      window.fetch = async (url, options = {}) => {
        if (!String(url).includes('generativelanguage.googleapis.com') || String(url).includes('/models?')) return nativeFetch(url, options);
        const enc = new TextEncoder(), send = (c, text, stop) => c.enqueue(enc.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, ...(stop ? { finishReason: 'STOP' } : {}) }] })}\n\n`));
        return new Response(new ReadableStream({ start(c) {
          let n = 0;
          const next = () => { send(c, piece(n), n === 3); n++; if (n < 4) setTimeout(next, 1500); else { c.close(); window.__sent = true; } };
          next();
        } }), { headers: { 'content-type': 'text/event-stream' } });
      };
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await page.fill('.composer textarea', 'Tell me about Lisbon');
    await page.locator('.composer .send-btn').click();
    await page.waitForSelector('.msg.assistant .markdown');
    // Sample how much text is on screen, every 100 ms, while the bursts arrive.
    const samples = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 70; i++) { out.push(document.querySelector('.msg.assistant .markdown')?.textContent.length || 0); await new Promise((r) => setTimeout(r, 100)); }
      return out;
    });
    const steps = samples.slice(1).map((x, i) => x - samples[i]);
    const growing = steps.filter((d) => d > 0).length;
    const biggest = Math.max(...steps);
    // Bursts of ~400 characters every 1.5 s: shown at once, a handful of 100 ms samples would hold all the growth.
    assert.ok(growing >= 25, `the text grows steadily (${growing} of ${steps.length} samples grew)`);
    assert.ok(biggest < 250, `no big jumps (largest step ${biggest} characters)`);
    console.log(`PASS bursty reply flows in steadily (${growing}/${steps.length} samples grew, largest step ${biggest})`);
    await page.waitForFunction(() => !document.querySelector('.msg.assistant .caret'), null, { timeout: 15000 });
    const final = await page.evaluate(() => document.querySelector('.msg.assistant .markdown').textContent.trim().split(/\s+/).length);
    assert.equal(final, 160, 'the whole reply is shown at the end');
    console.log('PASS the whole reply is shown when it ends');
    await ctx.close();
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
