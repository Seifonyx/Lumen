import { installScreenHistory } from '../lib/screen-history';
import { installRouterSettingsRoute } from '../lib/router-settings-route';
// Canvas shell coordination, reached only through the presentation switch. screen-history adapts the canonical
// store and Routing Center owners to a real Back/Forward hierarchy, with account-scoped local presentations.
// Drafts stay with their existing owners. This component also restores collapse focus and lazy-loads the
// desktop rail; phone roots retain the main drawer, while pushed screens use PhoneNavigation.
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';

const CanvasRail = lazy(() => import('./CanvasRail'));
const PHONE = '(max-width: 899px)';
export const shown = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert], [hidden], [aria-hidden="true"]');
/** Focus already sits somewhere real (another control took it on purpose): leave it there. */
export const focusSettled = () => { const a = document.activeElement; return Boolean(a && a !== document.body && shown(a)); };
export const later = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));

function useSurfaceHistoryAndFocus() {
  // Router owns some Settings sections; requests for them are redirected before history records them.
  useEffect(() => installRouterSettingsRoute(), []);
  useEffect(() => installScreenHistory(), []);
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
