import { AlertTriangle, ShieldCheck, ShieldOff, Brain, BookmarkCheck, X as XIcon, Check, ChevronDown, Copy, FileDown, Info, Pencil, RefreshCw, Square, Volume2 } from 'lucide-react';
import { memo, useState } from 'react';
import { buildFile } from '../lib/generate';
import { toPlainText } from '../lib/markdown';
import { canSpeak, speak, stopSpeaking } from '../lib/speech';
import { copyText, isRtl, safeFileName, saveBlob } from '../lib/util';
import { modelLabel, useStore } from '../store';
import type { Message } from '../types';
import Markdown from './Markdown';
import ModelPicker from './ModelPicker';

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function Thinking({ text, active }: { text: string; active: boolean }) {
  const show = useStore((s) => s.settings.showThinking);
  const [open, setOpen] = useState(false);
  if (!show) return active ? <div className="thinking-chip"><Brain size={15} /> Thinking…</div> : null;
  return (
    <div className={`thinking${open ? ' open' : ''}`}>
      <button className="thinking-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Brain size={15} />
        <span className={active ? 'shimmer' : ''}>{active ? 'Thinking…' : 'Thought process'}</span>
        <ChevronDown size={15} className="chev" />
      </button>
      {open && <div className="thinking-body" dir="auto">{text}</div>}
    </div>
  );
}

