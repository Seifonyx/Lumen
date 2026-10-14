// Projects, tags/branching, Ctrl+K palette, and side-by-side model comparison.
const { chromium } = require('playwright');
let failures = 0;
const check = (c, l) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${l}`); if (!c) failures++; };
const sse = (o) => `data: ${JSON.stringify(o)}\n\n`;

(async () => {
  await fetch('http://127.0.0.1:8080/emulator/v1/projects/the-model-router/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/the-model-router/accounts', { method: 'DELETE' });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const requests = [];
  await ctx.route('**/generativelanguage.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/models?')) return route.fulfill({ json: { models: [
      { name: 'models/gemini-flash-latest', displayName: 'Gemini Flash Latest', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent'] },
    ] } });
    const model = decodeURIComponent(/models\/([^:]+):/.exec(url)?.[1] || 'unknown');
    const body = route.request().postDataJSON();
    if (url.includes(':generateContent')) return route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'Roadmap Test' }] } }] } });
    requests.push({ model, body });
    return route.fulfill({ headers: { 'content-type': 'text/event-stream' }, body: sse({ candidates: [{ content: { parts: [{ text: `Answer from ${model}` }] }, finishReason: 'STOP' }] }) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5190/?emulator');
  await page.waitForFunction(() => typeof window.__testSignIn === 'function');
  await page.evaluate(() => window.__testSignIn('hebaghoneim8@gmail.com'));
  await page.waitForSelector('input[placeholder="AIza…"]');
  await page.fill('input[placeholder="AIza…"]', 'g');
  await page.click('text=Save keys');
  await page.waitForTimeout(1200);

  await page.click('.settings-tabs >> text=Models');
  await page.locator('.models-nav button').filter({ hasText: 'Browse models' }).click();
  for (const label of ['Gemini Flash Latest', 'Gemini 2.5 Pro']) {
    await page.getByLabel('Search available models').fill(label);
    const add = page.locator('.model-list.add .model-row', { hasText: label }).locator('button').first();
    if (await add.count()) await add.click();
  }
  await page.click('.settings-page [aria-label="Close"]');
  await page.waitForSelector('.topbar');

  await page.getByRole('button', { name: 'New project', exact: true }).first().click();
  await page.fill('input[aria-label="Project name"]', 'Hospital reports');
  await page.fill('.project-edit-form textarea', 'Use the project reference as the source for reports.');
  await page.locator('.project-edit-form input[type="file"]').setInputFiles({ name: 'protocol.txt', mimeType: 'text/plain', buffer: Buffer.from('PROJECT_REFERENCE_MARKER: check oxygen trends') });
  await page.waitForSelector('.project-file');
  await page.getByRole('button',{name:'Create project',exact:true}).click();
  check(await page.locator('.sidebar-project-item[aria-current="page"]').textContent().then(t=>t.includes('Hospital reports')), 'new project is selected');
  await page.locator('.sidebar .new-chat').click();
  await page.fill('.composer textarea', 'Summarize the project protocol.');
  await page.click('.send-btn');
  await page.waitForSelector('.msg.assistant .model-tag', { timeout: 20000 });
  check(requests.length === 1 && JSON.stringify(requests[0].body).includes('PROJECT_REFERENCE_MARKER'), 'project reference text is sent with the chat');

  await page.click('.msg.user [aria-label="Branch from this message"]');
  check(await page.locator('.chat-row.active .chat-title').textContent().then((t) => t.includes('(branch)')), 'branch starts at the selected message and preserves the original chat');
  await page.click('.chat-row.active [aria-label="Chat options"]');
  await page.click('[role="menuitem"] >> text=Edit tags');
  await page.fill('.chat-tag-editor input', 'urgent, ICU');
  await page.click('.chat-tag-editor button');
  check((await page.locator('.chat-row.active .chat-tag-count').getAttribute('title')) === 'urgent, ICU', 'chat tags are saved and searchable');

  await page.keyboard.press('Control+k');
  await page.fill('.command-search input', 'Hospital reports');
  check(await page.locator('.command-item').count() > 0, 'Ctrl+K opens commands and finds the project');
  await page.keyboard.press('Escape');

  await page.fill('.composer textarea', 'Compare the two models.');
  await page.getByRole('button',{name:/^Add (?:photos, )?files or a repository$/}).click();await page.getByRole('button',{name:'Compare models',exact:true}).click();
  check(await page.locator('.compare-model-row').count() >= 2, 'model comparison offers enabled models');
  await page.click('.compare-picker-actions >> text=Compare');
  await page.waitForSelector('.comparison-card', { timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('.comparison-card').length >= 2 && [...document.querySelectorAll('.comparison-card')].every((x) => x.textContent.includes('Answer from')));
  check(requests.length === 3, 'comparison spends one request per selected model');
  check(await page.locator('.comparison-save').count() === 2, 'both model answers can be continued in the chat');
  await page.locator('.comparison-save').first().click();
  check(await page.locator('.msg.assistant').count() >= 1, 'selected comparison answer is added to the chat');
  check(!errors.length, `no browser errors ${errors.join(' | ')}`);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
