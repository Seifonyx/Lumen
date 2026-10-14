import CodingPlanCard from './CodingPlanCard';
import { parsePlan } from '../lib/coding-plan';
import KnowledgeSourceView from './KnowledgeSourceView';
import type { KnowledgeSource } from '../types';
import { AlertTriangle, Share, FolderOpen, ShieldCheck, ShieldOff, Brain, BookmarkCheck, X as XIcon, Check, ChevronDown, Copy, FileDown, GitBranch, Info, Pencil, RefreshCw, Square, TextSelect, Volume2 } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { mentionedPaths, repoTree, seenPaths } from '../lib/workspace';
import { normalizeEdits } from '../lib/edits';
import { buildFile } from '../lib/generate';
import { toPlainText } from '../lib/markdown';
import { canSpeak, speak, stopSpeaking } from '../lib/speech';
import { copyText, isRtl, isTouch, safeFileName, saveBlob } from '../lib/util';
import { modelLabel, useStore } from '../store';
import type { Message } from '../types';
import Markdown from './Markdown';
import GeneratedImage from './GeneratedImage';
import RouteWhy from './RouteWhy';
import ModelPicker from './ModelPicker';
import TextSelection from './TextSelection';
import MoreMenu from './MoreMenu';

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

/** While a reply is on its way: the route it's taking, live (models passed over are struck through). */
function WaitingForReply({ message }: { message: Message }) {
  const progress = useStore(s => s.replyProgress?.chatId === s.currentId ? s.replyProgress : null);
  const catalog = useStore(s => s.catalog);
  const label = progress?.label || 'Routing';
  const tried = progress?.tried || [];
  const target = message.model ? modelLabel(catalog, message.model) : '';
  return (
    <div className="reply-wait route-wait" role="status" aria-label={`${label}${target ? ` to ${target}` : ''}`}>
      <span className="route-pulse" aria-hidden="true" />
      <span className="route-label">{label}</span>
      {tried.map((m) => <span key={m} className="route-tried" aria-hidden="true"><s>{modelLabel(catalog, m)}</s></span>)}
      {target && <span className="route-target" aria-hidden="true"><span className="route-arrow">→</span>{target}</span>}
      {message.via && <span className="route-why" aria-hidden="true">· {message.via}</span>}
      {!message.via && message.route && <span className="route-why" aria-hidden="true">· {message.route}</span>}
    </div>
  );
}