function UserMessage({ message, busy }: { message: Message; busy: boolean }) {
  const editAndResend = useStore((s) => s.editAndResend);
  const setUi = useStore((s) => s.setUi);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const [copied, setCopied] = useState(false);

  return (
    <div className="msg user">
      {message.files && message.files.length > 0 && (
        <div className="msg-files">
          {message.files.map((f) =>
            f.thumb ? (
              <img key={f.id} src={f.thumb} alt={f.name} className="msg-thumb" title={f.name} />
            ) : (
              <button key={f.id} className="file-chip" title={f.name} onClick={() => f.text && setUi({ preview: { name: `${f.name}.txt`, content: f.text } })}>
                <FileDown size={15} /> <span>{f.name}</span>
              </button>
            ),
          )}
        </div>
      )}
      {editing ? (
        <div className="edit-box">
          <textarea dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus rows={Math.min(10, draft.split('\n').length + 1)} />
          <div className="edit-actions">
            <button className="btn ghost" onClick={() => { setEditing(false); setDraft(message.text); }}>Cancel</button>
            <button className="btn primary" disabled={!draft.trim() || busy} onClick={() => { setEditing(false); void editAndResend(message.id, draft.trim()); }}>Send</button>
          </div>
        </div>
      ) : (
        message.text && <div className="bubble" dir="auto">{message.text}</div>
      )}
      {message.privacy && !editing && (
        <div className={`privacy-note${message.privacy.unmasked ? ' as-is' : ''}`}>
          {message.privacy.unmasked ? <ShieldOff size={12} /> : <ShieldCheck size={12} />}
          {message.privacy.unmasked
            ? 'Sent without masking'
            : `${message.privacy.masked} personal detail${message.privacy.masked === 1 ? '' : 's'} hidden from the model`}
        </div>
      )}
      {!editing && (
        <div className="msg-actions user-actions">
          <button className="msg-action" onClick={async () => { if (await copyText(message.text)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }} aria-label="Copy" title="Copy">
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          {!busy && (
            <button className="msg-action" onClick={() => setEditing(true)} aria-label="Edit" title="Edit and resend">
              <Pencil size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MemoryChip({ memory }: { memory: NonNullable<Message['memory']> }) {
  const [open, setOpen] = useState(false);
  const memories = useStore((s) => s.memories);
  const deleteMemory = useStore((s) => s.deleteMemory);
  const setUi = useStore((s) => s.setUi);
  const saved = (memory.saved || []).filter((m) => memories.some((x) => x.id === m.id));
  if (!saved.length && !memory.forgotten?.length) return null;
  return (
    <div className="memory-note">
      <button className="memory-tag" onClick={() => setOpen(!open)} aria-expanded={open}>
        <BookmarkCheck size={14} /> Memory updated
      </button>
      {open && (
        <ul className="memory-changes" dir="auto">
          {saved.map((m) => (
            <li key={m.id}>
              <span>
                <b>Saved:</b> {m.text}
              </span>
              <button className="icon-btn xs" aria-label="Remove from memory" title="Remove from memory" onClick={() => void deleteMemory(m.id)}>
                <XIcon size={13} />
              </button>
            </li>
          ))}
          {memory.forgotten?.map((t, i) => (
            <li key={i}>
              <span>
                <b>Removed:</b> {t}
              </span>
            </li>
          ))}
          <li>
            <button className="link-btn" onClick={() => setUi({ settingsOpen: true, settingsTab: 'memory' })}>
              Manage memory
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

function AssistantMessage({ message, isLast, busy }: { message: Message; isLast: boolean; busy: boolean }) {
  const catalog = useStore((s) => s.catalog);
  const regenerate = useStore((s) => s.regenerate);
  const continueReply = useStore((s) => s.continueReply);
  const toast = useStore((s) => s.toast);
  const chatTitle = useStore((s) => s.chats.find((c) => c.id === s.currentId)?.title || 'Reply');
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const streaming = message.status === 'streaming';
  const truncated = message.notices?.some((n) => /length limit/.test(n));

  const saveWord = async () => {
    try {
      await saveBlob(await buildFile('reply.docx', message.text), `${safeFileName(chatTitle, 'Reply')}.docx`);
    } catch (e) {
      toast(`Couldn't create the Word file: ${(e as Error).message}`, 'error');
    }
  };

  return (
    <div className="msg assistant">
      {message.thinking && <Thinking text={message.thinking} active={streaming && !message.text} />}
      {message.text ? (
        <Markdown text={message.text} streaming={streaming} />
      ) : streaming && !message.thinking ? (
        <div className="typing" aria-label="Writing"><span /><span /><span /></div>
      ) : null}
      {streaming && message.text && <span className="caret" />}

      {message.sources && message.sources.length > 0 && (
        <div className="sources">
          <span className="sources-label">Sources</span>
          {message.sources.slice(0, 8).map((s, i) => (
            <a key={s.url + i} href={s.url} target="_blank" rel="noopener noreferrer" className="source" title={s.title}>
              <span className="source-n">{i + 1}</span>
              <span className="source-host">{s.title && !/^https?:/.test(s.title) ? s.title : hostOf(s.url)}</span>
            </a>
          ))}
        </div>
      )}

      {message.notices?.map((n, i) => (
        <div key={i} className="notice" dir="auto"><Info size={14} /> {n}</div>
      ))}

      {message.memory && !streaming && <MemoryChip memory={message.memory} />}

      {message.error && (
        <div className="error-box" role="alert">
          <AlertTriangle size={18} />
          <div>
            <div className="error-msg" dir="auto">{message.error}</div>
            {isLast && !busy && (
              <button className="btn small" onClick={() => void regenerate(message.id)}>
                <RefreshCw size={14} /> Try again
              </button>
            )}
          </div>
        </div>
      )}

      {!streaming && (
        <div className="msg-actions">
          <span className="model-tag" title={message.route ? `Auto picked this model: ${message.route}` : message.model}>
            {modelLabel(catalog, message.model)}
            {message.route && <span className="route-tag"> · Auto: {message.route}</span>}
          </span>
          {message.text && (
            <>
              <button className="msg-action" aria-label="Copy" title="Copy" onClick={async () => { if (await copyText(message.text)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
              {canSpeak && (
                <button
                  className="msg-action"
                  aria-label={speaking ? 'Stop reading' : 'Read aloud'}
                  title={speaking ? 'Stop reading' : 'Read aloud'}
                  onClick={() => {
                    if (speaking) {
                      stopSpeaking();
                      setSpeaking(false);
                    } else {
                      setSpeaking(true);
                      speak(message.id, toPlainText(message.text), () => setSpeaking(false));
                    }
                  }}
                >
                  {speaking ? <Square size={14} /> : <Volume2 size={15} />}
                </button>
              )}
              <button className="msg-action" aria-label="Save as Word" title="Save reply as Word" onClick={saveWord}>
                <FileDown size={15} />
              </button>
            </>
          )}
          {!busy && (
            <>
              <button className="msg-action" aria-label="Regenerate" title="Regenerate" onClick={() => void regenerate(message.id)}>
                <RefreshCw size={15} />
              </button>
              <ModelPicker compact value={message.model || ''} onChange={(id) => void regenerate(message.id, id)} label="Retry with…" align={isRtl(message.text) ? 'right' : 'left'} />
            </>
          )}
          {truncated && isLast && !busy && (
            <button className="btn small" onClick={() => void continueReply()}>Continue</button>
          )}
        </div>
      )}
    </div>
  );
}

function MessageItem({ message, isLast, busy }: { message: Message; isLast: boolean; busy: boolean }) {
  return message.role === 'user' ? <UserMessage message={message} busy={busy} /> : <AssistantMessage message={message} isLast={isLast} busy={busy} />;
}

export default memo(MessageItem);
