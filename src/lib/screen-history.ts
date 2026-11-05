import { flushSync } from 'react-dom';
// Browser adapter for existing canonical UI owners. History contains opaque IDs, never account data or drafts.
import { configureBackLayerContext, reconcileBackLayers, backLayerOpen, backLayerIdentity, backLayerRestore, clearBackLayerRestore, subscribeBackLayers } from './back-stack';
import { clearScreenMemory } from './screen-memory';
import { cancelPageSwap } from './motion';
import { useStore } from '../store';
import { getRoutingScreen, restoreRoutingScreen, subscribeRoutingCenter } from './routing-center';
import { isIOS, isStandalone } from './device';
import { onResumed, resumeInProgress } from './resume';
const KEY = 'lumenScreen';
let entries = new Map<number, ReturnType<typeof capture>>();
const views = new Map<number, { focus: HTMLElement | null; scrolls: [string, number][] }>();
const scrollSelectors = ['.hub-scroll', '.rc-page', '.rc-scroll', '.settings-scroll'];
let commit: (() => void) | null = null;
let replace: ((run: () => void) => void) | null = null;
/** Replace a completed form with its canonical destination; Cancel still traverses Back. */
export function replaceScreen(run: () => void) { if (replace) replace(run); else run(); }
/** Complete an irreversible local action without retaining a stale confirmation in Forward history. */
export function finishScreen(run: () => void) { replaceScreen(run); screenBack(); }
/** Combine synchronous canonical UI operations into one visible navigation step. */
export function navigateScreen(run: () => void) { const outer = applying; applying = true; try { run(); } finally { applying = outer; if (!outer) commit?.(); } }
/** One step across several handlers of the same tap (a drawer's capture handler and the item's own): returns the end,
 * which also runs on its own after the event in case a handler stops it. */
