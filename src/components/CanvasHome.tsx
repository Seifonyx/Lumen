// Canvas home (the new-chat screen): a time-aware line, Continue (your last few chats) and where a new chat will
// start. Reached only when CANVAS_SHELL is on; the ordinary build keeps its rotating greeting.
import { ChevronRight, MessageSquareText } from 'lucide-react';
import { useMemo } from 'react';
import { isTemporaryChat } from '../lib/temporary-chat';
import { useStore } from '../store';

const when = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function CanvasHome({ temporary }: { temporary: boolean }) {
  const user = useStore((s) => s.user);
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const projects = useStore((s) => s.settings.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const selectChat = useStore((s) => s.selectChat);
  const selectProject = useStore((s) => s.selectProject);
  const hour = new Date().getHours();
  const part = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = user?.name?.split(' ')[0].slice(0, 20);
  const project = projects?.find((p) => p.id === activeProjectId) || null;
  const recent = useMemo(() => chats
    .filter((c) => c.id !== currentId && !c.archived && !isTemporaryChat(c) && c.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3), [chats, currentId]);
  if (temporary) return <h1>Incognito chat</h1>;
  return (
    <div className="cv-home">
      <h1>{part}{name ? `, ${name}` : ''}</h1>
      {project
        ? <p className="cv-home-where">New chat in <strong dir="auto">{project.name}</strong> <button type="button" onClick={() => selectProject(null)}>Start outside it</button></p>
        : <p className="cv-home-where">Ask anything, or pick up where you left off.</p>}
      {recent.length > 0 && (
        <section className="cv-home-continue" aria-labelledby="cv-home-continue">
          <h2 id="cv-home-continue">Continue</h2>
          <ul>
            {recent.map((c) => {
              const p = c.projectId ? projects?.find((x) => x.id === c.projectId) : null;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => selectChat(c.id)}>
                    {p ? <span className="cv-mono" aria-hidden="true">{p.name.trim().slice(0, 1).toUpperCase()}</span> : <span className="cv-home-icon" aria-hidden="true"><MessageSquareText size={15} /></span>}
                    <span className="cv-home-title" dir="auto">{c.title}</span>
                    <span className="cv-home-when">{p ? `${p.name} · ` : ''}{when(c.updatedAt)}</span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
