// Phase 2 Canvas navigation: CanvasNav (Back, focus return, collapsed rail) exists only behind the Canvas switch, so
// the ordinary build has no import of it and its output stays unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('CanvasNav is null in the ordinary switch and comes only from the "on" module', () => {
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const CanvasNav: ComponentType<\{ collapsed: boolean; onExpand: \(\) => void \}> \| null = null;$/m);
  assert.match(readFileSync('src/lib/canvas-presentation.on.ts', 'utf8'), /^export \{ default as CanvasNav \} from '\.\.\/components\/CanvasNav';$/m);
  for (const file of ['src/App.tsx', 'src/components/Sidebar.tsx', 'src/components/SidebarCanvas.tsx', 'src/components/ChatView.tsx', 'src/main.tsx']) {
    assert.ok(!/from ['"][^'"]*components\/CanvasNav['"]/.test(readFileSync(file, 'utf8')), `${file} never imports CanvasNav directly`);
  }
  // Mounted only inside the Canvas branch of App.
  assert.match(readFileSync('src/App.tsx', 'utf8'), /\{CANVAS_SHELL \? <>\{CanvasNav && <CanvasNav collapsed=\{sidebarCollapsed\} onExpand=\{toggleSidebar\} \/>\}<ChatView/);
});

test('CanvasNav keeps one history entry for pages shown in place of the chat and reads no settings or data', () => {
  const src = readFileSync('src/components/CanvasNav.tsx', 'utf8');
  assert.equal((src.match(/history\.pushState\(/g) || []).length, 1, 'one place adds an entry');
  assert.match(src, /if \(!history\.state\?\.\[MARK\]\) history\.pushState/, 'moving between pages reuses the entry');
  assert.match(src, /ownPops\+\+; history\.back\(\)/, 'closing inside the app takes the entry back');
  assert.ok(!/localStorage|indexedDB|fetch\(|settings\./.test(src), 'presentation only');
  // The rail is the same navigation, loaded with the first collapse: no chat list or project tree of its own.
  assert.match(src, /const CanvasRail = lazy\(\(\) => import\('\.\/CanvasRail'\)\);/);
  const rail = readFileSync('src/components/CanvasRail.tsx', 'utf8');
  for (const file of [src, rail]) assert.ok(!/ChatRow|s\.chats|settings\.projects|localStorage|indexedDB|fetch\(/.test(file), 'no second copy of the tree, presentation only');
});
