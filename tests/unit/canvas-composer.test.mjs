// CP02 static guards: the Canvas composer stays off in the ordinary build, only the QA review build turns it on,
// its styles are scoped to the opted-in composer, and Composer keeps the ordinary JSX in every flagged branch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

test('the Canvas composer flag is off in the ordinary build and on only through the QA replacement', () => {
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const CANVAS_COMPOSER = false;$/m);
  const qa = readFileSync('qa/iphone/adapters/canvas-presentation.ts', 'utf8');
  assert.match(qa, /^export const CANVAS_COMPOSER = true;$/m);
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const CANVAS_SHELL = false;$/m);
  assert.match(qa, /^export const CANVAS_SHELL = true;$/m);
  assert.match(readFileSync('vite.qa.config.ts', 'utf8'), /\[at\('src\/lib\/canvas-presentation\.ts'\)\]: at\('qa\/iphone\/adapters\/canvas-presentation\.ts'\)/);
  assert.ok(!/canvas-presentation|canvas(?:-composer|-shell)?\.css/.test(readFileSync('vite.config.ts', 'utf8')), 'the ordinary config never enables it');
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
  assert.equal(ternaries.length, 3);
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
  assert.equal(t[1].replace(/<button type="button" className="icon-btn cv-compose"[^]*?<\/button>/, '').replace(/^\{|\}$/g, ''), t[2], 'its ordinary branch is unchanged');
  const root = postcss.parse(readFileSync('src/styles/canvas-shell.css', 'utf8'));
  let rules = 0;
  root.walkAtRules((rule) => assert.ok(['media', 'keyframes'].includes(rule.name), `no @${rule.name}`));
  root.walkRules((rule) => {
    rules++;
    for (const selector of rule.selectors) assert.match(selector, /^(?:(?:html\.glass|\[dir='rtl'\]) )?\.app\[data-lumen-canvas-shell\]/, `scoped: ${selector}`);
  });
  root.walkDecls((decl) => assert.ok(!/url\s*\(|@import/i.test(decl.value), 'no network/font dependency'));
  assert.ok(rules > 40);
});

test('CP04 Routing Center loads only through the QA switch and its styles stay scoped', () => {
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const RoutingCenter: ComponentType \| null = null;$/m);
  const qa = readFileSync('qa/iphone/adapters/canvas-presentation.ts', 'utf8');
  assert.match(qa, /^export const RoutingCenter = lazy\(\(\) => import\('\.\.\/\.\.\/\.\.\/src\/components\/RoutingCenter'\)\);$/m);
  assert.match(qa, /import '\.\.\/\.\.\/\.\.\/src\/styles\/canvas-routing\.css';/);
  for (const file of ['src/App.tsx', 'src/components/Sidebar.tsx', 'src/components/SidebarCanvas.tsx', 'src/components/ChatView.tsx', 'src/main.tsx']) {
    assert.ok(!/import\(['"][^'"]*RoutingCenter/.test(readFileSync(file, 'utf8')), `${file} never imports the Routing Center`);
  }
  const app = readFileSync('src/App.tsx', 'utf8');
  assert.match(app, /\{CANVAS_SHELL \? <><ChatView onExpandSidebar=\{toggleSidebar\} \/>\{RoutingCenter && <Suspense fallback=\{null\}><RoutingCenter \/><\/Suspense>\}<\/> : <ChatView onExpandSidebar=\{toggleSidebar\} \/>\}/);
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
  assert.match(readFileSync('qa/iphone/adapters/canvas-presentation.ts', 'utf8'), /import '\.\.\/\.\.\/\.\.\/src\/styles\/canvas-screens\.css';/);
  const root = postcss.parse(readFileSync('src/styles/canvas-screens.css', 'utf8'));
  let rules = 0;
  root.walkAtRules((rule) => assert.ok(['media'].includes(rule.name), `no @${rule.name}`));
  root.walkRules((rule) => { rules++; for (const selector of rule.selectors) assert.match(selector, /^html(?:\.glass)?\[data-lumen-canvas\]/, `scoped: ${selector}`); });
  root.walkDecls((decl) => assert.ok(!/url\s*\(|@import/i.test(decl.value), 'no network/font dependency'));
  assert.ok(rules > 40);
});
