// Codespaces review server, real synthetic build, Chromium or Linux WebKit (MR_WEBKIT=1). Simulates the
// Codespace environment locally on loopback; no Codespace, port forwarding or network is used.
//   node scripts/qa/build.mjs --out /tmp/qa-build --hours 8
//   QA_BUILD_DIR=/tmp/qa-build [QA_EXPECTED_COMMIT=<sha>] node tests/security/private-qa-codespace-browser.mjs

import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { startCodespaceServer } from '../../scripts/qa/serve-codespace.mjs';
import { testIdentityProvider } from './private-qa-fixtures.mjs';

const env = { CODESPACES: 'true', CODESPACE_NAME: 'lumen-local-check', GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN: 'app.github.dev' };
const server = await startCodespaceServer({ buildDir: process.env.QA_BUILD_DIR, port: 0, env, expectedCommit: process.env.QA_EXPECTED_COMMIT });
const browser = await (process.env.MR_WEBKIT ? webkit : chromium).launch();
try {
  const port = server.address.port;
  const forged = await testIdentityProvider().token('attacker@example.test');
  for (const [width, height] of [[390, 844], [1440, 960]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 900 && !process.env.MR_WEBKIT, hasTouch: width < 900, extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': forged } });
    const external = [];
    context.on('request', (r) => { if (!r.url().startsWith(`http://localhost:${port}`) && !/^(data|blob):/.test(r.url())) external.push(r.url()); });
    await context.route((url) => !url.href.startsWith(`http://localhost:${port}`), (route) => route.abort());
    await context.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.effectiveDirective)); });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const response = await page.goto(`http://localhost:${port}/b/${server.buildId}/`);
    assert.equal(response.status(), 200);
    assert.equal(response.headers()['cache-control'], 'private, no-store');
    await page.getByRole('textbox', { name: 'Message', exact: true }).waitFor({ timeout: 20000 });
    await page.getByText(/^Synthetic review · no live provider requests/).waitFor();
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Hello from the Codespaces check');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByText(/No live provider was contacted/).last().waitFor({ timeout: 20000 });
    const state = await page.evaluate(() => ({ csp: window.__csp, blocked: window.__qaBlockedHosts || [], firebase: window.__qaDisabledCalls || [] }));
    assert.deepEqual(external, []);
    assert.deepEqual(state, { csp: [], blocked: [], firebase: [] });
    assert.deepEqual(errors, []);
    // A request with a foreign Host header never gets app bytes.
    const foreign = await page.evaluate(async () => (await fetch(location.href, { headers: {} })).status);
    assert.equal(foreign, 200, 'same host still served');
    await context.close();
    console.log(`PASS codespace server ${process.env.MR_WEBKIT ? 'webkit' : 'chromium'} ${width}x${height}: app loads behind the gate, forged identity ignored, 0 external requests, 0 CSP/page errors`);
  }
} finally {
  await browser.close();
  await server.close();
}
