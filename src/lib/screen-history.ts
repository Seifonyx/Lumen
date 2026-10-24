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
export function navigateScreen(run: () => void) { applying = true; try { run(); } finally { applying = false; commit?.(); } }
let active = 0, serial = 0, applying = false;
const session = /* @__PURE__ */ (() => Math.random().toString(36).slice(2))();
const capture = () => { const s = useStore.getState(); return { layerKey: backLayerOpen() ? backLayerIdentity() : null, restoreLayer: backLayerRestore(), activeProjectId: s.activeProjectId, currentId: s.currentId, layer: backLayerOpen(), canvasOpen: s.canvasOpen, canvasDocumentId: s.canvasDocumentId, page: s.page, pageArg: s.pageArg, settingsOpen: s.settingsOpen, settingsTab: s.settingsTab, projectWorkspaceOpen: s.projectWorkspaceOpen, routing: getRoutingScreen() }; };
type Screen = ReturnType<typeof capture>;
// Compare UI references/primitives only. Streaming updates must not stringify Study inputs or other page data.
const same = (a: Screen, b: Screen) => a.currentId === b.currentId && a.activeProjectId === b.activeProjectId
 && a.canvasOpen === b.canvasOpen && a.canvasDocumentId === b.canvasDocumentId
 && a.page === b.page && a.pageArg === b.pageArg && a.settingsOpen === b.settingsOpen && a.settingsTab === b.settingsTab
 && a.projectWorkspaceOpen === b.projectWorkspaceOpen && a.layer === b.layer && a.layerKey === b.layerKey
 && a.routing.open === b.routing.open && a.routing.section === b.routing.section && a.routing.provider === b.routing.provider;
export function screenBack(fallback?: () => void) {
  if (applying) { fallback?.(); return; }
  if (active > 0 && history.state?.[KEY]?.session === session) history.back();
  else fallback?.();
}
export const screenHasBack = () => active > 0;
export function installScreenHistory() {
  // A local layer on an unmounted/covered canonical screen must not become a second
  // entry when its effect cleans up after Settings or another destination has opened.
  configureBackLayerContext(() => { const s = useStore.getState(); const r = getRoutingScreen(); return JSON.stringify([s.page, s.currentId, s.settingsOpen, s.settingsTab, s.projectWorkspaceOpen, s.canvasOpen, r.open, r.section, r.provider]); });
  let owner = useStore.getState().user?.uid;
  let previous = capture();
  const remember = () => {
    entries = new Map([[0, capture()]]); active = 0;
    history.replaceState({ ...history.state, [KEY]: { session, id: 0 } }, '');
  };
  remember();
  const saveView = () => views.set(active, { focus: document.activeElement instanceof HTMLElement ? document.activeElement : null, scrolls: scrollSelectors.map(selector => [selector, document.querySelector(selector)?.scrollTop || 0]) });
  const check = () => {
    if (applying) return;
    if (owner !== useStore.getState().user?.uid) { owner = useStore.getState().user?.uid; applying = true; reconcileBackLayers(null); clearScreenMemory(); clearBackLayerRestore(); views.clear(); useStore.setState({ page: null, settingsOpen: false, projectWorkspaceOpen: false }); restoreRoutingScreen({ open: false, section: 'overview' }); remember(); previous = capture(); applying = false; return; }
    const next = capture();
    if (same(next, previous)) { entries.set(active, next); return; }
    saveView();
    const root = (value: typeof next) => !value.canvasOpen && !value.page && !value.settingsOpen && !value.projectWorkspaceOpen && !value.routing.open && !value.layer;
    if (root(previous) && root(next)) { previous = next; entries.set(active, next); return; }
    previous = next;
    active = ++serial; entries.set(active, next);
    history.pushState({ ...history.state, [KEY]: { session, id: active } }, '');
  };
  const pop = () => {
    const marker = history.state?.[KEY];
    if (marker?.session !== session || !entries.has(marker.id)) return;
    saveView(); active = marker.id; const next = entries.get(active)!;
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
      useStore.setState(ui); restoreRoutingScreen(routing);
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
