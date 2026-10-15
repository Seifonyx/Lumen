// Tools: everything Lumen can do beyond a plain chat, in one catalog: research, creating, analysing, learning,
// assistants and connected apps. Each card says what the tool does and what it needs; opening one starts it.
// (The message box's + menu keeps the everyday ones one tap away.)
import { BarChart3, BookOpenCheck, Calculator, Columns2, FileSearch, FolderGit2, Globe, GraduationCap, Image as ImageIcon, MessageSquareText, Pencil, PlayCircle, Plug, Plus, Search, Sparkles, Telescope, TextCursorInput } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ANALYSIS_TEMPLATES } from '../lib/analysis';
import { BUILTIN_ASSISTANTS } from '../lib/assistants';
import { useStore } from '../store';
import HubPage from './HubPage';

type Section = 'research' | 'create' | 'analyze' | 'learn' | 'assistants' | 'apps';
interface Tool { id: string; section: Section; name: string; text: string; icon: ReactNode; needs?: string; ready?: boolean; state?: string; run: () => void }

const SECTIONS: { id: Section; label: string; blurb: string }[] = [
  { id: 'research', label: 'Research', blurb: 'Find things out, on the web and in your own history.' },
  { id: 'create', label: 'Create', blurb: 'Write, draw and edit.' },
  { id: 'analyze', label: 'Analyze', blurb: 'Numbers, data and second opinions.' },
  { id: 'learn', label: 'Learn', blurb: 'Make what you read stick.' },
  { id: 'assistants', label: 'Assistants', blurb: 'Helpers with their own instructions and model.' },
  { id: 'apps', label: 'Connected apps', blurb: 'Your accounts elsewhere, used in chats.' },
];

const composerMode = (mode: 'research' | 'image') => {
  const s = useStore.getState();
  s.setUi({ page: null });
  s.newChat();
  setTimeout(() => window.dispatchEvent(new CustomEvent('mr:composer-mode', { detail: mode })), 60);
};
const library = (detail: string) => window.dispatchEvent(new CustomEvent('mr:library', { detail }));

