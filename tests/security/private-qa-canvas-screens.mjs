// CP05 browser contract: Canvas across the app (Library, Tools, Projects, project workspace, Settings, All chats,
// picker, usage, + menu, Routing Center, Study, Assistants, Compare, document Canvas panel) in dark and light (Canvas has no True black), in a committed synthetic review build served through
// the real QA gate on loopback, in Chromium or Linux WebKit (MR_WEBKIT=1). Not a physical-iPhone result.
//
//   node scripts/qa/build.mjs --out /tmp/qa-build && QA_BUILD_DIR=/tmp/qa-build node tests/security/private-qa-canvas-screens.mjs
//
// Per viewport (1440×960, 390×844) and theme (dark, light; no True black on Canvas): every destination opens with the Canvas scope, ink
// (monochrome) accents and display headings; one workflow per area (create a project → it appears in the Canvas
// tree; open a project from its brief while a page is showing); axe per screen; no overflow, CSP violation, page
// error or request leaving the review origin. Screenshots go to CP05_OUT.

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
const out = process.env.CP05_OUT || join('tests/e2e/out/cp05', engineName);
mkdirSync(out, { recursive: true });
const VIEWPORTS = (process.env.CP05_VIEWPORTS || '1440x960,390x844').split(',').map((v) => v.split('x').map(Number));
const gate = await startLocalGate(buildDir);
const browser = await engine.launch();
const results = [], toolingCsp = [];

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
const settle = (page, ms = 450) => page.waitForTimeout(ms);
const nav = (page) => page.locator('aside.cv-nav');
async function openNav(page, phone) {
  if (!phone || await nav(page).evaluate((el) => el.classList.contains('open'))) return;
  while(await page.locator('.phone-navigation [aria-label="Back"]').isVisible()){await page.locator('.phone-navigation [aria-label="Back"]').click();await settle(page,250);}
  await page.getByRole('button', { name: /^(Open chats|Open sidebar|Open navigation)$/ }).first().click();
  await settle(page, 600);
}
async function go(page, phone, label) { await openNav(page, phone); await nav(page).getByRole('button', { name: label, exact: true }).click(); await settle(page, 700); }
const closeAll = async (page) => {
 for(let i=0;i<24;i++){
   const presented=await page.locator('.modal-backdrop:visible,.hub-page:visible,.settings-page:visible,.rc-page:visible,.canvas-panel:visible,.project-workspace-main:visible,[role="dialog"]:visible:not([inert]),[role="menu"]:visible:not([inert])').count();
   if(!presented && await page.locator('.composer textarea').isVisible()) return;
   if(await page.locator('.modal-backdrop:visible,[role="dialog"]:visible:not([inert]),[role="menu"]:visible:not([inert])').count())await page.keyboard.press('Escape');else await page.goBack();
   await settle(page,200);
 }
 console.error('Unclosed presentation',await page.locator('.modal-backdrop:visible,.hub-page:visible,.settings-page:visible,.rc-page:visible,.canvas-panel:visible,.project-workspace-main:visible,[role="dialog"]:visible:not([inert]),[role="menu"]:visible:not([inert])').evaluateAll(els=>els.map(el=>({tag:el.tagName,class:el.className,label:el.getAttribute('aria-label'),inert:el.inert}))));
 assert.fail('Could not return through the screen hierarchy to chat');
};
/** Ink accents and Canvas headings on the current screen. */
const canvasLook = (page, heading) => page.evaluate((sel) => {
  const root = document.documentElement, h = sel ? document.querySelector(sel) : null;
  const signal = getComputedStyle(root).getPropertyValue('--signal').trim(), text = getComputedStyle(root).getPropertyValue('--text').trim();
  return { scoped: root.hasAttribute('data-lumen-canvas'), ink: signal === text || signal === 'var(--text)', headingFont: h ? getComputedStyle(h).fontFamily : null };
}, heading);
async function axe(page, include) {
  // Measure settled screens: an opening dialog fades in, and mid-fade text reads as low contrast.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== 'running'), null, { timeout: 5000 }).catch(() => {});
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) builder = builder.include(include);
  return (await builder.analyze()).violations.map((v) => ({ id: v.id, nodes: v.nodes.length, target: v.nodes[0]?.target?.join(' ') }));
}

