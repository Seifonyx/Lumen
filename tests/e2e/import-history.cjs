// 2.0: chat history from ChatGPT (a .zip export), Claude (conversations.json) and Gemini (My Activity, JSON or
// HTML) comes in as Lumen chats, tagged with where it came from. Importing again updates instead of duplicating.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const JSZip = require('jszip');
const { profile } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const t0 = 1760000000;

// ChatGPT keeps branches: the edited question (u1b) is the one you ended on.
const chatgpt = [{
  title: 'Trip to Rome', create_time: t0, update_time: t0 + 60, conversation_id: 'cg1', current_node: 'a2',
  mapping: {
    root: { id: 'root', message: null, parent: null, children: ['sys'] },
    sys: { id: 'sys', message: { id: 'sys', author: { role: 'system' }, content: { content_type: 'text', parts: [''] }, metadata: { is_visually_hidden_from_conversation: true } }, parent: 'root', children: ['u1', 'u1b'] },
    u1: { id: 'u1', message: { id: 'u1', author: { role: 'user' }, create_time: t0, content: { content_type: 'text', parts: ['Old question'] } }, parent: 'sys', children: [] },
    u1b: { id: 'u1b', message: { id: 'u1b', author: { role: 'user' }, create_time: t0 + 1, content: { content_type: 'text', parts: ['What should I see in Rome?'] } }, parent: 'sys', children: ['tool'] },
    tool: { id: 'tool', message: { id: 'tool', author: { role: 'assistant' }, recipient: 'browser', content: { content_type: 'code', text: 'search("rome")' } }, parent: 'u1b', children: ['a1'] },
    a1: { id: 'a1', message: { id: 'a1', author: { role: 'assistant' }, create_time: t0 + 2, content: { content_type: 'text', parts: ['The Colosseum.'] } }, parent: 'tool', children: ['a2'] },
    a2: { id: 'a2', message: { id: 'a2', author: { role: 'assistant' }, create_time: t0 + 3, content: { content_type: 'text', parts: ['And the Pantheon.'] } }, parent: 'a1', children: [] },
  },
}];
const claude = [{ uuid: 'cl1', name: 'Poem help', created_at: '2025-05-01T10:00:00Z', updated_at: '2025-05-01T10:05:00Z', chat_messages: [
  { uuid: 'm1', sender: 'human', text: 'Write a haiku about tea', created_at: '2025-05-01T10:00:00Z', attachments: [{ file_name: 'notes.txt' }] },
  { uuid: 'm2', sender: 'assistant', text: '', content: [{ type: 'text', text: 'Steam curls from the cup' }], created_at: '2025-05-01T10:00:05Z' },
] }];
const gemini = [
  { header: 'Gemini Apps', title: 'Prompted Plan a garden', time: '2025-06-01T09:00:00Z', safeHtmlItem: [{ html: '<p>Start with <b>herbs</b>.</p><ul><li>Basil</li><li>Mint</li></ul>' }] },
  { header: 'Gemini Apps', title: 'Prompted Which soil?', time: '2025-06-01T09:10:00Z', safeHtmlItem: [{ html: '<p>Loamy soil.</p>' }] },
  { header: 'Gemini Apps', title: 'Prompted Unrelated question', time: '2025-06-03T12:00:00Z', safeHtmlItem: [{ html: '<p>Answer.</p>' }] },
  { header: 'Gemini Apps', title: 'Used Gemini Apps', time: '2025-06-03T12:01:00Z' },
];
const geminiHtml = `<html><body><div class="outer-cell"><div class="content-cell">Prompted&nbsp;How tall is Everest?<br>Jun 5, 2025, 3:04:05 PM UTC<br><p>About 8,849 m.</p></div></div></body></html>`;

