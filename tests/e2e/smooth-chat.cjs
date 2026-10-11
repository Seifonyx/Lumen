// Real streaming UI work with isolated data and scripted provider responses.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1280, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900 });
      await context.route('**/firestore.googleapis.com/**', r => r.abort());
      await context.addInitScript(() => {
        if (!localStorage.getItem('mr.preview_user')) {
          const uid = 'preview-smooth-chat';
          const settings = { autoIntroduced: true, autoTitle: false, autoSwitch: true, enabledModels: ['gemini:gemini-2.5-flash'], defaultModel: 'auto' };
          localStorage.setItem('mr.preview_user', JSON.stringify({ uid, email: 'smooth@local.invalid', displayName: 'Smooth chat' }));
          localStorage.setItem(`mr.account.${uid}`, JSON.stringify({ geminiKey: 'fixture', settings }));
          localStorage.setItem('mr.settings', JSON.stringify(settings));
          localStorage.setItem('mr.installHint', '1');
        }
        const nativeFetch = window.fetch;
        window.__smooth = { requests: [], chunks: 0, first: 0, firstPaint: 0, updates: 0, maxHighlightDuringStream: 0, longTasks: [] };
        try { new PerformanceObserver(list => window.__smooth.longTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask', buffered: false }); } catch {}
        window.fetch = async (url, options = {}) => {
          if (!String(url).includes('generativelanguage.googleapis.com')) return nativeFetch(url, options);
          if (String(url).includes('/models?')) return Response.json({ models: [{ name: 'models/gemini-2.5-flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] }] });
          const m = window.__smooth;
          m.requests.push(JSON.parse(options.body));
          const enc = new TextEncoder();
          let timer, count = 0, ended = false;
          const packet = text => enc.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`);
          return new Response(new ReadableStream({
            start(c) {
              const abort = () => { if (ended) return; ended = true; clearTimeout(timer); c.error(new DOMException('Stopped', 'AbortError')); };
              options.signal?.addEventListener('abort', abort, { once: true });
              const next = () => {
                if (ended) return;
                if (!count) { m.first = performance.now(); c.enqueue(packet('Here is the code:\n\n```javascript\n')); }
                c.enqueue(packet(Array.from({ length: 24 }, (_, i) => `const value${count}_${i} = { label: "example", count: ${i} };\n`).join('')));
                count++; m.chunks = count;
                if (count < 70) timer = setTimeout(next, 30);
                else {
                  c.enqueue(packet('```\n\nFinished.'));
                  c.enqueue(enc.encode(`data: ${JSON.stringify({ candidates: [{ finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 30 } })}\n\n`));
                  ended = true; options.signal?.removeEventListener('abort', abort); c.close();
                }
              };
              timer = setTimeout(next, 80);
            },
            cancel() { ended = true; clearTimeout(timer); },
          }), { headers: { 'content-type': 'text/event-stream' } });
        };
      });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
      await page.waitForSelector('.composer textarea');
      await page.evaluate(() => {
        new MutationObserver(() => {
          const m = window.__smooth;
          if (!document.querySelector('.msg.assistant .markdown')) return;
          if (!m.firstPaint) m.firstPaint = performance.now();
          m.updates++;
          if (document.querySelector('.send-btn.stop')) m.maxHighlightDuringStream = Math.max(m.maxHighlightDuringStream, document.querySelectorAll('.msg.assistant .hljs span').length);
        }).observe(document.querySelector('.messages'), { subtree: true, childList: true, characterData: true });
      });
      await page.fill('.composer textarea', 'hello'); await page.click('.send-btn');
      await page.waitForFunction(() => window.__smooth.chunks >= 10);
      await page.evaluate(() => { const el = document.querySelector('.messages'); el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); });
      await page.waitForFunction(() => window.__smooth.chunks >= 30);
      assert.equal(await page.evaluate(() => document.querySelector('.messages').scrollTop), 0, 'reading earlier content must not be pulled down');
      await page.locator('.send-btn.stop').waitFor({ state: 'hidden' });
      const metrics = await page.evaluate(() => ({ ...window.__smooth, requests: window.__smooth.requests.map(r => r.generationConfig), finalHighlights: document.querySelectorAll('.msg.assistant .hljs span').length, fits: document.documentElement.scrollWidth <= innerWidth + 1 }));
      console.log(`METRICS ${width}px ${JSON.stringify(metrics)}`);
      assert.ok(metrics.finalHighlights > 100);
      assert.ok(metrics.fits);
      assert.match(await page.locator('.msg.assistant .markdown').textContent(), /value69_23[\s\S]*Finished/);
      if (!process.env.MR_PERF_BASELINE) {
        assert.equal(metrics.maxHighlightDuringStream, 0, 'highlight only after the stream finishes');
        assert.equal(metrics.requests[0]?.thinkingConfig?.thinkingBudget, 0, 'Auto quick chat avoids unnecessary Gemini 2.5 Flash thinking');
      }
      await page.fill('.composer textarea', 'continue'); await page.click('.send-btn');
      await page.waitForFunction(() => document.querySelectorAll('.msg.assistant .markdown').length === 2);
      await page.locator('.send-btn.stop').click();
      await page.locator('.send-btn.stop').waitFor({ state: 'hidden' });
      const stopped = await page.locator('.msg.assistant').last().textContent();
      assert.match(stopped, /value/);
      await page.waitForTimeout(100);
      assert.equal(await page.locator('.msg.assistant').last().textContent(), stopped, 'no delayed streaming flush after Stop');
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `tests/e2e/out/smooth-chat-${width}.png` });
      console.log(`PASS ${width}px: complete long code, scroll position, Stop and layout`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
