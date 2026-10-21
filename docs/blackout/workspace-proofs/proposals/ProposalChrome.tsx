// Gate1 reconsideration: two opt-in design proposals over the real App (?proposal=canvas | ?proposal=desk).
// The real Composer (textarea, draft, attachments, picker, UsageMeter, Send/Stop), store actions and pages stay the
// owners; this file only adds navigation, a few top-bar slots and the expand control. Exploration, not production.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, Inbox, LayoutGrid, Maximize2, PanelLeft, Plus, Search, Settings2, SlidersHorizontal, SquarePen, X } from 'lucide-react';
import { selectCurrentChat, useStore } from '../../../../src/store';
import { estimateTokens } from '../../../../src/lib/routing';
import { formatTokens } from '../../../../src/lib/usage';
import { useComposerPresentation } from '../ComposerChrome';
import UsageShareLabels from '../UsageShareLabels';
import { contextTokens } from '../../../../src/lib/compact';
import type { Chat, Project } from '../../../../src/types';
import './shared.css';
import './canvas.css';
import './desk.css';

type Kind = 'canvas' | 'desk';
type Name = 'app' | 'main' | 'form' | 'bar' | 'topbar' | 'usage';
const queries: Record<Name, string> = { app: '.app', main: '.main', form: '.main .composer', bar: '.main .composer .composer-bar', topbar: '.main .topbar', usage: '.main .composer .usage-chip' };
const NO_PROJECTS: Project[] = [];

