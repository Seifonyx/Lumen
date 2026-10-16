// Projects: each project is a workspace with its own instructions, files and memory, shared by every chat in
// it. This page shows them all as cards, with what's inside and when it was last used.
import { FolderKanban, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Project } from '../types';
import HubPage, { HubEmpty, relTime } from './HubPage';
import ProjectManager from './ProjectManager';

const NO_PROJECTS: Project[] = [];
type Sort = 'recent' | 'name';

export default function ProjectsPage({ onClose }: { onClose: () => void }) {
  const projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const chats = useStore((s) => s.chats);
  const memories = useStore((s) => s.memories);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [menu, setMenu] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id?: string; create?: boolean } | null>(null);
  const stats = useMemo(() => {
    const out = new Map<string, { chats: number; last: number }>();
    for (const c of chats) if (c.projectId) { const s = out.get(c.projectId) || { chats: 0, last: 0 }; s.chats++; s.last = Math.max(s.last, c.updatedAt); out.set(c.projectId, s); }
    return out;
  }, [chats]);
  const q = query.trim().toLowerCase();
  const last = (p: Project) => Math.max(p.updatedAt, stats.get(p.id)?.last || 0);
  const shown = projects.filter((p) => !q || `${p.name} ${p.description || ''} ${p.instructions}`.toLowerCase().includes(q))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : last(b) - last(a)));
  const open = (id: string) => { useStore.getState().setUi({ page: null }); useStore.getState().selectProject(id); };
  const create = () => setEditing({ create: true });
  // iPhone glass look: like Tools and Collection (centred title, + at the top left, one search field; newest first).
  const [glassPhone] = useState(() => document.documentElement.classList.contains('glass') && window.matchMedia('(max-width: 899px)').matches);

  return (
    <HubPage label="Projects" title="Projects" subtitle="Workspaces with their own instructions, files and memory. Every chat in a project shares them." onClose={onClose}
      compact={glassPhone} create={glassPhone ? { label: 'New project', run: create } : undefined}
      actions={!glassPhone && <button type="button" className="btn primary" onClick={create}><Plus size={16} /> New project</button>}
      toolbar={projects.length > 0 && (
        <>
          <label className="hub-search"><Search size={16} /><input type="search" aria-label="Search projects" placeholder="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" /></label>
          {!glassPhone && <div className="hub-seg" role="radiogroup" aria-label="Sort">
            {([['recent', 'Recent'], ['name', 'Name']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={sort === v} onClick={() => setSort(v)}>{l}</button>)}
          </div>}
        </>
      )}>
      {projects.length === 0 ? (
        <HubEmpty icon={<FolderKanban size={26} />} title="No projects yet" text={glassPhone ? 'For anything ongoing, like a course, a client or a trip.' : 'Make a project for anything ongoing (a course, a client, a trip) and give it instructions and files. Every chat in it starts with them.'} action={<button type="button" className="btn primary" onClick={create}><Plus size={16} /> New project</button>} />
      ) : shown.length === 0 ? (
        <p className="hub-none">No projects match “{query}”.</p>
      ) : (
        <ul className="proj-grid">
          {shown.map((p) => {
            const s = stats.get(p.id), files = p.files?.length || 0, mem = memories.filter((m) => m.projectId === p.id).length;
            return (
              <li key={p.id} className={`proj-card color-${p.color || 'indigo'}`}>
                <button type="button" className="proj-open" onClick={() => open(p.id)} aria-label={`Open ${p.name}`}>
                  <span className="proj-band" aria-hidden="true"><span className="proj-mono">{p.name.trim().slice(0, 1).toUpperCase()}</span></span>
                  <span className="proj-body">
                    <strong dir="auto">{p.name}</strong>
                    <span className="proj-desc" dir="auto">{p.description || p.instructions.split('\n')[0] || 'No description yet.'}</span>
                    <span className="proj-stats">
                      <span>{s?.chats || 0} {s?.chats === 1 ? 'chat' : 'chats'}</span>
                      {files > 0 && <span>{files} {files === 1 ? 'file' : 'files'}</span>}
                      {mem > 0 && <span>{mem} {mem === 1 ? 'memory' : 'memories'}</span>}
                      {p.instructions.trim() && <span>Instructions</span>}
                    </span>
                    <span className="proj-time">Updated {relTime(last(p))}</span>
                  </span>
                </button>
                <div className="doc-more">
                  <button type="button" className="icon-btn sm" aria-label={`More for ${p.name}`} aria-haspopup="menu" aria-expanded={menu === p.id} onClick={() => setMenu(menu === p.id ? null : p.id)}><MoreHorizontal size={16} /></button>
                  {menu === p.id && (
                    <div className="menu doc-menu" role="menu" onMouseLeave={() => setMenu(null)}>
                      <button type="button" role="menuitem" onClick={() => { setMenu(null); setEditing({ id: p.id }); }}><Pencil size={15} /> Edit</button>
                      <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(null); if (confirm(`Delete the project “${p.name}”? Its chats stay, outside any project.`)) void useStore.getState().deleteProject(p.id); }}><Trash2 size={15} /> Delete</button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <ProjectManager initialProjectId={editing.id} createNewImmediately={editing.create} onClose={() => setEditing(null)} />}
    </HubPage>
  );
}
