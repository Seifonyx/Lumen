// CP04 browser contract: the Canvas Routing Center in a committed synthetic review build, served through the real
// QA gate on loopback, in Chromium or Linux WebKit (MR_WEBKIT=1). Not a physical-iPhone result.
//
//   node scripts/qa/build.mjs --out /tmp/qa-build && QA_BUILD_DIR=/tmp/qa-build node tests/security/private-qa-routing-center.mjs
//
// Per viewport (1440×960, 390×844, 320×568): opened from the Canvas navigation with the draft kept; honest overview
// (catalog, policies, unknown allowance); every place in view; provider filters, search and detail; canonical manual selection from a
// provider's model list; Layout editor (edit and new, cancelled); Usage and Diagnostics; Manage → Settings and back;
// Back/Escape/another chat close it; a second reviewer starts closed; axe; no request leaving the review origin.

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
const out = process.env.CP04_OUT || join('tests/e2e/out/cp04', engineName);
mkdirSync(out, { recursive: true });
const VIEWPORTS = (process.env.CP04_VIEWPORTS || '1440x960,390x844,320x568').split(',').map((v) => v.split('x').map(Number));
const gate = await startLocalGate(buildDir);
const browser = await engine.launch();
const results = [], toolingCsp = [];
const DRAFT = 'Draft kept while routing: café 🌙';

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
async function shot(page, path) {
  const before = await page.evaluate(() => window.__cspViolations.length);
  await page.screenshot({ path, caret: 'initial' });
  await page.waitForTimeout(150);
  const during = await page.evaluate((n) => window.__cspViolations.splice(n), before);
  assert.ok(during.every((v) => /^style-src-elem inline\b/.test(v)), `only the capture's own style may be refused: ${during}`);
  toolingCsp.push(...during);
}
const settle = (page, ms = 400) => page.waitForTimeout(ms);
const rc = (page) => page.locator('section.rc-page');
const isOpen = (page) => page.evaluate(() => { const el = document.querySelector('section.rc-page'); return Boolean(el && !el.hidden); });
async function openRouting(page, phone) {
  if (phone) { await page.getByRole('button', { name: 'Open chats', exact: true }).first().click(); await settle(page, 600); }
  await page.locator('aside.cv-nav').getByRole('button', { name: 'Prism', exact: true }).click();
  await rc(page).getByRole('heading', { name: phone ? 'Prism' : 'Prism', level: 1 }).waitFor();
  await settle(page);
}
// Phone section shortcuts retain canonical screen history; provider details push without the strip.
async function tab(page, name) {
 const r=rc(page);
 if(await r.locator('.rc-tabs').count()) return r.locator('.rc-tabs').getByRole('button',{name,exact:true}).click();
 while(!await r.getByRole('navigation',{name:'Prism sections'}).count()) {
   await r.getByRole('button',{name:'Back',exact:true}).click();await settle(page,150);
 }
 await r.getByRole('navigation',{name:'Prism sections'}).getByRole('button',{name,exact:true}).click();
}

