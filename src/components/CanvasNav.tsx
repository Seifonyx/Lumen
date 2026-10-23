// Phase 2 Canvas navigation (reached only through src/lib/canvas-presentation.on.ts; the ordinary build has no import
// of it). Three things the shell was missing:
//  - Back: opening a page in place of the chat (Library, Tools, Projects, Study, Assistants, Routing Center, a project's
//    overview), Settings, or a registered layer such as All chats (src/lib/back-stack.ts) adds one history entry, so
//    the browser's Back (or the iPhone edge swipe in Safari) closes the topmost of them instead of leaving Lumen.
//    Closing them any other way consumes that entry again. Moving between them reuses the one entry.
//  - Focus: when such a page closes, focus returns to the control that opened it when it is still on screen (the
//    sidebar destination on computers), otherwise to the menu button on phones (no keyboard pops up) or to the message
//    box on computers. Collapsing or expanding the sidebar moves focus to the control that undoes it.
//  - The collapsed rail (computers): with the sidebar collapsed, a slim column keeps the mark, expand, new chat,
//    search and the destinations one click away (src/components/CanvasRail.tsx, loaded with the first collapse).
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { backLayerOpen, closeTopBackLayer, subscribeBackLayers } from '../lib/back-stack';
import { closeRoutingCenter, routingCenterOpen, subscribeRoutingCenter } from '../lib/routing-center';
import { useStore } from '../store';

const CanvasRail = lazy(() => import('./CanvasRail'));
const PHONE = '(max-width: 899px)';
const MARK = 'lumenSurface';
const surfaceOpen = () => { const s = useStore.getState(); return Boolean(s.page) || s.settingsOpen || s.projectWorkspaceOpen || routingCenterOpen() || backLayerOpen(); };
/** Back closes the topmost surface only: a layer, then Settings, then the page, Routing Center or project overview. */
function closeTopSurface() {
  if (closeTopBackLayer()) return;
  const s = useStore.getState();
  if (s.settingsOpen) { s.setUi({ settingsOpen: false }); return; }
  s.setUi({ page: null, pageArg: undefined });
  closeRoutingCenter();
  if (useStore.getState().projectWorkspaceOpen) useStore.setState({ projectWorkspaceOpen: false });
}
export const shown = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert], [hidden], [aria-hidden="true"]');
/** Focus already sits somewhere real (another control took it on purpose): leave it there. */
export const focusSettled = () => { const a = document.activeElement; return Boolean(a && a !== document.body && shown(a)); };
export const later = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));

function useSurfaceHistoryAndFocus() {
  useEffect(() => {
    // A reload keeps the marked entry while nothing is open: unmark it so the next page adds its own.
    if (history.state?.[MARK] && !surfaceOpen()) history.replaceState({ ...history.state, [MARK]: undefined }, '');
    let open = surfaceOpen();
    let opener: HTMLElement | null = null;
    let openedOn: string | null = null;
    let ownPops = 0;
    const restore = () => later(() => {
      if (surfaceOpen() || focusSettled()) return;
      const sameChat = useStore.getState().currentId === openedOn;
      const phone = window.matchMedia(PHONE).matches;
      const target = (sameChat && shown(opener) ? opener : null)
        || (phone ? document.querySelector('.menu-btn') : document.querySelector('#message-input'));
      if (shown(target)) target.focus({ preventScroll: true });
      opener = null;
    });
    const check = () => {
      const now = surfaceOpen();
      if (now === open) return;
      open = now;
      if (now) {
        const active = document.activeElement;
        opener = active instanceof HTMLElement && active !== document.body ? active : null;
        openedOn = useStore.getState().currentId;
        if (!history.state?.[MARK]) history.pushState({ ...history.state, [MARK]: true }, '');
      } else {
        // Closed from inside the app: take back the entry it added, so Back afterwards leaves as it did before.
        if (history.state?.[MARK]) { ownPops++; history.back(); }
        restore();
      }
    };
    const onPop = () => {
      if (ownPops) { ownPops--; return; }
      if (open && !history.state?.[MARK]) {
        closeTopSurface();
        // Something is still open underneath (Settings over a page, a dialog over Settings): it keeps an entry of its own.
        if (surfaceOpen()) history.pushState({ ...history.state, [MARK]: true }, '');
      }
      // Forward onto an entry whose page has since closed: it is an ordinary chat entry again.
      else if (!open && history.state?.[MARK]) history.replaceState({ ...history.state, [MARK]: undefined }, '');
    };
    const stopStore = useStore.subscribe(check);
    const stopRouting = subscribeRoutingCenter(check);
    const stopLayers = subscribeBackLayers(check);
    window.addEventListener('popstate', onPop);
    return () => { stopStore(); stopRouting(); stopLayers(); window.removeEventListener('popstate', onPop); };
  }, []);
}

function useCollapseFocus(collapsed: boolean) {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    later(() => {
      if (focusSettled()) return;
      const target = document.querySelector(collapsed ? '.cv-navrail .cv-navrail-expand' : '.cv-nav .collapse-sidebar');
      if (shown(target)) target.focus({ preventScroll: true });
    });
  }, [collapsed]);
}

export default function CanvasNav({ collapsed, onExpand }: { collapsed: boolean; onExpand: () => void }) {
  useSurfaceHistoryAndFocus();
  useCollapseFocus(collapsed);
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const media = window.matchMedia(PHONE);
    const change = () => setPhone(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  if (!collapsed || phone) return null;
  // The rail loads with the first collapse (startup stays lean); its empty column holds the layout meanwhile.
  return <Suspense fallback={<nav className="cv-navrail" aria-hidden="true" />}><CanvasRail onExpand={onExpand} /></Suspense>;
}
