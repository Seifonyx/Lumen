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
  // One entry for whatever is open; Back that leaves something open underneath re-adds it (slice 3).
  assert.equal((src.match(/history\.pushState\(/g) || []).length, 2, 'an entry is added on open, and again only for what Back left open');
  assert.match(src, /if \(!history\.state\?\.\[MARK\]\) history\.pushState/, 'moving between pages reuses the entry');
  assert.match(src, /ownPops\+\+; history\.back\(\)/, 'closing inside the app takes the entry back');
  assert.ok(!/localStorage|indexedDB|fetch\(|settings\./.test(src), 'presentation only');
  // The rail is the same navigation, loaded with the first collapse: no chat list or project tree of its own.
  assert.match(src, /const CanvasRail = lazy\(\(\) => import\('\.\/CanvasRail'\)\);/);
  const rail = readFileSync('src/components/CanvasRail.tsx', 'utf8');
  for (const file of [src, rail]) assert.ok(!/ChatRow|s\.chats|settings\.projects|localStorage|indexedDB|fetch\(/.test(file), 'no second copy of the tree, presentation only');
});

test("the tree's arrow keys load lazily from SidebarCanvas only, and change no roles", () => {
  const tree = readFileSync('src/components/SidebarCanvas.tsx', 'utf8');
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const loadTreeKeys: .+ \| null = null;$/m);
  assert.match(readFileSync('src/lib/canvas-presentation.on.ts', 'utf8'), /^export const loadTreeKeys = \(\) => import\('\.\/tree-keys'\);$/m);
  assert.ok(!/(?<!typeof )import\('\.\.\/lib\/tree-keys'\)|from '\.\.\/lib\/tree-keys'/.test(tree), 'only through the switch (no ordinary chunk), never static');
  for (const file of ['src/App.tsx', 'src/components/Sidebar.tsx', 'src/components/ChatView.tsx', 'src/main.tsx']) assert.ok(!readFileSync(file, 'utf8').includes('tree-keys'), file);
  const keys = readFileSync('src/lib/tree-keys.ts', 'utf8');
  assert.ok(!/setAttribute|removeAttribute|tabIndex|\.role\s*=/.test(keys), 'rows keep their button semantics');
  // The shared ChatRow keeps its single Canvas seam; the tree adds current/pinned state as attributes.
  assert.match(tree, /setAttribute\('aria-current', 'page'\)/);
  assert.match(tree, /\[row\.querySelector\('\.pin-mark'\) && `\$\{ids\}-pinned`, draft && `\$\{ids\}-draft`\]/);
});

test('global New chat is always general; a project folder New chat is always that project (Canvas only)', () => {
  const lib = readFileSync('src/lib/new-chat.ts', 'utf8');
  assert.match(lib, /export function newGeneralChat\(\) \{[^]*?useStore\.setState\(\{ activeProjectId: null \}\)[^]*?newChat\(\);/, 'clears the remembered project first');
  assert.ok(!/moveChatToProject|currentId/.test(lib), 'moves no chat');
  assert.match(readFileSync('src/lib/canvas-presentation.ts', 'utf8'), /^export const newGeneralChat: \(\(\) => void\) \| null = null;$/m);
  assert.match(readFileSync('src/lib/canvas-presentation.on.ts', 'utf8'), /^export \{ newGeneralChat \} from '\.\/new-chat';$/m);
  // Every global trigger goes through it: ⌘⇧O, the palette, the top bar, the sidebar, the drawer and the rail.
  assert.match(readFileSync('src/App.tsx', 'utf8'), /if \(shortcut === 'new-chat'\) \{ if \(newGeneralChat\) newGeneralChat\(\); else s\.newChat\(\); \}/);
  assert.match(readFileSync('src/components/CommandPalette.tsx', 'utf8'), /run: newGeneralChat \|\| newChat/);
  assert.match(readFileSync('src/components/ChatView.tsx', 'utf8'), /className="icon-btn cv-compose"[^>]*onClick=\{\(\) => \(newGeneralChat \|\| useStore\.getState\(\)\.newChat\)\(\)\}/);
  const tree = readFileSync('src/components/SidebarCanvas.tsx', 'utf8');
  assert.match(tree, /className="cv-dest-new"[^>]*onClick=\{newGeneralChat\}/);
  assert.match(tree, /className="cv-new-pill" onClick=\{newGeneralChat\} aria-label="New chat"/);
  assert.match(tree, /className="cv-new-here" onClick=\{\(\) => newProjectChat\(p\.id\)\}/);
  assert.ok(!/[^.]newChat\b/.test(tree.replace(/newGeneralChat|newProjectChat/g, '')), 'the tree never calls the inheriting newChat');
  assert.match(readFileSync('src/components/CanvasRail.tsx', 'utf8'), /newGeneralChat\(\)/);
});

test('slice 3: Back covers Settings, a project overview and registered layers; the tree marks unsent drafts', () => {
  const nav = readFileSync('src/components/CanvasNav.tsx', 'utf8');
  assert.match(nav, /s\.settingsOpen \|\| s\.projectWorkspaceOpen \|\| routingCenterOpen\(\) \|\| backLayerOpen\(\)/);
  assert.match(nav, /closeTopSurface\(\);\s*\n\s*\/\/ Something is still open underneath/, 'Back closes the topmost surface only');
  const tree = readFileSync('src/components/SidebarCanvas.tsx', 'utf8');
  assert.match(tree, /useBackLayer\(allChats, \(\) => setAllChats\(false\)\)/);
  assert.match(tree, /localStorage\.getItem\(`mr\.draft\.\$\{user\?\.uid\}\.\$\{row\.dataset\.flip\}`\)/, 'reads the composer\'s own per-chat draft key');
  assert.match(readFileSync('src/styles/canvas-shell.css', 'utf8'), /content: 'Draft' \/ ''/, 'visual word only; screen readers get the description');
});