export default function ToolsPage({ onClose }: { onClose: () => void }) {
  const keys = useStore((s) => s.keys);
  const settings = useStore((s) => s.settings);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<Section>('research');
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
    { id: 'writing', section: 'create', name: 'Writing tools', text: 'Select words in any reply to improve, shorten, change the tone or translate them.', icon: <TextCursorInput size={20} />, run: () => s.toast('Select some words in any reply, then tap “Writing tools”.') },
    { id: 'prompts', section: 'create', name: 'Saved prompts', text: 'Start a message from a prompt you use often.', icon: <MessageSquareText size={20} />, run: () => library('prompts') },
    { id: 'analysis', section: 'analyze', name: 'Data analysis', text: 'Charts and answers from CSV and Excel files, run on your device.', icon: <BarChart3 size={20} />, run: () => s.setUi({ page: null, runner: { lang: 'python', code: ANALYSIS_TEMPLATES.overview.code, analysis: true } }) },
    { id: 'calc', section: 'analyze', name: 'Calculate', text: 'Exact maths with Python, shown step by step.', icon: <Calculator size={20} />, needs: 'Gemini key', ready: gemini, run: () => library('tools:calculation') },
    { id: 'compare', section: 'analyze', name: 'Compare models', text: 'Ask two or three models at once, then combine their answers.', icon: <Columns2 size={20} />, run: () => { s.setUi({ page: null }); s.toast('Type your question, then choose + → Compare models.'); setTimeout(() => document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus(), 100); } },
    { id: 'study', section: 'learn', name: 'Study', text: 'Flashcards and quizzes from any chat or document. Hard cards come back sooner.', icon: <GraduationCap size={20} />, run: () => s.setUi({ page: 'study' }) },
    { id: 'study-chat', section: 'learn', name: 'Study partner', text: 'An assistant that explains step by step and quizzes you.', icon: <BookOpenCheck size={20} />, run: () => { const a = BUILTIN_ASSISTANTS.find((x) => x.id === 'builtin-study'); if (a) { s.startAssistant(a); s.setUi({ page: null }); } } },
    { id: 'github', section: 'apps', name: 'GitHub', text: 'Work on your repositories: read code, plan and commit changes.', icon: <FolderGit2 size={20} />, state: keys.github ? 'Connected' : 'Not connected', run: () => (keys.github ? s.setUi({ page: null, repoPicker: true }) : s.setUi({ settingsOpen: true, settingsTab: 'connectors' })) },
    { id: 'more-apps', section: 'apps', name: 'More connections', text: 'Google Drive, Calendar and others are on the way.', icon: <Plug size={20} />, state: 'Soon', run: () => s.toast('More connections are coming. Tell us which you want.') },
  ], [gemini, keys.cloudflare, keys.github, settings.webSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const assistants = [...(settings.assistants || []), ...BUILTIN_ASSISTANTS].slice(0, 6);
  const q = query.trim().toLowerCase();
  const match = (t: { name: string; text: string }) => !q || `${t.name} ${t.text}`.toLowerCase().includes(q);
  // The category list follows the section you're reading.
  useEffect(() => {
    const root = scroller.current?.closest('.hub-scroll');
    if (!root) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id.replace('tools-', ''), e.isIntersecting);
      const first = SECTIONS.find((sec) => seen.get(sec.id));
      if (first) setActive(first.id);
    }, { root, rootMargin: '0px 0px -60% 0px' });
    root.querySelectorAll('.tools-section').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [query]);
  const jump = (id: Section) => { setActive(id); document.getElementById(`tools-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const Card = ({ t }: { t: Tool }) => (
    <button type="button" className={`tool-card sec-${t.section}`} onClick={t.run}>
      <span className="tool-icon" aria-hidden="true">{t.icon}</span>
      <span className="tool-text">
        <strong>{t.name}{t.state && <span className={`tool-state${t.state === 'On' || t.state === 'Connected' ? ' on' : ''}`}>{t.state}</span>}</strong>
        <span>{t.text}</span>
        {t.needs && <span className={`tool-needs${t.ready ? ' ok' : ''}`}>{t.ready ? '✓ ' : 'Needs a '}{t.ready ? t.needs.replace(' key', ' ready') : t.needs}</span>}
      </span>
    </button>
  );

  return (
    <HubPage label="Tools" title="Tools" subtitle="Everything Lumen can do beyond a chat. The ones you use most are also in the + menu." onClose={onClose}
      toolbar={<label className="hub-search"><Search size={16} /><input type="search" aria-label="Search tools" placeholder="Search tools" value={query} onChange={(e) => setQuery(e.target.value)} /></label>}>
      <div className="tools-layout" ref={scroller}>
        <nav className="tools-rail" aria-label="Tool categories">
          {SECTIONS.map((sec) => <button key={sec.id} type="button" className={active === sec.id ? 'active' : ''} aria-current={active === sec.id || undefined} onClick={() => jump(sec.id)}>{sec.label}</button>)}
        </nav>
        <div className="tools-sections">
          {SECTIONS.map((sec) => {
            if (sec.id === 'assistants') {
              const list = assistants.filter((a) => match({ name: a.name, text: a.description }));
              if (q && !list.length) return null;
              return (
                <section key={sec.id} id={`tools-${sec.id}`} className="tools-section">
                  <header><h2>{sec.label}</h2><p>{sec.blurb}</p><button type="button" className="btn small" onClick={() => s.setUi({ page: 'assistants' })}>All assistants</button></header>
                  <div className="tools-grid">
                    {list.map((a) => (
                      <button key={a.id} type="button" className="tool-card sec-assistants" onClick={() => { s.startAssistant(a); s.setUi({ page: null }); }}>
                        <span className="tool-icon" aria-hidden="true"><Sparkles size={20} /></span>
                        <span className="tool-text"><strong>{a.name}</strong><span>{a.description || 'Your custom assistant.'}</span></span>
                      </button>
                    ))}
                    {!q && <button type="button" className="tool-card tool-new" onClick={() => s.setUi({ page: 'assistants' })}><span className="tool-icon" aria-hidden="true"><Plus size={20} /></span><span className="tool-text"><strong>Make an assistant</strong><span>Your own instructions and model, ready in every chat.</span></span></button>}
                  </div>
                </section>
              );
            }
            const list = tools.filter((t) => t.section === sec.id && match(t));
            if (!list.length) return null;
            return (
              <section key={sec.id} id={`tools-${sec.id}`} className="tools-section">
                <header><h2>{sec.label}</h2><p>{sec.blurb}</p></header>
                <div className="tools-grid">{list.map((t) => <Card key={t.id} t={t} />)}</div>
              </section>
            );
          })}
          {q && !tools.some(match) && !assistants.some((a) => match({ name: a.name, text: a.description })) && <p className="hub-none">No tools match “{query}”.</p>}
        </div>
      </div>
    </HubPage>
  );
}