try {
  for (const [width, height] of VIEWPORTS) {
    const phone = width < 900;
    for (const theme of (process.env.CP05_THEMES || 'dark,light').split(',')) {
      const tag = `${width}x${height}-${theme}`;
      const record = { viewport: tag, engine: engineName, screens: {}, checks: [] };
      const pass = (name) => record.checks.push(name);
      const { context, page, seen } = await open(REVIEWERS.owner, { width, height });
      try {
        // Theme through the canonical Settings control.
        await go(page, phone, 'Settings');
        await page.getByRole('dialog', { name: 'Settings' }).waitFor();
        if (phone) { await page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: /^General/ }).first().click(); await settle(page); }
        // Canvas offers Light and Dark (and Auto); True black is not a choice.
        assert.equal(await page.getByRole('radio', { name: 'True black', exact: true }).or(page.getByRole('button', { name: 'True black', exact: true })).count(), 0, `${tag}: no True black`);
        const themeLabel = { light: 'Light', dark: 'Dark' }[theme];
        await page.getByRole('radio', { name: themeLabel, exact: true }).or(page.getByRole('button', { name: themeLabel, exact: true })).first().click(); await settle(page);
        assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.theme || 'auto', document.documentElement.dataset.appearance || '']), [theme, '']);
        let look = await canvasLook(page, '.settings-heading h2');
        assert.ok(look.scoped && look.ink, 'Canvas scope with ink accents');
        assert.match(look.headingFont, /Geist/); // owner decision: Geist stays the display face (no Archivo)
        // A shared compact bar owns the phone title; the content must not repeat it.
        if(phone){assert.equal(await page.locator('.phone-navigation h1').innerText(),'General');assert.equal(await page.locator('.settings-heading h2').isVisible(),false);}
        record.screens.settings = await axe(page, 'section.settings-page');
        await shot(page, join(out, `${tag}-settings.png`));
        await closeAll(page);
        pass('settings');

        // Library, Tools, Projects (HubPage shell).
        for (const [label, name] of [['Library', 'library'], ['Tools', 'tools']]) {
          await go(page, phone, label);
          look = await canvasLook(page, '.hub-head h1');
          assert.ok(look.scoped && look.ink);
          record.screens[name] = await axe(page, 'main.hub-page');
          await shot(page, join(out, `${tag}-${name}.png`));
          await closeAll(page);
        }
        await go(page, phone, 'All projects');
        record.screens.projects = await axe(page, 'main.hub-page');
        await shot(page, join(out, `${tag}-projects.png`));
        pass('library, tools, projects');

        // Workflow: create a project; it joins the Canvas tree as a folder.
        const name = `QA ${theme} ${width}`;
        await page.getByRole('button', { name: 'New project' }).first().click();
        await page.getByRole('textbox', { name: 'Project name' }).fill(name);
        await page.getByRole('button', { name: 'Create project' }).click();
        await settle(page, 700);
        assert.equal(await page.getByRole('textbox',{name:'Project name',exact:true}).count(),0,'successful creation dismisses its form');
        assert.ok(await page.locator('.project-workspace-main').isVisible(),'successful creation retains the selected workspace');
        await openNav(page, phone);
        assert.ok(await nav(page).getByRole('button', { name: new RegExp(name) }).first().isVisible(), 'the new project is a folder in the tree');
        pass('create project');

        // Regression: the brief opens its project even while a page (Library) is showing.
        await closeAll(page);
        await go(page, phone, 'Library');
        await openNav(page, phone);
        await nav(page).getByRole('button', { name: /Offer, portfolio and first clients/ }).click();
        await settle(page, 700);
        assert.ok(await page.locator('.project-workspace-main').isVisible(), 'project workspace from a page');
        record.screens.project = await axe(page, '.project-workspace-main');
        await shot(page, join(out, `${tag}-project.png`));
        pass('project from brief');

        // Back to a chat: All chats, picker, usage and + menu dialogs.
        await openNav(page, phone);
        await nav(page).locator('.chat-row', { hasText: 'A launch worth remembering' }).getByRole('button').first().click();
        await settle(page, 700);
        await openNav(page, phone);
        await nav(page).getByRole('button', { name: /All chats/ }).click();
        await page.getByRole('dialog', { name: 'All chats' }).waitFor();
        record.screens.allChats = await axe(page, '[role="dialog"]');
        await shot(page, join(out, `${tag}-all-chats.png`));
        await closeAll(page);
        await page.locator('.composer .model-button').click();
        await page.getByRole('dialog', { name: 'Choose a model', exact: true }).waitFor();
        await shot(page, join(out, `${tag}-picker.png`));
        await closeAll(page);
        await page.getByRole('button', { name: /Add (photos, files|files)/ }).first().click();
        await settle(page, 600);
        await shot(page, join(out, `${tag}-attach.png`));
        await closeAll(page);
        pass('dialogs');

        // Routing Center in this theme.
        await go(page, phone, 'Models & routing');
        record.screens.routing = await axe(page, 'section.rc-page');
        await shot(page, join(out, `${tag}-routing.png`));
        await closeAll(page);
        pass('routing center');

        // Study, Assistants, Compare and the document Canvas panel, reached the way people reach them (Tools).
        const fromTools = async (name) => {
          await go(page, phone, 'Tools');
          await page.locator('main.hub-page').getByRole('button', { name: new RegExp('^' + name) }).first().click();
          await settle(page, 700);
        };
        const inkOf = (sel) => page.evaluate((q) => {
          const el = document.querySelector(q), probe = document.body.appendChild(Object.assign(document.createElement('span'), { style: 'color: var(--text)' }));
          const ink = getComputedStyle(probe).color; probe.remove();
          return Boolean(el) && getComputedStyle(el).color === ink;
        }, sel);
        await fromTools('Study');
        look = await canvasLook(page, '.hub-head h1');
        assert.ok(look.scoped && look.ink);
        record.screens.study = await axe(page, 'main.hub-page');
        await shot(page, join(out, `${tag}-study.png`));
        await closeAll(page);
        await go(page, phone, 'Tools');
        await page.getByRole('button',{name:'New assistant',exact:true}).click();
        await page.getByLabel('Library item name').waitFor();
        record.screens.assistants = await axe(page, 'main.hub-page');
        await shot(page, join(out, `${tag}-assistants.png`));
        await closeAll(page);
        pass('study, assistants');
        await fromTools('Compare models');
        await page.locator('.compare-picker').waitFor();
        record.screens.compare = await axe(page, '[role="dialog"]');
        await shot(page, join(out, `${tag}-compare.png`));
        await closeAll(page);
        await fromTools('Document canvas');
        await page.locator('aside.canvas-panel').waitFor();
        record.screens.canvasPanel = await axe(page, 'aside.canvas-panel');
        await shot(page, join(out, `${tag}-canvas-panel.png`));
        await closeAll(page);
        pass('compare, document canvas');

        const state = await page.evaluate(() => ({ csp: window.__cspViolations, overflow: document.documentElement.scrollWidth - innerWidth }));
        for (const [screen, violations] of Object.entries(record.screens)) assert.deepEqual(violations, [], `axe on ${screen} at ${tag}`);
        assert.ok(state.overflow <= 0, 'no horizontal overflow');
        assert.deepEqual(state.csp, []);
        assert.deepEqual(seen.external, []);
        assert.deepEqual(seen.errors, []);
        pass('axe, overflow, CSP, network, errors');
      } finally {
        await context.close();
      }
      results.push(record);
      console.log(`PASS ${engineName} ${tag}: ${record.checks.length} checks`);
    }
  }
} finally {
  writeFileSync(join(out, 'cp05-results.json'), JSON.stringify({ engine: engineName, commit: head, physicalDevice: false, screenshotToolingCsp: toolingCsp, results }, null, 2));
  await browser.close();
  await gate.close();
}
console.log(`CP05 Canvas screens contract passed in ${engineName} at ${VIEWPORTS.map((v) => v.join('x')).join(', ')} (dark and light)`);
