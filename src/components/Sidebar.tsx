import { Download, MoreHorizontal, Pencil, Pin, PinOff, Search, Settings, SquarePen, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayGroup, modelShortName, safeFileName, saveBlob } from '../lib/util';
import { useStore } from '../store';
import type { Chat } from '../types';

function chatToMarkdown(chat: Chat): string {
  const lines = [`# ${chat.title}`, ''];
  for (const m of chat.messages) {
    lines.push(m.role === 'user' ? '## You' : `## Assistant${m.model ? ` (${modelShortName(m.model)})` : ''}`);
    if (m.files?.length) lines.push(`_Attachments: ${m.files.map((f) => f.name).join(', ')}_`);
    lines.push(m.text || m.error || '', '');
  }
  return lines.join('\n');
}

function ChatRow({ chat, active }: { chat: Chat; active: boolean }) {
  const { selectChat, deleteChat, renameChat, togglePin } = useStore.getState();
  const streaming = useStore((s) => s.streamingChatId === chat.id);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(chat.title);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  if (editing) {
    return (
      <li className="chat-row editing">
        <input
          autoFocus
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            void renameChat(chat.id, title);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setTitle(chat.title);
              setEditing(false);
            }
          }}
        />
      </li>
    );
  }

  return (
    <li className={`chat-row${active ? ' active' : ''}`}>
      <button className="chat-open" onClick={() => selectChat(chat.id)} dir="auto" title={chat.title}>
        {chat.pinned && <Pin size={13} className="pin-mark" />}
        <span className="chat-title">{chat.title}</span>
        {streaming && <span className="dot-pulse" aria-label="Replying" />}
      </button>
      <div className="row-menu" ref={menuRef}>
        <button className="icon-btn sm" aria-label="Chat options" onClick={() => setMenu(!menu)}>
          <MoreHorizontal size={16} />
        </button>
        {menu && (
          <div className="menu" role="menu">
            <button role="menuitem" onClick={() => { setMenu(false); setTitle(chat.title); setEditing(true); }}>
              <Pencil size={15} /> Rename
            </button>
            <button role="menuitem" onClick={() => { setMenu(false); void togglePin(chat.id); }}>
              {chat.pinned ? <PinOff size={15} /> : <Pin size={15} />} {chat.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button role="menuitem" onClick={() => { setMenu(false); void saveBlob(new Blob([chatToMarkdown(chat)], { type: 'text/markdown' }), `${safeFileName(chat.title, 'chat')}.md`); }}>
              <Download size={15} /> Export
            </button>
            <button role="menuitem" className="danger" onClick={() => { setMenu(false); if (confirm(`Delete "${chat.title}"?`)) void deleteChat(chat.id); }}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export default function Sidebar() {
  const chats = useStore((s) => s.chats);
  const currentId = useStore((s) => s.currentId);
  const open = useStore((s) => s.sidebarOpen);
  const { newChat, setUi } = useStore.getState();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = chats.filter((c) => c.messages.length > 0 || c.id === currentId);
    const matches = q
      ? visible.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q)))
      : visible;
    const out: [string, Chat[]][] = [];
    const pinned = matches.filter((c) => c.pinned);
    if (pinned.length) out.push(['Pinned', pinned]);
    for (const c of matches.filter((c) => !c.pinned)) {
      const g = dayGroup(c.updatedAt);
      const last = out[out.length - 1];
      if (last && last[0] === g) last[1].push(c);
      else out.push([g, [c]]);
    }
    return out;
  }, [chats, query, currentId]);

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Chats">
      <div className="sidebar-head">
        <div className="brand">
          <img src="/icon.svg" alt="" width={26} height={26} />
          <span>TheModelRouter</span>
        </div>
        <button className="icon-btn close-sidebar" onClick={() => setUi({ sidebarOpen: false })} aria-label="Close menu">
          <X size={20} />
        </button>
      </div>
      <button className="btn primary block new-chat" onClick={newChat}>
        <SquarePen size={17} /> New chat
      </button>
      <label className="search">
        <Search size={16} />
        <input id="chat-search" type="search" placeholder="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" />
      </label>
      <nav className="chat-list">
        {groups.length === 0 && <p className="muted small empty-list">{query ? 'No chats match.' : 'Your chats will appear here.'}</p>}
        {groups.map(([label, list]) => (
          <section key={label}>
            <h3 className="group-label">{label}</h3>
            <ul>
              {list.map((c) => (
                <ChatRow key={c.id} chat={c} active={c.id === currentId} />
              ))}
            </ul>
          </section>
        ))}
      </nav>
      <button className="sidebar-foot" onClick={() => setUi({ settingsOpen: true, settingsTab: 'general', sidebarOpen: false })}>
        <Settings size={18} /> Settings
      </button>
    </aside>
  );
}
