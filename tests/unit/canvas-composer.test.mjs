// CP02 static guards: the Canvas composer stays off in the ordinary build; LUMEN_CANVAS=1 production builds and the QA
// review build turn it on through one shared "on" module,
// its styles are scoped to the opted-in composer, and Composer keeps the ordinary JSX in every flagged branch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

test('the Canvas flags are off in the ordinary build and on through one module shared by production and QA', () => {
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const CANVAS_COMPOSER = false;$/m);
  const on = readFileSync('src/lib/canvas-presentation.on.ts', 'utf8');
  assert.match(on, /^export const CANVAS_COMPOSER = true;$/m);
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const CANVAS_SHELL = false;$/m);
  assert.match(on, /^export const CANVAS_SHELL = true;$/m);
  // QA review: the adapter only re-exports the production "on" module, so QA shows what production ships.
  assert.match(readFileSync('vite.qa.config.ts', 'utf8'), /\[at\('src\/lib\/canvas-presentation\.ts'\)\]: at\('qa\/iphone\/adapters\/canvas-presentation\.ts'\)/);
  assert.match(readFileSync('qa/iphone/adapters/canvas-presentation.ts', 'utf8'), /^export \* from '\.\.\/\.\.\/\.\.\/src\/lib\/canvas-presentation\.on';$/m);
  // Production: only LUMEN_CANVAS=1 swaps in the "on" module; unset or 0 leaves the ordinary build untouched.
  const config = readFileSync('vite.config.ts', 'utf8');
  assert.match(config, /if \(flag !== '1'\) return false;/);
  assert.match(config, /resolve\('src\/lib\/canvas-presentation\.on\.ts'\)/);
  assert.ok(!/canvas(?:-composer|-shell|-routing|-screens)?\.css/.test(config), 'styles load only through the "on" module');
  // The Deploy workflow builds Canvas unless an operator explicitly chooses the ordinary (rollback) build.
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
  // Canvas ships only when chosen: ordinary is the default and anything else builds ordinary.
  for (const workflow of [deploy, readFileSync('.github/workflows/preview.yml', 'utf8')]) {
    assert.match(workflow, /^ {8}default: ordinary$/m);
    assert.match(workflow, /LUMEN_CANVAS: \$\{\{ inputs\.presentation == 'canvas' && '1' \|\| '0' \}\}/);
  }
  // Styles load with the switch, never from the component (a CSS import would survive tree-shaking).
  for (const file of ['src/components/Composer.tsx', 'src/components/ComposerCanvas.tsx', 'src/components/SidebarCanvas.tsx', 'src/components/Sidebar.tsx', 'src/components/ChatView.tsx']) assert.ok(!/\.css['"]/.test(readFileSync(file, 'utf8')), `${file} imports no stylesheet`);
  for (const file of ['src/main.tsx', 'src/App.tsx']) assert.ok(!/canvas(?:-composer|-shell)?\.css/.test(readFileSync(file, 'utf8')), `${file} never loads Canvas styles`);
});

test('every flagged Composer branch keeps the ordinary expression as its alternative', () => {
  const src = readFileSync('src/components/Composer.tsx', 'utf8');
  const uses = src.match(/CANVAS_COMPOSER\b/g).length - 1; // minus the import
  // Spreads fall back to nothing; ternaries repeat the ordinary JSX after `:`; statements are guarded.
  const spreads = src.match(/\{\.\.\.\(CANVAS_COMPOSER \? canvas!\.\w+ : undefined\)\}/g) || [];
  const ternaries = src.match(/\{CANVAS_COMPOSER \? <>.+?<\/> : .+?\}\n/g) || [];
  for (const t of ternaries) {
    // The Canvas branch is the ordinary expression plus exactly one Canvas piece.
    const [, inside, outside] = /<>(.+?)<\/> : (.+?)\}\n/.exec(t);
    assert.equal(inside.match(/\{canvas!\.\w+\}/g)?.length, 1, t.trim());
    assert.equal(inside.replace(/\{canvas!\.\w+\}/, '').replace(/^\{|\}$/g, ''), outside, `ordinary branch is unchanged in: ${t.trim()}`);
  }
  const statements = src.match(/if \(CANVAS_COMPOSER(?: && [^)]*\))?\) [^;]*;|CANVAS_COMPOSER \? useCanvasComposer\(/g) || [];
  assert.equal(spreads.length + ternaries.length + statements.length, uses, 'no unreviewed flag use');
  assert.equal(spreads.length, 3);
  assert.equal(ternaries.length, 4);
});

test('Canvas composer styles are scoped to the opted-in composer and load nothing', () => {
  const root = postcss.parse(readFileSync('src/styles/canvas-composer.css', 'utf8'));
  let rules = 0;
  root.walkAtRules((rule) => assert.ok(['media', 'keyframes'].includes(rule.name), `no @${rule.name}`));
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') return;
    rules++;
    for (const selector of rule.selectors) {
      assert.match(selector, /^(?:(?::root\[data-theme='light'\]|html(?:\.glass|\.kb-open)?) )?\.composer-wrap(?:\[data-composer-state(?:='\w+')?\])?\[data-lumen-canvas-composer\]/, `scoped: ${selector}`);
    }
  });
  root.walkDecls((decl) => assert.ok(!/url\s*\(|@import/i.test(decl.value), 'no network/font dependency'));
  assert.ok(rules > 30);
});