(async () => {
  const zip = new JSZip();
  zip.file('conversations.json', JSON.stringify(chatgpt));
  zip.file('chat.html', '<html></html>');
  const files = {
    chatgpt: { name: 'chatgpt-export.zip', mimeType: 'application/zip', buffer: await zip.generateAsync({ type: 'nodebuffer' }) },
    claude: { name: 'conversations.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(claude)) },
    gemini: { name: 'MyActivity.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(gemini)) },
    geminiHtml: { name: 'MyActivity.html', mimeType: 'text/html', buffer: Buffer.from(geminiHtml) },
    junk: { name: 'random.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') },
  };
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, serviceWorkers: 'block' });
    await profile(ctx, 'import-history', 'light');
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('.app:not(.app-skeleton) .composer textarea');
    await page.click('.sidebar-foot, .cv-account');
    await page.locator('.settings-tabs').getByRole('button', { name: 'Privacy & data', exact: true }).click();
    const row = page.locator('.settings-page:not(.exit-ghost) .import-row');
    const load = async (f, expect) => {
      await row.locator('input[type=file]').setInputFiles(f);
      await row.locator('.import-found').waitFor();
      assert.match(await row.locator('.import-found').textContent(), expect);
      await row.getByRole('button', { name: 'Import all' }).click();
      await row.locator('.import-found').waitFor({ state: 'detached' });
    };
    await load(files.chatgpt, /Found 1 ChatGPT chat \(2 messages\)/);
    await load(files.claude, /Found 1 Claude chat \(2 messages\)/);
    await load(files.gemini, /Found 2 Gemini chats \(6 messages\)/);
    await load(files.geminiHtml, /Found 1 Gemini chat \(2 messages\)/);
    console.log('PASS ChatGPT, Claude and Gemini exports are recognised');

    const stored = async () => page.evaluate(() => new Promise((res) => { const r = indexedDB.open('model-router-account-preview-import-history'); r.onsuccess = () => { const q = r.result.transaction('chats').objectStore('chats').getAll(); q.onsuccess = () => res(q.result); }; }));
    let all = await stored();
    const byId = Object.fromEntries(all.map((c) => [c.id, c]));
    const cg = byId['import-chatgpt-cg1'];
    assert.equal(cg.title, 'Trip to Rome');
    assert.deepEqual(cg.messages.map((m) => [m.role, m.text]), [['user', 'What should I see in Rome?'], ['assistant', 'The Colosseum.\n\nAnd the Pantheon.']], 'follows the branch you ended on, without tool steps');
    assert.deepEqual(cg.tags, ['ChatGPT']);
    assert.equal(cg.createdAt, t0 * 1000);
    const cl = byId['import-claude-cl1'];
    assert.equal(cl.messages[0].text, '[Attached: notes.txt]\nWrite a haiku about tea');
    assert.equal(cl.messages[1].text, 'Steam curls from the cup');
    const gem = all.filter((c) => c.tags?.includes('Gemini')).sort((a, b) => a.createdAt - b.createdAt);
    assert.equal(gem.length, 3);
    assert.equal(gem[0].messages.length, 4, 'prompts close together become one chat');
    assert.equal(gem[0].title, 'Plan a garden');
    assert.match(gem[0].messages[1].text, /Start with herbs\.\s*\n- Basil\n- Mint/);
    assert.equal(gem[2].messages[1].text, 'About 8,849 m.');
    console.log('PASS imported chats keep their messages, order, dates and source');

    // Again: updated, not duplicated. And a file that isn't an export is refused.
    await load(files.chatgpt, /Found 1 ChatGPT chat/);
    all = await stored();
    assert.equal(all.filter((c) => c.id === 'import-chatgpt-cg1').length, 1);
    assert.equal(all.length, 5);
    await row.locator('input[type=file]').setInputFiles(files.junk);
    await page.locator('.toast-error', { hasText: "couldn't read that file" }).waitFor();
    console.log('PASS importing again updates; other files are refused');

    // The imported chat opens like any other.
    await page.click('.settings-page [aria-label="Close"]');
    await page.click('.chat-row:has-text("Trip to Rome") .chat-open');
    await page.locator('.msg.assistant:has-text("And the Pantheon.")').waitFor();
    console.log('PASS an imported chat opens and reads normally');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
