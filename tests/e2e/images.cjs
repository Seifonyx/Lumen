// Create image: + menu → Create image → the reply is the picture (Hugging Face or Cloudflare via the relay).
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile } = require('./helpers/preview-profile.cjs');
// A tiny valid PNG (2x2) stands in for the generated image.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function open(browser, uid, connect) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, serviceWorkers: 'block', reducedMotion: 'reduce', acceptDownloads: true });
  await profile(ctx, uid, 'light');
  if (connect) await ctx.addInitScript(({ uid, connect }) => {
    const key = `mr.account.${uid}`, a = JSON.parse(localStorage.getItem(key) || '{}');
    a.providerConnections = { ...connect, providerAccess: Object.fromEntries(Object.keys(connect).filter((k) => k !== 'cloudflareAccountId').map((k) => [k, true])) };
    localStorage.setItem(key, JSON.stringify(a));
  }, { uid, connect });
  const calls = [];
  await ctx.route('**/router.huggingface.co/**', (r) => {
    if (r.request().url().includes('/hf-inference/')) { calls.push({ provider: 'hf', body: r.request().postData() }); return r.fulfill({ contentType: 'image/png', body: PNG }); }
    return r.fulfill({ json: { data: [] } });
  });
  await ctx.route('**/cloudflare/**', (r) => {
    if (r.request().url().endsWith('/cloudflare/image')) { calls.push({ provider: 'cf', body: r.request().postData(), account: r.request().headers()['x-mr-account-id'] }); return r.fulfill({ json: { result: { image: PNG.toString('base64') }, success: true } }); }
    return r.fulfill({ json: { result: [], success: true } });
  });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => { if (!e.message.includes('firestore')) errors.push(e.message); });
  await page.goto(process.env.MR_TEST_URL || 'http://localhost:5190/?emulator');
  await page.locator('.composer textarea').waitFor();
  const create = async (prompt) => {
    await page.getByRole('button', { name: /^Add (?:photos, )?files or a repository$/ }).click();
    await page.getByRole('button', { name: 'Create image', exact: true }).click();
    await page.locator('.image-chip').waitFor();
    await page.fill('.composer textarea', prompt);
    await page.click('.send-btn');
  };
  return { ctx, page, errors, calls, create };
}

(async () => {
  const browser = await chromium.launch();
  try {
    // No image provider: a clear message instead of a picture.
    const none = await open(browser, 'preview-images-none');
    await none.create('a lime star');
    await none.page.getByText('connect Cloudflare Workers AI or Hugging Face', { exact: false }).waitFor();
    assert.equal(none.calls.length, 0);
    assert.deepEqual(none.errors, []);
    await none.ctx.close();

    // Hugging Face.
    const hf = await open(browser, 'preview-images-hf', { huggingface: 'hf_fixture' });
    await hf.create('A lime star over a hospital at night');
    const figure = hf.page.locator('.generated-image');
    await figure.locator('img').waitFor();
    assert.equal(hf.calls[0].provider, 'hf');
    assert.match(hf.calls[0].body, /A lime star over a hospital at night/);
    assert.ok(await figure.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0), 'image shows');
    await figure.getByText('FLUX.1 schnell · Hugging Face').waitFor();
    const [download] = await Promise.all([hf.page.waitForEvent('download'), figure.getByRole('button', { name: 'Download' }).click()]);
    assert.match(download.suggestedFilename(), /\.jpg$/);
    await figure.getByRole('button', { name: 'Make another' }).click();
    await hf.page.locator('.generated-image').nth(1).locator('img').waitFor();
    assert.equal(hf.calls.length, 2);
    assert.deepEqual(hf.errors, []);
    await hf.ctx.close();

    // Cloudflare (preferred when both are connected) goes through the relay with the account ID.
    const cf = await open(browser, 'preview-images-cf', { cloudflare: 'cf_fixture', cloudflareAccountId: 'a'.repeat(32), huggingface: 'hf_fixture' });
    await cf.create('A calm ward corridor');
    await cf.page.locator('.generated-image img').waitFor();
    assert.equal(cf.calls[0].provider, 'cf');
    assert.equal(cf.calls[0].account, 'a'.repeat(32));
    assert.deepEqual(cf.errors, []);
    await cf.ctx.close();
    console.log('PASS create image: none connected, Hugging Face, Cloudflare via relay, download, make another');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
