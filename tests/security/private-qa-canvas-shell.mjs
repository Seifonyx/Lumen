// CP03 browser contract: the Canvas navigation tree, header breadcrumb and reading layout in a committed synthetic
// review build, served through the real QA gate on loopback, in Chromium or Linux WebKit (MR_WEBKIT=1).
// Not a physical-iPhone result.
//
//   node scripts/qa/build.mjs --out /tmp/qa-build && QA_BUILD_DIR=/tmp/qa-build node tests/security/private-qa-canvas-shell.mjs
//
// Per viewport (1440×960, 390×844, 320×568): folders and loose conversations from the canonical store; the open
// chat's folder open; folder/section disclosure; project overview, new chat in a project; row actions (rename);
// search over titles and messages with Ask; All chats; phone drawer open/close; header breadcrumb; reading
// measure; floating composer clear of the last answer (desktop); a second reviewer's isolated tree; axe; no request
// leaving the review origin. Screenshots go to CP03_OUT.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startLocalGate, REVIEWERS } from './private-qa-local-gate.mjs';
import { verifyBuild } from '../../scripts/qa/verify.mjs';

const buildDir = process.env.QA_BUILD_DIR;
assert.ok(buildDir, 'Set QA_BUILD_DIR to the output of scripts/qa/build.mjs');
const head = process.env.QA_EXPECTED_COMMIT || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.deepEqual(await verifyBuild(buildDir, head), [], 'build must match its manifest and commit before it is served');

const engineName = process.env.MR_WEBKIT ? 'webkit' : 'chromium';
const engine = process.env.MR_WEBKIT ? webkit : chromium;
const out = process.env.CP03_OUT || join('tests/e2e/out/cp03', engineName);
mkdirSync(out, { recursive: true });
const VIEWPORTS = (process.env.CP03_VIEWPORTS || '1440x960,390x844,320x568').split(',').map((v) => v.split('x').map(Number));
const gate = await startLocalGate(buildDir);
const browser = await engine.launch();
const results = [];
const toolingCsp = [];

