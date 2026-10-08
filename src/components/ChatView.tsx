import { ArrowDown, FileSpreadsheet, FileText, Languages, LineChart, Menu, Presentation, ScrollText, SquarePen } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AUTO } from '../lib/routing';
import { selectCurrentChat, useStore } from '../store';
import Composer, { prefillComposer } from './Composer';
import MessageItem from './MessageItem';
import ModelPicker from './ModelPicker';

const SUGGESTIONS = [
  { icon: Presentation, title: 'Make a presentation', prompt: 'Make a 8-slide PowerPoint presentation about ' },
  { icon: FileSpreadsheet, title: 'Build an Excel tracker', prompt: 'Create an Excel workbook to track ' },
  { icon: FileText, title: 'Write a Word report', prompt: 'Write a well-formatted Word report about ' },
  { icon: ScrollText, title: 'Summarize a file', prompt: 'Summarize the attached file in clear bullet points, then list the key numbers.' },
  { icon: LineChart, title: 'Chart some data', prompt: 'Show this data as a chart: ' },
  { icon: Languages, title: 'Translate', prompt: 'Translate the following into Arabic, keeping the tone natural:\n\n' },
];

export default function ChatView() {
  const chat = useStore(selectCurrentChat);
  const catalogError = useStore((s) => s.catalogError);
  const streaming = useStore((s) => s.streamingChatId !== null && s.streamingChatId === s.currentId);
  const defaultModel = useStore((s) => s.settings.defaultModel);
  const { setUi, newChat, setChatModel } = useStore.getState();
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [showDown, setShowDown] = useState(false);

  const model = chat?.model && (chat.model === AUTO || useStore.getState().settings.enabledModels.includes(chat.model)) ? chat.model : defaultModel;
  const messages = chat?.messages || [];
  const lastText = messages.length ? messages[messages.length - 1].text.length + (messages[messages.length - 1].thinking?.length || 0) : 0;

  // Jump to the bottom when switching chats.
  useLayoutEffect(() => {
    stick.current = true;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat?.id]);

  // Follow streaming text while the user is at the bottom.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastText]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
      stick.current = gap < 80;
      setShowDown(gap > 400);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="main">
      <header className="topbar">
        <button className="icon-btn menu-btn" onClick={() => setUi({ sidebarOpen: true })} aria-label="Open chats">
          <Menu size={22} />
        </button>
        <ModelPicker value={model} onChange={setChatModel} />
        <div className="spacer" />
        <button className="icon-btn" onClick={newChat} aria-label="New chat" title="New chat (Ctrl+Shift+O)">
          <SquarePen size={20} />
        </button>
      </header>

      {catalogError && (
        <div className="banner" role="alert" dir="auto">
          Some models couldn't be loaded: {catalogError}
        </div>
      )}

      <div className="messages" ref={scroller}>
        {messages.length === 0 ? (
          <div className="empty">
            <img src="/icon.svg" alt="" width={52} height={52} />
            <h1>What can I help with?</h1>
            <p className="muted">Ask anything, attach files, or have me make documents, spreadsheets and slides.</p>
            <div className="suggestions">
              {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                <button key={title} className="suggestion" onClick={() => prefillComposer(prompt)}>
                  <Icon size={18} />
                  <span>{title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="thread">
            {messages.map((m, i) => (
              <MessageItem key={m.id} message={m} isLast={i === messages.length - 1} busy={streaming} />
            ))}
          </div>
        )}
      </div>

      {showDown && (
        <button
          className="to-bottom"
          aria-label="Scroll to latest"
          onClick={() => {
            stick.current = true;
            scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
          }}
        >
          <ArrowDown size={18} />
        </button>
      )}

      <Composer model={model} />
    </main>
  );
}
