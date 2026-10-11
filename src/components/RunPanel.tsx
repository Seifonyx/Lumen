import { Download, FileSpreadsheet, Loader2, MessageSquarePlus, Play, Square, Trash2, Upload, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { htmlDocument, LANG_NAMES, releasePythonRunner, runCode, runLang, type OutLine, type Run, type RunArtifact } from '../lib/runner';
import { ANALYSIS_TEMPLATES, analysisFileName, analysisFilesFit, analysisMime, MAX_ANALYSIS_BYTES, type AnalysisInput } from '../lib/analysis';
import { insertPrompt } from './Composer';
import { useStore } from '../store';
import Modal from './Modal';

const CodeEditor = lazy(() => import('./CodeEditor'));
const EXT = { js: 'js', ts: 'ts', python: 'py', html: 'html' } as const;

/** Runs a code block from a reply: editable code above, output (or a live page for HTML) below. */
export default function RunPanel() {
  const runner = useStore((s) => s.runner)!;
  const setUi = useStore((s) => s.setUi);
  const send = useStore((s) => s.send);
  const busy = useStore((s) => Boolean(s.streamingChatId || s.comparing || s.compactingChatId || s.canvasEditingChatId));
  const analysis = Boolean(runner.analysis);
  const lang = runLang(runner.lang) || 'js';
  const [code, setCode] = useState(runner.code);
  const [out, setOut] = useState<OutLine[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ failed: boolean; ms: number } | null>(null);
  const [page, setPage] = useState('');
  const [files, setFiles] = useState<AnalysisInput[]>([]);
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const [artifacts, setArtifacts] = useState<RunArtifact[]>([]);
  const [downloads, setDownloads] = useState<{ name: string; url: string; bytes: number }[]>([]);
  const mounted = useRef(true);
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
    setArtifacts([]);
    if (lang === 'html') {
      setPage(htmlDocument(code));
      setResult({ failed: false, ms: 0 });
      return;
    }
    setRunning(true);
    let printed = 0;
    const r = runCode(lang, code, (line) => {
      if (printed >= 200_000) return;
      const text = line.text.slice(0, Math.min(20_000, 200_000 - printed));
      printed += text.length;
      setOut((items) => items.length >= 2000 ? items : [...items, { ...line, text: text.length < line.text.length ? `${text}\n[Output truncated]` : text }]);
    }, analysis ? 240_000 : undefined, {
      analysis, files, onArtifact: (file) => setArtifacts((items) => [...items, file]),
    });
    run.current = r;
    void r.done.then((res) => {
      if (run.current !== r) return;
      setRunning(false);
      setResult(res);
    });
  }, [code, lang, analysis, files]);

  // Run once when opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!analysis) start(); }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; run.current?.stop(); if (analysis) releasePythonRunner(); }; }, [analysis]);
  useEffect(() => {
    const items = artifacts.map(file => ({ name: file.name, bytes: file.data.byteLength, url: URL.createObjectURL(new Blob([file.data.slice().buffer], { type: analysisMime(file.name) })) }));
    setDownloads(items);
    return () => items.forEach(file => URL.revokeObjectURL(file.url));
  }, [artifacts]);

  const upload = async (incoming: File[]) => {
    setFileError('');
    if (incoming.some(file => !/\.(csv|tsv|xlsx|xlsm|xls)$/i.test(file.name))) { setFileError('Choose CSV, TSV or Excel files.'); return; }
    if (files.length + incoming.length > 5 || files.reduce((sum, file) => sum + file.data.byteLength, 0) + incoming.reduce((sum, file) => sum + file.size, 0) > MAX_ANALYSIS_BYTES) {
      setFileError('Choose up to 5 files, totalling 20 MB.'); return;
    }
    setReading(true);
    try {
      const next = [...files];
      for (const file of incoming) next.push({ name: analysisFileName(file.name, next.map(item => item.name)), data: new Uint8Array(await file.arrayBuffer()) });
      if (mounted.current && analysisFilesFit(next)) setFiles(next);
    } catch { if (mounted.current) setFileError('This file could not be read. Please try again.'); }
    finally { if (mounted.current) setReading(false); }
  };

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
    if (analysis) insertPrompt(parts.filter(Boolean).join('\n\n'));
    else void send(parts.filter(Boolean).join('\n\n'), []);
    close();
  };

  return (
    <Modal
      title={analysis ? 'Data analysis' : <>Run · {LANG_NAMES[lang]}</>}
      onClose={close}
      wide
    >
      <div
        className={`run-panel${lang === 'html' ? ' html' : ''}${analysis ? ' analysis-panel' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (!running && !reading) start();
          }
        }}
      >
        {analysis && <section className="analysis-inputs" aria-label="Analysis files">
          <div className="analysis-intro"><span className="analysis-symbol"><FileSpreadsheet size={22} /></span><div><h3>Work with your data</h3><p>Calculate, clean and chart with editable Python. Files stay on this device.</p></div></div>
          <label className={`btn analysis-upload${running || reading ? ' disabled' : ''}`}>
            {reading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Add CSV or Excel files
            <input type="file" multiple accept=".csv,.tsv,.xlsx,.xlsm,.xls" aria-label="Upload analysis files" disabled={running || reading} onChange={(event) => { const incoming = Array.from(event.target.files || []); event.target.value = ''; void upload(incoming); }} />
          </label>
          <span className="muted small">Up to 5 files · 20 MB total</span>
          {fileError && <p className="analysis-error" role="alert">{fileError}</p>}
          {files.length > 0 && <ul className="analysis-file-list">{files.map(file => <li key={file.name}><FileSpreadsheet size={16} /><span title={file.name}>{file.name}<small>{(file.data.byteLength / 1024).toFixed(1)} KB</small></span><button className="icon-btn xs" disabled={running || reading} aria-label={`Remove ${file.name}`} onClick={() => setFiles(items => items.filter(item => item !== file))}><X size={15} /></button></li>)}</ul>}
          <div className="analysis-templates" aria-label="Analysis templates">{Object.entries(ANALYSIS_TEMPLATES).map(([key, template]) => <button key={key} type="button" className={`btn small${code === template.code ? ' active' : ' ghost'}`} disabled={running} onClick={() => {
            if (!Object.values(ANALYSIS_TEMPLATES).some(item => item.code === code) && !window.confirm('Replace your edited Python with this template?')) return;
            setCode(template.code);
          }}>{template.label}</button>)}</div>
          <p className="muted small analysis-help">Templates use the first file. In Python, <code>input_files</code> lists all uploads. Save downloads in <code>/output</code>; charts appear automatically.</p>
        </section>}
        <div className="run-toolbar">
          <span className="run-status muted small">
            {running ? <><Loader2 size={13} className="spin" /> Running…</> : result ? (lang === 'html' ? 'Showing the page' : `${failed ? 'Failed' : 'Finished'} in ${result.ms < 1000 ? `${result.ms} ms` : `${(result.ms / 1000).toFixed(1)} s`}`) : ''}
          </span>
          {lang !== 'html' && (out.length > 0 || result) && (
            <button className="btn ghost small" onClick={share} disabled={busy || running}>
              <MessageSquarePlus size={15} /> {analysis ? 'Add output to draft' : failed ? 'Ask to fix' : 'Send output'}
            </button>
          )}
          {running ? (
            <button className="btn small" onClick={() => run.current?.stop()}>
              <Square size={14} /> Stop
            </button>
          ) : (
            <button className="btn primary small" onClick={start} title="Ctrl+Enter" disabled={reading}>
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
        {analysis && downloads.length > 0 && !running && !result?.failed && <section className="analysis-downloads" aria-label="Analysis downloads"><h3>Downloads</h3><div className="analysis-artifacts">{downloads.map(file => <article key={file.name}>
          {/\.png$/i.test(file.name) && <img src={file.url} alt={`Chart: ${file.name}`} />}
          <a className="analysis-download" href={file.url} download={file.name.replace(/\//g, '-')}><Download size={16} /><span>{file.name}<small>{(file.bytes / 1024).toFixed(1)} KB</small></span></a>
        </article>)}</div></section>}
        <p className="run-note muted small">
          {analysis ? 'Python and its packages download once, then work offline if your browser keeps the cache. Uploads and results are temporary; download anything you want to keep. Adding output to a draft lets you review it before sending.' : <>Runs in your browser, separate from the app.{lang === 'python' ? ' Python and packages like numpy and pandas load from jsDelivr the first time.' : lang === 'html' ? '' : ' npm imports load from esm.sh; Node.js-only modules (fs, path…) aren’t available.'}</>}
        </p>
      </div>
    </Modal>
  );
}