async function open(who, { width, height }) {
  const phone = width < 900;
  const context = await browser.newContext({ viewport: { width, height }, isMobile: phone && engineName === 'chromium', hasTouch: phone,
    extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': await gate.token(who) } });
  const seen = { external: [], errors: [] };
  context.on('request', (r) => { if (!r.url().startsWith(gate.origin) && !/^(data|blob):/.test(r.url())) seen.external.push(r.url()); });
  await context.route((url) => !url.href.startsWith(gate.origin), (route) => route.abort('blockedbyclient'));
  await context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(`${e.effectiveDirective} ${e.blockedURI}`));
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => seen.errors.push(e.message));
  page.setDefaultTimeout(15000);
  await page.goto(gate.buildUrl);
  await page.getByRole('textbox', { name: 'Message', exact: true }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  return { context, page, seen };
}
// Evidence screenshots; Playwright's WebKit capture inserts its own inline <style> (refused by the review CSP),
// so reports raised during a capture are recorded separately, never hidden.
async function shot(page, path) {
  const before = await page.evaluate(() => window.__cspViolations.length);
  await page.screenshot({ path, caret: 'initial' });
  await page.waitForTimeout(150);
  const during = await page.evaluate((n) => window.__cspViolations.splice(n), before);
  assert.ok(during.every((v) => /^style-src-elem inline\b/.test(v)), `only the capture's own style may be refused: ${during}`);
  toolingCsp.push(...during);
}
const settle = (page, ms = 400) => page.waitForTimeout(ms);
const nav = (page) => page.locator('aside.cv-nav');
async function openNav(page, phone) {
  if (!phone) return;
  await page.getByRole('button', { name: 'Open chats', exact: true }).first().click();
  await settle(page, 600);
}
async function closeNav(page, phone) {
  if (!phone) return;
  if (await nav(page).evaluate((el) => el.classList.contains('open'))) { await nav(page).getByRole('button', { name: 'Close menu', exact: true }).click(); await settle(page, 500); }
}

try {
  for (const [width, height] of VIEWPORTS) {
    const phone = width < 900, tag = `${width}x${height}`;
    const record = { viewport: tag, engine: engineName, checks: [] };
    const pass = (name) => record.checks.push(name);
    const { context, page, seen } = await open(REVIEWERS.owner, { width, height });
    try {
      // Header breadcrumb: project › chat (desktop); title with project beneath (phone).
      const crumb = await page.evaluate(() => {
        const r = (s) => document.querySelector(s)?.getBoundingClientRect();
        const t = r('.topbar-center .chat-heading'), p = r('.project-topbar-pill');
        return { title: document.querySelector('.topbar-center .chat-heading')?.textContent, project: document.querySelector('.project-topbar-name')?.textContent, t, p, truncated: (() => { const el = document.querySelector('.topbar-center .chat-heading'); return el ? el.scrollWidth > el.clientWidth + 1 : null; })() };
      });
      assert.equal(crumb.project, 'Studio launch');
      if (phone) assert.ok(crumb.p.top > crumb.t.top, 'phone: project sits beneath the title');
      else { assert.ok(crumb.p.right <= crumb.t.left + 1, 'desktop: project › title'); assert.equal(crumb.truncated, false, 'desktop title fits'); }
      pass('header breadcrumb');

      // Reading measure and (desktop) composer clear of the last answer.
      const reading = await page.evaluate(() => {
        const thread = document.querySelector('.thread')?.getBoundingClientRect();
        const list = document.querySelector('.messages'); if (list) list.scrollTop = list.scrollHeight;
        return { width: thread?.width };
      });
      assert.ok(reading.width <= 720 + 1, `reading measure ≤ 720 (${reading.width})`);
      await settle(page);
      if (!phone) {
        const clear = await page.evaluate(() => {
          const answers = [...document.querySelectorAll('.msg.assistant')], last = answers.at(-1)?.getBoundingClientRect();
          return { lastBottom: last?.bottom, composerTop: document.querySelector('.composer')?.getBoundingClientRect().top };
        });
        assert.ok(clear.lastBottom <= clear.composerTop, `scrolled to the end, the last answer ends above the floating composer (${clear.lastBottom} ≤ ${clear.composerTop})`);
      }
      await shot(page, join(out, `${tag}-1-chat.png`));
      pass('reading layout');

      // The tree: folders from the canonical store; the open chat's folder is open; loose chats grouped.
      await openNav(page, phone);
      const studio = nav(page).getByRole('button', { name: /Studio launch/ }).first();
      const lisbon = nav(page).getByRole('button', { name: /Lisbon in spring/ }).first();
      assert.equal(await studio.getAttribute('aria-expanded'), 'true', 'the folder holding the open chat starts open');
      assert.equal(await lisbon.getAttribute('aria-expanded'), 'false');
      const inStudio = nav(page).locator(`#${await studio.getAttribute('aria-controls')}`);
      assert.ok(await inStudio.getByText('A launch worth remembering').isVisible());
      assert.equal(await nav(page).locator('.chat-row.active').count(), 1, 'one current chat');
      assert.ok(await nav(page).getByText('Notes for a quieter workspace').isVisible(), 'loose conversations listed');
      await shot(page, join(out, `${tag}-2-nav.png`));
      // Disclosure: open Lisbon, fold Studio; content inside a closed folder is inert.
      await lisbon.click(); await settle(page);
      assert.ok(await nav(page).getByText('Four quiet days in Lisbon').isVisible());
      await studio.click(); await settle(page);
      assert.equal(await inStudio.evaluate((el) => el.inert), true, 'a closed folder is inert');
      await studio.click(); await settle(page);
      pass('folders and disclosure');

      // Row actions (canonical ChatRow): rename through the options menu.
      const row = nav(page).locator('.chat-row', { hasText: 'Reading list — October' });
      // Keyboard path (works at every size; phones also offer long press, which needs a real touch screen).
      await row.getByRole('button', { name: 'Chat options', exact: true }).focus();
      await page.keyboard.press('Enter');
      await nav(page).getByRole('menuitem', { name: 'Rename' }).click();
      const field = nav(page).getByRole('textbox', { name: 'Chat name', exact: true });
      await field.fill('Reading list — November');
      await field.press('Enter');
      await settle(page);
      assert.ok(await nav(page).getByText('Reading list — November').isVisible(), 'rename applied by the store');
      pass('row actions');

      // Search: titles and message text, with Ask your chats.
      if (phone) { await nav(page).getByRole('button', { name: 'Search chats', exact: true }).click(); await settle(page); }
      await nav(page).getByRole('searchbox', { name: 'Search chats' }).fill('quiet days');
      await settle(page);
      assert.ok(await nav(page).getByText('Four quiet days in Lisbon').isVisible(), 'search finds a chat inside a folder');
      assert.ok(await nav(page).getByRole('button', { name: /Ask your chats/ }).isVisible());
      assert.equal(await nav(page).getByText('Notes for a quieter workspace').count(), 0, 'non-matching chats are hidden');
      await nav(page).getByRole('searchbox', { name: 'Search chats' }).fill('');
      if (phone) await nav(page).getByRole('button', { name: 'Search chats', exact: true }).click();
      await settle(page);
      pass('search');

      // All chats opens the canonical list.
      await nav(page).getByRole('button', { name: /All chats/ }).click();
      await settle(page, 600);
      assert.ok(await page.getByRole('dialog').filter({ hasText: /chats/i }).first().isVisible(), 'All chats opens');
      await page.keyboard.press('Escape');
      await settle(page, 500);
      pass('all chats');

      // Project overview from the folder brief; new chat in a project carries the project.
      await openNav(page, phone && !(await nav(page).evaluate((el) => el.classList.contains('open'))));
      await nav(page).getByRole('button', { name: /Offer, portfolio and first clients/ }).click();
      await settle(page, 600);
      assert.ok(await page.locator('.project-workspace-main').isVisible(), 'the brief opens the project workspace');
      await openNav(page, phone);
      await nav(page).getByRole('button', { name: 'New chat in Studio launch', exact: true }).click();
      await settle(page, 600);
      assert.equal(await page.locator('.project-workspace-main').count(), 0);
      assert.equal(await page.locator('.composer-chip').filter({ hasText: 'Studio launch' }).count(), 1, 'the new chat starts in the project');
      pass('project overview and new chat in project');

      // Phone drawer: opens as a dialog and closes; desktop: collapse and expand.
      if (phone) {
        await openNav(page, true);
        assert.equal(await nav(page).getAttribute('role'), 'dialog');
        await closeNav(page, true);
        assert.equal(await nav(page).evaluate((el) => el.inert), true, 'closed drawer is inert');
      } else {
        await nav(page).getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await settle(page);
        assert.equal(await nav(page).isVisible(), false);
        await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        await settle(page);
        assert.equal(await nav(page).isVisible(), true);
      }
      pass('drawer / collapse');

      await openNav(page, phone);
      const state = await page.evaluate(() => ({ csp: window.__cspViolations, blocked: window.__qaBlockedHosts || [], overflow: document.documentElement.scrollWidth - innerWidth }));
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      record.axe = axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
      assert.deepEqual(record.axe, [], `axe at ${tag}`);
      assert.deepEqual(seen.external, []);
      assert.deepEqual(state.csp, []);
      assert.deepEqual(state.blocked, []);
      assert.ok(state.overflow <= 0, 'no horizontal overflow');
      assert.deepEqual(seen.errors, []);
      pass('axe, network, CSP, overflow, errors');
    } finally {
      await context.close();
    }

    // Another reviewer's tree is their own: their (untouched) synthetic chats, the default disclosure.
    {
      const other = await open(REVIEWERS.second, { width, height });
      await openNav(other.page, phone);
      assert.equal(await nav(other.page).getByText('Reading list — November').count(), 0, 'a rename by one reviewer never reaches another');
      assert.equal(await nav(other.page).getByRole('button', { name: /Lisbon in spring/ }).first().getAttribute('aria-expanded'), 'false');
      await other.context.close();
      pass('second reviewer isolated');
    }
    results.push(record);
    console.log(`PASS ${engineName} ${tag}: ${record.checks.length} checks`);
  }
} finally {
  writeFileSync(join(out, 'cp03-results.json'), JSON.stringify({ engine: engineName, commit: head, physicalDevice: false, screenshotToolingCsp: toolingCsp, results }, null, 2));
  await browser.close();
  await gate.close();
}
console.log(`CP03 Canvas shell contract passed in ${engineName} at ${VIEWPORTS.map((v) => v.join('x')).join(', ')}`);