export function holdScreenStep() {
  if (applying) return () => {};
  applying = true;
  let open = true;
  const end = () => { if (!open) return; open = false; applying = false; commit?.(); };
  window.setTimeout(end, 0);
  return end;
}
// Position tracks the actual browser stack independently of opaque, never-reused entry IDs.
// After a Back and new push, the browser discards its Forward branch; prune our in-memory copy too.
let positions = new Map<number, number>();
let cursor = 0;
let active = 0, serial = 0, applying = false;
let traversalTimer: number | undefined;
const clearTraversal = () => { window.clearTimeout(traversalTimer); traversalTimer = undefined; };
// Back and Exit are asynchronous. Ignore another app traversal until the browser has settled.
// Release the guard if the browser drops a traversal (for example, when throttling history calls).
function traverse(delta: number) {
  if (traversalTimer !== undefined) return;
  traversalTimer = window.setTimeout(clearTraversal, 1000);
  if (inMemory) {
    // The stack is the app's own: move to the entry and replay it as the browser would, a task later.
    const target = [...positions].find(([, pos]) => pos === cursor + delta);
    if (!target) { clearTraversal(); return; }
    window.setTimeout(() => {
      history.replaceState({ ...history.state, [KEY]: { session, id: target[0] } }, '');
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    }, 0);
    return;
  }
  try { history.go(delta); } catch (error) { clearTraversal(); throw error; }
}
// iOS Home Screen web apps (iOS 26) have Safari's own edge swipe: it slides in a snapshot of the previous entry, taken
// when it was left (often stale: the drawer still open over the chat), and goes Back by itself alongside the app's own
// gestures. There the stack lives in memory over one browser entry, so the system swipe has nothing to go back to and
// every swipe is the app's (navigation-coordinator.ts, sidebar-gesture.ts). Tests that drive browser Back and Forward
// on a Home Screen app opt out (window.__mrRealHistory), as on Android, whose installed apps keep real history.
let inMemory = false;
export const screenStackInMemory = () => inMemory;
const session = /* @__PURE__ */ (() => Math.random().toString(36).slice(2))();
const capture = () => { const s = useStore.getState(); return { layerKey: backLayerOpen() ? backLayerIdentity() : null, restoreLayer: backLayerRestore(), activeProjectId: s.activeProjectId, currentId: s.currentId, runner: s.runner, layer: backLayerOpen(), canvasOpen: s.canvasOpen, canvasDocumentId: s.canvasDocumentId, page: s.page, pageArg: s.pageArg, settingsOpen: s.settingsOpen, settingsTab: s.settingsTab, projectWorkspaceOpen: s.projectWorkspaceOpen, routing: getRoutingScreen() }; };
export type Screen = ReturnType<typeof capture>;
// The Canvas navigation coordinator (navigation-coordinator.ts) is told before each new step, while the leaving screen
// is still on screen, and when history starts over (id -1: sign-in, account switch). It keeps no browser payload.
let leave: ((from: number, next: Screen) => void) | null = null;
export const onScreenLeave = (fn: typeof leave) => { leave = fn; };
export const screenEntry = () => entries.get(active);
// …and around each restore from history: before (true when the app itself asked for the traversal) and after.
let pops: { before: (app: boolean) => void; after: () => void } | null = null;
export const onScreenPop = (hooks: typeof pops) => { pops = hooks; };
// Feature ownership travels with the existing in-memory entries, never the browser payload.
// A root visit was chosen in the phone drawer (or began the session): like a place picked in an iOS app's sidebar, it
// replaces the screen rather than being pushed over it, so its first screen has no Back (its swipe opens the drawer).
// `key` names the visit: two visits can begin at the same entry (the session's first screen begins at itself).
type Visit = { key: number; feature: string; origin: number; direct?: boolean; root?: boolean };
let visitSerial = 0;
const visits = new Map<number, Visit>();
let directExit: number | null = null;
// Set while a tap in the open phone drawer is being handled: the drawer closes and a place opens in the same task.
let fromDrawer = false;
const phoneLayout = () => window.matchMedia?.('(max-width:899px)').matches;
// Router's section tabs switch in place on phones, like a segmented control: one screen, not a step per tab (a sub-screen
// of the tab being left goes with it). A link inside the content that changes section (Manage model) is still a step.
let tapping = false;
/** Runs a tap on a section tab: on phones it switches in place instead of adding a history step. */
export function switchTab(run: () => void) { tapping = phoneLayout(); try { run(); } finally { tapping = false; } }
const tabSwitch = (a: Screen, b: Screen) => tapping && a.routing.open && b.routing.open && !b.routing.provider && !b.layer
 && a.routing.section !== b.routing.section && same({ ...a, layer: false, layerKey: null }, { ...b, routing: a.routing });
