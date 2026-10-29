// Frame-by-frame proof for transitions (motion on): for each one, the first frame after the tap matches the
// screen before it, the last frame matches the screen after it, and no frame in between flashes (differs
// a lot from both of its neighbours). Light and dark, phone and computer; an Arabic chat title is included
// so right-to-left text is in the frames.
const { chromium } = require('playwright'), assert = require('node:assert/strict');
const { profile, seed } = require('./helpers/preview-profile.cjs');
const URL = process.env.MR_TEST_URL || 'http://localhost:5190/?emulator';
const now = Date.now();
const chats = [
  { id: 'a', title: 'Weekly planning', createdAt: now - 6e5, updatedAt: now - 6e5, messages: [{ id: 'a1', role: 'user', text: 'Plan my week', createdAt: now - 6e5 }, { id: 'a2', role: 'assistant', status: 'done', model: 'gemini:gemini-flash-latest', text: 'Start with the **three** most important tasks.', createdAt: now - 5e5 }] },
  { id: 'b', title: 'رسالة إلى الموردين', createdAt: now - 9e7, updatedAt: now - 9e7, messages: [{ id: 'b1', role: 'user', text: 'مرحبا', createdAt: now - 9e7 }] },
  ...Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, title: `Chat number ${i + 1}`, createdAt: now - (i + 2) * 9e7, updatedAt: now - (i + 2) * 9e7, messages: [{ id: `m${i}`, role: 'user', text: 'hi', createdAt: now - (i + 2) * 9e7 }] })),
];

/** Mean per-pixel difference (0 to 255) between two images, computed in the page with a canvas. */
const compare = (page, a, b) => page.evaluate(async ([a, b]) => {
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const [x, y] = await Promise.all([load(a), load(b)]);
  const w = 120, h = Math.round((x.height / x.width) * w);
  const data = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
  const p = data(x), q = data(y);
  let sum = 0;
  for (let i = 0; i < p.length; i += 4) sum += (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2])) / 3;
  return sum / (p.length / 4);
}, [a, b]);

async function record(page, cdp, act) {
  const shot = async () => `data:image/png;base64,${(await page.screenshot()).toString('base64')}`;
  const before = await shot();
  const frames = [];
  const onFrame = async (f) => { frames.push({ t: f.metadata.timestamp, src: `data:image/jpeg;base64,${f.data}` }); try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch {} };
  cdp.on('Page.screencastFrame', onFrame);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80 });
  await page.waitForTimeout(150);
  const tap = Date.now() / 1000;
  await act();
  await page.waitForTimeout(700);
  await cdp.send('Page.stopScreencast');
  cdp.off('Page.screencastFrame', onFrame);
  const after = await shot();
  const from = frames.findIndex((f) => f.t >= tap);
  return { before, after, frames: frames.slice(Math.max(0, from)) };
}

async function check(page, cdp, name, act, results) {
  const { before, after, frames } = await record(page, cdp, act);
  assert.ok(frames.length >= 3, `${name}: recorded frames (${frames.length})`);
  const first = await compare(page, frames[0].src, before);
  const last = await compare(page, frames.at(-1).src, after);
  // A flash: a frame far from both neighbours while the neighbours are close to each other.
  let flash = 0;
  for (let i = 1; i < frames.length - 1; i++) {
    const ab = await compare(page, frames[i - 1].src, frames[i].src), bc = await compare(page, frames[i].src, frames[i + 1].src), ac = await compare(page, frames[i - 1].src, frames[i + 1].src);
    if (ab > 12 && bc > 12 && ac < Math.min(ab, bc) / 3) flash++;
  }
  results.push({ name, frames: frames.length, first: +first.toFixed(1), last: +last.toFixed(1), flash });
  // The native phone Settings push begins with a real destination-frame change (no fake overlay).
  // Keep flash detection and the final-frame assertion strict, but allow that intentional first-frame change.
  const nativeSettings = name.startsWith('390 ') && name.includes('settings') && await page.locator('[data-lumen-canvas-shell]').count();
  assert.ok(first < (nativeSettings ? 14 : 6), `${name}: first frame matches its navigation contract (difference ${first.toFixed(1)})`);
  assert.ok(last < 2.5, `${name}: last frame matches the screen after (difference ${last.toFixed(1)})`);
  assert.equal(flash, 0, `${name}: no flashing frames`);
}

