// Phase 4 Routing Center screenshots (not a test): node tests/e2e/helpers/rc-shots.cjs <outDir> [url]
// Actual Canvas UI on synthetic accounts with intercepted transport (no live provider, no inference). States:
//   connected — Google AI Studio key saved, enabled, catalog ready; Anthropic key saved, permission off; a recent Auto
//               answer with its recorded route.
//   empty     — no provider key saved.
//   failed    — the Google catalog refuses the key (401).
//   stale     — a ready catalog, then a check that fails (503): cached models remain.
//   dense     — 145 models with long names, and larger text (Lumen's largest text size and 125% page zoom).
// Screens: models, providers, detail (Google AI Studio) and detail-anthropic. Sizes: iPhone 320×568, 390×844, 430×932;
// laptop 1280×800, desktop 1440×900; Light and Dark; one CSS px per image px. SHOTS=<regex> filters file names;
// STATES=connected,empty,… limits states. Chromium with an emulated touch phone: not a physical-iPhone result.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { profile, seed } = require('./preview-profile.cjs');
const out = process.argv[2], base = (process.argv[3] || 'http://localhost:5197').replace(/\/$/, '');
const only = process.env.SHOTS ? new RegExp(process.env.SHOTS) : null;
const states = (process.env.STATES || 'connected,empty,failed,stale,dense').split(',');
fs.mkdirSync(out, { recursive: true });
const SIZES = [['320', 320, 568], ['390', 390, 844], ['430', 430, 932], ['1280', 1280, 800], ['1440', 1440, 900]];
const model = (name, label, ctx = 1048576) => ({ name: `models/${name}`, displayName: label, inputTokenLimit: ctx, supportedGenerationMethods: ['generateContent'] });
const MODELS = [model('gemini-flash-latest', 'Gemini Flash'), model('gemini-2.5-pro', 'Gemini 2.5 Pro', 2097152)];
const LONG = [...MODELS, ...Array.from({ length: 143 }, (_, i) => model(`gemini-research-preview-${i}`, `Gemini Research Preview ${i} — extended reasoning with long context`, 524288))];
const now = Date.now();
const CHATS = [
  { id: 'rc-a', title: 'Launch plan, three weeks', createdAt: now - 3600e3, updatedAt: now - 600e3, rev: now - 600e3, model: 'auto', messages: [
    { id: 'a1', role: 'user', text: 'Plan the launch.', createdAt: now - 700e3 },
    { id: 'a2', role: 'assistant', text: 'Here is a plan.', model: 'gemini:gemini-flash-latest', route: 'good at planning', status: 'done', createdAt: now - 600e3 } ] },
  { id: 'rc-b', title: 'Thesis outline, chapter by chapter', createdAt: now - 7200e3, updatedAt: now - 5400e3, rev: now - 5400e3, model: 'auto', messages: [
    { id: 'b1', role: 'user', text: 'Outline it.', createdAt: now - 5500e3 },
    { id: 'b2', role: 'assistant', text: 'Chapter one…', model: 'gemini:gemini-2.5-pro', route: 'long writing', status: 'done', createdAt: now - 5400e3 } ] },
];

(async () => {
  const browser = await chromium.launch();
  // One retry per case: a busy machine can miss a first paint.
  for (const state of states) for (const theme of ['light', 'dark']) for (const size of SIZES) {
    try { await capture(browser, state, theme, size); } catch (e) { console.warn(`retry ${state} ${theme} ${size[0]}: ${e.message.split('\n')[0]}`); await capture(browser, state, theme, size); }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

async function capture(browser, state, theme, [tag, w, h]) {
  {
    const name = (screen) => `${state}-${tag}-${theme}-${screen}.png`;
    if (only && !['models', 'providers', 'detail', 'detail-anthropic'].some((s) => only.test(name(s)))) return;
    const phone = w < 900;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: theme, serviceWorkers: 'block' });
    await ctx.route('**/*', (r) => new URL(r.request().url()).origin === new URL(base).origin || /^(data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
    const uid = `preview-rc-${state}-${tag}-${theme}`;
    await profile(ctx, uid, theme, { defaultModel: 'auto', enabledModels: ['gemini:gemini-flash-latest', 'gemini:gemini-2.5-pro'], ...(state === 'dense' ? { fontSize: 'large' } : {}) },
      state === 'empty' ? { geminiKey: '' } : { providerConnections: { anthropic: 'SYNTHETIC_ONLY', providerAccess: { anthropic: false } } });
    let status = state === 'failed' ? 401 : 0;
    await ctx.route('**/generativelanguage.googleapis.com/**', (r) => status
      ? r.fulfill({ status, json: { error: { message: 'synthetic failure' } } })
      : r.fulfill({ json: { models: state === 'dense' ? LONG : MODELS } }));
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(base + '/');
    // Without a key Lumen opens Settings → Keys first (its real first run); close it as a person would.
    const settings = page.getByRole('dialog', { name: 'Settings' });
    if (state === 'empty') { await settings.waitFor(); await settings.getByRole('button', { name: 'Close', exact: true }).first().click(); }
    await page.locator('.composer textarea').waitFor();
    if (state !== 'empty') { await seed(page, uid, CHATS); await page.reload(); await page.locator('.composer textarea').waitFor(); }
    // Larger text: Lumen's largest text size and 125% page zoom (what Safari's text-size control does; not Dynamic Type).
    if (state === 'dense') await page.evaluate(() => { document.documentElement.style.setProperty('--fs', '19px'); document.documentElement.style.zoom = '1.25'; });
    await page.waitForTimeout(500);
    const shot = async (screen) => { if (only && !only.test(name(screen))) return; await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name(screen)), animations: 'disabled' }); };
    const rc = page.locator('.rc-page');
    // Open from the navigation, as a person would.
    if (phone) { await page.getByRole('button', { name: 'Open chats', exact: true }).first().click(); await page.waitForTimeout(400); }
    await page.locator('aside.cv-nav').getByRole('button', { name: 'Prism', exact: true }).click();
    await rc.getByRole('heading', { name: 'Prism' }).first().waitFor();
    await page.waitForTimeout(400);
    await shot('models');
    // Sections: the redesign and the previous build both name them; try the navigation's button or tab.
    const section = async (label) => {
      const nav = rc.getByRole('navigation', { name: 'Prism sections' });
      const name = new RegExp(`^${label}\\b`);
      const target = nav.getByRole('tab', { name }).or(nav.getByRole('button', { name })).or(nav.getByRole('link', { name }));
      await target.first().click();
      await page.waitForTimeout(300);
    };
    await section('Providers');
    await rc.locator('[data-provider="gemini"]').first().waitFor();
    if (state === 'stale') {
      await rc.locator('[data-provider="gemini"]').first().click();
      status = 503;
      await rc.getByRole('button', { name: /^(Check connection|Refresh model list)$/ }).first().click();
      await page.waitForTimeout(1200);
      if (phone) { const back = rc.getByRole('button', { name: 'Back to providers', exact: true }).first(); if (await back.isVisible()) await back.click(); }
      await page.waitForTimeout(300);
    }
    await shot('providers');
    await rc.locator('[data-provider="gemini"]').first().click();
    await page.waitForTimeout(500);
    await shot('detail');
    if (state === 'connected') {
      if (phone) { await rc.getByRole('button', { name: /Back to providers/ }).first().click(); await page.waitForTimeout(300); }
      await rc.locator('[data-provider="anthropic"]').first().click();
      await page.waitForTimeout(400);
      await shot('detail-anthropic');
    }
    await ctx.close();
  }
}
