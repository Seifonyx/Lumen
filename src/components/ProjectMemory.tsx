// Canvas project memory: every fact kept for this project, each one editable or removable in place, and a way to add
// one. Uses the existing memory actions (the same ones Settings → Memory uses); nothing new is stored. No icon
// library here: ProjectWorkspace imports this module in every build.
import { useState } from 'react';
import { useStore } from '../store';
import type { Memory } from '../types';

export default function ProjectMemory({ projectId, memories }: { projectId: string; memories: Memory[] }) {
  const [editing, setEditing] = useState<string | null>(null), [draft, setDraft] = useState(''), [removing, setRemoving] = useState<string | null>(null);
  const on = useStore((s) => s.settings.memory !== false);
  const start = (id: string, text: string) => { setEditing(id); setDraft(text); setRemoving(null); };
  const save = () => {
    const text = draft.trim();
    if (text && editing === 'new') void useStore.getState().addMemory(text, projectId);
    else if (text && editing) void useStore.getState().updateMemory(editing, text);
    setEditing(null);
  };
  const editor = (label: string) => (
    <form className="cv-memory-edit" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <textarea aria-label={label} value={draft} maxLength={500} rows={2} dir="auto" autoFocus onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null); } }} />
      <span><button type="submit" className="btn primary small" disabled={!draft.trim()}>Save</button><button type="button" className="btn ghost small" onClick={() => setEditing(null)}>Cancel</button></span>
    </form>
  );
  return (
    <section className="pw-ctx cv-memory" aria-labelledby={`memory-${projectId}`}>
      <div className="pw-ctx-head">
        <h2 id={`memory-${projectId}`}>Memory <span className="pw-count">{memories.length}</span></h2>
        {on && editing !== 'new' && <button type="button" className="pw-link" aria-label="Add a memory for this project" onClick={() => start('new', '')}>Add</button>}
      </div>
      {!on && <p className="pw-empty">Memory is off in Settings → Memory.</p>}
      {editing === 'new' && editor('New memory for this project')}
      {memories.length ? (
        <ul className="project-memories">{memories.map((m) => (
          <li key={m.id}>
            {editing === m.id ? editor('Edit memory') : <>
              <p dir="auto">{m.text}</p>
              <span className="cv-memory-actions">
                {removing === m.id ? <>
                  <span className="muted small">Forget this?</span>
                  <button type="button" className="btn ghost small" onClick={() => { setRemoving(null); void useStore.getState().deleteMemory(m.id); }}>Forget</button>
                  <button type="button" className="btn ghost small" onClick={() => setRemoving(null)}>Keep</button>
                </> : <>
                  <span className="muted small">{m.source === 'manual' ? 'Added by you' : 'Saved from a chat'}</span>
                  <button type="button" className="btn ghost small" aria-label={`Edit: ${m.text.slice(0, 60)}`} onClick={() => start(m.id, m.text)}>Edit</button>
                  <button type="button" className="btn ghost small" aria-label={`Forget: ${m.text.slice(0, 60)}`} onClick={() => setRemoving(m.id)}>Forget</button>
                </>}
              </span>
            </>}
          </li>
        ))}</ul>
      ) : null}
    </section>
  );
}
