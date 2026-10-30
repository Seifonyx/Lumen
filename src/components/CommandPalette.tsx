import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BarChart3, BookOpen, Boxes, Clock, FileText, FolderKanban, Keyboard, MessageSquare, Plus, Search, Settings, Sparkles, Wrench, GitFork } from 'lucide-react';
import { modKey } from '../lib/util';
import { modelLabel, useStore } from '../store';
import { savedChats } from '../lib/temporary-chat';
import Modal from './Modal';
import type { Project } from '../types';
import { ANALYSIS_TEMPLATES } from '../lib/analysis';
import { CANVAS_SHELL, newGeneralChat } from '../lib/canvas-presentation';
import { openRoutingCenter } from '../lib/routing-center';

const EMPTY_PROJECTS: Project[] = [];

type Item = { id: string; label: string; detail: string; Icon: typeof Search; run: () => void };

const sections = [
  ['connectors', 'Connectors'], ['general', 'General'], ['keys', 'API keys'], ['models', 'Models'], ['usage', 'Usage'],
  ['personalize', 'Personalization'], ['memory', 'Memory'], ['privacy', 'Privacy & data'],
] as const;
// Canvas: these open Router (src/lib/router-settings-route.ts), so the palette names where they go.
const ROUTER_LABELS: Partial<Record<string, string>> = { keys: 'API keys', models: 'Routing', usage: 'Usage' };

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
      { id: 'new-chat', label: 'New chat', detail: `${modKey}⇧O`, Icon: Plus, run: newGeneralChat || newChat },
      ...(CANVAS_SHELL ? [{ id: 'prism', label: 'Router', detail: 'Models, providers & routing', Icon: GitFork, run: () => { setUi({ page: null, settingsOpen: false, sidebarOpen: false }); openRoutingCenter(); } }] : []),
      { id: 'library', label: 'Assistants', detail: 'Helpers with their own instructions', Icon: Sparkles, run: () => window.dispatchEvent(new Event('mr:library')) },
      { id: 'prompts', label: 'Saved prompts', detail: 'Start a message from a prompt', Icon: BookOpen, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'prompts' })) },
      { id: 'files', label: 'Files', detail: 'Documents and uploaded files', Icon: FileText, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'documents' })) },
      { id: 'knowledge', label: 'Uploaded files', detail: 'Files Lumen searches and cites', Icon: BookOpen, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'knowledge' })) },
      { id: 'study', label: 'Study', detail: 'Flashcards and quizzes', Icon: Sparkles, run: () => window.dispatchEvent(new CustomEvent('mr-open-study')) },
      { id: 'tasks', label: 'Scheduled tasks', detail: 'Settings', Icon: Clock, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tasks' })) },
      { id: 'free-tools', label: 'Summarize a YouTube video', detail: 'Tool', Icon: Wrench, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools:youtube' })) },
      { id: 'read-page', label: 'Read a web page', detail: 'Tool', Icon: Wrench, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools:reader' })) },
      { id: 'calculate', label: 'Calculate with Python', detail: 'Tool', Icon: Wrench, run: () => window.dispatchEvent(new CustomEvent('mr:library', { detail: 'tools:calculation' })) },
      { id: 'canvas', label: 'Open document canvas', detail: 'Write and edit', Icon: FileText, run: () => useStore.getState().openCanvas() },
      { id: 'analysis', label: 'Data analysis', detail: 'Python · CSV · Excel · charts', Icon: BarChart3, run: () => setUi({ runner: { lang: 'python', code: ANALYSIS_TEMPLATES.overview.code, analysis: true }, sidebarOpen: false }) },
      { id: 'shortcuts', label: 'Keyboard shortcuts', detail: `${modKey}/`, Icon: Keyboard, run: () => window.dispatchEvent(new Event('mr:shortcuts')) },
      ...sections.map(([id, label]) => { const router = CANVAS_SHELL ? ROUTER_LABELS[id] : undefined; return { id: `settings-${id}`, label: router ? `Router · ${router}` : `Settings · ${label}`, detail: router ? 'Router' : 'Settings', Icon: Settings, run: () => setUi({ settingsOpen: true, settingsTab: id, sidebarOpen: false }) }; }),
      ...projects.map((project) => ({ id: `project-${project.id}`, label: project.name, detail: 'Project', Icon: FolderKanban, run: () => selectProject(project.id) })),
      ...enabled.map((id) => ({ id: `model-${id}`, label: modelLabel(catalog, id), detail: 'Set default model', Icon: Boxes, run: () => updateSettings({ defaultModel: id }) })),
      ...savedChats(chats).slice(0, 100).map((chat) => ({ id: `chat-${chat.id}`, label: chat.title, detail: 'Chat', Icon: MessageSquare, run: () => selectChat(chat.id) })),
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