const screenListeners = new Set<() => void>();
/** Notified whenever the current screen entry changes (for controls that depend on where Back leads). */
export const subscribeScreens = (fn: () => void) => { screenListeners.add(fn); return () => { screenListeners.delete(fn); }; };
let screenVersion = 0;
export const screenSnapshot = () => screenVersion;
const screensChanged = () => { screenVersion++; screenListeners.forEach((fn) => fn()); };
const closeFeature = () => { reconcileBackLayers(null); useStore.setState({ page: null, pageArg: undefined, canvasOpen: false, preview: null, runner: null, settingsOpen: false, projectWorkspaceOpen: false }); restoreRoutingScreen({ open: false, section: 'models' }); };
const feature = (s: Screen) => s.page === 'collection' ? 'library' : ['tools','assistants','study'].includes(s.page || '') ? 'tools' : s.page || (s.routing.open ? 'prism' : s.projectWorkspaceOpen ? 'projects' : s.canvasOpen ? 'canvas' : s.runner ? 'tools' : s.settingsOpen ? 'settings' : s.layer ? 'overlay' : null);
// Where Exit leads: the entry the visit began from, while it is still behind this one in this tab's history.
function exitTarget() {
  const visit = visits.get(active), here = positions.get(active), there = visit && positions.get(visit.origin);
  if (applying || here === undefined || there === undefined || there >= here || history.state?.[KEY]?.session !== session) return null;
  return { id: visit!.origin, delta: there - here, direct: Boolean(visit!.direct) };
}
/** Exit the entire visit by traversing to its origin. Sequential browser history remains intact. */
export function exitFeature(fallback?: () => void) {
  if (traversalTimer !== undefined || !window.dispatchEvent(new Event('lumen:before-feature-exit', { cancelable: true }))) return;
  // A place chosen in the drawer replaced the screen before it: leaving it goes to the chat, not back to that screen.
  const visit = visits.get(active);
  const target = visit?.root && !visit.direct ? null : exitTarget();
  if (target) { if (target.direct) directExit = target.id; traverse(target.delta); return; }
  replaceScreen(() => {
    if (fallback) { reconcileBackLayers(null); fallback(); } else closeFeature();
  });
}
export function featureExitLabel() {
  const visit = visits.get(active), origin = visit && entries.get(visit.origin);
  return origin && !visit?.direct && feature(origin) ? 'Return to previous screen' : 'Return to chat';
}
// Settings target metadata updates the current snapshot without adding a navigation step.
// Compare UI references/primitives only. Streaming updates must not stringify Study inputs or other page data.
const same = (a: Screen, b: Screen) => a.currentId === b.currentId && a.activeProjectId === b.activeProjectId
 && Boolean(a.runner) === Boolean(b.runner)
 && a.canvasOpen === b.canvasOpen && a.canvasDocumentId === b.canvasDocumentId
 && a.page === b.page && a.pageArg === b.pageArg && a.settingsOpen === b.settingsOpen && a.settingsTab === b.settingsTab
 && a.projectWorkspaceOpen === b.projectWorkspaceOpen && a.layer === b.layer && a.layerKey === b.layerKey
 && a.routing.open === b.routing.open && a.routing.section === b.routing.section && a.routing.provider === b.routing.provider;
export function screenBack(fallback?: () => void) {
  if (applying) { fallback?.(); return; }
  if (screenHasBack()) traverse(-1);
  else fallback?.();
}
// The nearest meaningful Settings ancestor, not every transient tab/editor snapshot.
function settingsTarget(target: 'index' | 'exit') {
  const here = positions.get(active);
  if (applying || here === undefined || history.state?.[KEY]?.session !== session) return null;
  const ancestors = [...positions].map(([id, pos]) => ({ id, pos, entry: entries.get(id) }))
    .filter(({ pos, entry }) => pos < here && Boolean(entry))
    .sort((a, b) => b.pos - a.pos);
  // A Settings visit starts after its nearest non-Settings ancestor. Do not jump
  // into an older, unrelated Settings visit merely because it remains in history.
  const origin = ancestors.find(({ entry }) => !entry!.settingsOpen);
  const index = ancestors.find(({ pos, entry }) => pos > (origin?.pos ?? -1) && entry!.settingsOpen && !entry!.settingsTab);
  // Connection Settings is a drill-down from Routing Center, not from the
  // global Settings index. One Back must restore the same provider detail.
  const destination = target === 'exit' ? origin : index || (origin?.entry?.routing.open ? origin : undefined);
  return destination ? { id: destination.id, delta: destination.pos - here } : null;
}
/** Navigate to the nearest meaningful Settings ancestor.
 * If Settings was the initial screen, replace its snapshot with the fallback (no phantom Back). */
