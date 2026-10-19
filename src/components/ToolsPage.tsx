// Tools: everything Lumen can do beyond a plain chat, in one catalog: research, creating, analysing, learning,
// and assistants. Each card says what the tool does and what it needs; opening one starts it.
// (The message box's + menu keeps the everyday ones one tap away; connected apps live in Settings → Connectors.)
// On iPhones with the glass look, the bottom tab bar picks a category, so the page shows one at a time.
import { BarChart3, BookOpenCheck, Calculator, Columns2, FileSearch, Globe, GraduationCap, Image as ImageIcon, MessageSquareText, Pencil, PlayCircle, Plus, Search, Sparkles, Telescope, TextCursorInput } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ANALYSIS_TEMPLATES } from '../lib/analysis';
import { BUILTIN_ASSISTANTS } from '../lib/assistants';
import { useStore } from '../store';
import HubPage from './HubPage';
import AssistantLibrary from './AssistantLibrary';
import { uid } from '../lib/util';
import type { SavedAssistant } from '../types';

type Section = 'research' | 'create' | 'analyze' | 'learn' | 'assistants';
interface Tool { id: string; section: Section; name: string; text: string; icon: ReactNode; needs?: string; ready?: boolean; state?: string; run?: () => void }

const SECTIONS: { id: Section; label: string; blurb: string }[] = [
  { id: 'research', label: 'Research', blurb: 'Find things out, on the web and in your own history.' },
  { id: 'create', label: 'Create', blurb: 'Write, draw and edit.' },
  { id: 'analyze', label: 'Analyze', blurb: 'Numbers, data and second opinions.' },
  { id: 'learn', label: 'Learn', blurb: 'Make what you read stick.' },
  { id: 'assistants', label: 'Assistants', blurb: 'Helpers with their own instructions and model.' },
];

const composerMode = (mode: 'research' | 'image') => {
  const s = useStore.getState();
  s.setUi({ page: null });
  s.newChat();
  setTimeout(() => window.dispatchEvent(new CustomEvent('mr:composer-mode', { detail: mode })), 60);
};
const library = (detail: string) => window.dispatchEvent(new CustomEvent('mr:library', { detail }));

// Stable component identity keeps an in-progress press intact when search,
// connection settings or the scroll observer update the Tools page.
function ToolCard({ t }: { t: Tool }) {
    const content = <>
      <span className="tool-icon" aria-hidden="true">{t.icon}</span>
      <span className="tool-text">
        <strong>{t.name}{t.state && <span className={`tool-state${t.state === 'On' || t.state === 'Connected' ? ' on' : ''}`}>{t.state}</span>}</strong>
        <span>{t.text}</span>
        {t.needs && <span className={`tool-needs${t.ready ? ' ok' : ''}`}>{t.ready ? '✓ ' : 'Needs a '}{t.ready ? t.needs.replace(' key', ' ready') : t.needs}</span>}
      </span>
    </>;
    return t.run
      ? <button type="button" className={`tool-card sec-${t.section}`} onClick={t.run}>{content}</button>
      : <article className={`tool-card tool-contextual sec-${t.section}`}>{content}</article>;
}

