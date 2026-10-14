// Hands-free voice conversation with simulated speech recognition and speech output.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const reply = (text) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n';

(async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await profile(ctx, 'preview-voice', 'dark');
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => r.request().url().includes('/models?') ? r.fallback() : r.fulfill({ contentType: 'text/event-stream', body: reply('**Four.** Two plus two is four.') }));
    await ctx.addInitScript(() => {
      // Each recognition session "hears" the next phrase, then ends like a real one after a pause.
      const phrases = ['What is two plus two', ''];
      window.__voice = { starts: 0, spoken: [] };
      class FakeRecognition {
        start() {
          const said = phrases[window.__voice.starts++] ?? '';
          setTimeout(() => {
            if (said) this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: said }], { isFinal: true })] });
            this.onend?.();
          }, 150);
        }
        stop() { this.onend?.(); }
      }
      window.SpeechRecognition = FakeRecognition;
      const synth = { getVoices: () => [], cancel() {}, speak(u) { if (u.text.trim()) window.__voice.spoken.push(u.text); setTimeout(() => u.onend?.(), 80); } };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => { if (!e.message.includes('firestore')) errors.push(e.message); });
    await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
    await page.locator('.composer textarea').waitFor();

    // Empty message box: the send button is the voice button; typing brings Send back.
    const voice = page.getByRole('button', { name: 'Start voice conversation' });
    await voice.waitFor();
    await page.fill('.composer textarea', 'x');
    assert.equal(await voice.count(), 0, 'typing shows Send again');
    await page.locator('.send-btn').waitFor();
    await page.fill('.composer textarea', '');

    await voice.click();
    await page.getByRole('dialog', { name: 'Voice conversation' }).waitFor();
    // Heard → sent → reply spoken (as plain text) → listening again.
    await page.waitForFunction(() => window.__voice.spoken.length === 1);
    if (process.env.SHOT) { await page.waitForTimeout(40); await page.screenshot({ path: process.env.SHOT }); }
    assert.equal(await page.evaluate(() => window.__voice.spoken[0]), 'Four. Two plus two is four.');
    await page.waitForFunction(() => window.__voice.starts >= 2);
    await page.getByRole('button', { name: 'End voice conversation' }).click();
    await page.getByRole('dialog', { name: 'Voice conversation' }).waitFor({ state: 'detached' });
    await page.locator('.msg.user').filter({ hasText: 'What is two plus two' }).waitFor();
    await page.locator('.msg.assistant').filter({ hasText: 'Two plus two is four.' }).waitFor();

    assert.deepEqual(errors, []);
    console.log('PASS hands-free voice: listen, send, speak, listen again');
    await ctx.close();
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