/** Under the last reply in a coding chat: files it names that the model hasn't seen, one tap to load them. */
function LoadMentioned({ message }: { message: Message }) {
  const chat = useStore((s) => s.chats.find((c) => c.id === s.currentId));
  const loadRepoFiles = useStore((s) => s.loadRepoFiles);
  const busy = useStore((s) => Boolean(s.streamingChatId));
  const [paths, setPaths] = useState<string[]>([]);
  const repo = chat?.repo;
  useEffect(() => {
    setPaths([]);
    if (!repo || !chat || /`{3,}\s*(edit|delete)[:\s]/i.test(normalizeEdits(message.text))) return;
    let live = true;
    repoTree(repo).then(
      (t) => {
        const seen = seenPaths(chat);
        if (live) setPaths(mentionedPaths(message.text, t.files).filter((p) => !seen.has(p)));
      },
      () => {},
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.text, repo?.owner, repo?.repo, repo?.branch, chat?.messages.length]);
  if (!chat || !paths.length) return null;
  return (
    <div className="load-mentioned">
      <FolderOpen size={15} />
      <span className="load-mentioned-files">
        {paths.map((p) => <code key={p} title={p}>{p.split('/').pop()}</code>)}
      </span>
      <button className="btn small" disabled={busy} onClick={() => void loadRepoFiles(chat.id, paths)}>
        Load {paths.length === 1 ? 'file' : `${paths.length} files`} &amp; continue
      </button>
    </div>
  );
}

function UserMessage({ message, busy }: { message: Message; busy: boolean }) {
  const editAndResend = useStore((s) => s.editAndResend);
  const setUi = useStore((s) => s.setUi);
  const chatId = useStore((s) => s.currentId);
  const branchChatFrom = useStore((s) => s.branchChatFrom);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const [copied, setCopied] = useState(false);

  // Files the app loaded because a model asked for them.
  if (message.auto === 'repository') return <div className="msg auto-files" role="note"><GitBranch size={14}/><span>{message.text.split('\n')[0]}</span></div>;
  if (message.auto === 'files') {
    const names = (message.files || []).map((f) => f.name);
    return (
      <div className="msg auto-files" role="note">
        <FolderOpen size={14} />
        <span>
          {message.searches?.map((q) => (
            <span key={q.query} className="auto-search">
              Searched <code>{q.query}</code> · {q.count ? `${q.count} match${q.count === 1 ? '' : 'es'}` : 'no matches'}
            </span>
          ))}
          {names.length ? <>Loaded {names.map((n) => <code key={n}>{n}</code>)}</> : null}
          {/Couldn't find/.test(message.text) && <span className="muted"> {message.text.split(' — ')[0]}.</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="msg user">
      {message.files && message.files.length > 0 && (
        <div className="msg-files">
          {message.files.map((f) =>
            f.thumb ? (
              <img key={f.id} src={f.thumb} alt={f.name} className="msg-thumb" title={f.name} />
            ) : (
              <button key={f.id} className={`file-chip${f.auto ? ' auto' : ''}`} title={f.auto ? `${f.name} — attached automatically: your message is about it` : f.name} onClick={() => f.text && setUi({ preview: { name: `${f.name}.txt`, content: f.text } })}>
                <FileDown size={15} /> <span>{f.name}</span>
                {f.auto && <span className="chip-note">auto</span>}
              </button>
            ),
          )}
        </div>
      )}
      {editing ? (
        <div className="edit-box">
          <textarea aria-label="Edit message" dir="auto" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus rows={Math.min(10, draft.split('\n').length + 1)} />
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
          {message.text && <TextSelection text={message.text} />}
          <button className="msg-action" onClick={async () => { if (await copyText(message.text)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }} aria-label="Copy" title="Copy">
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
          {!busy && (
            <>
              <button className="msg-action" onClick={() => setEditing(true)} aria-label="Edit" title="Edit and resend"><Pencil size={15} /></button>
              {chatId && <button className="msg-action" onClick={() => branchChatFrom(chatId, message.id)} aria-label="Branch from this message" title="Branch from here"><GitBranch size={15} /></button>}
            </>
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
  const [source,setSource]=useState<KnowledgeSource|null>(null);
  const catalog = useStore((s) => s.catalog);
  const regenerate = useStore((s) => s.regenerate);
  const continueReply = useStore((s) => s.continueReply);
  const toast = useStore((s) => s.toast);
  const chatTitle = useStore((s) => s.chats.find((c) => c.id === s.currentId)?.title || 'Reply');
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const streaming = message.status === 'streaming';
  const truncated = message.notices?.some((n) => /length limit/.test(n));

  // Phones: the native share sheet (Messages, Mail, Notes, WhatsApp…).
  const canShare = typeof navigator.share === 'function' && isTouch();
  const shareReply = async () => {
    try {
      await navigator.share({ title: chatTitle, text: message.text });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast("Couldn't open the share sheet.", 'error');
    }
  };

  const saveWord = async () => {
    try {
      await saveBlob(await buildFile('reply.docx', message.text), `${safeFileName(chatTitle, 'Reply')}.docx`);
    } catch (e) {
      toast(`Couldn't create the Word file: ${(e as Error).message}`, 'error');
    }
  };

  if (!message.text && message.files?.some((f) => f.kind === 'image')) return <div className="msg assistant"><GeneratedImage message={message} /></div>;

  return (
    <div className="msg assistant">
      {message.thinking && <Thinking text={message.thinking} active={streaming && !message.text} />}
      {message.text ? (
        <Markdown text={message.coding?.phase === 'plan' && !streaming && parsePlan(message.text) ? message.text.replace(/`{3,}plan\s*\n[\s\S]*?\n`{3,}/i, '') : message.text} streaming={streaming} messageId={message.id} knowledgeSources={message.knowledgeSources} onSource={setSource}/>
      ) : streaming && !message.thinking ? (
        <WaitingForReply message={message} />
      ) : null}
      {streaming && message.text && <span className="caret" />}
      {message.coding && <CodingPlanCard message={message} />}
      {message.knowledgeSources?.length? <div className="knowledge-citations" aria-label="Document sources">{message.knowledgeSources.map((item,i)=><button className="source btn ghost small" key={`${item.docId}:${item.page}`} onClick={()=>setSource(item)}><span className="source-n">D{i+1}</span><span>{item.title} · {/\.pdf$/i.test(item.title)?'PDF page':'Section'} {item.page}</span></button>)}</div>:null}
      {source&&<KnowledgeSourceView source={source} onClose={()=>setSource(null)}/>}

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

      {isLast && !streaming && message.text && <LoadMentioned message={message} />}

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
          {message.route && !message.via && message.model ? <RouteWhy message={message} /> : (
          <span className="model-tag" title={message.via ? `${message.via} layout${message.route ? `: ${message.route}` : ''}` : message.route ? `Auto picked this model: ${message.route}` : message.model}>
            {modelLabel(catalog, message.model)}
            {message.via ? (
              <span className="route-tag"> · {message.via}{message.route ? `: ${message.route}` : ''}</span>
            ) : (
              message.route && <span className="route-tag"> · Auto: {message.route}</span>
            )}
          </span>
          )}
          {message.text && (
            <>
              <button className="msg-action" aria-label="Copy" title="Copy" onClick={async () => { if (await copyText(message.text)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
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
          {message.text && (
            <MoreMenu
              items={[
                ...(canSpeak ? [{ label: speaking ? 'Stop reading' : 'Read aloud', icon: speaking ? <Square size={14} /> : <Volume2 size={15} />, onSelect: () => {
                  if (speaking) { stopSpeaking(); setSpeaking(false); }
                  else { setSpeaking(true); speak(message.id, toPlainText(message.text), () => setSpeaking(false)); }
                } }] : []),
                ...(canShare ? [{ label: 'Share', icon: <Share size={15} />, onSelect: () => void shareReply() }] : []),
                { label: 'Save as Word', icon: <FileDown size={15} />, onSelect: () => void saveWord() },
                { label: 'Edit in canvas', icon: <Pencil size={15} />, onSelect: () => useStore.getState().openCanvas(`${safeFileName(chatTitle, 'Reply')}.md`, message.text) },
                { label: 'Select text', icon: <TextSelect size={15} />, onSelect: () => setSelecting(true) },
              ]}
            />
          )}
          {selecting && <TextSelection text={toPlainText(message.text)} open onClose={() => setSelecting(false)} />}
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
