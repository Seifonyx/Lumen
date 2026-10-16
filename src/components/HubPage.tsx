// The layout shared by Library, Documents and Study: they open in place of the chat (the sidebar stays), with a
// large title, a line about what's here, the main action, optional tabs, and the content below.
import { ChevronLeft, FolderKanban, LayoutGrid, Menu, MessageCircle, Plus, Shapes } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusScope } from '../lib/focus-scope';
import { installSwipeBack } from '../lib/swipe-back';
import { swapControl } from '../lib/motion';
import { useStore } from '../store';

export interface HubTab<T extends string> { id: T; label: string; icon?: ReactNode; count?: number }
/** A page's own bottom tab bar (iPhone glass look): its sections instead of the app's, each with its colour. */
export interface HubBar { items: { id: string; label: string; icon: ReactNode; hue?: number }[]; active: string; onSelect: (id: string) => void; label: string;
  /** What the + at the top left makes for the chosen tab (e.g. "New document"). */
  create?: { label: string; run: () => void } }

export default function HubPage<T extends string>({ title, subtitle, actions, tabs, tab, onTab, toolbar, onClose, onBack, children, label, bar, compact, create }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; label: string;
  bar?: HubBar;
  /** iPhone glass look without sections of its own (Projects): the same centred title and + as Tools. */
  compact?: boolean; create?: { label: string; run: () => void };
  tabs?: HubTab<T>[]; tab?: T; onTab?: (t: T) => void;
  toolbar?: ReactNode; onClose: () => void;
  /** a step inside the page (e.g. a deck): the arrow goes back to the page instead of closing it */
  onBack?: () => void;
  children: ReactNode;
}) {
  const root = useRef<HTMLElement>(null);
  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches;
  useFocusScope(root, phone, onBack || onClose);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.modal-backdrop')) { e.preventDefault(); (onBack || onClose)(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onBack, onClose]);
  useEffect(() => { root.current?.focus({ preventScroll: true }); }, []);
  // Phones: swipe right to go back (a step inside the page goes back to the page; otherwise to the chat).
  const back = useRef(onBack || onClose);
  back.current = onBack || onClose;
  const stepped = Boolean(onBack);
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    return installSwipeBack(page, () => window.matchMedia('(max-width: 899px)').matches, () => {}, () => back.current(), stepped ? {} : { reveal: () => document.querySelector<HTMLElement>('.app > .main') });
  }, [stepped]);
  // iPhone glass look: the small title in the bar shows once the big one has scrolled away.
  const [scrolled, setScrolled] = useState(false);
  const make = bar?.create || create;
  return (
    <section ref={root} className={`hub-page${scrolled ? ' scrolled' : ''}${bar || compact ? ' has-bar' : ''}`} aria-label={label} tabIndex={-1} data-keep-sidebar="true">
      <div className="hub-bar">
        {onBack ? (
          <button type="button" className="icon-btn hub-nav" aria-label="Back" onClick={onBack}><ChevronLeft size={26} /></button>
        ) : make ? (
          // Pages with their own tab bar (iPhone): the top-left button makes something new for the chosen tab.
          <button type="button" className="icon-btn hub-nav hub-new" aria-label={make.label} title={make.label} onClick={make.run}><Plus size={22} /></button>
        ) : phone ? (
          <button type="button" className="icon-btn hub-nav" aria-label="Open sidebar" onClick={() => useStore.getState().setUi({ sidebarOpen: true })}><Menu size={20} /></button>
        ) : null}
        <span className="hub-bar-title">{label}</span>
        <button type="button" className="btn ghost small hub-close" aria-label="Close" onClick={onClose}><span className="hub-close-long">Back to chat</span><span className="hub-close-short">Done</span></button>
      </div>
      <div className="hub-scroll" onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 56)}>
        <div className="hub-inner">
          <header className="hub-head">
            <div className="hub-titles">
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="hub-actions">{actions}</div>}
          </header>
          {tabs && tabs.length > 0 && (
            <div className="hub-tabs" role="tablist" aria-label={`${label} sections`}>
              {tabs.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={t.id === tab} tabIndex={t.id === tab ? 0 : -1} className={t.id === tab ? 'active' : ''} onClick={() => onTab?.(t.id)}
                  onKeyDown={(e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); const i = tabs.findIndex((x) => x.id === tab); const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]; onTab?.(next.id); (e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[tabs.indexOf(next)])?.focus(); }}>
                  {t.icon}{t.label}{t.count !== undefined && <span className="hub-count">{t.count}</span>}
                </button>
              ))}
            </div>
          )}
          {toolbar && <div className="hub-toolbar">{toolbar}</div>}
          <div className="hub-body">{children}</div>
        </div>
      </div>
      {phone && !onBack && <GlassTabs bar={bar} />}
    </section>
  );
}

