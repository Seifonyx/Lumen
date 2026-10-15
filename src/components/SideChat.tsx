// Side by side: another chat beside the one you're in, to read or copy from while you work. "Switch" makes it
// the main chat (and puts the main one here); X closes it.
import { ArrowLeftRight, X } from 'lucide-react';
import { useRef } from 'react';
import { activeSummary } from '../lib/compact';
import { useExit } from '../lib/motion';
import { useStore } from '../store';
import { ReadOnlyPane } from './MessageItem';
import MessageThread from './MessageThread';
import PaneResizer from './PaneResizer';

export default function SideChat() {
  const chat = useStore((s) => s.chats.find((c) => c.id === s.sideChatId));
  const streaming = useStore((s) => s.streamingChatId === s.sideChatId);
  const { setUi, selectChat } = useStore.getState();
  const pane = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const navigationHost = useRef<HTMLDivElement>(null);
  useExit(pane, 'fade');
  if (!chat) return null;
  return (
    <aside ref={pane} className="side-chat" aria-label={`Side by side: ${chat.title}`}>
      <PaneResizer pane={pane} storageKey="mr.sideWidth" label="Resize side by side" />
      <header className="side-chat-head">
        <span className="side-chat-title" dir="auto" title={chat.title}>{chat.title}</span>
        <button type="button" className="btn ghost small" onClick={() => selectChat(chat.id)} title="Make this the main chat"><ArrowLeftRight size={14} /> Switch</button>
        <button type="button" className="icon-btn" aria-label="Close side by side" onClick={() => setUi({ sideChatId: null })}><X size={18} /></button>
      </header>
      <div className="side-chat-scroll" ref={scroller} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        <ReadOnlyPane.Provider value={true}>
          <MessageThread key={chat.id} chat={chat} summary={activeSummary(chat)} busy={streaming} compacting={false} scroller={scroller} stick={stick} navigationHost={navigationHost} />
        </ReadOnlyPane.Provider>
        <div ref={navigationHost} hidden />
      </div>
    </aside>
  );
}
