// Explicit loopback proof check, outside ordinary built-app E2E discovery.
// Exercise the existing preview boundary, not a new authentication/fixture mechanism.
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { profile } = require('../e2e/helpers/preview-profile.cjs');
(async () => {
  const proof = process.env.CP01_PROOF_URL;
  assert(proof, 'explicit loopback proof URL required');
  assert.equal(new URL(proof).hostname, 'localhost');
  const engine = process.env.MR_WEBKIT ? webkit : chromium, browser = await engine.launch();
  try {
    // Even a forged test flag cannot load a normal account through the proof entry.
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.route('**/*', r => new URL(r.request().url()).origin === new URL(proof).origin ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      window.__blackoutHarness = true;
      localStorage.setItem('mr.preview_user', JSON.stringify({ uid: 'cp01-guard-account', displayName: 'Synthetic guard account' }));
      localStorage.setItem('mr.account.cp01-guard-account', JSON.stringify({ marker: 'DO_NOT_OVERWRITE' }));
    });
    const page = await ctx.newPage();
    await page.goto(proof + '&fixture=1');
    await page.getByText('Open the synthetic Blackout preview in a separate browser profile to preserve the existing local account.', { exact: true }).waitFor();
    assert.equal(await page.locator('.app').count(), 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('mr.account.cp01-guard-account')).marker), 'DO_NOT_OVERWRITE');
    await ctx.close();
    // The exact same loopback server at a non-localhost hostname stays denied; no host allowance is added.
    const host = await browser.newContext({ serviceWorkers: 'block' });
    const url = new URL(proof); url.hostname = '127.0.0.1';
    const denied = await host.newPage(); await denied.goto(url.href);
    await denied.getByText('Design proofs run only on localhost in an isolated synthetic account.', { exact: true }).waitFor();
    assert.equal(await denied.locator('.app').count(), 0); await host.close();
    // The manual synthetic preview's built-in transport guard remains active without the test capability.
    const manual = await browser.newContext({ serviceWorkers: 'block' });
    let inference = 0;
    await manual.route('**/*', r => {
      const u = new URL(r.request().url());
      if (u.origin === new URL(proof).origin) return r.continue();
      if (u.hostname === 'generativelanguage.googleapis.com' && r.request().method() === 'POST') inference++;
      return r.abort();
    });
    const local = await manual.newPage(); await local.goto(proof + '&fixture=1');
    await local.locator('.composer textarea').fill('Synthetic manual preview; transport must remain blocked.');
    await local.getByRole('button', { name: 'Send', exact: true }).click();
    // Wait for the canonical request to settle against the local synthetic 503, not a timing-based sleep.
    await local.getByText(/No external request was sent/).first().waitFor();
    assert.equal(inference, 0, 'manual proof never sends provider inference across the network');
    await manual.close();
    // A proposal query on the ordinary built entry cannot activate the proof.
    const ordinary = await browser.newContext({ serviceWorkers: 'block' });
    await profile(ordinary, 'preview-blackout-cp01-root-boundary');
    const regular = await ordinary.newPage();
    const root = new URL(process.env.MR_TEST_URL || 'http://localhost:5190/'); root.search = '?proposal=canvas&fixture=1';
    await regular.goto(root.href); await regular.locator('.composer textarea').waitFor();
    assert.equal(await regular.locator('[data-proposal-nav], [data-lumen-canvas-foundation]').count(), 0);
    assert.equal(await regular.evaluate(() => document.documentElement.hasAttribute('data-proposal')), false);
    await ordinary.close();
    console.log('PASS CP01 isolation', engine.name(), 'normal-account denial, localhost guard, blocked manual transport, ordinary query isolation');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
