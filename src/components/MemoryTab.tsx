import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MAX_MEMORIES, MAX_MEMORY_CHARS } from '../lib/memory';
import { useStore } from '../store';
import type { Memory } from '../types';

function Row({ m }: { m: Memory }) {
  const updateMemory = useStore((s) => s.updateMemory);
  const deleteMemory = useStore((s) => s.deleteMemory);
  const chatTitle = useStore((s) => (m.chatId ? s.chats.find((c) => c.id === m.chatId)?.title : undefined));
  const selectChat = useStore((s) => s.selectChat);
  const setUi = useStore((s) => s.setUi);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);

  if (editing) {
    return (
      <li className="memory-row editing">
        <textarea dir="auto" value={draft} maxLength={MAX_MEMORY_CHARS} rows={2} autoFocus onChange={(e) => setDraft(e.target.value)} />
        <div className="memory-row-actions">
          <button className="icon-btn sm" aria-label="Cancel" onClick={() => { setEditing(false); setDraft(m.text); }}>
            <X size={16} />
          </button>
          <button className="icon-btn sm" aria-label="Save" disabled={!draft.trim()} onClick={() => { setEditing(false); void updateMemory(m.id, draft); }}>
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
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? memories.filter((m) => m.text.toLowerCase().includes(q)) : memories;
  }, [memories, query]);

  return (
    <div className="settings-section memory-tab">
      <Toggle
        label="Use memory"
        hint="Models get the facts below with every message, so you don't have to repeat yourself. Works with every model and syncs to your devices."
        checked={settings.memory}
        onChange={(v) => update({ memory: v })}
      />
      <Toggle
        label="Let models save memories"
        hint="Models may save lasting facts you share (your job, projects, preferences). Off = only when you ask them to remember something."
        checked={settings.memoryAuto}
        onChange={(v) => update({ memoryAuto: v })}
      />
      <form
        className="memory-add"
        onSubmit={(e) => {
          e.preventDefault();
          void addMemory(text);
          setText('');
        }}
      >
        <input dir="auto" value={text} maxLength={MAX_MEMORY_CHARS} onChange={(e) => setText(e.target.value)} placeholder="Add a memory, e.g. I work as a clinical pharmacist" />
        <button className="btn" type="submit" disabled={!text.trim()}>
          <Plus size={16} /> Add
        </button>
      </form>
      <div className="memory-head">
        <span className="setting-label">
          {memories.length} memor{memories.length === 1 ? 'y' : 'ies'}
          <span className="muted small"> (up to {MAX_MEMORIES})</span>
        </span>
        {memories.length > 5 && (
          <label className="search small-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memory" />
          </label>
        )}
      </div>
      {memories.length === 0 ? (
        <p className="muted small">
          Nothing saved yet. Tell any model “remember that …”, type <code>/remember …</code> in the message box, or add one above.
        </p>
      ) : (
        <ul className="memory-list">
          {shown.map((m) => (
            <Row key={m.id} m={m} />
          ))}
        </ul>
      )}
      {memories.length > 0 && (
        <button className="btn danger small" onClick={() => { if (confirm('Delete everything in memory?')) void clearMemories(); }}>
          <Trash2 size={14} /> Delete all memories
        </button>
      )}
      <p className="muted small">
        Memories are sent to whichever free model answers, so models are told never to store patient details, health information, passwords or confidential figures.
      </p>
    </div>
  );
}
