// Real composer -> routing -> provider requests, with isolated accounts and mocked providers.
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const url = process.env.MR_TEST_URL || 'http://localhost:5190/';
const coder = 'openrouter:qwen/qwen3-coder:free';
const lite = 'gemini:gemini-2.5-flash-lite';
const pro = 'gemini:gemini-2.5-pro';
const wideText = 'ع'.repeat(112000);
const geminiReply = text => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n';
const cors = {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
const fulfill = (route, response) => route.fulfill({...response,headers:{...cors,...response.headers}});

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    for (const width of [390, 1280]) for (const mode of ['prose', 'new-task', 'search', 'search-fallback', 'quota-fallback', 'layout-quota-fallback', 'offline', 'project', 'summary']) {
      if (process.env.AUTO_CASE && process.env.AUTO_CASE !== mode) continue;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 900, hasTouch: width < 900, serviceWorkers: 'block' });
      const uid = `preview-intelligence-${width}-${mode}`, requests = [], errors = [];
      const unicode = ['project', 'summary'].includes(mode);
      const quotaCase = mode.includes('quota-fallback');
      const search = ['search', 'search-fallback', 'offline'].includes(mode) || quotaCase;
      const enabledModels = unicode ? [lite, pro] : mode.endsWith('fallback') ? [coder, pro, lite] : search ? [coder, lite] : [coder, pro];
      await profile(context, uid, 'dark', {
        enabledModels, defaultModel: unicode ? lite : 'auto', autoSwitch: !unicode, webSearch: search,
        ...(mode === 'layout-quota-fallback' ? {layouts:[{id:'quota-layout',name:'Quota layout',icon:'code',mode:'order',models:[pro,lite]}]} : {}),
        ...(mode === 'project' ? { projects: [{ id: 'source', name: 'Source', createdAt: 1, files: [{ id: 'f', kind: 'text', name: 'arabic.txt', mime: 'text/plain', size: 224000, text: wideText }] }] } : {}),
      });
      await context.addInitScript(({uid}) => {
        const key = `mr.account.${uid}`, account = JSON.parse(localStorage.getItem(key));
        localStorage.setItem(key, JSON.stringify({ ...account, openrouterKey: 'fixture' }));
        // This suite measures chat requests; the weekly availability probe has its own suite.
        localStorage.setItem('mr.modelCheck.background', JSON.stringify(Date.now()));
      }, {uid});
      await context.route('**/openrouter.ai/**', async route => {
        if (route.request().method() === 'OPTIONS') return fulfill(route, {status:204});
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/key')) return fulfill(route, { json: { data: { is_free_tier: true } } });
        if (path.endsWith('/models')) return fulfill(route, { json: { data: [{ id: coder.slice('openrouter:'.length), name: 'Qwen Coder', context_length: 262144, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] } }] } });
        requests.push({ model: coder, body: route.request().postDataJSON() });
        return fulfill(route, { contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: `INTELLIGENCE_REPLY_${requests.length}` } }] }) + '\n\ndata: [DONE]\n\n' });
      });
      await context.route('**/generativelanguage.googleapis.com/**', async route => {
        if (route.request().method() === 'OPTIONS') return fulfill(route, {status:204});
        if (route.request().url().includes('/models?')) return fulfill(route, { json: { models: [
          { name: 'models/gemini-2.5-flash-lite', displayName: 'Flash Lite', inputTokenLimit: 64000, supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-pro', displayName: 'Pro', inputTokenLimit: 128000, supportedGenerationMethods: ['generateContent'] },
        ] } });
        const name = /models\/([^:]+):/.exec(route.request().url())[1];
        requests.push({ model: `gemini:${name}`, body: route.request().postDataJSON() });
        if (mode === 'search-fallback' && requests.length === 1) return fulfill(route, {status:503,json:{error:{code:503,message:'Temporarily unavailable'}}});
        if (quotaCase && name === lite.slice('gemini:'.length)) return fulfill(route, {status:429,json:{error:{code:429,message:'Daily quota exhausted'}}});
        if (quotaCase && requests.length >= 3) return fulfill(route, {status:503,json:{error:{code:503,message:'Temporarily unavailable'}}});
        return fulfill(route, { contentType: 'text/event-stream', body: geminiReply(`INTELLIGENCE_REPLY_${requests.length}`) });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL('/privacy.html', url).href);
      const previous = ['new-task', 'search', 'search-fallback', 'offline'].includes(mode) || quotaCase;
      await seed(page, uid, [{ id: 'task', title: 'Decision test', model: unicode || quotaCase ? lite : 'auto', createdAt: 1, updatedAt: 2,
        ...(mode === 'project' ? { projectId: 'source' } : {}),
        ...(mode === 'summary' ? { summary: { text: wideText, upTo: null, count: 10, saved: 0, createdAt: 1 } } : {}),
        messages: [{ id: 'old', role: 'user', text: previous ? 'Fix the Python API bug' : 'Ready', createdAt: 1 }, { id: 'answer', role: 'assistant', text: previous ? 'The code is fixed.' : 'Ready for your request.', status: 'done', model: previous ? coder : lite, createdAt: 2 }],
      }]);
      await page.goto(url);
      await page.locator('.composer textarea').waitFor();
      if (width < 900) await page.locator('.menu-btn').click();
      await page.locator('.chat-open').filter({hasText:'Decision test'}).click();
      const prompt = mode === 'prose' ? 'Write an email about a Python bug' : mode === 'new-task' ? 'Yes, write a birthday poem instead' : search && mode !== 'offline' ? 'Fix this Python bug using current documentation' : mode === 'offline' ? 'Research supplied papers, do not use web search' : 'Summarize the provided text';
      await page.locator('.composer textarea').fill(prompt);
      await page.locator('.send-btn').click();
      await page.getByText(`INTELLIGENCE_REPLY_${mode.endsWith('fallback') ? 2 : 1}`, {exact:true}).waitFor().catch(async error => {
        console.error({width,mode,models:requests.map(r=>r.model),errors:await page.locator('.error-msg, .reply-wait').allTextContents()});
        throw error;
      });
      await page.getByRole('button', {name:'Stop',exact:true}).waitFor({state:'detached'});
      assert.equal(requests.length, mode.endsWith('fallback') ? 2 : 1, 'Requests are bounded to the necessary attempts');
      if (quotaCase) {
        assert.deepEqual(requests.map(r => r.model), [lite, pro]);
        await page.locator('.model-button').click();
        if (mode === 'layout-quota-fallback') await page.locator('.models-pop .mp-title').filter({hasText:'Quota layout'}).click();
        else await page.locator('.models-pop .mp-auto').click();
        await page.locator('.composer textarea').fill('Fix this Python bug using current documentation');
        await page.locator('.send-btn').click();
        await page.locator('.msg.assistant .markdown').filter({hasText:/INTELLIGENCE_REPLY_[45]/}).last().waitFor();
        assert.deepEqual(requests.map(r => r.model), [lite, pro, pro, coder], 'Known daily blocks survive search failover and the working text backup answers');
        assert.ok((await page.locator('.notice').allTextContents()).some(text => /did not search/i.test(text)), 'Degraded search is visible');
      } else if (mode === 'search-fallback') {
        assert.deepEqual(requests.map(r => r.model), [pro, lite], 'Another searchable model precedes a non-search provider');
        assert.ok(requests[1].body.tools?.some(t => 'google_search' in t), 'Fallback retains search');
      } else if (mode !== 'offline') assert.equal(requests[0].model, unicode || !search ? pro : lite, mode);
      if (mode.startsWith('search')) assert.ok(requests[0].body.tools?.some(t => 'google_search' in t), 'Search preference reaches the provider');
      if (mode === 'offline') assert.ok(!requests[0].body.tools?.some(t => 'google_search' in t), 'Explicit offline work disables search');
      if (unicode) {
        assert.ok(JSON.stringify(requests[0].body).includes(wideText), 'All source text reaches the model without truncation');
        await page.locator('.composer textarea').fill('Continue with the same source');
        await page.locator('.send-btn').click();
        await page.getByText('INTELLIGENCE_REPLY_2', {exact:true}).waitFor();
        assert.equal(requests[1].model, pro, 'Subsequent messages keep working with fallback switching disabled');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS Auto intelligence ${process.env.MR_WEBKIT ? 'webkit' : 'chromium'} ${width}px ${mode}`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
