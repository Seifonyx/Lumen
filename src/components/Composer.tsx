import ChecksBar from './ChecksBar';
import { Columns2, FileCode2, GitBranch, ShieldCheck, ArrowUp, FileText, Globe, Loader2, Mic, Paperclip, Plus, Square, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ACCEPT, readAttachment } from '../lib/files/read';
import { canListen, listen } from '../lib/speech';
import { formatBytes, isTouch } from '../lib/util';
import { formatUntil, remaining } from '../lib/usage';
import { modelInfo, modelLabel, useStore } from '../store';
import type { Attachment } from '../types';
import { scan, type Finding } from '../lib/privacy';
import PrivacyCheck from './PrivacyCheck';
import AttachSheet from './AttachSheet';
import CompareModelsModal from './CompareModelsModal';

interface Pending {
  key: string;
  name: string;
  file?: Attachment;
}

const PREFILL = 'mr:prefill';
export const prefillComposer = (text: string) => window.dispatchEvent(new CustomEvent(PREFILL, { detail: text }));
export const insertPrompt = (text: string) => window.dispatchEvent(new CustomEvent(PREFILL, { detail: { text, append: true } }));

export default function Composer({ model, meter, starterActions }: { model: string; meter?: ReactNode; starterActions?: ReactNode }) {
  const send = useStore((s) => s.send);
  const runComparison = useStore((s) => s.runComparison);
  const stop = useStore((s) => s.stop);
  const toast = useStore((s) => s.toast);
  const streaming = useStore((s) => s.streamingChatId !== null || s.compactingChatId !== null || s.comparing);
  const compact = useStore((s) => s.compact);
  const addMemory = useStore((s) => s.addMemory);
  const setUi = useStore((s) => s.setUi);
  const settings = useStore((s) => s.settings);
  const catalog = useStore((s) => s.catalog);
  const updateSettings = useStore((s) => s.updateSettings);
  const currentId = useStore((s) => s.currentId);
  const chat = useStore((s) => s.chats.find((c) => c.id === s.currentId));
  const activeProjectId = useStore((s) => s.activeProjectId);
  const project = settings.projects?.find((p) => p.id === (chat ? chat.projectId : activeProjectId));
  const projectFiles = project?.files || [];
  const setContext = useStore((s) => s.setContext);
  const info = modelInfo(catalog, model);
  const usage = useStore((s) => s.usage);
  const blockedUntil = (() => {
    const u = usage?.models[model];
    if (u?.blockedUntil && u.blockedUntil > Date.now()) return u.blockedUntil;
    const freeOR = model.startsWith('openrouter:') && model.endsWith(':free');
    return freeOR && usage?.openrouter.limit && usage.openrouter.used >= usage.openrouter.limit ? usage.openrouter.resetAt : null;
  })();
  const left = remaining(usage, model);
  const usageWarning = model === 'auto'
    ? ''
    : blockedUntil
    ? `${modelLabel(catalog, model)} reached its limit — back ${formatUntil(blockedUntil)}.${settings.autoSwitch ? ' Your next message will use another model.' : ''}`
    : left !== null && left <= 3
      ? `${modelLabel(catalog, model)}: ${left} message${left === 1 ? '' : 's'} left today.`
      : '';

  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [dragging, setDragging] = useState(false);
  const [check, setCheck] = useState<{ findings: Finding[]; unchecked: number; compareModels?: string[] } | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const baseText = useRef('');
  const [sheet, setSheet] = useState(false);
  const [sheetAnchor, setSheetAnchor] = useState<{ left: number; bottom: number } | undefined>();
  const touch = isTouch();

  // Unsent text is kept per chat, so it survives switching chats, a reload, or the phone closing the page in the background.
  const draftKey = `mr.draft.${currentId ?? 'new'}`;
  const draftKeyRef = useRef(draftKey);
  const saveDraft = useCallback((value: string) => {
    try {
      if (value) localStorage.setItem(draftKeyRef.current, value);
      else localStorage.removeItem(draftKeyRef.current);
    } catch {
      // Storage unavailable: the draft just isn't kept.
    }
  }, []);
  const clearText = () => {
    setText('');
    setInterim('');
    saveDraft('');
  };
  useEffect(() => {
    draftKeyRef.current = draftKey;
    try {
      setText(localStorage.getItem(draftKey) ?? '');
    } catch {
      // Storage unavailable.
    }
  }, [draftKey]);

  const autosize = useCallback(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.4)}px`;
  }, []);

  useEffect(autosize, [text, interim, autosize]);

  useEffect(() => {
    if (!isTouch()) input.current?.focus();
  }, [currentId]);

  useEffect(() => {
    const onPrefill = (e: Event) => {
      const detail = (e as CustomEvent<string | { text: string; append: boolean }>).detail;
      const current = input.current?.value || '';
      const prefill = typeof detail === 'string' ? detail : `${detail.append && current ? current + '\n\n' : ''}${detail.text}`;
      setText(prefill);
      saveDraft(prefill);
      requestAnimationFrame(() => {
        const el = input.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    };
    window.addEventListener(PREFILL, onPrefill);
    return () => window.removeEventListener(PREFILL, onPrefill);
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const key = `${file.name}-${file.size}-${Math.random()}`;
        setPending((p) => [...p, { key, name: file.name }]);
        try {
          const att = await readAttachment(file);
          setPending((p) => p.map((x) => (x.key === key ? { ...x, file: att } : x)));
        } catch (e) {
          setPending((p) => p.filter((x) => x.key !== key));
          toast((e as Error).message, 'error');
        }
      }
    },
    [toast],
  );

  // Drag & drop anywhere in the window.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      void addFiles([...(e.dataTransfer?.files || [])]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [addFiles]);

  const ready = pending.every((p) => p.file);
  const canSend = !streaming && ready && (text.trim() || pending.length > 0);

  const ensureOnline = () => {
    if (navigator.onLine) return true;
    toast("You're offline — your message is kept here; send it when you're back online.");
    return false;
  };

  const submit = () => {
    if (streaming) {
      stop();
      return;
    }
    if (!canSend) return;
    stopListening.current?.();
    // Commands, like in Claude Code.
    if (/^\/compact\s*$/i.test(text.trim()) && !pending.length) {
      clearText();
      void compact();
      return;
    }
    const remember = /^\/remember\s+([\s\S]+)$/i.exec(text.trim());
    if (remember && !pending.length) {
      clearText();
      void addMemory(remember[1]);
      return;
    }
    if (/^\/memory\s*$/i.test(text.trim())) {
      clearText();
      setUi({ settingsOpen: true, settingsTab: 'memory' });
      return;
    }
    if (!ensureOnline()) return;
    const files = pending.map((p) => p.file!);
    // Privacy shield ("Ask me"): show what was found before anything is sent.
    if (settings.privacyShield && settings.privacyMode === 'ask') {
      const findings = [...scan(text), ...files.flatMap((f) => (f.text ? scan(f.text) : [])), ...scan(project?.instructions || ''), ...projectFiles.flatMap((f) => (f.text ? scan(f.text) : []))];
      if (findings.length) {
        setCheck({ findings, unchecked: files.filter((f) => !f.text).length });
        return;
      }
    }
    dispatch();
  };

  const dispatch = (opts?: { privacy?: 'asIs' }) => {
    if (!ensureOnline()) return;
    const compareWith = check?.compareModels;
    setCheck(null);
    const files = pending.map((p) => p.file!);
    const message = text.trim();
    clearText();
    if (compareWith) void runComparison(message, files, compareWith, opts);
    else void send(message, files, opts);
    setPending([]);
  };

  const compare = (models: string[]) => {
    if (!ensureOnline()) return;
    setCompareOpen(false);
    const files = pending.map((p) => p.file!);
    if (settings.privacyShield && settings.privacyMode === 'ask') {
      const findings = [...scan(text), ...files.flatMap((f) => (f.text ? scan(f.text) : [])), ...scan(project?.instructions || ''), ...projectFiles.flatMap((f) => (f.text ? scan(f.text) : []))];
      if (findings.length) {
        setCheck({ findings, unchecked: files.filter((f) => !f.text).length, compareModels: models });
        return;
      }
    }
    dispatchCompare(models);
  };
  const dispatchCompare = (models: string[], opts?: { privacy?: 'asIs' }) => {
    if (!ensureOnline()) return;
    const files = pending.map((p) => p.file!);
    const message = text.trim();
    clearText();
    void runComparison(message, files, models, opts);
    setPending([]);
  };

  const toggleMic = () => {
    if (listening) {
      stopListening.current?.();
      return;
    }
    baseText.current = text ? `${text.trimEnd()} ` : '';
    setListening(true);
    stopListening.current = listen(
      settings.voiceLang,
      (finalText, partial) => {
        setText(baseText.current + finalText);
        saveDraft(baseText.current + finalText);
        setInterim(partial);
      },
      (error) => {
        setListening(false);
        setInterim('');
        stopListening.current = null;
        if (error) toast(error, 'error');
      },
    );
  };

  const searchAvailable = !info || info.search;

  return (
    <div className="composer-wrap">
      {dragging && (
        <div className="drop-overlay">
          <Paperclip size={28} />
          <span>Drop files to attach</span>
        </div>
      )}
      {meter}
      {usageWarning && (
        <div className={`usage-warning${blockedUntil ? ' blocked' : ''}`} role="status" dir="auto">
          {usageWarning}
        </div>
      )}
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {chat?.repo && <ChecksBar chat={chat} />}
        {chat?.repo && (
          <div className="repo-strip">
            <button type="button" className="repo-chip" onClick={() => setUi({ workspaceOpen: true })} title="Open the repository panel">
              <GitBranch size={13} /> <span className="repo-chip-name">{chat.repo.repo}</span> <span className="repo-chip-branch muted">· {chat.repo.branch}</span>
              {Object.keys(chat.changes || {}).length > 0 && <span className="badge">{Object.keys(chat.changes || {}).length}</span>}
            </button>
            {(chat.context || []).map((p) => (
              <span key={p} className="ctx-chip" title={p}>
                <FileCode2 size={12} /> <span className="ctx-chip-name">{p.split('/').pop()}</span>
                <button type="button" className="icon-btn xs" aria-label={`Remove ${p} from the chat`} onClick={() => setContext(chat.id, (chat.context || []).filter((x) => x !== p))}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        {pending.length > 0 && (
          <div className="attachments">
            {pending.map((p) => (
              <div key={p.key} className={`attachment${p.file ? '' : ' loading'}`} title={p.name}>
                {p.file?.thumb ? <img src={p.file.thumb} alt="" /> : p.file ? <FileText size={18} /> : <Loader2 size={18} className="spin" />}
                <span className="att-meta">
                  <span className="att-name">{p.name}</span>
                  <span className="att-size">{p.file ? (p.file.kind === 'text' && !p.file.mime.startsWith('text') ? 'Converted to text' : formatBytes(p.file.size)) : 'Reading…'}</span>
                </span>
                {p.file && (
                  <button type="button" className="icon-btn xs" aria-label={`Remove ${p.name}`} onClick={() => setPending((x) => x.filter((y) => y.key !== p.key))}>
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={input}
          rows={1}
          dir="auto"
          placeholder={listening ? 'Listening…' : 'Message Model Router'}
          value={interim ? `${text}${text && !text.endsWith(' ') ? ' ' : ''}${interim}` : text}
          onChange={(e) => {
            setText(e.target.value);
            saveDraft(e.target.value);
            setInterim('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && settings.enterToSend && !isTouch()) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            const files = [...(e.clipboardData?.files || [])];
            if (files.length) {
              e.preventDefault();
              void addFiles(files);
            }
          }}
          enterKeyHint={settings.enterToSend && !isTouch() ? 'send' : 'enter'}
        />
        <div className="composer-bar">
          <input ref={fileInput} type="file" multiple hidden accept={ACCEPT} onChange={(e) => { void addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
          {touch ? (
            <>
              <button type="button" className={`tool-btn${chat?.repo ? ' on-repo' : ''}`} onClick={() => setSheet(true)} aria-label="Add photos, files or a repository" aria-haspopup="dialog">
                <Plus size={22} />
              </button>
            </>
          ) : (
            <button type="button" className={`tool-btn add-tool${chat?.repo ? ' on-repo' : ''}`} onClick={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setSheetAnchor({ left: Math.max(16, Math.min(box.left, window.innerWidth - 376)), bottom: window.innerHeight - box.top + 8 });
              setSheet(true);
            }} aria-label="Add files or a repository" aria-haspopup="dialog" title="Add files or a repository">
              <Plus size={21} />
            </button>
          )}
          <button
            type="button"
            className={`tool-btn pill${settings.webSearch ? ' on' : ''}${searchAvailable ? '' : ' unavailable'}`}
            onClick={() => updateSettings({ webSearch: !settings.webSearch })}
            aria-pressed={settings.webSearch}
            title={searchAvailable ? 'Search the web for up-to-date answers' : 'Web search works with Gemini models only'}
          >
            <Globe size={17} /> <span>Search</span>
          </button>
          <button type="button" className="tool-btn pill compare-trigger" disabled={!canSend} onClick={() => setCompareOpen(true)} aria-label="Compare models" title="Compare this question with two or three models">
            <Columns2 size={16} /> <span>Compare</span>
          </button>
          <div className="spacer" />
          {settings.privacyShield && (
            <button
              type="button"
              className="tool-btn shield-on"
              onClick={() => setUi({ settingsOpen: true, settingsTab: 'privacy' })}
              aria-label="Privacy shield is on"
              title={settings.privacyMode === 'ask' ? 'Privacy shield: asks before sending personal details' : 'Privacy shield: masks personal details automatically'}
            >
              <ShieldCheck size={17} />
            </button>
          )}
          {canListen && (
            <button type="button" className={`tool-btn${listening ? ' recording' : ''}`} onClick={toggleMic} aria-label={listening ? 'Stop voice input' : 'Voice input'} title="Voice input">
              <Mic size={19} />
            </button>
          )}
          <button type="submit" className={`send-btn${streaming ? ' stop' : ''}`} disabled={!streaming && !canSend} aria-label={streaming ? 'Stop' : 'Send'} title={streaming ? 'Stop (Esc)' : 'Send'}>
            {streaming ? <Square size={14} fill="currentColor" /> : <ArrowUp size={19} />}
          </button>
        </div>
      </form>
      {sheet && (
        <AttachSheet
          onClose={() => setSheet(false)}
          onFiles={() => fileInput.current?.click()}
          onRepo={() => setUi(chat?.repo ? { workspaceOpen: true } : { repoPicker: true })}
          repoName={chat?.repo ? `${chat.repo.owner}/${chat.repo.repo}` : undefined}
          anchor={touch ? undefined : sheetAnchor}
        />
      )}
      {compareOpen && <CompareModelsModal prompt={text.trim()} files={pending.flatMap((p) => p.file ? [p.file] : [])} onClose={() => setCompareOpen(false)} onCompare={compare} />}
      {check && <PrivacyCheck findings={check.findings} unchecked={check.unchecked} onMask={() => dispatch()} onAsIs={() => dispatch({ privacy: 'asIs' })} onEdit={() => setCheck(null)} />}
      <p className="disclaimer">AI can make mistakes. Check important info.</p>
      {starterActions && <div className="starter-actions">{starterActions}</div>}
    </div>
  );
}
