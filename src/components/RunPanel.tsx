import { Loader2, MessageSquarePlus, Play, Square, Trash2 } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { htmlDocument, LANG_NAMES, runCode, runLang, type OutLine, type Run } from '../lib/runner';
import { useStore } from '../store';
import Modal from './Modal';

const CodeEditor = lazy(() => import('./CodeEditor'));
const EXT = { js: 'js', ts: 'ts', python: 'py', html: 'html' } as const;

/** Runs a code block from a reply: editable code above, output (or a live page for HTML) below. */
export default function RunPanel() {
  const runner = useStore((s) => s.runner)!;
  const setUi = useStore((s) => s.setUi);
  const send = useStore((s) => s.send);
  const busy = useStore((s) => Boolean(s.streamingChatId));
  const lang = runLang(runner.lang) || 'js';
  const [code, setCode] = useState(runner.code);
  const [out, setOut] = useState<OutLine[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ failed: boolean; ms: number } | null>(null);
  const [page, setPage] = useState('');
  const run = useRef<Run | null>(null);
  const outBox = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    run.current?.stop();
    setUi({ runner: null });
  }, [setUi]);

  const start = useCallback(() => {
    run.current?.stop();
    setOut([]);
    setResult(null);
    if (lang === 'html') {
      setPage(htmlDocument(code));
      setResult({ failed: false, ms: 0 });
      return;
    }
    setRunning(true);
    const r = runCode(lang, code, (l) => setOut((o) => (o.length > 2000 ? o : [...o, l])));
    run.current = r;
    void r.done.then((res) => {
      if (run.current !== r) return;
      setRunning(false);
      setResult(res);
    });
  }, [code, lang]);

  // Run once when opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => start(), []);
  useEffect(() => () => run.current?.stop(), []);

  // Logs from the HTML page.
  useEffect(() => {
    if (lang !== 'html') return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.__runner) setOut((o) => [...o, { kind: e.data.kind, text: e.data.text }]);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [lang]);

  useEffect(() => {
    outBox.current?.scrollTo({ top: outBox.current.scrollHeight });
  }, [out]);

  const outputText = out.filter((l) => l.kind !== 'system').map((l) => (l.kind === 'error' ? `Error: ${l.text}` : l.text)).join('\n');
  const failed = Boolean(result?.failed) || out.some((l) => l.kind === 'error');
  const edited = code !== runner.code;

  const share = () => {
    const fence = '```';
    const parts = [
      failed ? `I ran the ${LANG_NAMES[lang]} code and it failed:` : `I ran the ${LANG_NAMES[lang]} code. Output:`,
      `${fence}\n${outputText.slice(-6000) || '(no output)'}\n${fence}`,
      edited ? `This is the code I ran (I changed it):\n${fence}${lang === 'python' ? 'python' : lang}\n${code}\n${fence}` : '',
      failed ? 'Please fix it.' : '',
    ];
    void send(parts.filter(Boolean).join('\n\n'), []);
    close();
  };

  return (
    <Modal
      title={<>Run · {LANG_NAMES[lang]}</>}
      onClose={close}
      wide
    >
      <div
        className={`run-panel${lang === 'html' ? ' html' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            start();
          }
        }}
      >
        <div className="run-toolbar">
          <span className="run-status muted small">
            {running ? <><Loader2 size={13} className="spin" /> Running…</> : result ? (lang === 'html' ? 'Showing the page' : `${failed ? 'Failed' : 'Finished'} in ${result.ms < 1000 ? `${result.ms} ms` : `${(result.ms / 1000).toFixed(1)} s`}`) : ''}
          </span>
          {lang !== 'html' && (out.length > 0 || result) && (
            <button className="btn ghost small" onClick={share} disabled={busy || running}>
              <MessageSquarePlus size={15} /> {failed ? 'Ask to fix' : 'Send output'}
            </button>
          )}
          {running ? (
            <button className="btn small" onClick={() => run.current?.stop()}>
              <Square size={14} /> Stop
            </button>
          ) : (
            <button className="btn primary small" onClick={start} title="Ctrl+Enter">
              <Play size={14} /> Run{result ? ' again' : ''}
            </button>
          )}
        </div>
        <div className="run-code">
          <Suspense fallback={<pre className="run-fallback">{code}</pre>}>
            <CodeEditor path={`snippet.${EXT[lang]}`} value={code} onChange={setCode} />
          </Suspense>
        </div>
        {lang === 'html' && (
          <iframe className="run-page" title="Page preview" sandbox="allow-scripts allow-modals allow-forms" srcDoc={page} />
        )}
        {(lang !== 'html' || out.length > 0) && (
          <div className="run-out" ref={outBox} role="log" aria-label="Output">
            <div className="run-out-head">
              <span>{lang === 'html' ? 'Console' : 'Output'}</span>
              {out.length > 0 && (
                <button className="icon-btn xs" onClick={() => setOut([])} aria-label="Clear output"><Trash2 size={12} /></button>
              )}
            </div>
            {out.length === 0 && !running && <div className="run-line system">{result ? 'No output.' : ''}</div>}
            {out.map((l, i) => (
              <div key={i} className={`run-line ${l.kind}`}>{l.text}</div>
            ))}
          </div>
        )}
        <p className="run-note muted small">
          Runs in your browser, separate from the app.{lang === 'python' ? ' Python and packages like numpy and pandas load from jsDelivr the first time.' : lang === 'html' ? '' : ' npm imports load from esm.sh; Node.js-only modules (fs, path…) aren’t available.'}
        </p>
      </div>
    </Modal>
  );
}
