// The collapsed sidebar's rail (computers; Phase 2). Loaded by CanvasNav with the first collapse. The same
// navigation as the sidebar, not a second copy of the tree: mark, expand, new chat, search, the destinations and the
// account. A rail that arrives after its collapse takes focus when nothing else holds it.
import { BookOpen, FolderKanban, LayoutGrid, MessageSquarePlus, PanelLeftOpen, Search, GitFork } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { BrandMark } from '../lib/canvas-presentation';
import { closeRoutingCenter, openRoutingCenter, useRoutingCenter } from '../lib/routing-center';
import { modKey } from '../lib/util';
import { useStore } from '../store';
import { focusSettled, later } from './CanvasNav';
import { newGeneralChat } from '../lib/new-chat';

export default function CanvasRail({ onExpand }: { onExpand: () => void }) {
  const page = useStore((s) => s.page);
  const user = useStore((s) => s.user);
  const routing = useRoutingCenter().open;
  const expand = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!focusSettled()) expand.current?.focus({ preventScroll: true }); }, []);

  const { setUi } = useStore.getState();
  const go = (next: 'collection' | 'tools' | 'projects', pageArg?: string) => { closeRoutingCenter(); setUi({ page: next, settingsOpen: false, ...(pageArg ? { pageArg } : {}) }); };
  const search = () => { onExpand(); later(() => document.querySelector<HTMLInputElement>('#chat-search')?.focus()); };
  const items: [string, string, ReactNode, boolean, () => void][] = [
    ['Library', 'Photos, files and documents from all your chats', <BookOpen size={19} />, page === 'collection', () => go('collection', 'all')],
    ['Tools', `Research, create, analyze, study, assistants and connected apps (${modKey}⇧L)`, <LayoutGrid size={19} />, page === 'tools' || page === 'assistants' || page === 'study', () => go('tools')],
    ['Projects', 'All projects', <FolderKanban size={19} />, page === 'projects', () => go('projects')],
    ['Router', 'Models, providers & routing', <GitFork size={19} strokeWidth={1.8} />, routing && !page, () => { setUi({ page: null, settingsOpen: false }); openRoutingCenter(); }],
  ];
  return (
    <nav className="cv-navrail" aria-label="Navigation">
      {BrandMark && <span className="cv-navrail-mark"><BrandMark height={20} decorative /></span>}
      <button ref={expand} type="button" className="cv-navrail-btn cv-navrail-expand" aria-label="Expand sidebar" title={`Expand sidebar (${modKey}⇧S)`} onClick={onExpand}><PanelLeftOpen size={19} /></button>
      <button type="button" className="cv-navrail-btn" aria-label="New chat" title={`New chat (${modKey}⇧O)`} onClick={() => { setUi({ page: null, settingsOpen: false }); closeRoutingCenter(); newGeneralChat(); }}><MessageSquarePlus size={19} /></button>
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
