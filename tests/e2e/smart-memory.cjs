// 2.0: "About me" in your own words goes to every model; facts a model keeps "for this project" stay in that
const { openChat } = require('./helpers/open-chat.cjs');
// project's chats; you can move a memory between a project and every chat.
const { chromium, webkit } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/';
const now = Date.now();
const projects = [{ id: 'alpha', name: 'Alpha', instructions: '', createdAt: now, updatedAt: now }];
const chats = [
  { id: 'inproj', title: 'Alpha planning', projectId: 'alpha', createdAt: now, updatedAt: now, model: 'gemini:gemini-flash-latest', messages: [{ id: 'p1', role: 'user', text: 'hi', createdAt: now }, { id: 'p2', role: 'assistant', status: 'done', text: 'Hello', createdAt: now }] },
  { id: 'plain', title: 'Plain chat', createdAt: now - 1e5, updatedAt: now - 1e5, model: 'gemini:gemini-flash-latest', messages: [{ id: 'q1', role: 'user', text: 'hi', createdAt: now }, { id: 'q2', role: 'assistant', status: 'done', text: 'Hello', createdAt: now }] },
];
const sse = (text) => 'data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] }) + '\n\n';

(async () => {
  const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'preview-smart-memory', 'light', { memory: true, memoryAuto: true, projects });
    const bodies = [];
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
      if (r.request().url().includes('/models?')) return r.fulfill({ json: { models: [{ name: 'models/gemini-flash-latest', displayName: 'Gemini Flash', inputTokenLimit: 128000, supportedGenerationMethods: ['generateContent'] }] } });
      const body = r.request().postData() || '';
      if (r.request().url().includes(':generateContent')) return r.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'I like sailing and I keep notes in Markdown. I prefer short, direct answers.' }] } }] } });
      bodies.push(body);
      return r.fulfill({ contentType: 'text/event-stream', body: sse(body.includes('Alpha planning') || bodies.length === 1 ? 'Noted.\n[[remember for project: Alpha ships every Friday]]\n[[remember: Likes sailing]]' : 'Sure.') });
    });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await seed(page, 'preview-smart-memory', chats);
    await page.reload();
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');

    // ---- About me, saved.
    await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: 'Memory', exact: true }).click();
    const settingsPage = page.locator('.settings-page:not(.exit-ghost)');
    await settingsPage.getByLabel('About me').fill('I build wooden boats.');
    await settingsPage.getByRole('button', { name: 'Save', exact: true }).click();
    await page.click('.settings-page [aria-label="Close"]');

    // ---- In a project chat: About me is sent; the project fact is kept for the project.
    await openChat(page, 'Alpha planning');
    await page.fill('.composer textarea', 'We ship on Fridays. I like sailing.');
    await page.click('.send-btn');
    await page.locator('.msg.assistant:has-text("Noted.")').waitFor();
    assert.match(bodies[0], /I build wooden boats\./, 'About me goes to the model');
    assert.match(bodies[0], /remember for project/, 'in a project, the model is told how to keep project facts');
    console.log('PASS About me is sent, and project chats can keep project facts');

    // ---- In another chat: the general fact is there, the project fact isn't.
    await page.click('.chat-row:has-text("Plain chat") .chat-open');
    await page.fill('.composer textarea', 'Anything?');
    await page.click('.send-btn');
    await page.locator('.msg.assistant:has-text("Sure.")').waitFor();
    const plain = bodies.at(-1);
    assert.match(plain, /Likes sailing/);
    assert.doesNotMatch(plain, /Alpha ships every Friday/, 'project memories stay in their project');
    assert.doesNotMatch(plain, /remember for project/);
    console.log('PASS other chats don’t see the project’s memories');

    // ---- Memory tab: the project label; move it to every chat; draft About me from memories.
    await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: 'Memory', exact: true }).click();
    const row = settingsPage.locator('.memory-row', { hasText: 'Alpha ships every Friday' });
    assert.match(await row.locator('.memory-project').textContent(), /Alpha/);
    await row.getByRole('button', { name: 'Edit' }).click();
    await settingsPage.locator('.memory-row.editing').getByLabel('Use this memory in').selectOption('');
    await settingsPage.locator('.memory-row.editing').getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(200);
    assert.equal(await settingsPage.locator('.memory-row', { hasText: 'Alpha ships every Friday' }).locator('.memory-project').count(), 0, 'moved to every chat');
    await settingsPage.getByRole('button', { name: 'Update from memories' }).click();
    await page.waitForFunction(() => document.querySelector('.about-me textarea')?.value.includes('sailing'));
    console.log('PASS memories can change scope, and About me can be drafted from them');

    // ---- Deleting a chat forgets the memories saved in it (1.8 bug: a deleted chat's language stuck around).
    await page.click('.settings-page [aria-label="Close"]');
    page.once('dialog', (d) => d.accept());
    const row2 = page.locator('.chat-row:has-text("Alpha planning")');
    await row2.hover();
    await row2.getByRole('button', { name: 'Chat options' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.locator('.toast', { hasText: 'Also forgot 2 memories saved in that chat.' }).waitFor();
    await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: 'Memory', exact: true }).click();
    await settingsPage.locator('.memory-tab').waitFor();
    assert.equal(await settingsPage.locator('.memory-row', { hasText: /Likes sailing|Alpha ships every Friday/ }).count(), 0, 'memories from the deleted chat are gone');
    console.log('PASS deleting a chat forgets what was saved in it');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