export default function ToolsPage({ onClose, initial = 'research', newAssistant = false }: { onClose: () => void; initial?: Section; newAssistant?: boolean }) {
  const keys = useStore((s) => s.keys);
  const settings = useStore((s) => s.settings);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Section>(initial);
  // iPhone: an assistant is made or edited right here, and Back, Save or Delete return to this tab.
  const [editingAssistant, setEditingAssistant] = useState<SavedAssistant | 'new' | null>(newAssistant ? 'new' : null);
  // iPhone glass look: one category at a time, chosen in the bottom tab bar.
  const [glassPhone] = useState(() => document.documentElement.classList.contains('glass') && window.matchMedia('(max-width: 899px)').matches);
  const scroller = useRef<HTMLDivElement>(null);
  const gemini = Boolean(keys.gemini);
  const s = useStore.getState();

  const tools: Tool[] = useMemo(() => [
    { id: 'research', section: 'research', name: 'Deep research', text: 'Several web searches, read and turned into one cited report.', icon: <Telescope size={20} />, needs: 'Gemini key', ready: gemini, run: () => composerMode('research') },
    { id: 'ask', section: 'research', name: 'Ask your chats', text: 'Find what you talked about, even in other words, and get an answer from it.', icon: <Sparkles size={20} />, needs: 'Gemini key', ready: gemini, run: () => { s.setUi({ page: null, sidebarOpen: true }); setTimeout(() => document.querySelector<HTMLInputElement>('#chat-search')?.focus(), 350); } },
    { id: 'web', section: 'research', name: 'Web search', text: 'Let replies look things up on Google.', icon: <Globe size={20} />, needs: 'Gemini key', ready: gemini, state: settings.webSearch ? 'On' : 'Off', run: () => { s.updateSettings({ webSearch: !settings.webSearch }); s.toast(settings.webSearch ? 'Web search off.' : 'Web search on for your messages.', 'success'); } },
    { id: 'page', section: 'research', name: 'Read a web page', text: 'Bring a page’s text into the chat to summarize or ask about.', icon: <FileSearch size={20} />, run: () => library('tools:reader') },
    { id: 'youtube', section: 'research', name: 'Summarize a YouTube video', text: 'Main points and timestamps from a public video.', icon: <PlayCircle size={20} />, needs: 'Gemini key', ready: gemini, run: () => library('tools:youtube') },
    { id: 'canvas', section: 'create', name: 'Document canvas', text: 'Write and edit a document side by side with the chat.', icon: <Pencil size={20} />, run: () => { s.setUi({ page: null }); s.newChat(); setTimeout(() => useStore.getState().openCanvas(), 0); } },
    { id: 'image', section: 'create', name: 'Create an image', text: 'Describe it and Lumen draws it.', icon: <ImageIcon size={20} />, needs: 'Cloudflare key', ready: Boolean(keys.cloudflare), run: () => composerMode('image') },
    { id: 'writing', section: 'create', name: 'Writing tools', text: 'Select text in a reply, then choose Writing tools to improve, shorten, change the tone or translate it.', icon: <TextCursorInput size={20} />, state: 'In replies' },
    { id: 'prompts', section: 'create', name: 'Saved prompts', text: 'Start a message from a prompt you use often.', icon: <MessageSquareText size={20} />, run: () => library('prompts') },
    { id: 'analysis', section: 'analyze', name: 'Data analysis', text: 'Charts and answers from CSV and Excel files, run on your device.', icon: <BarChart3 size={20} />, run: () => s.setUi({ page: null, runner: { lang: 'python', code: ANALYSIS_TEMPLATES.overview.code, analysis: true } }) },
    { id: 'calc', section: 'analyze', name: 'Calculate', text: 'Exact maths with Python, shown step by step.', icon: <Calculator size={20} />, needs: 'Gemini key', ready: gemini, run: () => library('tools:calculation') },
    { id: 'compare', section: 'analyze', name: 'Compare models', text: 'Ask two or three models at once, then combine their answers.', icon: <Columns2 size={20} />, run: () => { s.setUi({ page: null, sidebarOpen: false }); window.dispatchEvent(new CustomEvent('mr:composer-mode', { detail: 'compare' })); } },
    { id: 'study', section: 'learn', name: 'Study', text: 'Flashcards and quizzes from any chat or document. Hard cards come back sooner.', icon: <GraduationCap size={20} />, run: () => s.setUi({ page: 'study', pageArg: undefined }) },
    { id: 'study-chat', section: 'learn', name: 'Study partner', text: 'An assistant that explains step by step and quizzes you.', icon: <BookOpenCheck size={20} />, run: () => { const a = BUILTIN_ASSISTANTS.find((x) => x.id === 'builtin-study'); if (a) { s.startAssistant(a); s.setUi({ page: null }); } } },
  ], [gemini, keys.cloudflare, settings.webSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // (On iPhone this tab is the only list of assistants, so it shows them all.)
  const allAssistants = [...(settings.assistants || []), ...BUILTIN_ASSISTANTS];
  const assistants = glassPhone ? allAssistants : allAssistants.slice(0, 6);
  const q = query.trim().toLowerCase();
  const match = (t: { name: string; text: string }) => !q || `${t.name} ${t.text}`.toLowerCase().includes(q);
  // The category list follows the section you're reading.
  useEffect(() => {
    const root = scroller.current?.closest('.hub-scroll');
    if (!root || glassPhone) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id.replace('tools-', ''), e.isIntersecting);
      const first = SECTIONS.find((sec) => seen.get(sec.id));
      if (first) setActive(first.id);
    }, { root, rootMargin: '0px 0px -60% 0px' });
    root.querySelectorAll('.tools-section').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [query, glassPhone]);
  const pick = (id: Section) => { setActive(id); scroller.current?.closest('.hub-scroll')?.scrollTo({ top: 0 }); };
  const ICONS: Record<Section, ReactNode> = { research: <Telescope size={22} />, create: <Pencil size={22} />, analyze: <BarChart3 size={22} />, learn: <GraduationCap size={22} />, assistants: <Sparkles size={22} /> };
  const HUES: Record<Section, number> = { research: 212, create: 330, analyze: 160, learn: 40, assistants: 270 };
  // A + only where it adds something: on the Assistants tab (the other tabs' cards already start those tools).
  const create = active === 'assistants' ? { label: 'New assistant', run: () => setEditingAssistant('new') } : undefined;
  const bar = glassPhone ? { label: 'Tool categories', active, onSelect: (id: string) => pick(id as Section), create, items: SECTIONS.map((sec) => ({ id: sec.id, label: sec.label, icon: ICONS[sec.id], hue: HUES[sec.id] })) } : undefined;
  // With the tab bar, only the chosen category shows, and the search looks only inside it.
  const shownHere = (id: Section) => !glassPhone || id === active;
  const jump = (id: Section) => { setActive(id); document.getElementById(`tools-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };


  if (editingAssistant) return <AssistantLibrary key={typeof editingAssistant === 'string' ? 'new' : editingAssistant.id} startNew={editingAssistant === 'new'} startWith={typeof editingAssistant === 'string' ? undefined : editingAssistant} onClose={onClose} onDone={() => setEditingAssistant(null)} />;

  return (
    <HubPage label="Tools" title="Tools" subtitle="Everything Lumen can do beyond a chat. The ones you use most are also in the + menu." onClose={onClose} bar={bar}
      toolbar={<label className="hub-search"><Search size={16} /><input type="search" aria-label="Search tools" placeholder={glassPhone ? `Search ${SECTIONS.find((x) => x.id === active)?.label}` : 'Search tools'} value={query} onChange={(e) => setQuery(e.target.value)} /></label>}>
      <div className="tools-layout" ref={scroller}>
        <nav className="tools-rail" aria-label="Tool categories">
          {SECTIONS.map((sec) => <button key={sec.id} type="button" className={active === sec.id ? 'active' : ''} aria-current={active === sec.id || undefined} onClick={() => jump(sec.id)}>{sec.label}</button>)}
        </nav>
        <div className="tools-sections">
          {SECTIONS.map((sec) => {
            if (!shownHere(sec.id)) return null;
            if (sec.id === 'assistants') {
              const list = assistants.filter((a) => match({ name: a.name, text: a.description }));
              if (q && !list.length) return null;
              return (
                <section key={sec.id} id={`tools-${sec.id}`} className="tools-section">
                  {!glassPhone && <header><h2>{sec.label}</h2><p>{sec.blurb}</p><button type="button" className="btn small" onClick={() => s.setUi({ page: 'assistants' })}>All assistants</button></header>}
                  <div className="tools-grid">
                    {list.map((a) => (
                      <div key={a.id} className="tool-card-wrap">
                        <button type="button" className="tool-card sec-assistants" onClick={() => { s.startAssistant(a); s.setUi({ page: null }); }}>
                          <span className="tool-icon" aria-hidden="true"><Sparkles size={20} /></span>
                          <span className="tool-text"><strong>{a.name}</strong><span>{a.description || 'Your custom assistant.'}</span></span>
                        </button>
                        {/* iPhone: edit yours (or make your own copy of one of Lumen's) */}
                        {glassPhone && <button type="button" className="icon-btn tool-card-edit" aria-label={a.id.startsWith('builtin-') ? `Customize ${a.name}` : `Edit ${a.name}`} onClick={() => setEditingAssistant(a.id.startsWith('builtin-') ? { ...a, id: uid() } : a)}><Pencil size={17} /></button>}
                      </div>
                    ))}
                    {!q && !glassPhone && <button type="button" className="tool-card tool-new" onClick={() => s.setUi({ page: 'assistants' })}><span className="tool-icon" aria-hidden="true"><Plus size={20} /></span><span className="tool-text"><strong>Make an assistant</strong><span>Your own instructions and model, ready in every chat.</span></span></button>}
                  </div>
                </section>
              );
            }
            const list = tools.filter((t) => t.section === sec.id && match(t));
            if (!list.length) return null;
            return (
              <section key={sec.id} id={`tools-${sec.id}`} className="tools-section">
                {!glassPhone && <header><h2>{sec.label}</h2><p>{sec.blurb}</p></header>}
                <div className="tools-grid">{list.map((t) => <ToolCard key={t.id} t={t} />)}</div>
              </section>
            );
          })}
          {q && (glassPhone
            ? (active === 'assistants' ? !assistants.some((a) => match({ name: a.name, text: a.description })) : !tools.some((t) => t.section === active && match(t)))
            : !tools.some(match) && !assistants.some((a) => match({ name: a.name, text: a.description }))) && <p className="hub-none">No tools match “{query}”.</p>}
        </div>
      </div>
    </HubPage>
  );
}
