// The layout shared by Library, Documents and Study: they open in place of the chat (the sidebar stays), with a
// large title, a line about what's here, the main action, optional tabs, and the content below.
import { ArrowLeft, FolderKanban, LayoutGrid, Menu, MessageCircle, Shapes } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusScope } from '../lib/focus-scope';
import { useStore } from '../store';

export interface HubTab<T extends string> { id: T; label: string; icon?: ReactNode; count?: number }

export default function HubPage<T extends string>({ title, subtitle, actions, tabs, tab, onTab, toolbar, onClose, onBack, children, label }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; label: string;
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
  // iPhone glass look: the small title in the bar shows once the big one has scrolled away.
  const [scrolled, setScrolled] = useState(false);
  return (
    <section ref={root} className={`hub-page${scrolled ? ' scrolled' : ''}`} aria-label={label} tabIndex={-1} data-keep-sidebar="true">
      <div className="hub-bar">
        {onBack ? (
          <button type="button" className="icon-btn hub-nav" aria-label="Back" onClick={onBack}><ArrowLeft size={20} /></button>
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
      {phone && !onBack && <GlassTabs />}
    </section>
  );
}

/** iPhone glass look: a floating tab bar to move between the chat and the main pages (shown only with glass). */
function GlassTabs() {
  const page = useStore((s) => s.page);
  const go = (p: 'projects' | 'collection' | 'tools' | null) => useStore.getState().setUi({ page: p, pageArg: undefined });
  const tabs = [
    { id: null, label: 'Chats', icon: <MessageCircle size={22} /> },
    { id: 'projects' as const, label: 'Projects', icon: <FolderKanban size={22} /> },
    { id: 'collection' as const, label: 'Collection', icon: <LayoutGrid size={22} /> },
    { id: 'tools' as const, label: 'Tools', icon: <Shapes size={22} /> },
  ];
  const current = page === 'assistants' || page === 'study' ? 'tools' : page;
  // The selected tab sits under a glass lens that slides to the tab you touch and swells while you hold it.
  const [held, setHeld] = useState<number | null>(null);
  const index = Math.max(0, tabs.findIndex((t) => t.id === current));
  const lens = held ?? index;
  return (
    <nav className={`glass-tabbar${held !== null ? ' held' : ''}`} aria-label="Sections" style={{ ['--i' as string]: lens, ['--n' as string]: tabs.length }}
      onPointerUp={() => setHeld(null)} onPointerCancel={() => setHeld(null)} onPointerLeave={() => setHeld(null)}>
      <span className="glass-lens" aria-hidden="true" />
      {tabs.map((t, i) => <button key={t.label} type="button" aria-current={current === t.id ? 'page' : undefined} onPointerDown={() => setHeld(i)} onPointerEnter={(e) => { if (e.buttons) setHeld(i); }} onClick={() => go(t.id)}>{t.icon}<span>{t.label}</span></button>)}
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
