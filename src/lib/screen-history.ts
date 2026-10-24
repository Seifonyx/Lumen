import { flushSync } from 'react-dom';
// Browser adapter for existing canonical UI owners. History contains opaque IDs, never account data or drafts.
import { configureBackLayerContext, reconcileBackLayers, backLayerOpen, backLayerIdentity, backLayerRestore, clearBackLayerRestore, subscribeBackLayers } from './back-stack';
import { clearScreenMemory } from './screen-memory';
import { useStore } from '../store';
import { getRoutingScreen, restoreRoutingScreen, subscribeRoutingCenter } from './routing-center';
const KEY = 'lumenScreen';
let entries = new Map<number, ReturnType<typeof capture>>();
const views = new Map<number, { focus: HTMLElement | null; scrolls: [string, number][] }>();
const scrollSelectors = ['.hub-scroll', '.rc-page', '.settings-scroll'];
let commit: (() => void) | null = null;
let replace: ((run: () => void) => void) | null = null;
/** Replace a completed form with its canonical destination; Cancel still traverses Back. */
export function replaceScreen(run: () => void) { if (replace) replace(run); else run(); }
/** Complete an irreversible local action without retaining a stale confirmation in Forward history. */
export function finishScreen(run: () => void) { replaceScreen(run); screenBack(); }
/** Combine synchronous canonical UI operations into one visible navigation step. */
export function navigateScreen(run: () => void) { const outer = applying; applying = true; try { run(); } finally { applying = outer; if (!outer) commit?.(); } }
// Position tracks the actual browser stack independently of opaque, never-reused entry IDs.
// After a Back and new push, the browser discards its Forward branch; prune our in-memory copy too.
let positions = new Map<number, number>();
let cursor = 0;
let active = 0, serial = 0, applying = false;
const session = /* @__PURE__ */ (() => Math.random().toString(36).slice(2))();
const capture = () => { const s = useStore.getState(); return { layerKey: backLayerOpen() ? backLayerIdentity() : null, restoreLayer: backLayerRestore(), activeProjectId: s.activeProjectId, currentId: s.currentId, runner: s.runner, layer: backLayerOpen(), canvasOpen: s.canvasOpen, canvasDocumentId: s.canvasDocumentId, page: s.page, pageArg: s.pageArg, settingsOpen: s.settingsOpen, settingsTab: s.settingsTab, projectWorkspaceOpen: s.projectWorkspaceOpen, routing: getRoutingScreen() }; };
type Screen = ReturnType<typeof capture>;
// Compare UI references/primitives only. Streaming updates must not stringify Study inputs or other page data.
const same = (a: Screen, b: Screen) => a.currentId === b.currentId && a.activeProjectId === b.activeProjectId
 && Boolean(a.runner) === Boolean(b.runner)
 && a.canvasOpen === b.canvasOpen && a.canvasDocumentId === b.canvasDocumentId
 && a.page === b.page && a.pageArg === b.pageArg && a.settingsOpen === b.settingsOpen && a.settingsTab === b.settingsTab
 && a.projectWorkspaceOpen === b.projectWorkspaceOpen && a.layer === b.layer && a.layerKey === b.layerKey
 && a.routing.open === b.routing.open && a.routing.section === b.routing.section && a.routing.provider === b.routing.provider;
export function screenBack(fallback?: () => void) {
  if (applying) { fallback?.(); return; }
  if (active > 0 && history.state?.[KEY]?.session === session) history.back();
  else fallback?.();
}
/** Navigate to the nearest meaningful Settings ancestor, not every transient tab/editor snapshot.
 * If Settings was the initial screen, replace its snapshot with the fallback (no phantom Back). */
