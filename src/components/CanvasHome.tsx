// Canvas home (the new-chat screen): a time-aware line and where a new chat will start. Reached only when
// CANVAS_SHELL is on; the ordinary build keeps its rotating greeting.
import { useStore } from '../store';

export default function CanvasHome({ temporary }: { temporary: boolean }) {
  const user = useStore((s) => s.user);
  const projects = useStore((s) => s.settings.projects);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const selectProject = useStore((s) => s.selectProject);
  const hour = new Date().getHours();
  const part = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = user?.name?.split(' ')[0].slice(0, 20);
  const project = projects?.find((p) => p.id === activeProjectId) || null;
  if (temporary) return <h1>Incognito chat</h1>;
  return (
    <div className="cv-home">
      <h1>{part}{name ? `, ${name}` : ''}</h1>
      {project
        ? <p className="cv-home-where">New chat in <strong dir="auto">{project.name}</strong> <button type="button" onClick={() => selectProject(null)}>Start outside it</button></p>
        : <p className="cv-home-where">Ask anything.</p>}
    </div>
  );
}
