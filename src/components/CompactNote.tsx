import { ChevronDown, Loader2, MessageSquarePlus, Shrink, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { formatTokens } from '../lib/usage';
import { modelLabel, useStore } from '../store';
import type { Chat, ChatSummary } from '../types';
import Markdown from './Markdown';

/** The line in a chat where older messages were replaced by a summary. */
export function CompactNote({ chat, summary }: { chat: Chat; summary: ChatSummary }) {
  const [open, setOpen] = useState(false);
  const catalog = useStore((s) => s.catalog);
  const busy = useStore((s) => s.streamingChatId !== null || s.compactingChatId !== null);
  const undoCompact = useStore((s) => s.undoCompact);
  const continued = summary.upTo === null;

  return (
    <div className="compact-note" role="note">
      <div className="compact-line">
        <span className="compact-label">
          <Shrink size={14} />
          {continued ? (
            <span dir="auto">Continues “{summary.from}” · {summary.count} messages summarized</span>
          ) : (
            <span>
              {summary.count} earlier message{summary.count === 1 ? '' : 's'} summarized{summary.saved > 0 ? ` · saves ~${formatTokens(summary.saved)} tokens per message` : ''}
            </span>
          )}
        </span>
      </div>
      <div className="compact-actions">
        <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          <ChevronDown size={14} className={open ? 'flip' : ''} /> {open ? 'Hide summary' : 'Show summary'}
        </button>
        {!continued && (
          <button className="link-btn" onClick={() => void undoCompact(chat.id)} disabled={busy} title="Send the full chat again">
            <Undo2 size={14} /> Undo
          </button>
        )}
      </div>
      {open && (
        <div className="compact-summary" dir="auto">
          <Markdown text={summary.text} streaming={false} />
          {summary.model && <div className="muted small">Written by {modelLabel(catalog, summary.model)}{summary.auto ? ' automatically' : ''}.</div>}
        </div>
      )}
    </div>
  );
}

export function CompactingNote() {
  return (
    <div className="compact-note working" role="status">
      <div className="compact-line">
        <span className="compact-label">
          <Loader2 size={14} className="spin" /> Summarizing earlier messages to keep this chat fast…
        </span>
      </div>
    </div>
  );
}

/** Small meter above the message box once a chat gets long. */
export function MemoryMeter({ used, limit, chatId }: { used: number; limit: number; chatId: string }) {
  const [open, setOpen] = useState(false);
  const compact = useStore((s) => s.compact);
  const continueInNewChat = useStore((s) => s.continueInNewChat);
  const auto = useStore((s) => s.settings.autoCompact);
  const busy = useStore((s) => s.streamingChatId !== null || s.compactingChatId !== null);
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="memory">
      <button className={`memory-chip${pct >= 85 ? ' high' : pct >= 65 ? ' mid' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} title="How full this chat's memory is">
        <span className="memory-bar" aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </span>
        Chat memory {pct}%
      </button>
      {open && (
        <div className="memory-pop" role="dialog" aria-label="Chat memory">
          <p className="small">
            This chat is about {formatTokens(used)} tokens long. {auto ? 'At 100% older messages are summarized automatically' : 'Automatic summarizing is off (Settings → General)'} — like compacting in Claude Code. The full chat stays on screen.
          </p>
          <div className="memory-btns">
            <button className="btn" disabled={busy} onClick={() => { setOpen(false); void compact(chatId); }}>
              <Shrink size={15} /> Compact now
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => { setOpen(false); void continueInNewChat(chatId); }}>
              <MessageSquarePlus size={15} /> New chat with summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