function useTargets() {
  const [targets, setTargets] = useState<Partial<Record<Name, Element>>>({});
  useEffect(() => {
    let frame = 0;
    const sync = () => { frame = 0; const next = Object.fromEntries(Object.entries(queries).map(([k, q]) => [k, document.querySelector(q) || undefined])); setTargets((old) => (Object.keys(queries).every((k) => old[k as Name] === next[k]) ? old : next)); };
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(sync); });
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, []);
  return targets;
}
function usePhone() {
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 899px)').matches);
  useEffect(() => { const m = matchMedia('(max-width: 899px)'); const on = () => setPhone(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return phone;
}
const go = {
  chat: (id: string) => useStore.getState().selectChat(id),
  overview: (id: string) => useStore.getState().selectProject(id),
  newIn: (id: string | null) => { const s = useStore.getState(); if (id) { s.selectProject(id); } else s.selectProject(null); s.newChat(); },
  page: (page: 'collection' | 'tools' | 'projects') => useStore.getState().setUi({ page }),
  settings: (tab: string) => useStore.getState().setUi({ settingsOpen: true, settingsTab: tab }),
};
const sorted = (list: Chat[]) => list.filter((c) => !c.archived && (c.messages.length || c.documents?.length)).toSorted((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);
const when = (t: number) => { const d = Math.round((Date.now() - t) / 86400000); return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : d < 7 ? `${d} days ago` : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const preview = (c: Chat) => { const m = [...c.messages].reverse().find((x) => x.role === 'assistant') || c.messages[0]; return (m?.text || '').replace(/[#*|`>-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90); };

/** Shared footer: everything that isn't a conversation, one tap away. */
function Destinations() {
  return <div className="px-destinations">
    <button type="button" onClick={() => go.page('collection')}><BookOpen size={17} /><span>Library</span></button>
    <button type="button" onClick={() => go.page('tools')}><LayoutGrid size={17} /><span>Tools</span></button>
    <button type="button" onClick={() => go.settings('models')}><SlidersHorizontal size={17} /><span>Models & routing</span></button>
    <button type="button" onClick={() => go.settings('general')}><Settings2 size={17} /><span>Settings</span></button>
  </div>;
}

/** Proposal A — Canvas: one navigation tree. Projects are folders of conversations, not a separate app. */
function CanvasNav({ chat, onClose }: { chat?: Chat | null; onClose: () => void }) {
  const chats = useStore((s) => s.chats), projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase(), match = (c: Chat) => !q || c.title.toLowerCase().includes(q);
  const isOpen = (p: Project) => open[p.id] ?? (p.id === chat?.projectId || Boolean(q));
  const pick = (fn: () => void) => () => { fn(); onClose(); };
  const unfiled = sorted(chats.filter((c) => !c.projectId)).filter(match);
  return <nav className="pc-nav" aria-label="Conversations and projects">
    <div className="pc-nav-head"><span className="px-wordmark">Lumen</span><button type="button" className="pc-nav-close" data-proposal-nav-close aria-label="Close navigation" onClick={onClose}><X size={18} /></button></div>
    <button type="button" className="pc-new" onClick={pick(() => go.newIn(null))}><SquarePen size={17} />New chat<kbd>⌘N</kbd></button>
    <label className="px-search"><Search size={16} /><input type="search" aria-label="Search conversations" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <div className="pc-tree">
      <h2 className="px-label">Projects</h2>
      {projects.map((p) => { const list = sorted(chats.filter((c) => c.projectId === p.id)).filter(match); if (q && !list.length) return null; return <div key={p.id} className="pc-project">
        <button type="button" className="pc-project-row" data-proposal-space={p.id} aria-expanded={isOpen(p)} onClick={() => setOpen({ ...open, [p.id]: !isOpen(p) })}>{isOpen(p) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<span className="px-mono" aria-hidden="true">{p.name.slice(0, 1)}</span><span className="pc-name">{p.name}</span><span className="pc-count">{list.length}</span></button>
        {isOpen(p) && <ul>{list.map((c) => <li key={c.id}><button type="button" aria-current={c.id === chat?.id ? 'page' : undefined} onClick={pick(() => go.chat(c.id))}>{c.title}</button></li>)}<li className="pc-project-actions"><button type="button" onClick={pick(() => go.newIn(p.id))}><Plus size={14} />New chat here</button><button type="button" onClick={pick(() => go.overview(p.id))}>Overview</button></li></ul>}
      </div>; })}
      <h2 className="px-label">Conversations</h2>
      <ul className="pc-chats">{unfiled.map((c) => <li key={c.id}><button type="button" aria-current={c.id === chat?.id ? 'page' : undefined} onClick={pick(() => go.chat(c.id))}>{c.title}</button></li>)}</ul>
    </div>
    <Destinations />
  </nav>;
}

/** Proposal B — Desk: spaces (All + each project) on a rail, the chosen space's conversations in a list. */
function DeskNav({ chat, space, setSpace, onClose }: { chat?: Chat | null; space: string; setSpace: (s: string) => void; onClose: () => void }) {
  const chats = useStore((s) => s.chats), projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const [query, setQuery] = useState('');
  const project = projects.find((p) => p.id === space);
  const list = sorted(chats.filter((c) => (space === 'all' ? true : c.projectId === space))).filter((c) => !query.trim() || c.title.toLowerCase().includes(query.trim().toLowerCase()));
  return <>
    <nav className="pd-rail" aria-label="Spaces">
      <span className="px-wordmark">Lumen</span>
      <button type="button" className="pd-space" data-proposal-space="all" aria-current={space === 'all' ? 'true' : undefined} onClick={() => setSpace('all')}><span className="pd-tile"><Inbox size={18} /></span><span>All</span></button>
      {projects.map((p) => <button key={p.id} type="button" className="pd-space" data-proposal-space={p.id} aria-current={space === p.id ? 'true' : undefined} onClick={() => setSpace(p.id)}><span className="pd-tile px-mono">{p.name.slice(0, 1)}</span><span>{p.name}</span></button>)}
      <button type="button" className="pd-space pd-add" onClick={() => go.page('projects')}><span className="pd-tile"><Plus size={18} /></span><span>Projects</span></button>
      <Destinations />
    </nav>
    <section className="pd-list" aria-label={project ? project.name : 'All conversations'}>
      <header className="pd-list-head">
        <button type="button" className="pd-list-close" data-proposal-nav-close aria-label="Back to conversation" onClick={onClose}><ChevronLeft size={20} /></button>
        <h2>{project ? project.name : 'All conversations'}</h2>
        <button type="button" className="pd-list-new" aria-label={project ? `New chat in ${project.name}` : 'New chat'} onClick={() => { go.newIn(project?.id || null); onClose(); }}><SquarePen size={18} /></button>
      </header>
      {project && <button type="button" className="pd-brief" onClick={() => { go.overview(project.id); onClose(); }}><span className="px-label">Project</span><strong>{project.description || 'Project overview'}</strong><span>{project.instructions ? 'Instructions on' : 'No instructions'} · {project.files?.length || 0} files · Overview <ChevronRight size={13} /></span></button>}
      <label className="px-search"><Search size={16} /><input type="search" aria-label={`Search ${project ? project.name : 'conversations'}`} placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <ul className="pd-chats">{list.map((c) => <li key={c.id}><button type="button" aria-current={c.id === chat?.id ? 'page' : undefined} onClick={() => { go.chat(c.id); onClose(); }}><span className="pd-chat-title">{c.title}</span><span className="pd-chat-meta">{when(c.updatedAt)}{space === 'all' && c.projectId ? ` · ${projects.find((p) => p.id === c.projectId)?.name || ''}` : ''}</span><span className="pd-chat-preview">{preview(c)}</span></button></li>)}</ul>
    </section>
  </>;
}

export default function ProposalChrome({ kind }: { kind: Kind }) {
  const t = useTargets(), phone = usePhone();
  const chat = useStore(selectCurrentChat), projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const page = useStore((s) => s.page), settingsOpen = useStore((s) => s.settingsOpen);
  const { draft, expanded, toggle } = useComposerPresentation(t.form, chat?.id);
  const [navOpen, setNavOpen] = useState(false);
  const project = projects.find((p) => p.id === chat?.projectId);
  const [space, setSpace] = useState<string>('all');
  useEffect(() => { setSpace(chat?.projectId || 'all'); }, [chat?.id, chat?.projectId]);
  useEffect(() => { document.documentElement.toggleAttribute('data-proposal-nav-open', navOpen); }, [navOpen]);
  useEffect(() => { if (settingsOpen || page) setNavOpen(false); }, [settingsOpen, page]);
  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;
  const last = useMemo(() => chat?.messages.findLast((m) => m.role === 'assistant'), [chat]);
  if (!t.app) return null;
  const close = () => setNavOpen(false);
  const nav = kind === 'canvas' ? <CanvasNav chat={chat} onClose={close} /> : <DeskNav chat={chat} space={space} setSpace={setSpace} onClose={close} />;
  const shown = !phone || navOpen;
  const lead = kind === 'canvas'
    ? <><button type="button" className="px-nav-btn" data-proposal-nav aria-label={phone ? 'Open conversations' : 'Conversations and projects'} aria-expanded={phone ? navOpen : undefined} onClick={() => setNavOpen(!navOpen)}><PanelLeft size={19} /></button>
      <div className="pc-crumb">{project && <><button type="button" onClick={() => go.overview(project.id)}>{project.name}</button><ChevronRight size={13} aria-hidden="true" /></>}<span className="pc-title">{chat?.title || 'New chat'}</span></div>
      {phone && <button type="button" className="px-nav-btn pc-compose" aria-label="New chat" onClick={() => go.newIn(chat?.projectId || null)}><SquarePen size={19} /></button>}</>
    : <><button type="button" className="px-nav-btn pd-back" data-proposal-nav aria-label={phone ? `Back to ${project ? project.name : 'all conversations'}` : 'Conversations'} onClick={() => setNavOpen(true)}><ChevronLeft size={21} />{phone && <span>{project ? project.name : 'All'}</span>}</button>
      <div className="pd-title"><span>{chat?.title || 'New chat'}</span>{project && <small>{project.name}</small>}</div></>;
  // Expanded writing is a state of the composer, not a destination: a sheet (Canvas) or a page (Desk).
  const head = <div className="px-sheet-head">
    {kind === 'canvas' && <span className="px-grabber" aria-hidden="true" />}
    <div><span className="px-label">{kind === 'canvas' ? 'Writing' : 'Page'}</span><strong>{chat?.title || 'New chat'}</strong></div>
    <span className="px-count">{words} words · ~{formatTokens(estimateTokens(draft))} tokens</span>
    <button type="button" className="px-done" aria-label="Collapse writing" onClick={toggle}>Done</button>
  </div>;
  const replying = kind === 'desk' && last ? <details className="pd-replying"><summary><span className="px-label">Replying to</span><span>{(last.text.match(/^#+ (.+)$/m)?.[1] || preview({ ...chat!, messages: [last] }))}</span></summary><div className="pd-replying-body">{last.text.replace(/^#+ .+$/m, '').trim().split('\n\n').slice(0, 2).join('\n\n').replace(/[*#|]/g, '')}</div></details> : null;
  return <>
    {shown && !settingsOpen && !(phone && page) && createPortal(<div className={`px-nav-host px-${kind}`}>{nav}</div>, t.app)}
    {phone && navOpen && createPortal(<button type="button" className="px-scrim" aria-label="Close navigation" tabIndex={-1} onClick={close} />, t.app)}
    {t.topbar && createPortal(<div className="px-lead">{lead}</div>, t.topbar)}
    {t.form && createPortal(<>{head}{replying}</>, t.form)}
    {t.usage && chat && createPortal(<span className="px-usage">~{formatTokens(contextTokens(chat))} tokens</span>, t.usage)}
    <UsageShareLabels />
    {t.bar && createPortal(<button type="button" className="px-expand" data-proposal-expand aria-label={expanded ? 'Collapse writing' : 'Expand writing'} aria-expanded={expanded} aria-controls="message-input" title={expanded ? 'Back (Esc)' : 'Expand writing'} onClick={toggle}><Maximize2 size={17} /></button>, t.bar)}
  </>;
}
