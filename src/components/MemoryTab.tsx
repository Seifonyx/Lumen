import { Check, FolderKanban, Loader2, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MAX_ABOUT_CHARS, MAX_MEMORIES, MAX_MEMORY_CHARS } from '../lib/memory';
import { useStore } from '../store';
import type { Memory, Project } from '../types';

const NO_PROJECTS: Project[] = [];

/** Where a memory applies: every chat, or only one project's chats. */
function ScopeSelect({ value, onChange, projects }: { value: string; onChange: (v: string) => void; projects: Project[] }) {
  if (!projects.length && !value) return null;
  return (
    <select className="memory-scope" aria-label="Use this memory in" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Every chat</option>
      {projects.map((p) => <option key={p.id} value={p.id}>Only in {p.name}</option>)}
    </select>
  );
}

/** "About me": what you want every model to know, in your own words. Can be drafted from your memories. */
function AboutMe() {
  const saved = useStore((s) => s.settings.aboutMe || '');
  const update = useStore((s) => s.updateSettings);
  const hasMemories = useStore((s) => s.memories.some((m) => !m.projectId));
  const [draft, setDraft] = useState(saved);
  const [busy, setBusy] = useState(false);
  const changed = draft.trim() !== saved.trim();
  return (
    <div className="settings-group">
      <span className="settings-group-title">About me</span>
      <div className="settings-card about-me">
        <textarea
          dir="auto"
          aria-label="About me"
          value={draft}
          maxLength={MAX_ABOUT_CHARS}
          rows={4}
          placeholder="What should Lumen know about you? Your work, what you're into, how you like answers…"
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="about-me-foot">
          <span className="muted small">Sent with your memories to every model{draft.length > MAX_ABOUT_CHARS * 0.8 ? ` · ${draft.length}/${MAX_ABOUT_CHARS}` : ''}.</span>
          <span className="spacer" />
          {hasMemories && (
            <button type="button" className="btn ghost small" disabled={busy} title="Write a draft from what Lumen has remembered about you" onClick={async () => {
              setBusy(true);
              const text = await useStore.getState().draftAboutMe();
              setBusy(false);
              if (text) setDraft(text);
              else useStore.getState().toast("Couldn't write a draft right now. Try again in a minute.", 'error');
            }}>{busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Update from memories</button>
          )}
          {changed && <button type="button" className="btn ghost small" onClick={() => setDraft(saved)}>Undo</button>}
          <button type="button" className="btn primary small" disabled={!changed} onClick={() => { update({ aboutMe: draft.trim() }); useStore.getState().toast('Saved.', 'success'); }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function Row({ m }: { m: Memory }) {
  const updateMemory = useStore((s) => s.updateMemory);
  const deleteMemory = useStore((s) => s.deleteMemory);
  const chatTitle = useStore((s) => (m.chatId ? s.chats.find((c) => c.id === m.chatId)?.title : undefined));
  const selectChat = useStore((s) => s.selectChat);
  const setUi = useStore((s) => s.setUi);
  const projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const project = m.projectId ? projects.find((p) => p.id === m.projectId) : undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const [scope, setScope] = useState(m.projectId || '');

  if (editing) {
    return (
      <li className="memory-row editing">
        <textarea dir="auto" value={draft} maxLength={MAX_MEMORY_CHARS} rows={2} autoFocus onChange={(e) => setDraft(e.target.value)} />
        <ScopeSelect value={scope} onChange={setScope} projects={projects} />
        <div className="memory-row-actions">
          <button className="icon-btn sm" aria-label="Cancel" onClick={() => { setEditing(false); setDraft(m.text); setScope(m.projectId || ''); }}>
            <X size={16} />
          </button>
          <button className="icon-btn sm" aria-label="Save" disabled={!draft.trim()} onClick={() => { setEditing(false); void updateMemory(m.id, draft, scope === (m.projectId || '') ? undefined : scope || null); }}>
            <Check size={16} />
          </button>
        </div>
      </li>
    );
  }
  return (
    <li className="memory-row">
      <div className="memory-text">
        <span dir="auto">{m.text}</span>
        <span className="muted small">
          {m.projectId && <span className="memory-project" title="Only used in this project's chats"><FolderKanban size={11} /> {project?.name || 'A deleted project'}</span>}
          {new Date(m.updatedAt).toLocaleDateString()} ·{' '}
          {m.source === 'manual' ? (
            'added by you'
          ) : chatTitle ? (
            <button className="link-btn inline" onClick={() => { selectChat(m.chatId!); setUi({ settingsOpen: false }); }}>
              from “{chatTitle}”
            </button>
          ) : (
            'saved in a chat'
          )}
        </span>
      </div>
      <div className="memory-row-actions">
        <button className="icon-btn sm" aria-label="Edit" title="Edit" onClick={() => setEditing(true)}>
          <Pencil size={15} />
        </button>
        <button className="icon-btn sm" aria-label="Delete" title="Delete" onClick={() => void deleteMemory(m.id)}>
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

export default function MemoryTab({ Toggle }: { Toggle: (p: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => React.ReactElement }) {
  const memories = useStore((s) => s.memories);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const addMemory = useStore((s) => s.addMemory);
  const clearMemories = useStore((s) => s.clearMemories);
  const projects = useStore((s) => s.settings.projects) || NO_PROJECTS;
  const [text, setText] = useState('');
  const [scope, setScope] = useState('');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? memories.filter((m) => m.text.toLowerCase().includes(q)) : memories;
  }, [memories, query]);

  return (
    <div className="memory-tab" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="settings-group">
        <span className="settings-group-title">Memory preferences</span>
        <div className="settings-card">
          <Toggle
            label="Use memory across chats"
            hint="Models receive these remembered facts with every message, avoiding repetitive explanations. Works across all models."
            checked={settings.memory}
            onChange={(v) => update({ memory: v })}
          />
          <Toggle
            label="Allow models to save memories"
            hint="Models may automatically remember lasting preferences, projects, or context you share. Off = only when you ask."
            checked={settings.memoryAuto}
            onChange={(v) => update({ memoryAuto: v })}
          />
        </div>
      </div>

      <AboutMe />

      <div className="settings-group">
        <div className="settings-group-title">
          <span>Remembered facts ({memories.length}/{MAX_MEMORIES})</span>
          {memories.length > 0 && (
            <button className="link-btn small danger" onClick={() => { if (confirm('Delete all saved memories?')) void clearMemories(); }}>
              <Trash2 size={13} /> Clear all
            </button>
          )}
        </div>
        <div className="settings-card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <form
            className="memory-add"
            style={{ margin: 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              void addMemory(text, scope || undefined);
              setText('');
            }}
          >
            <input dir="auto" value={text} maxLength={MAX_MEMORY_CHARS} onChange={(e) => setText(e.target.value)} placeholder="Add a memory, e.g. I prefer short answers" />
            <ScopeSelect value={scope} onChange={setScope} projects={projects} />
            <button className="btn primary small" type="submit" disabled={!text.trim()}>
              <Plus size={15} /> Add
            </button>
          </form>

          {memories.length > 4 && (
            <label className="search small-search" style={{ margin: 0 }}>
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search saved memories..." />
            </label>
          )}

          {memories.length === 0 ? (
            <p className="muted small memory-empty">
              No memories saved yet. Add a fact above, tell any model “remember that…”, or type <code>/remember</code> in chat.
            </p>
          ) : (
            <ul className="memory-list" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
              {shown.map((m) => (
                <Row key={m.id} m={m} />
              ))}
            </ul>
          )}
          <span className="setting-hint" style={{ fontSize: '0.75rem' }}>
            Memories are sent to whichever AI model answers. Models are instructed never to store passwords, health numbers, or confidential credentials.
          </span>
        </div>
      </div>
    </div>
  );
}
