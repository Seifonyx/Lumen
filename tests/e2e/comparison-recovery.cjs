// Run once normally (Chromium), then with MR_WEBKIT=1 (WebKit).
// Real comparison UI and provider requests; no store backdoors or paid services.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');

const base = process.env.MR_TEST_URL || 'http://localhost:5190/';
const a = 'gemini:gemini-flash-lite-latest';
const b = 'gemini:gemini-2.5-pro';
const outside = 'gemini:gemini-3.8-pro';
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
};
const packet = value => `data: ${JSON.stringify(value)}\n\n`;
const answer = text => packet({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });
const partialError = (text, message) => packet({ candidates: [{ content: { parts: [{ text }] } }] })
  + packet({ error: { code: 503, message } });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

async function compare(page, prompt) {
  await page.locator('.composer textarea').fill(prompt);
  await page.getByRole('button', { name: /^Add (?:photos, )?files or a repository$/ }).click();
  await page.getByRole('button', { name: 'Compare models', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Compare models', exact: true });
  await picker.getByRole('button', { name: 'Compare', exact: true }).click();
  return page.getByRole('dialog', { name: 'Model comparison', exact: true });
}

async function preserveAnswer(card) {
  await card.locator('.comparison-save').waitFor();
  const node = await card.locator('.comparison-answer').elementHandle();
  const text = await card.locator('.comparison-answer').innerText();
  return async () => {
    assert.equal(await node.evaluate(element => element.isConnected), true, 'successful answer keeps its existing DOM node');
    assert.equal(await card.locator('.comparison-answer').innerText(), text, 'successful answer content is preserved');
    assert.equal(await card.getByRole('button', { name: 'Retry this model', exact: true }).count(), 0, 'successful stages are not offered a retry');
  };
}

(async () => {
  const engine = process.env.MR_WEBKIT ? webkit : chromium;
  const browser = await engine.launch();
  try {
    for (const width of [390, 1280]) {
      for (const mode of ['retry-and-synthesis', 'partial-error', 'stop', 'close-and-reload']) {
        const context = await browser.newContext({
          viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900, serviceWorkers: 'block',
        });
        try {
          const uid = `preview-comparison-recovery-${engine.name()}-${width}-${mode}`;
          const calls = [], errors = [];
          const heldRequest = deferred(), releaseHeld = deferred();
          const sourceCalls = id => calls.filter(call => call.kind === 'source' && call.model === id);
          const synthesisCalls = () => calls.filter(call => call.kind === 'synthesis');
          await profile(context, uid, 'dark', {
            enabledModels: [a, b, outside], defaultModel: a, autoSwitch: true,
            autoTitle: false, autoCompact: false, privacyShield: false, webSearch: false,
          });
          await context.route('**/generativelanguage.googleapis.com/**', async route => {
            const request = route.request();
            if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
            if (request.url().includes('/models?')) {
              return route.fulfill({ headers, json: { models: [
                { name: `models/${a.slice(7)}`, displayName: 'Flash Lite A', inputTokenLimit: 128000, outputTokenLimit: 8192, supportedGenerationMethods: ['generateContent'] },
                { name: `models/${b.slice(7)}`, displayName: 'Pro B', inputTokenLimit: 128000, outputTokenLimit: 8192, supportedGenerationMethods: ['generateContent'] },
                { name: `models/${outside.slice(7)}`, displayName: 'Outside comparison C', inputTokenLimit: 256000, outputTokenLimit: 8192, supportedGenerationMethods: ['generateContent'] },
              ] } });
            }
            assert.match(request.url(), /:streamGenerateContent/, 'automatic titles and unrelated helper calls are disabled');
            const model = `gemini:${/models\/([^:]+):/.exec(request.url())[1]}`;
            const body = request.postDataJSON();
            const kind = /Several AI models answered the same question|Write the single best answer/.test(JSON.stringify(body)) ? 'synthesis' : 'source';
            calls.push({ model, body, kind });
            assert.ok([a, b].includes(model), 'only the two selected comparison models may receive inference calls');
            if (kind === 'synthesis') {
              return route.fulfill({
                headers, contentType: 'text/event-stream',
                body: synthesisCalls().length === 1
                  ? partialError('SYNTHESIS_PARTIAL', 'SYNTHESIS_STREAM_FAILURE')
                  : answer('SYNTHESIS_RECOVERED\n\n**Where they differed**\nThe combined answer keeps the useful details from both.'),
              });
            }
            const ordinal = sourceCalls(model).length;
            if (model === b && ordinal === 1) {
              if (mode === 'stop') {
                heldRequest.resolve();
                await releaseHeld.promise;
                // The canceled request may already have been torn down by the browser.
                return route.fulfill({ headers, contentType: 'text/event-stream', body: answer('LATE_CANCELED_ANSWER') }).catch(() => {});
              }
              if (mode === 'partial-error') {
                return route.fulfill({ headers, contentType: 'text/event-stream', body: partialError('SOURCE_B_PARTIAL', 'SOURCE_STREAM_FAILURE') });
              }
              return route.fulfill({ status: 503, headers, json: { error: { message: 'SOURCE_UNAVAILABLE_BEFORE_OUTPUT' } } });
            }
            return route.fulfill({ headers, contentType: 'text/event-stream', body: answer(model === a ? `SOURCE_A_STABLE_${ordinal}` : `SOURCE_B_RECOVERED_${ordinal}`) });
          });

          const page = await context.newPage();
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(base);
          await page.locator('.app:not(.app-skeleton) .composer textarea').waitFor();
          const originalPrompt = `RECOVERY_ORIGINAL_PROMPT ${mode}`;
          const dialog = await compare(page, originalPrompt);
          const first = dialog.locator('.comparison-grid .comparison-card').filter({ has: page.locator('header strong').filter({ hasText: /^Flash Lite A$/ }) });
          const second = dialog.locator('.comparison-grid .comparison-card').filter({ has: page.locator('header strong').filter({ hasText: /^Pro B$/ }) });
          const verifyFirst = await preserveAnswer(first);
          assert.match(await first.textContent(), /SOURCE_A_STABLE_1/);
          await first.getByRole('status').filter({hasText:'Answer ready'}).waitFor();

          if (mode === 'stop') {
            await heldRequest.promise;
            await dialog.locator('.comparison-actions').getByRole('button', { name: 'Stop', exact: true }).click();
            await second.getByText(/Stopped\.?/, { exact: true }).waitFor();
            releaseHeld.resolve();
          } else {
            await second.locator('.error-msg').filter({ hasText: mode === 'partial-error' ? 'SOURCE_STREAM_FAILURE' : 'SOURCE_UNAVAILABLE_BEFORE_OUTPUT' }).waitFor();
            assert.equal(await second.locator('.error-msg').getAttribute('role'),'alert','failed stages announce their error without replacing partial text');
          }
          const retry = second.getByRole('button', { name: 'Retry this model', exact: true });
          await retry.waitFor();
          assert.equal(sourceCalls(a).length, 1);
          assert.equal(sourceCalls(b).length, 1, 'a failed comparison slot never automatically calls another model');
          assert.equal(calls.length, 2);
          assert.equal(await second.locator('.comparison-save').count(), 0, 'failed or stopped output cannot be saved as completed');
          if (mode === 'partial-error') assert.match(await second.locator('.comparison-answer').innerText(), /SOURCE_B_PARTIAL/, 'partial output remains readable alongside its error');
          await verifyFirst();

          if (mode === 'close-and-reload') {
            await dialog.locator('.comparison-actions').getByRole('button', { name: 'Close', exact: true }).click();
            await dialog.waitFor({ state: 'detached' });
            await page.reload();
            await page.locator('.app:not(.app-skeleton) .composer textarea').waitFor();
            assert.equal(await page.getByRole('dialog', { name: 'Model comparison', exact: true }).count(), 0, 'old comparison and retry controls do not survive reload');
            assert.equal(calls.length, 2, 'reload never replays an old comparison request');
            const fresh = await compare(page, 'FRESH_COMPARISON_PROMPT');
            await fresh.locator('.comparison-save').nth(1).waitFor();
            assert.equal(sourceCalls(a).length, 2);
            assert.equal(sourceCalls(b).length, 2);
            for (const call of calls.slice(2)) {
              assert.match(JSON.stringify(call.body), /FRESH_COMPARISON_PROMPT/);
              assert.doesNotMatch(JSON.stringify(call.body), /RECOVERY_ORIGINAL_PROMPT/, 'a new comparison never reuses the closed request snapshot');
            }
          } else {
            await retry.click();
            await second.locator('.comparison-save').waitFor();
            assert.match(await second.locator('.comparison-answer').innerText(), /SOURCE_B_RECOVERED_2/);
            assert.doesNotMatch(await second.locator('.comparison-answer').innerText(), /SOURCE_B_PARTIAL|LATE_CANCELED_ANSWER/);
            assert.equal(await second.locator('.error-msg').count(), 0);
            assert.equal(await second.getByRole('button', { name: 'Retry this model', exact: true }).count(), 0);
            assert.equal(sourceCalls(a).length, 1, 'retry resends only the failed or stopped model');
            assert.equal(sourceCalls(b).length, 2);
            assert.deepEqual(sourceCalls(b)[1].body, sourceCalls(b)[0].body, 'slot retry preserves its frozen provider request');
            await verifyFirst();

            if (mode === 'retry-and-synthesis') {
              const verifySecond = await preserveAnswer(second);
              const combine = dialog.getByRole('button', { name: 'Combine into one answer', exact: true });
              await combine.click();
              const combined = dialog.locator('.comparison-combined');
              await combined.locator('.error-msg').filter({ hasText: 'SYNTHESIS_STREAM_FAILURE' }).waitFor();
              assert.match(await combined.locator('.comparison-answer').innerText(), /SYNTHESIS_PARTIAL/);
              assert.equal(await combined.locator('.comparison-save').count(), 0);
              assert.equal(synthesisCalls().length, 1, 'one synthesis stage starts after the comparison finishes');
              assert.equal(synthesisCalls()[0].model, b, 'shared quality routing selects the stronger eligible source model');
              for (const marker of [originalPrompt, 'SOURCE_A_STABLE_1', 'SOURCE_B_RECOVERED_2']) assert.ok(JSON.stringify(synthesisCalls()[0].body).includes(marker), 'synthesis receives the question and both completed answers');
              await combine.click();
              await combined.locator('.comparison-save').waitFor();
              assert.match(await combined.locator('.comparison-answer').innerText(), /SYNTHESIS_RECOVERED/);
              assert.equal(await combined.locator('.error-msg').count(), 0);
              assert.equal(synthesisCalls().length, 2, 'retry adds only one synthesis request');
              assert.equal(sourceCalls(a).length, 1);
              assert.equal(sourceCalls(b).length, 2);
              assert.equal(calls.length, 5, 'two initial sources, one slot retry and two synthesis attempts');
              assert.doesNotMatch(JSON.stringify(synthesisCalls()[1].body), /SYNTHESIS_PARTIAL/, 'failed synthesis is never passed back as a source answer');
              await verifyFirst();
              await verifySecond();
            }
          }
          const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          assert.equal(horizontalOverflow, false, 'comparison recovery fits the phone and desktop viewport');
          assert.deepEqual(errors, []);
          console.log(`PASS comparison recovery ${engine.name()} ${width}px ${mode}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
