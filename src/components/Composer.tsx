import { ArrowUp, FileText, Globe, Image as ImageIcon, Loader2, Mic, Paperclip, Square, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPT, readAttachment } from '../lib/files/read';
import { canListen, listen } from '../lib/speech';
import { formatBytes, isTouch } from '../lib/util';
import { formatUntil, remaining } from '../lib/usage';
import { modelInfo, modelLabel, useStore } from '../store';
import type { Attachment } from '../types';

interface Pending {
  key: string;
  name: string;
  file?: Attachment;
}

const PREFILL = 'mr:prefill';
export const prefillComposer = (text: string) => window.dispatchEvent(new CustomEvent(PREFILL, { detail: text }));

export default function Composer({ model }: { model: string }) {
  const send = useStore((s) => s.send);
  const stop = useStore((s) => s.stop);
  const toast = useStore((s) => s.toast);
  const streaming = useStore((s) => s.streamingChatId !== null);
  const settings = useStore((s) => s.settings);
  const catalog = useStore((s) => s.catalog);
  const updateSettings = useStore((s) => s.updateSettings);
  const currentId = useStore((s) => s.currentId);
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
  const input = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const baseText = useRef('');

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
      setText((e as CustomEvent<string>).detail);
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

  const submit = () => {
    if (streaming) {
      stop();
      return;
    }
    if (!canSend) return;
    stopListening.current?.();
    const files = pending.map((p) => p.file!);
    void send(text.trim(), files);
    setText('');
    setInterim('');
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
          <button type="button" className="tool-btn" onClick={() => fileInput.current?.click()} aria-label="Attach files" title="Attach files (PDF, Word, Excel, PowerPoint, images…)">
            <Paperclip size={19} />
          </button>
          {isTouch() && (
            <label className="tool-btn" aria-label="Take a photo" title="Take a photo">
              <ImageIcon size={19} />
              <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
            </label>
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
          <div className="spacer" />
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
      <p className="disclaimer">AI can make mistakes. Don't share patient or confidential data.</p>
    </div>
  );
}
