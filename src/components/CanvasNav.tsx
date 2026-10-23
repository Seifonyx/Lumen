// Phase 2 Canvas navigation (reached only through src/lib/canvas-presentation.on.ts; the ordinary build has no import
// of it). Three things the shell was missing:
//  - Back: opening a page in place of the chat (Library, Tools, Projects, Study, Assistants, Routing Center) adds one
//    history entry, so the browser's Back (or the iPhone edge swipe in Safari) returns to the chat instead of leaving
//    Lumen. Closing it any other way consumes that entry again. Moving between pages reuses the one entry.
//  - Focus: when such a page closes, focus returns to the control that opened it when it is still on screen (the
//    sidebar destination on computers), otherwise to the menu button on phones (no keyboard pops up) or to the message
//    box on computers. Collapsing or expanding the sidebar moves focus to the control that undoes it.
//  - The collapsed rail (computers): with the sidebar collapsed, a slim column keeps the mark, expand, new chat,
//    search and the destinations one click away. It is the same navigation, not a second copy of the tree.
import { BookOpen, FolderKanban, LayoutGrid, MessageSquarePlus, PanelLeftOpen, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { BrandMark } from '../lib/canvas-presentation';
import { closeRoutingCenter, openRoutingCenter, routingCenterOpen, subscribeRoutingCenter, useRoutingCenter } from '../lib/routing-center';
import { modKey } from '../lib/util';
import { useStore } from '../store';

const PHONE = '(max-width: 899px)';
const MARK = 'lumenSurface';
const surfaceOpen = () => Boolean(useStore.getState().page) || routingCenterOpen();
const shown = (el: Element | null): el is HTMLElement => el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert], [hidden], [aria-hidden="true"]');
/** Focus already sits somewhere real (another control took it on purpose): leave it there. */
const focusSettled = () => { const a = document.activeElement; return Boolean(a && a !== document.body && shown(a)); };
const later = (fn: () => void) => requestAnimationFrame(() => setTimeout(fn, 0));

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
      if (open && !history.state?.[MARK]) { useStore.getState().setUi({ page: null, pageArg: undefined }); closeRoutingCenter(); }
      // Forward onto an entry whose page has since closed: it is an ordinary chat entry again.
      else if (!open && history.state?.[MARK]) history.replaceState({ ...history.state, [MARK]: undefined }, '');
    };
    const stopStore = useStore.subscribe(check);
    const stopRouting = subscribeRoutingCenter(check);
    window.addEventListener('popstate', onPop);
    return () => { stopStore(); stopRouting(); window.removeEventListener('popstate', onPop); };
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
  const page = useStore((s) => s.page);
  const user = useStore((s) => s.user);
  const routing = useRoutingCenter().open;
  if (!collapsed || phone) return null;

  const { setUi, newChat } = useStore.getState();
  const go = (next: 'collection' | 'tools' | 'projects', pageArg?: string) => { closeRoutingCenter(); setUi({ page: next, settingsOpen: false, ...(pageArg ? { pageArg } : {}) }); };
  const search = () => { onExpand(); later(() => document.querySelector<HTMLInputElement>('#chat-search')?.focus()); };
  const items: [string, string, ReactNode, boolean, () => void][] = [
    ['Library', 'Photos, files and documents from all your chats', <BookOpen size={19} />, page === 'collection', () => go('collection', 'all')],
    ['Tools', `Research, create, analyze, study, assistants and connected apps (${modKey}⇧L)`, <LayoutGrid size={19} />, page === 'tools' || page === 'assistants' || page === 'study', () => go('tools')],
    ['Projects', 'All projects', <FolderKanban size={19} />, page === 'projects', () => go('projects')],
    ['Models & routing', 'Providers, models and routing rules', <SlidersHorizontal size={19} />, routing && !page, () => { setUi({ page: null, settingsOpen: false }); openRoutingCenter(); }],
  ];
  return (
    <nav className="cv-navrail" aria-label="Navigation">
      {BrandMark && <span className="cv-navrail-mark"><BrandMark height={20} decorative /></span>}
      <button type="button" className="cv-navrail-btn cv-navrail-expand" aria-label="Expand sidebar" title={`Expand sidebar (${modKey}⇧S)`} onClick={onExpand}><PanelLeftOpen size={19} /></button>
      <button type="button" className="cv-navrail-btn" aria-label="New chat" title={`New chat (${modKey}⇧O)`} onClick={() => { setUi({ page: null, settingsOpen: false }); closeRoutingCenter(); newChat(); }}><MessageSquarePlus size={19} /></button>
      <button type="button" className="cv-navrail-btn" aria-label="Search chats" title="Search chats" onClick={search}><Search size={19} /></button>
      <span className="cv-navrail-rule" aria-hidden="true" />
      <ul>
        {items.map(([label, title, icon, current, run]) => (
          <li key={label}><button type="button" className="cv-navrail-btn" aria-label={label} title={title} aria-current={current ? 'page' : undefined} onClick={run}>{icon}</button></li>
        ))}
      </ul>
      <button type="button" className="cv-navrail-btn cv-navrail-account" aria-label="Settings" title={`Settings (${modKey},)`} onClick={() => setUi({ settingsOpen: true, settingsTab: '' })}>
        {user?.photo ? <img className="cv-avatar" src={user.photo} alt="" referrerPolicy="no-referrer" /> : <span className="cv-avatar" aria-hidden="true">{(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}</span>}
      </button>
    </nav>
  );
}