test('CP03 shell seams fold to the ordinary code and its styles stay scoped', () => {
  const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');
  assert.equal((sidebar.match(/CANVAS_SHELL\b/g) || []).length - 1, 1, 'Sidebar: one early return, constant per build');
  assert.match(sidebar, /^  if \(CANVAS_SHELL\) return <SidebarCanvas onCollapse=\{onCollapse\} \/>;$/m);
  const app = readFileSync('src/App.tsx', 'utf8');
  assert.equal((app.match(/CANVAS_SHELL\b/g) || []).length - 1, 3, 'App: the document scope, the app scope attributes and the Routing Center mount');
  assert.match(app, /\{\.\.\.\(CANVAS_SHELL \? \{ 'data-lumen-canvas-shell': '', 'data-lumen-canvas-foundation': '' \} : undefined\)\}/);
  const view = readFileSync('src/components/ChatView.tsx', 'utf8');
  const t = /\{CANVAS_SHELL \? <>(.+?)<\/> : (.+?)\}\n/.exec(view);
  assert.ok(t, 'ChatView: one ternary');
  assert.equal(t[1].replace(/<button type="button" className="icon-btn cv-compose"[^]*?<\/button>/, '').replace('{!empty && <RailToggle />}', '').replace(/^\{|\}$/g, ''), t[2], 'its ordinary branch is unchanged');
  // The context rail (1280 px and wider) adds only its toggle above and its panel beside the navigator host.
  assert.match(view, /\{CANVAS_SHELL \? <><div className="message-navigation-host" ref=\{navigationHost\} \/>\{!empty && <ContextRail chat=\{chat\} \/>\}<\/> : <div className="message-navigation-host" ref=\{navigationHost\} \/>\}/);
  const root = postcss.parse(readFileSync('src/styles/canvas-shell.css', 'utf8'));
  let rules = 0;
  root.walkAtRules((rule) => assert.ok(['media', 'keyframes'].includes(rule.name), `no @${rule.name}`));
  root.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') return; // keyframe steps, not selectors
    rules++;
    for (const selector of rule.selectors) assert.match(selector, /^(?:(?:html\.glass|html\.streaming|\[dir='rtl'\]) )?\.app\[data-lumen-canvas-shell\]/, `scoped: ${selector}`);
  });
  root.walkDecls((decl) => assert.ok(!/url\s*\(|@import/i.test(decl.value), 'no network/font dependency'));
  assert.ok(rules > 40);
});

test('CP04 Routing Center loads only through the "on" module, lazily, and its styles stay scoped', () => {
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const RoutingCenter: ComponentType \| null = null;$/m);
  const on = readFileSync('src/lib/canvas-presentation.on.ts', 'utf8');
  assert.match(on, /^export const RoutingCenter = lazy\(\(\) => import\('\.\.\/components\/RoutingCenter'\)\);$/m);
  assert.match(on, /^import '\.\.\/styles\/canvas-routing\.css';$/m);
  for (const file of ['src/App.tsx', 'src/components/Sidebar.tsx', 'src/components/SidebarCanvas.tsx', 'src/components/ChatView.tsx', 'src/main.tsx']) {
    assert.ok(!/import\(['"][^'"]*RoutingCenter/.test(readFileSync(file, 'utf8')), `${file} never imports the Routing Center`);
  }
  const app = readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /\{CANVAS_SHELL \? <>(?:\{CanvasNav && <CanvasNav collapsed=\{sidebarCollapsed\} onExpand=\{toggleSidebar\} \/>\})?<ChatView onExpandSidebar=\{toggleSidebar\} \/>\{RoutingCenter && <Suspense fallback=\{null\}><RoutingCenter \/><\/Suspense>\}<\/> : <ChatView onExpandSidebar=\{toggleSidebar\} \/>\}/);
  const root = postcss.parse(readFileSync('src/styles/canvas-routing.css', 'utf8'));
  let rules = 0;
  root.walkAtRules((rule) => assert.ok(['media'].includes(rule.name), `no @${rule.name}`));
  root.walkRules((rule) => { rules++; for (const selector of rule.selectors) assert.match(selector, /^(?:html\[data-qa-review\] )?\.app\[data-lumen-canvas-shell\]/, `scoped: ${selector}`); });
  root.walkDecls((decl) => assert.ok(!/url\s*\(|@import/i.test(decl.value), 'no network/font dependency'));
  assert.ok(rules > 40);
});

test('CP05 Canvas screens: document scope only while the shell is on; styles scoped and load nothing', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /^if \(CANVAS_SHELL\) \{ document\.documentElement\.setAttribute\('data-lumen-canvas', ''\); document\.documentElement\.setAttribute\('data-lumen-canvas-foundation', ''\); \}$/m);
  assert.match(readFileSync('src/lib/canvas-presentation.on.ts', 'utf8'), /^import '\.\.\/styles\/canvas-screens\.css';$/m);
  const root = postcss.parse(readFileSync('src/styles/canvas-screens.css', 'utf8'));
  let rules = 0;
  root.walkAtRules((rule) => assert.ok(['media'].includes(rule.name), `no @${rule.name}`));
  root.walkRules((rule) => { rules++; for (const selector of rule.selectors) assert.match(selector, /^html(?:\.glass)?\[data-lumen-canvas\]/, `scoped: ${selector}`); });
  root.walkDecls((decl) => assert.ok(!/url\s*\(|@import/i.test(decl.value), 'no network/font dependency'));
  assert.ok(rules > 40);
});