/** iPhone glass look: a floating tab bar to move between the chat and the main pages (shown only with glass). */
function GlassTabs({ bar }: { bar?: HubBar }) {
  const page = useStore((s) => s.page);
  // Switching tabs doesn't slide (as on iOS), not even back to the chats.
  const go = (p: 'projects' | 'collection' | 'tools' | null) => { swapControl.skip = true; try { useStore.getState().setUi({ page: p, pageArg: undefined }); } finally { swapControl.skip = false; } };
  const tabs = [
    { id: null, label: 'Chats', icon: <MessageCircle size={22} /> },
    { id: 'projects' as const, label: 'Projects', icon: <FolderKanban size={22} /> },
    { id: 'collection' as const, label: 'Library', icon: <LayoutGrid size={22} /> },
    { id: 'tools' as const, label: 'Tools', icon: <Shapes size={22} /> },
  ];
  const current = page === 'assistants' || page === 'study' ? 'tools' : page;
  // The selected tab sits under a glass lens that slides to the tab you touch and swells while you hold it.
  const [held, setHeld] = useState<number | null>(null);
  const [lensPosition, setLensPosition] = useState<number | null>(null);
  const pointer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const tabAt = (nav: HTMLElement, x: number, y: number) => {
    const bounds = nav.getBoundingClientRect();
    if (y < bounds.top || y > bounds.bottom || x < bounds.left || x > bounds.right) return null;
    const index = [...nav.querySelectorAll('button')].findIndex(button => {
      const r = button.getBoundingClientRect();
      return x >= r.left && x <= r.right;
    });
    return index < 0 ? null : index;
  };
  const moveLens = (nav: HTMLElement, x: number, y: number) => {
    const next = tabAt(nav, x, y);
    setHeld(next);
    if (next === null) { setLensPosition(null); return; }
    const first = nav.querySelector('button')!.getBoundingClientRect();
    const count = nav.querySelectorAll('button').length;
    // Track the finger between tab centres rather than jumping one whole slot at a time.
    setLensPosition(Math.max(0, Math.min(count - 1, (x - first.left - first.width / 2) / first.width)));
  };
  // A page with its own sections (Tools, Collection) shows those instead of the app's pages.
  const items = bar ? bar.items.map((b) => ({ key: b.id, label: b.label, icon: b.icon, hue: b.hue, on: bar.active === b.id, pick: () => bar.onSelect(b.id) }))
    : tabs.map((t) => ({ key: t.label, label: t.label, icon: t.icon, hue: undefined, on: current === t.id, pick: () => go(t.id) }));
  const index = Math.max(0, items.findIndex((t) => t.on));
  const lens = held ?? index;
  return (
    <nav className={`glass-tabbar${held !== null ? ' held' : ''}${bar ? ' page-sections' : ''}`} aria-label={bar?.label || 'Sections'} style={{ ['--i' as string]: lens, ['--lens-position' as string]: lensPosition ?? index, ['--n' as string]: items.length }}
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0 || pointer.current !== null) return;
        const next = tabAt(e.currentTarget, e.clientX, e.clientY);
        if (next === null) return;
        pointer.current = e.pointerId;
        suppressClick.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
        moveLens(e.currentTarget, e.clientX, e.clientY);
      }}
      onPointerMove={e => {
        if (pointer.current === e.pointerId) moveLens(e.currentTarget, e.clientX, e.clientY);
      }}
      onPointerUp={e => {
        if (pointer.current !== e.pointerId) return;
        const next = tabAt(e.currentTarget, e.clientX, e.clientY);
        pointer.current = null;
        suppressClick.current = true;
        setHeld(null);
        setLensPosition(null);
        e.currentTarget.releasePointerCapture(e.pointerId);
        if (next !== null) items[next]?.pick();
      }}
      onPointerCancel={e => {
        if (pointer.current !== e.pointerId) return;
        pointer.current = null;
        suppressClick.current = true;
        setHeld(null);
        setLensPosition(null);
      }}
      onLostPointerCapture={e => {
        if (pointer.current !== e.pointerId) return;
        pointer.current = null;
        suppressClick.current = true;
        setHeld(null);
        setLensPosition(null);
      }}
      onClickCapture={e => {
        // A captured pointer commits on release; leave keyboard/assistive clicks alone.
        if (suppressClick.current && e.detail !== 0) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick.current = false;
        }
      }}>
      <span className="glass-lens" aria-hidden="true">
        {held !== null && <span className="glass-lens-content" data-hue={items[held]?.hue !== undefined || undefined} style={items[held]?.hue !== undefined ? { ['--hue' as string]: items[held].hue } : undefined}>
          {items[held]?.icon}<span>{items[held]?.label}</span>
        </span>}
      </span>
      {items.map((t, i) => <button key={t.key} type="button" aria-current={t.on ? 'page' : undefined} data-preview={held === i || undefined} data-hue={t.hue !== undefined || undefined} style={t.hue !== undefined ? { ['--hue' as string]: t.hue } : undefined} onClick={t.pick}>{t.icon}<span>{t.label}</span></button>)}
    </nav>
  );
}

/** A friendly empty state: an icon, a line of what goes here, and how to start. */
export function HubEmpty({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="hub-empty">
      <span className="hub-empty-icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export const relTime = (t: number) => {
  const d = Date.now() - t, m = Math.round(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return days === 1 ? 'yesterday' : `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