export function screenBackToSettings(target: 'index' | 'exit', fallback: () => void) {
  const destination = settingsTarget(target);
  if (destination) traverse(destination.delta);
  else replaceScreen(fallback);
}
// A screen's Back (its leading control and the Back swipe) goes up one level, as in an iOS navigation stack: a Settings
// section returns to the Settings list, a drill-down (a provider, a document, a project) to the screen it was opened
// from within the same place, and the first screen of a place pushed from a chat back to that chat. The first screen of
// a place chosen in the drawer has no Back: it is a root, and its swipe opens the drawer.
const upToSettings = (e: Screen | undefined) => Boolean(e?.settingsOpen && e.settingsTab);
function upTarget(): { id: number; delta: number; direct?: boolean } | null {
  const here = entries.get(active);
  if (upToSettings(here)) return settingsTarget('index');
  const visit = visits.get(active), pos = positions.get(active);
  if (!visit || applying || pos === undefined || history.state?.[KEY]?.session !== session) return null;
  // The nearest earlier screen of the same visit (sheets and dialogs are closed by their own controls, not by Back).
  const level = [...positions].filter(([id, p]) => p < pos && visits.get(id)?.key === visit.key && !entries.get(id)?.layer).sort((a, b) => b[1] - a[1])[0];
  if (level) return { id: level[0], delta: level[1] - pos };
  if (visit.root) return null;
  return exitTarget();
}
/** The screen Back leads to, as the Back swipe shows it underneath. Null on a root screen (the drawer owns its swipe). */
export function screenParent(): { id: number; entry: Screen } | null {
  const target = upTarget();
  const entry = target && entries.get(target.id);
  if (!target || !entry) return null;
  return { id: target.id, entry };
}
/** True on a root screen: a conversation, or the first screen of a place chosen in the drawer. A Settings section never
 * is: even opened directly, its Back returns to the Settings list. */