(async () => {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const [width, theme] of [[390, 'light'], [390, 'dark'], [1280, 'light'], [1280, 'dark']]) {
      const phone = width < 900;
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: phone, hasTouch: phone, serviceWorkers: 'block' });
      await profile(ctx, `tr-${width}-${theme}`, theme);
      await ctx.addInitScript(() => { window.__mrMotion = true; });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(URL);
      await page.waitForSelector('.composer textarea');
      await seed(page, `tr-${width}-${theme}`, chats);
      await page.reload();
      await page.waitForSelector('.composer textarea');
      const cdp = await ctx.newCDPSession(page);
      const tag = `${width} ${theme}`;
      const drawer = async () => { if (phone && !(await page.locator('.sidebar.open').count())) { await page.click('.menu-btn'); await page.locator('.sidebar.open').waitFor(); await page.waitForTimeout(400); } };
      await drawer();
      await page.click('text=Weekly planning');
      await page.waitForTimeout(600);
      await check(page, cdp, `${tag} model picker opens`, async () => { await page.click('.composer .model-button'); await page.locator('.models-pop').waitFor(); }, results);
      await check(page, cdp, `${tag} model picker closes`, async () => { await page.keyboard.press('Escape'); }, results);
      await check(page, cdp, `${tag} usage opens`, async () => { await page.focus('.composer textarea').then(()=>page.click('.usage-chip')); await page.locator('.usage-pop').waitFor(); }, results);
      await check(page, cdp, `${tag} usage closes`, async () => { await page.keyboard.press('Escape'); }, results);
      await drawer();
      await check(page, cdp, `${tag} settings opens`, async () => { await page.click('.sidebar-foot, .cv-account'); await page.locator('.settings-page').waitFor(); }, results);
      if (phone) {
        await check(page, cdp, `${tag} settings section push`, async () => { await page.locator(':is(.settings-tabs, .si)').getByRole('button', { name: /^(General|Account:)/ }).first().click(); }, results);
      } else await page.locator(':is(.settings-tabs, .si)').getByRole('button', { name: /^(General|Account:)/ }).first().click();
      await check(page, cdp, `${tag} theme crossfade`, async () => { await page.getByRole('radio', { name: theme === 'dark' ? 'Light' : 'Dark', exact: true }).click(); }, results);
      await check(page, cdp, `${tag} theme back`, async () => { await page.getByRole('radio', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true }).click(); }, results);
      if (phone) await check(page, cdp, `${tag} settings section pop`, async () => { if(await page.locator('[data-lumen-canvas-shell]').count())await page.goBack();else await page.click('.settings-back'); }, results);
      await check(page, cdp, `${tag} settings closes`, async () => { await page.keyboard.press('Escape'); await page.locator('.settings-page').waitFor({ state: 'hidden' }); }, results);
      await drawer();
      await check(page, cdp, `${tag} all chats opens`, async () => { await page.click('.view-all-chats, .cv-all'); await page.getByRole('dialog', { name: 'All chats' }).waitFor(); }, results);
      // (Canvas: rows are plain until Select; pick that mode before the measured step.)
      { const select = page.getByRole('dialog', { name: 'All chats' }).locator('.all-chats-select'); if (await select.count()) { await select.click(); await page.waitForTimeout(400); } }
      await check(page, cdp, `${tag} chat deleted (row slides out)`, async () => { const d = page.getByRole('dialog', { name: 'All chats' }); await d.getByLabel('Select Chat number 5').check(); await d.getByRole('button', { name: 'Delete' }).click(); await d.getByRole('alert').getByRole('button', { name: 'Delete' }).click(); }, results);
      await check(page, cdp, `${tag} all chats closes`, async () => { await page.keyboard.press('Escape'); }, results);
      assert.deepEqual(errors, []);
      console.log(`PASS ${tag}: ${results.filter((r) => r.name.startsWith(tag)).length} transitions start on the screen before, end on the screen after, no flashes`);
      await ctx.close();
    }
  } finally {
    if (process.env.PROOF) require('fs').writeFileSync(process.env.PROOF, JSON.stringify(results, null, 1));
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