export function screenBackToSettings(target: 'index' | 'exit', fallback: () => void) {
  const here = positions.get(active);
  if (!applying && here !== undefined && history.state?.[KEY]?.session === session) {
    const ancestors = [...positions].map(([id, pos]) => ({ pos, entry: entries.get(id) }))
      .filter(({ pos, entry }) => pos < here && Boolean(entry))
      .sort((a, b) => b.pos - a.pos);
    // A Settings visit starts after its nearest non-Settings ancestor. Do not jump
    // into an older, unrelated Settings visit merely because it remains in history.
    const origin = ancestors.find(({ entry }) => !entry!.settingsOpen);
    const index = ancestors.find(({ pos, entry }) => pos > (origin?.pos ?? -1) && entry!.settingsOpen && !entry!.settingsTab);
    // Connection Settings is a drill-down from Routing Center, not from the
    // global Settings index. One Back must restore the same provider detail.
    const destination = target === 'exit' ? origin : index || (origin?.entry?.routing.open ? origin : undefined);
    if (destination) { history.go(destination.pos - here); return; }
  }
  replaceScreen(fallback);
}
export const screenHasBack = () => active > 0;
export function installScreenHistory() {
  // A local layer on an unmounted/covered canonical screen must not become a second
  // entry when its effect cleans up after Settings or another destination has opened.
  configureBackLayerContext(() => { const s = useStore.getState(); const r = getRoutingScreen(); return JSON.stringify([s.page, s.currentId, s.settingsOpen, s.settingsTab, s.projectWorkspaceOpen, s.canvasOpen, r.open, r.section, r.provider]); });
  let owner = useStore.getState().user?.uid;
  let previous = capture();
  const remember = () => {
    entries = new Map([[0, capture()]]); positions = new Map([[0, 0]]); cursor = 0; active = 0;
    history.replaceState({ ...history.state, [KEY]: { session, id: 0 } }, '');
  };
  remember();
  const saveView = () => views.set(active, { focus: document.activeElement instanceof HTMLElement ? document.activeElement : null, scrolls: scrollSelectors.map(selector => [selector, document.querySelector(selector)?.scrollTop || 0]) });
  const check = () => {
    if (applying) return;
    if (owner !== useStore.getState().user?.uid) { owner = useStore.getState().user?.uid; applying = true; reconcileBackLayers(null); clearScreenMemory(); clearBackLayerRestore(); views.clear(); useStore.setState({ page: null, settingsOpen: false, projectWorkspaceOpen: false, runner: null }); restoreRoutingScreen({ open: false, section: 'overview' }); remember(); previous = capture(); applying = false; return; }
    const next = capture();
    if (same(next, previous)) { entries.set(active, next); return; }
    saveView();
    const root = (value: typeof next) => !value.runner && !value.canvasOpen && !value.page && !value.settingsOpen && !value.projectWorkspaceOpen && !value.routing.open && !value.layer;
    if (root(previous) && root(next)) { previous = next; entries.set(active, next); return; }
    previous = next;
    for (const [id, pos] of positions) if (pos > cursor) { positions.delete(id); entries.delete(id); views.delete(id); }
    cursor += 1;
    active = ++serial; entries.set(active, next); positions.set(active, cursor);
    history.pushState({ ...history.state, [KEY]: { session, id: active } }, '');
  };
  const pop = () => {
    const marker = history.state?.[KEY];
    if (marker?.session !== session || !entries.has(marker.id)) return;
    saveView(); active = marker.id; cursor = positions.get(active) ?? cursor; const next = entries.get(active)!;
    applying = true;
    const { routing, layer, layerKey: _layerKey, restoreLayer, ...ui } = next;
    const fresh = useStore.getState();
    if (ui.activeProjectId && !fresh.settings.projects?.some(p => p.id === ui.activeProjectId)) { ui.activeProjectId = null; ui.projectWorkspaceOpen = false; }
    if (ui.currentId && !fresh.chats.some(c => c.id === ui.currentId)) ui.currentId = fresh.currentId;
    // Flush React's local-layer effects while replay is guarded, so WebKit cannot record
    // an intermediate unmount/reopen as another user navigation.
    flushSync(() => {
      const mounted = reconcileBackLayers(layer ? _layerKey : null);
      if (layer && !mounted) restoreLayer?.();
      const pushed = ui.page || ui.settingsOpen || ui.canvasOpen || ui.projectWorkspaceOpen || routing.open;
      useStore.setState(window.matchMedia?.('(max-width:899px)').matches && pushed ? {...ui,sidebarOpen:false} : ui); restoreRoutingScreen(routing);
    });
    previous = capture(); entries.set(active, previous); applying = false;
    const focusAtReplay = document.activeElement;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // A fast tap/keystroke after Back owns focus; delayed restoration must not dismiss its menu or steal typing.
      if (document.activeElement !== focusAtReplay && document.activeElement?.matches('button,input,textarea,select,[role="menuitem"],a[href]')) return;
      const view = views.get(active);
      view?.scrolls.forEach(([selector, top]) => document.querySelector(selector)?.scrollTo(0, top));
      const focus = view?.focus?.isConnected && !view.focus.closest('[inert],[hidden],.exit-ghost') ? view.focus : document.querySelector<HTMLElement>('.phone-navigation h1, .settings-page h1, .hub-bar h1, .menu-btn');
      focus?.focus({ preventScroll: true });
    }));
  };
  replace = (run) => {
    applying = true;
    try { flushSync(run); } finally { previous = capture(); entries.set(active, previous); applying = false; }
  };
  commit = check;
  const a = useStore.subscribe(check), b = subscribeRoutingCenter(check), c = subscribeBackLayers(check);
  window.addEventListener('popstate', pop);
  return () => { replace = null; commit = null; a(); b(); c(); window.removeEventListener('popstate', pop); };
}