export function screenIsRoot() {
  if (upToSettings(entries.get(active))) return false;
  const visit = visits.get(active);
  return !visit || (Boolean(visit.root) && !upTarget());
}
/** Back for the current screen: see screenParent. False when the screen refused to be left (nothing happened). */
export function screenUp(fallback?: () => void) {
  if (upToSettings(entries.get(active))) { screenBackToSettings('index', () => useStore.getState().setUi({ settingsTab: '' })); return true; }
  const target = upTarget();
  // A screen that must not be left yet (an unsaved document name, an unsent edit) can refuse, as with Exit; the
  // fallback and Exit paths ask it themselves.
  if (target) {
    if (traversalTimer !== undefined || !window.dispatchEvent(new Event('lumen:before-feature-exit', { cancelable: true }))) return false;
    traverse(target.delta);
  } else if (fallback) replaceScreen(fallback);
  else exitFeature();
  return true;
}
export const screenHasBack = () => cursor > 0 && history.state?.[KEY]?.session === session;
export function installScreenHistory() {
  // A local layer on an unmounted/covered canonical screen must not become a second
  // entry when its effect cleans up after Settings or another destination has opened.
  configureBackLayerContext(() => { const s = useStore.getState(); const r = getRoutingScreen(); return JSON.stringify([s.page, s.currentId, s.settingsOpen, s.settingsTab, s.projectWorkspaceOpen, s.canvasOpen, r.open, r.section, r.provider]); });
  inMemory = isIOS() && isStandalone() && !(window as { __mrRealHistory?: boolean }).__mrRealHistory;
  let owner = useStore.getState().user?.uid;
  let previous = capture();
  let replay = 0;
  let drawerOpen = useStore.getState().sidebarOpen;
  const remember = () => {
    ++replay;
    clearTraversal();
    visits.clear();
    directExit = null;
    entries = new Map([[0, capture()]]); positions = new Map([[0, 0]]); cursor = 0; active = 0; leave?.(-1, entries.get(0)!);
    const initialFeature = feature(capture());
    if (initialFeature) visits.set(0, { key: ++visitSerial, feature: initialFeature, origin: 0, direct: true, root: true });
    screensChanged();
    history.replaceState({ ...history.state, [KEY]: { session, id: 0 } }, '');
  };
  remember();
  const saveView = () => views.set(active, { focus: document.activeElement instanceof HTMLElement ? document.activeElement : null, scrolls: scrollSelectors.map(selector => [selector, document.querySelector(selector)?.scrollTop || 0]) });
  const check = () => {
    if (applying || resumeInProgress()) return;
    if (owner !== useStore.getState().user?.uid) { owner = useStore.getState().user?.uid; applying = true; reconcileBackLayers(null); clearScreenMemory(); clearBackLayerRestore(); views.clear(); useStore.setState({ page: null, settingsOpen: false, projectWorkspaceOpen: false, runner: null }); restoreRoutingScreen({ open: false, section: 'overview' }); remember(); previous = capture(); applying = false; return; }
    // A canceled/closed Settings visit cannot leave a provider target for a later general visit.
    // Target metadata travels with the existing in-memory snapshot, never the browser payload.
    const routing = getRoutingScreen();
    if (!useStore.getState().settingsOpen && routing.settingsTarget) {
      applying = true; restoreRoutingScreen({ ...routing, settingsTarget: null }); applying = false;
    }
    const s = useStore.getState();
    // The drawer closing in the same task as a place opening means the place was chosen in the drawer.
    if (drawerOpen && !s.sidebarOpen && phoneLayout()) { fromDrawer = true; window.setTimeout(() => { fromDrawer = false; }, 0); }
    drawerOpen = s.sidebarOpen;
    const next = capture();
    if (same(next, previous)) { entries.set(active, next); return; }
    if (tabSwitch(previous, next)) { previous = next; entries.set(active, next); return; }
    saveView();
    const root = (value: typeof next) => !value.runner && !value.canvasOpen && !value.page && !value.settingsOpen && !value.projectWorkspaceOpen && !value.routing.open && !value.layer;
    if (root(previous) && root(next)) { previous = next; entries.set(active, next); return; }
    const currentVisit = visits.get(active), nextFeature = feature(next), picked = fromDrawer || (s.sidebarOpen && phoneLayout());
    const child = !picked && currentVisit && (nextFeature === currentVisit.feature || next.settingsOpen || next.layer || (previous.page && !next.page && (next.canvasOpen || next.runner)));
    const visit = child ? currentVisit : nextFeature ? { key: ++visitSerial, feature: nextFeature, origin: active, ...(picked ? { root: true } : {}) } : undefined;
    previous = next;
    for (const [id, pos] of positions) if (pos > cursor) { positions.delete(id); entries.delete(id); views.delete(id); visits.delete(id); }
    leave?.(active, next);
    cursor += 1;
    active = ++serial; entries.set(active, next); positions.set(active, cursor);
    if (visit) visits.set(active, visit);
    const marker = { ...history.state, [KEY]: { session, id: active } };
    if (inMemory) history.replaceState(marker, ''); else history.pushState(marker, '');
    screensChanged();
  };
  const pop = () => {
    const revision = ++replay, app = traversalTimer !== undefined;
    clearTraversal();
    cancelPageSwap();
    pops?.before(app);
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
      if (directExit === active) { directExit = null; closeFeature(); visits.delete(active); }
    });
    previous = capture(); entries.set(active, previous); applying = false; drawerOpen = useStore.getState().sidebarOpen;
    screensChanged();
    pops?.after();
    const focusAtReplay = document.activeElement, entryAtReplay = active;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (revision !== replay || entryAtReplay !== active) return;
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
    try { flushSync(run); } finally {
      previous = capture(); entries.set(active, previous); applying = false;
      // A replaced entry that now shows another feature (Settings handed to Router) belongs to that feature, so a
      // later step inside it continues the same visit and Exit still returns to where the visit began.
      const visit = visits.get(active), now = feature(previous);
      if (visit && now && visit.feature !== now) visits.set(active, { ...visit, feature: now });
      screensChanged();
    }
  };
  commit = check;
  // A relaunch that reopens where you left off (resume.ts) starts the history there: the restored screen is the
  // session's first, a root like a place chosen in the drawer, with no Back to the new chat it replaced.
  onResumed(() => { if (applying || owner !== useStore.getState().user?.uid) return; remember(); previous = capture(); drawerOpen = useStore.getState().sidebarOpen; });
  const a = useStore.subscribe(check), b = subscribeRoutingCenter(check), c = subscribeBackLayers(check);
  window.addEventListener('popstate', pop);
  window.addEventListener('pagehide', clearTraversal);
  return () => {
    ++replay;
    clearTraversal();
    replace = null; commit = null; onResumed(null); a(); b(); c();
    window.removeEventListener('popstate', pop);
    window.removeEventListener('pagehide', clearTraversal);
  };
}
