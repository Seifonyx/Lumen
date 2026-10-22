// 1.5 on a phone: the app opens from this device's saved copy without waiting for the network; a reply that
// arrives while you're scrolled up shows "Writing…" then "New reply" on the jump button, which takes you
// there; dragging the conversation down hides the keyboard; the optional send sound plays only when turned
// on; the iPhone launch screens are all there.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const long = Array.from({ length: 12 }, (_, i) => [
  { id: `pu${i}`, role: 'user', text: `Question ${i}`, createdAt: now - 9e6 + i * 1000 },
  { id: `pa${i}`, role: 'assistant', model: 'gemini:gemini-flash-latest', status: 'done', createdAt: now - 9e6 + i * 1000 + 500, text: `Answer ${i}. ${'Some longer text to fill the screen. '.repeat(6)}` },
]).flat();

(async () => {
  // Launch screens: every link points at a real image of the right size.
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const links = [...html.matchAll(/rel="apple-touch-startup-image" media="([^"]+)" href="\/([^"]+)"/g)];
  assert.ok(links.length >= 20, `launch screens listed (${links.length})`);
  for (const [, media, file] of links) {
    const png = fs.readFileSync(path.join(__dirname, '..', '..', 'public', file));
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    const [, cw, ch, r] = /device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)/.exec(media);
    assert.ok(w === cw * r && h === ch * r, `${file} is ${w}×${h} for ${cw}×${ch}@${r}`);
  }
  console.log(`PASS ${links.length} iPhone launch screens (light and dark) match their screen sizes`);

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await profile(ctx, 'polish', 'light');
    await ctx.addInitScript(() => {
      window.__mrMotion = true;
      window.__sounds = 0;
      const Real = window.AudioContext;
      window.AudioContext = class extends Real { createOscillator() { window.__sounds++; return super.createOscillator(); } };
      // A reply that streams for about two seconds.
      const real = window.fetch;
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : input.url;
        if (!url.includes('streamGenerateContent')) return real(input, init);
        const body = new ReadableStream({ async start(c) {
          for (let i = 0; i < 20; i++) {
            await new Promise((ok) => setTimeout(ok, 100));
            c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: `Line ${i} of a long streamed answer.\n\n` }] } }] })}\n\n`));
          }
          c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'STOP' }] })}\n\n`));
          c.close();
        } });
        return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
      };
    });
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      const u = r.request().url();
      if (u.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] } });
      return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Title' }] } }] } });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.composer textarea');
    await seed(page, 'polish', [{ id: 'pl', title: 'Reading list', createdAt: now - 9e6, updatedAt: now, model: 'gemini:gemini-flash-latest', messages: long }]);

    // ---- Instant open: with the account data slow to arrive, the app is still there at once.
    await page.reload();
    await page.waitForSelector('.composer textarea');
    await page.waitForTimeout(1500); // the saved copy is written after the first full load
    await ctx.route('**/google.firestore.v1.Firestore/**', async (r) => { await new Promise((ok) => setTimeout(ok, 4000)); await r.continue().catch(() => {}); });
    const t0 = Date.now();
    await page.reload();
    await page.locator('.app:not(.app-skeleton) .composer textarea').waitFor();
    const opened = Date.now() - t0;
    assert.ok(opened < 3000, `opens from the saved copy without waiting for the network (${opened} ms)`);
    await ctx.unroute('**/google.firestore.v1.Firestore/**');
    console.log(`PASS opens in ${opened} ms while the account data is held back 4 s`);

    // ---- New reply while scrolled up
    await page.click('.menu-btn'); await page.locator('.sidebar.open').waitFor(); await page.waitForTimeout(500);
    await page.click('text=Reading list');
    await page.waitForTimeout(800);
    await page.fill('.composer textarea', 'Tell me more');
    await page.click('.send-btn');
    await page.waitForTimeout(500);
    await page.locator('.messages').evaluate((el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
    const pill = page.locator('.to-bottom.labelled');
    await pill.waitFor({ timeout: 3000 });
    assert.match(await pill.innerText(), /Writing/, 'while it is being written: "Writing…"');
    await page.locator('.send-btn.stop').waitFor({ state: 'hidden', timeout: 8000 });
    await page.waitForTimeout(200);
    assert.match(await pill.innerText(), /New reply/, 'once done: "New reply"');
    await pill.click();
    await page.waitForFunction(() => { const el = document.querySelector('.messages'); return el.scrollHeight - el.scrollTop - el.clientHeight < 4; }, null, { timeout: 3000 });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.to-bottom.labelled').count(), 0, 'the label goes once you are there');
    console.log('PASS a reply below you shows "Writing…" then "New reply", and the button takes you there');

    // ---- Dragging the conversation down hides the keyboard
    await page.focus('.composer textarea');
    await page.keyboard.type('draft');
    const box = await page.locator('.messages').boundingBox();
    await page.evaluate(async ([x, y]) => {
      const target = document.elementFromPoint(x, y);
      const mk = (yy) => new Touch({ identifier: 4, target, clientX: x, clientY: yy });
      target.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(y)], changedTouches: [mk(y)], bubbles: true }));
      for (let i = 1; i <= 6; i++) { await new Promise((ok) => setTimeout(ok, 16)); target.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(y + i * 10)], changedTouches: [mk(y + i * 10)], bubbles: true })); }
      target.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(y + 60)], bubbles: true }));
    }, [box.x + box.width / 2, box.y + 200]);
    assert.ok(await page.evaluate(() => document.activeElement?.tagName !== 'TEXTAREA'), 'dragging the conversation down hides the keyboard');
    assert.equal(await page.inputValue('.composer textarea'), 'draft', 'and keeps what you typed');
    console.log('PASS dragging the conversation down hides the keyboard and keeps the draft');

    // ---- Send sound: off by default, plays when turned on
    await page.fill('.composer textarea', 'Quiet please');
    await page.click('.send-btn');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__sounds), 0, 'no sound by default');
    await page.locator('.send-btn.stop').waitFor({ state: 'hidden', timeout: 8000 });
    await page.click('.menu-btn'); await page.waitForTimeout(500); await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: 'General', exact: true }).click();
    await page.waitForTimeout(500);
    await page.locator('.settings-page:not(.exit-ghost)').getByLabel('Sound when sending').check();
    const preview = await page.evaluate(() => window.__sounds);
    assert.ok(preview > 0, 'turning it on plays it once');
    assert.ok(await page.locator('.settings-page:not(.exit-ghost)').getByRole('radio', { name: 'Auto' }).count() >= 1, 'text size has Auto');
    await page.click('.settings-page [aria-label="Close"]');
    await page.waitForTimeout(400);
    await page.fill('.composer textarea', 'Now with sound');
    await page.click('.send-btn');
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => window.__sounds) > preview, 'sending plays it');
    console.log('PASS send sound off by default, plays when on; text size offers Auto');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
