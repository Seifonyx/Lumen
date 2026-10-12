import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Boxes, FolderKanban, MessageSquare, Plus, Search, Settings } from 'lucide-react';
import { modKey } from '../lib/util';
import { modelLabel, useStore } from '../store';
import Modal from './Modal';
import type { Project } from '../types';
import { ANALYSIS_TEMPLATES } from '../lib/analysis';

const EMPTY_PROJECTS: Project[] = [];

type Item = { id: string; label: string; detail: string; Icon: typeof Search; run: () => void };

const sections = [
  ['general', 'General'], ['keys', 'API keys'], ['models', 'Models'], ['usage', 'Usage'],
  ['personalize', 'Personalization'], ['memory', 'Memory'], ['privacy', 'Privacy & data'],
] as const;

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const chats = useStore((s) => s.chats);
  const projects = useStore((s) => s.settings.projects) || EMPTY_PROJECTS;
  const enabled = useStore((s) => s.settings.enabledModels);
  const catalog = useStore((s) => s.catalog);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const resultsId=useId();
  const { newChat, selectChat, setUi, updateSettings, selectProject } = useStore.getState();
  const norm = query.trim().toLowerCase();
  const items = useMemo(() => {
    const all: Item[] = [
      { id: 'new-chat', label: 'New chat', detail: `${modKey}⇧O`, Icon: Plus, run: newChat },
      { id: 'library', label: 'Saved helpers and prompts', detail: 'Library', Icon: Boxes, run: () => window.dispatchEvent(new Event('mr:library')) },
      { id: 'tasks', label: 'Tasks & reminders', detail: 'Scheduled help while the app is open', Icon: Boxes, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tasks' })) },
      { id: 'free-tools', label: 'Free tools', detail: 'YouTube · calculations · web reader', Icon: Boxes, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools' })) },
      { id: 'canvas', label: 'Open document canvas', detail: 'Write and edit', Icon: Plus, run: () => useStore.getState().openCanvas() },
      { id: 'analysis', label: 'Data analysis', detail: 'Python · CSV · Excel · charts', Icon: Boxes, run: () => setUi({ runner: { lang: 'python', code: ANALYSIS_TEMPLATES.overview.code, analysis: true }, sidebarOpen: false }) },
      ...sections.map(([id, label]) => ({ id: `settings-${id}`, label: `Settings · ${label}`, detail: 'Settings', Icon: Settings, run: () => setUi({ settingsOpen: true, settingsTab: id, sidebarOpen: false }) })),
      ...projects.map((project) => ({ id: `project-${project.id}`, label: project.name, detail: 'Project', Icon: FolderKanban, run: () => selectProject(project.id) })),
      ...enabled.map((id) => ({ id: `model-${id}`, label: modelLabel(catalog, id), detail: 'Set default model', Icon: Boxes, run: () => updateSettings({ defaultModel: id }) })),
      ...chats.slice(0, 100).map((chat) => ({ id: `chat-${chat.id}`, label: chat.title, detail: 'Chat', Icon: MessageSquare, run: () => selectChat(chat.id) })),
    ];
    return all.filter((x) => !norm || `${x.label} ${x.detail}`.toLowerCase().includes(norm)).slice(0, 50);
  }, [norm, projects, enabled, catalog, chats, newChat, selectChat, setUi, updateSettings, selectProject]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item: Item) => { item.run(); onClose(); };
  return (
    <Modal title="Jump to" onClose={onClose}>
      <div className="command-palette">
        <label className="command-search"><Search size={17} /><input autoFocus role="combobox" aria-expanded="true" aria-autocomplete="list" aria-controls={resultsId} aria-activedescendant={items[active]?`${resultsId}-${active}`:undefined} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (e.key === 'Enter' && items[active]) { e.preventDefault(); run(items[active]); }
        }} placeholder="Search chats, models, projects, settings…" aria-label="Search commands" /></label>
        <div className="command-results" id={resultsId} ref={list} role="listbox" aria-label="Command results">
          {items.length ? items.map(({ id, label, detail, Icon, run: action }, index) => (
            <button key={id} id={`${resultsId}-${index}`} data-index={index} role="option" tabIndex={-1} aria-selected={active === index} className={`command-item${active === index ? ' active' : ''}`} onMouseEnter={() => setActive(index)} onClick={() => run({ id, label, detail, Icon, run: action })}>
              <Icon size={16} /><span>{label}</span><small>{detail}</small>
            </button>
          )) : <p className="muted small command-empty">No matching chats, models, projects or settings.</p>}
        </div>
        <div className="command-hint"><span>↑↓ Navigate</span><span>Enter Open</span><span>Esc Close</span></div>
      </div>
    </Modal>
  );
}