try {
  for (const [width, height] of VIEWPORTS) {
    const phone = width < 900, tag = `${width}x${height}`;
    const record = { viewport: tag, engine: engineName, checks: [] };
    const pass = (name) => record.checks.push(name);
    const { context, page, seen } = await open(REVIEWERS.owner, { width, height });
    try {
      // A draft in the composer survives the visit.
      await page.getByRole('textbox', { name: 'Message', exact: true }).fill(DRAFT);
      await openRouting(page, phone);
      assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1', 'focus moves to the current screen heading');
      assert.equal(await page.locator('.main').isVisible(), false, 'it takes the main column’s place');
      pass('opens from navigation');

      // Models is the default, and Overview must be absent from both navigation systems.
      assert.equal(await rc(page).getByRole('button', { name:'Overview', exact:true }).count(), 0);
      assert.ok(await rc(page).getByRole('region', { name:'Current routing mode' }).isVisible());
      assert.match(await rc(page).locator('.rc-current').innerText(), /Next message in this chat/);
      assert.ok(await rc(page).getByRole('heading',{name:'Model inventory'}).isVisible());
      const places = await rc(page).locator('.rc-tabs button, .phone-sections button').evaluateAll(els => els.map(el => {
        const r=el.getBoundingClientRect();return { name:el.textContent,left:r.left,right:r.right,height:r.height,cut:el.scrollWidth>el.clientWidth };
      }));
      assert.deepEqual(places.map(p=>p.name), ['Models','Providers','Layouts','Usage','Diagnostics']);
      for (const t of places.filter(()=>!phone)) assert.ok(t.left>=0&&t.right<=width&&!t.cut, `visible desktop section: ${t.name}`);
      if (phone) {
        for (const item of await rc(page).locator('.phone-sections button').all()) {
          await item.focus(); const r=await item.boundingBox();
          assert.ok(r.x>=0&&r.x+r.width<=width&&r.height>=44,'phone section reveals fully on focus');
          assert.ok(await item.evaluate(el=>el.scrollWidth<=el.clientWidth));
        }
        await rc(page).getByRole('navigation',{name:'Prism sections'}).getByRole('button',{name:'Models',exact:true}).click();
      }
      await shot(page, join(out, `${tag}-1-models.png`));
      pass('Prism models landing');

      // Providers: filters, search, detail.
      await tab(page, 'Providers');
      await settle(page);
      if (phone) { assert.equal(await rc(page).locator('.rc-dock').count(),0); assert.equal(await rc(page).locator('.phone-navigation h1').innerText(),'Prism'); assert.equal(await rc(page).getByRole('navigation',{name:'Prism sections'}).getByRole('button',{name:'Providers',exact:true}).getAttribute('aria-current'),'page'); }
      assert.match(await rc(page).locator('.rc-count').innerText(), /^\d+ of \d+ providers$/);
      // Your providers form the ledger with one verdict each; the others are names to add, the first few shown until asked.
      const fold = rc(page).locator('.rc-more');
      assert.equal(await fold.getAttribute('aria-expanded'), 'false');
      assert.match(await rc(page).locator('.rc-explore').innerText(), /\d+ providers · no key saved/);
      assert.match(await rc(page).locator('[data-provider="gemini"]').innerText(), /Catalog ready/);
      assert.doesNotMatch(await rc(page).locator('[data-provider="gemini"]').innerText(), /No key saved|permission off/);
      assert.equal(await rc(page).locator('[data-provider="groq"]').isVisible(), false, 'unconnected providers start folded');
      await shot(page, join(out, `${tag}-2-providers-folded.png`));
      await fold.click();
      assert.equal(await fold.getAttribute('aria-expanded'), 'true');
      assert.equal(await rc(page).locator('[data-provider="groq"]').innerText(), 'Groq');
      await fold.click();
      assert.equal(await rc(page).locator('[data-provider="groq"]').isVisible(), false);
      // A search reaches folded providers directly.
      await rc(page).getByRole('searchbox', { name: 'Find a provider' }).fill('groq');
      await settle(page, 200);
      assert.equal(await rc(page).locator('.rc-provider-scroll [data-provider]').count(), 1);
      await rc(page).getByRole('button', { name: 'Clear provider search' }).click();
      await rc(page).getByRole('button', { name: 'Filter providers' }).click();
      await page.getByRole('menuitemradio', { name: /Saved keys/ }).or(page.getByRole('option', { name: /Saved keys/ })).first().click();
      await settle(page, 200);
      assert.equal(await rc(page).locator('.rc-provider-scroll [data-provider]').count(), 1, 'one saved key (synthetic Google AI Studio)');
      await rc(page).locator('[data-provider="gemini"]').click();
      await settle(page);
      const detail = rc(page).getByRole('region', { name: 'Provider detail' });
      assert.ok(await rc(page).getByRole('heading', { name: 'Google AI Studio',exact:true }).isVisible());
      // Independent facts, never a setup sequence; replies are never claimed.
      assert.match(await detail.locator('[data-fact="Key · permission"]').textContent(), /Saved · on/);
      assert.match(await detail.locator('[data-fact="Replies"]').textContent(), /Not tested by model listing/);
      assert.match(await detail.locator('[data-fact="Allowance"]').textContent(), /Unknown/);
      await shot(page, join(out, `${tag}-2-provider.png`));
      if (phone) {
        assert.equal(await rc(page).locator('.rc-provider-list').isVisible(), false, 'phone: the detail replaces the list');
        await rc(page).getByRole('button', { name: 'Back',exact:true }).click();
        await settle(page);
        assert.ok(await rc(page).locator('.rc-provider-list').isVisible());
        await rc(page).locator('[data-provider="gemini"]').click();
        await settle(page);
      }
      pass('providers');

      // Canonical manual selection: the conversation's model changes, the Routing Center closes with a confirmation, the draft stays.
      await detail.getByRole('button', { name: 'Use Gemini 2.5 Pro (synthetic)', exact: true }).click();
      await settle(page, 600);
      assert.equal(await isOpen(page), false, 'choosing a model returns to the chat');
      assert.match(await page.locator('.composer .model-name-text').innerText(), /Gemini 2\.5 Pro/);
      assert.equal(await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue(), DRAFT, 'draft kept');
      assert.ok(await page.getByText(/Now using Gemini 2\.5 Pro \(synthetic\) in this chat/).first().isVisible(), 'the choice is confirmed');
      pass('use model');

      // Policies: the real Layout editor, edit and new (cancelled, nothing saved).
      await openRouting(page, phone);
      await tab(page, 'Layouts');
      await settle(page);
      assert.ok(await rc(page).getByRole('heading', { name: 'Launch writing' }).isVisible());
      await shot(page, join(out, `${tag}-3-policies.png`));
      await rc(page).getByRole('button', { name: 'Edit Launch writing' }).click();
      await settle(page);
      assert.equal(await rc(page).locator('.rc-editor input[placeholder="e.g. Web apps"]').inputValue(), 'Launch writing');
      await rc(page).locator('.rc-editor').getByRole('button', { name: 'Cancel', exact: true }).click();
      await rc(page).getByRole('button', { name: 'New policy' }).click();
      await settle(page);
      assert.equal(await rc(page).locator('.rc-editor input[placeholder="e.g. Web apps"]').inputValue(), '');
      await rc(page).locator('.rc-editor').getByRole('button', { name: 'Cancel', exact: true }).click();
      await settle(page);
      assert.equal(await rc(page).locator('.rc-policy').count(), 1, 'cancelling saves nothing');
      pass('policies');

      // Usage (canonical UsageTab) and Diagnostics.
      await tab(page, 'Usage');
      await settle(page);
      assert.ok(await rc(page).locator('.settings-section.usage').isVisible(), 'the real usage view');
      await tab(page, 'Diagnostics');
      await settle(page);
      assert.ok(await rc(page).getByRole('heading', { name: 'Latest model choice' }).isVisible());
      if (phone) await shot(page, join(out, `${tag}-5-sections-scrolled.png`));
      pass('usage and diagnostics');

      // Manage connection → Settings (keys); closing Settings returns to the Routing Center.
      await tab(page, 'Providers');
      await rc(page).locator('[data-provider="gemini"]').click();
      if(phone){await rc(page).getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('menuitem',{name:'Connection settings',exact:true}).click();}else await rc(page).getByRole('button', { name: 'Connection settings for Google AI Studio' }).click();
      await page.getByRole('dialog', { name: 'Settings' }).waitFor();
      assert.equal(await isOpen(page), false, 'hidden under Settings');
      await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: phone ? 'Back' : 'Close', exact: true }).first().click();
      await settle(page, 600);
      assert.equal(await isOpen(page), true, 'back to the Routing Center');
      pass('manage connection');

      // Accessibility on the provider detail.
      const state = await page.evaluate(() => ({ csp: window.__cspViolations, overflow: document.documentElement.scrollWidth - innerWidth }));
      const axe = await new AxeBuilder({ page }).include('section.rc-page').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      record.axe = axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }));
      assert.deepEqual(record.axe, [], `axe at ${tag}`);
      assert.ok(state.overflow <= 0, 'no horizontal overflow');
      assert.deepEqual(state.csp, []);

      // Closing: Back to chat, Escape, and choosing another chat.
      if(phone){for(let i=0;i<24 && await isOpen(page);i++){await rc(page).getByRole('button',{name:'Back',exact:true}).click();await settle(page,120);}assert.equal(await isOpen(page),false,'Back traverses all visited Routing screens');}else await rc(page).getByRole('button', { name: 'Back to chat' }).click();
      await settle(page);
      assert.equal(await isOpen(page), false);
      await openRouting(page, phone);
      await rc(page).getByRole('heading', { name: phone ? 'Prism' : 'Prism', level: 1 }).focus();
      await page.keyboard.press('Escape');
      await settle(page);
      assert.equal(await isOpen(page), false, 'Escape closes');
      // Back closes it (not the app), as on the other pages shown in place of the chat.
      await openRouting(page, phone);
      await page.goBack();
      await settle(page);
      assert.equal(await isOpen(page), false, 'Back closes');
      assert.ok(page.url().startsWith(gate.origin), 'Back stays in Lumen');
      await page.goForward(); await settle(page);
      assert.equal(await isOpen(page), true, 'Forward restores Prism');
      assert.ok(await rc(page).getByRole('region',{name:'Current routing mode'}).isVisible());
      await page.goBack(); await settle(page);
      assert.equal(await isOpen(page), false, 'Back restores chat after Forward');
      // Nested phone screens return through Back; the drawer remains on the chat root.
      await openRouting(page, phone);
      if (phone) {
        assert.equal(await rc(page).getByRole('button',{name:'Open sidebar',exact:true}).count(),0);
        await rc(page).getByRole('button',{name:'Back',exact:true}).click();await settle(page,400);
        await page.getByRole('button',{name:'Open chats',exact:true}).first().click();await settle(page,400);
      }
      await page.locator('aside.cv-nav').getByText('Notes for a quieter workspace').click();
      await settle(page, 600);
      assert.equal(await isOpen(page), false, 'another chat closes it');
      assert.ok(await page.locator('.main').isVisible());
      pass('closing');

      assert.deepEqual(seen.external, []);
      assert.deepEqual(seen.errors, []);
      pass('axe, network, CSP, overflow, errors');
    } finally {
      await context.close();
    }

    {
      const other = await open(REVIEWERS.second, { width, height });
      assert.equal(await isOpen(other.page), false, 'another reviewer starts in their chat');
      await other.context.close();
      pass('second reviewer');
    }
    results.push(record);
    console.log(`PASS ${engineName} ${tag}: ${record.checks.length} checks`);
  }
} finally {
  writeFileSync(join(out, 'cp04-results.json'), JSON.stringify({ engine: engineName, commit: head, physicalDevice: false, screenshotToolingCsp: toolingCsp, results }, null, 2));
  await browser.close();
  await gate.close();
}
console.log(`CP04 Routing Center contract passed in ${engineName} at ${VIEWPORTS.map((v) => v.join('x')).join(', ')}`);
