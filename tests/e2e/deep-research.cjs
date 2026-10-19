// 2.0: Deep research plans several web searches, shows them as they run with the sites they read, then writes
// one report whose [n] citations link to numbered sources. The notes aren't kept; the searches are.
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/';
const sse = (text, chunks) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, ...(chunks ? { groundingMetadata: { groundingChunks: chunks.map(([title, uri]) => ({ web: { title, uri } })) } } : {}), finishReason: 'STOP' }] }) + '\n\n';

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'preview-deep-research', 'light');
    const seen = { plan: 0, search: [], report: '' };
    await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
      const url = r.request().url();
      if (url.includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash',inputTokenLimit:128000, supportedGenerationMethods: ['generateContent'] }] } });
      const body = r.request().postData() || '';
      if (url.includes(':generateContent')) {
        if (body.includes('planning web research')) { seen.plan++; return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: '["solar panel efficiency 2026", "perovskite cells cost", "solar recycling"]' }] } }] } }); }
        return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'A title' }] } }] } });
      }
      if (body.includes('Search the web for:')) {
        const q = /Search the web for: ([^\\]+?)\\n/.exec(body)?.[1] || '?';
        seen.search.push({ q, tools: /google_search/.test(body) });
        const n = seen.search.length;
        await new Promise((res) => setTimeout(res, 500));
        if(n===4)return r.fulfill({contentType:'text/event-stream',body:'data: '+JSON.stringify({candidates:[{content:{parts:[{text:'INCOMPLETE_UNVERIFIED_RESEARCH_NOTE'}]}}]})+'\n\n'});
        return r.fulfill({ contentType: 'text/event-stream', body: sse(`Notes about ${q}: fact ${n}.`, [[`Site ${n}`, `https://site${n}.example/page`], ['Shared', 'https://shared.example/']]) });
      }
      if (body.includes('Deep research. Web searches were run')) {
        seen.report = body;
        return r.fulfill({ contentType: 'text/event-stream', body: sse('## Summary\n\nPanels got better [1][2]. Costs fell [3].') });
      }
      return r.fulfill({ contentType: 'text/event-stream', body: sse('Plain reply.') });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');

    // ---- Turned on from the + menu; the composer says so.
    await page.getByRole('button',{name:/^Add (?:photos, )?files or a repository$/}).click();
    await page.getByRole('button', { name: 'Deep research' }).click();
    await page.locator('.research-chip').waitFor();
    assert.equal(await page.locator('.composer textarea').getAttribute('placeholder'), 'What should Lumen research?');
    await page.fill('.composer textarea', 'How is solar power changing?');
    await page.click('.send-btn');

    // ---- The searches show while they run.
    await page.locator('.research-card.live .research-step').first().waitFor();
    assert.equal(await page.locator('.research-step').count(), 3, 'one row per planned search');
    await page.locator('.research-step.done').first().waitFor();
    console.log('PASS deep research shows its planned searches as they run');

    // ---- The report: citations link to the numbered sources, which are listed at the end.
    await page.locator('.research-card[data-phase="done"]').waitFor({ timeout: 15000 });
    assert.equal(seen.plan, 1);
    assert.equal(seen.search.length, 3);
    assert.ok(seen.search.every((s) => s.tools), 'every search asks Google Search');
    assert.match(seen.report, /\[2\] Shared — https:\/\/shared\.example\/\\n\[3\] Site 2/, 'sources are numbered once across searches');
    const msg = page.locator('.msg.assistant').last();
    assert.equal(await msg.locator('a.cite[href="https://site1.example/page"]').first().textContent(), '1', 'citations are source badges');
    assert.ok(await msg.locator('h2:has-text("Sources")').count(), 'a Sources list follows the report');
    assert.equal(await msg.locator('ol li a').count(), 4);
    assert.match(await page.locator('.research-title').textContent(), /Researched 3 searches · 4 sources/);
    assert.equal(await page.locator('.research-step').count(), 0, 'folded once done');
    await page.click('.research-head');
    assert.equal(await page.locator('.research-step.done').count(), 3, 'opens again to show the searches');
    assert.equal(await page.locator('.research-chip').count(), 0, 'deep research turns off after sending');
    console.log('PASS the report cites numbered, linked sources');

    // ---- Kept after a reload, without the notes.
    await page.reload();
    await page.click('.chat-row .chat-open');
    await page.locator('.research-card[data-phase="done"]').waitFor();
    const stored = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('model-router-account-preview-deep-research'); r.onsuccess = () => { const tx = r.result.transaction('chats'); const q = tx.objectStore('chats').getAll(); q.onsuccess = () => res(q.result); }; }));
    const reply = stored[0].messages.find((m) => m.research);
    assert.equal(reply.research.steps.length, 3);
    assert.ok(reply.research.steps.every((s) => !s.notes), 'notes are not kept');
    console.log('PASS the research is kept with the chat (without the notes)');

    // ---- /research does the same.
    await page.locator('.sidebar').getByRole('button', { name: 'New chat', exact: true }).click();
    await page.fill('.composer textarea', '/research Wind power');
    await page.click('.send-btn');
    await page.locator('.msg.assistant .research-card[data-phase="done"]').waitFor({ timeout: 15000 });
    assert.equal(seen.plan, 2);
    await page.locator('.research-head').click();
    assert.equal(await page.locator('.research-step.failed').count(),1,'an interrupted search is failed even after partial notes');
    assert.doesNotMatch(seen.report,/INCOMPLETE_UNVERIFIED_RESEARCH_NOTE/,'failed partial notes are excluded from the final report');
    console.log('PASS /research starts deep research');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
