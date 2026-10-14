import { Check, Download, Eye, FilePlus2, Loader2, Pencil, Plus, RotateCcw, Sparkles, Square, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFocusScope } from '../lib/focus-scope';
import { selectCurrentChat, useStore } from '../store';
import type { CanvasDocument, Chat } from '../types';
import { replaceCanvasRange } from '../lib/canvas';
import { buildFile, fileKind } from '../lib/generate';
import { printDocument } from '../lib/generate/doc-html';
import { readAttachment } from '../lib/files/read';
import { safeFileName, saveBlob } from '../lib/util';
import { findLayout } from '../lib/layouts';
import { memoryInstructions } from '../lib/memory';
import { scan, type Finding } from '../lib/privacy';
import PrivacyCheck from './PrivacyCheck';
import Markdown from './Markdown';

function CanvasEditor({ chat, doc }: { chat: Chat; doc: CanvasDocument }) {
  const settings = useStore(s => s.settings);
  const busy = useStore(s => s.canvasEditingChatId !== null);
  const otherBusy = useStore(s => Boolean(s.streamingChatId || s.compactingChatId || s.comparing));
  const { saveCanvasDocument, requestCanvasEdit } = useStore.getState();
  const editor = useRef<HTMLTextAreaElement>(null);
  const aborter = useRef<AbortController | null>(null);
  const [preview, setPreview] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [range, setRange] = useState({ start: 0, end: 0 });
  const [proposal, setProposal] = useState<{ base: string; start: number; end: number; text: string; model: string } | null>(null);
  const [undo, setUndo] = useState<{ before: string; after: string } | null>(null);
  const [check, setCheck] = useState<Finding[] | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const saveSequence = useRef(0);
  const [saved, setSaved] = useState(true);
  useEffect(() => () => aborter.current?.abort(), []);
  const save = async (content: string, expected?: string) => {
    const sequence = ++saveSequence.current;
    setSaving(true);
    const ok = await saveCanvasDocument(chat.id, doc.id, { content }, expected);
    if (sequence === saveSequence.current) { setSaving(false); setSaved(ok); }
    return ok;
  };
  const selected = range.end > range.start;
  const stale = Boolean(proposal && doc.content !== proposal.base);
  const dispatch = async (asIs = false) => {
    setCheck(null); setError(''); setProposal(null);
    const base = doc.content, start = range.start, end = range.end;
    const controller = new AbortController(); aborter.current = controller;
    try {
      const result = await requestCanvasEdit(chat.id, doc.id, instruction, start, end, controller.signal, asIs);
      if (!controller.signal.aborted) setProposal({ base, start, end, ...result });
    } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message); }
    finally { if (aborter.current === controller) aborter.current = null; }
  };
  const request = () => {
    if (!selected || !instruction.trim()) return;
    const store = useStore.getState();
    const project = settings.projects?.find(p => p.id === chat.projectId);
    const layout = findLayout(chat.model || settings.defaultModel, store.catalog?.models || [], settings.layouts, settings.hiddenLayouts);
    const privateText = [doc.name, doc.content, instruction, settings.customInstructions, project?.instructions, chat.assistant?.instructions, layout?.instructions, settings.memory ? memoryInstructions(store.memories, false) : ''].filter(Boolean).join('\n');
    const findings = settings.privacyShield && settings.privacyMode === 'ask' ? scan(privateText) : [];
    if (findings.length) setCheck(findings); else void dispatch();
  };
  const accept = async () => {
    if (!proposal) return;
    const next = replaceCanvasRange(doc.content, proposal.base, proposal.start, proposal.end, proposal.text);
    if (next === null) { setError('The document changed. Request a fresh edit.'); return; }
    if (await save(next, proposal.base)) { setUndo({ before: proposal.base, after: next }); setProposal(null); setRange({ start: 0, end: 0 }); }
  };
  const code = fileKind(doc.name).kind === 'code';
  return <>
    <div className="canvas-editor-toolbar">
      <div className="canvas-view-switch" role="group" aria-label="Canvas view"><button className={!preview ? 'active' : ''} onClick={() => setPreview(false)}><Pencil size={14} />Edit</button><button className={preview ? 'active' : ''} onClick={() => setPreview(true)}><Eye size={14} />Preview</button></div>
      <button className="icon-btn sm" disabled={!undo || busy || doc.content !== undo.after} aria-label="Undo canvas edit" title="Undo accepted edit" onClick={async () => { if (undo && await save(undo.before, undo.after)) { setUndo(null); setProposal(null); } }}><RotateCcw size={16} /></button>
      <span className="muted small canvas-save-status" role="status">{saving ? 'Saving…' : saved ? 'Saved on device' : 'Save failed'}</span>
    </div>
    <div className="canvas-content">
      {preview ? <div className="canvas-preview" dir="auto">{code ? <pre>{doc.content}</pre> : <Markdown text={doc.content} streaming={false} />}</div> : <textarea ref={editor} className={`canvas-text${code ? ' code' : ''}`} aria-label="Canvas document" dir="auto" spellCheck={!code} value={doc.content} placeholder="Start writing here, or import a document…" onChange={e => { void save(e.target.value); setError(''); }} onSelect={e => { const el = e.currentTarget; setRange({ start: el.selectionStart, end: el.selectionEnd }); }} />}
    </div>
    <div className="canvas-ai-tools">
      <div className="canvas-selection-status"><Sparkles size={15} /><span>{selected ? `${range.end - range.start} characters selected` : 'Select text to edit with AI'}</span><button className="btn ghost small" disabled={preview || !doc.content || busy} onClick={() => { editor.current?.focus(); editor.current?.setSelectionRange(0, doc.content.length); setRange({ start: 0, end: doc.content.length }); }}>Select all</button></div>
      <div className="canvas-quick-edits">{['Shorten', 'Improve writing', 'Translate to Arabic'].map(text => <button key={text} className="btn ghost small" disabled={!selected || busy || otherBusy} onPointerDown={e => e.preventDefault()} onClick={() => setInstruction(text)}>{text}</button>)}</div>
      <div className="canvas-edit-request"><input aria-label="Canvas edit instruction" maxLength={2000} placeholder="Describe the change…" value={instruction} onChange={e => setInstruction(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !busy && !otherBusy) request(); }} /><button className="btn primary small" disabled={!busy && (!selected || !instruction.trim() || otherBusy)} onClick={() => busy ? aborter.current?.abort() : request()}>{busy ? <Square size={15} /> : <Sparkles size={15} />}{busy ? 'Stop' : 'Suggest'}</button></div>
      <p className="canvas-send-hint muted small">Your document and instructions go to the selected model for context. Changes wait for your approval.</p>
      {error && <p className="canvas-error" role="alert">{error}</p>}
      {proposal && <section className="canvas-review" aria-label="Review canvas edit">
        <div className="canvas-review-heading"><strong>Review suggested edit</strong><span className="muted small">{proposal.model.split(':').pop()}</span></div>
        <div className="canvas-review-comparison"><div><span className="muted small">Original</span><pre dir="auto">{proposal.base.slice(proposal.start, proposal.end)}</pre></div><div><span className="muted small">Proposed</span><pre dir="auto">{proposal.text}</pre></div></div>
        {stale && <p className="canvas-error" role="alert">The document changed. Request a fresh edit before applying.</p>}
        <div className="canvas-review-actions"><button className="btn small" onClick={() => setProposal(null)}>Reject</button><button className="btn primary small" disabled={stale || saving || busy} onClick={() => void accept()}><Check size={15} />Accept edit</button></div>
      </section>}
    </div>
    {check && <PrivacyCheck findings={check} unchecked={0} onMask={() => void dispatch()} onAsIs={() => void dispatch(true)} onEdit={() => setCheck(null)} />}
  </>;
}

export default function CanvasPanel() {
  const chat = useStore(selectCurrentChat);
  const selectedId = useStore(s => s.canvasDocumentId);
  const { setUi, openCanvas, deleteCanvasDocument, saveCanvasDocument, toast } = useStore.getState();
  const doc = chat?.documents?.find(d => d.id === selectedId) || chat?.documents?.[0];
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [phone, setPhone] = useState(() => window.matchMedia('(max-width:1199px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width:1199px)');
    const changed = () => setPhone(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  const close = () => setUi({ canvasOpen: false });
  useFocusScope(root,phone,close);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.current?.querySelector<HTMLButtonElement>('[aria-label="Close canvas"]')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('.modal-backdrop')) return;
      if (event.key === 'Escape') { event.preventDefault(); setUi({ canvasOpen: false }); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); if(!phone && previous?.isConnected)previous.focus(); };
  }, [setUi, phone]);
  const download = async () => {
    if (!doc) return;
    const name = safeFileName(doc.name, 'Document.md');
    setDownloading(true);
    try { if (fileKind(name).kind === 'pdf') printDocument(doc.content, name); else await saveBlob(await buildFile(name, doc.content), name); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setDownloading(false); }
  };
  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const attachment = await readAttachment(file, { textOnly: true });
      if (!attachment.text) throw new Error('No editable text was found in this file.');
      // Office/PDF imports are editable text drafts; original formatting is retained in the source file.
      const name = /\.(docx|pdf|pptx|xlsx|xlsm)$/i.test(file.name) ? file.name.replace(/\.[^.]+$/, '') + '.md' : file.name;
      openCanvas(safeFileName(name, 'Document.md'), attachment.text);
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setImporting(false); }
  };
  return <aside ref={root} className="canvas-panel" aria-label="Document canvas" role={phone ? 'dialog' : 'complementary'} aria-modal={phone || undefined} tabIndex={-1}>
    <header className="canvas-head"><span><Pencil size={17} /><strong>Canvas</strong></span><button className="icon-btn" aria-label="Close canvas" onClick={close}><X size={18} /></button></header>
    <div className={`canvas-document-toolbar${(chat?.documents?.length || 0) > 1 ? '' : ' single'}`}><select aria-label="Choose canvas document" value={doc?.id || ''} onChange={e => setUi({ canvasDocumentId: e.target.value })}>{chat?.documents?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="icon-btn sm" title="New document" aria-label="New canvas document" onClick={() => openCanvas(`Document ${1 + (chat?.documents?.length || 0)}.md`, '')}><Plus size={17} /></button><button className="icon-btn sm" disabled={importing} title="Import text draft" aria-label="Import canvas document" onClick={() => input.current?.click()}>{importing ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}</button><button className="icon-btn sm" disabled={!doc || downloading} aria-label="Download canvas document" title="Download document" onClick={() => void download()}>{downloading ? <Loader2 size={16} className="spin" /> : <Download size={16} />}</button><button className="icon-btn sm" disabled={!doc} aria-label="Delete canvas document" title="Delete document" onClick={() => { if (chat && doc && confirm(`Delete ${doc.name}?`)) deleteCanvasDocument(chat.id, doc.id); }}><Trash2 size={16} /></button></div>
    <input ref={input} type="file" hidden accept=".txt,.md,.csv,.tsv,.json,.html,.xml,.js,.ts,.tsx,.jsx,.py,.css,.sql,.yaml,.yml,.docx,.pdf,.pptx,.xlsx,.xlsm" onChange={e => { const file = e.target.files?.[0]; if (file) void importFile(file); e.target.value = ''; }} />
    {chat && doc ? <><label className="canvas-name"><span className="sr-only">Canvas filename</span><input aria-label="Canvas filename" value={doc.name} maxLength={120} onChange={e => void saveCanvasDocument(chat.id, doc.id, { name: e.target.value })} onBlur={e => void saveCanvasDocument(chat.id, doc.id, { name: safeFileName(e.target.value, 'Document.md') })} /></label><CanvasEditor key={`${chat.id}:${doc.id}`} chat={chat} doc={doc} /></> : <div className="canvas-empty"><FilePlus2 size={26} /><p>Start an editable document.</p><button className="btn" onClick={() => openCanvas('Document.md', '')}>New document</button></div>}
    <footer className="canvas-footer muted small">Up to 5 documents per chat. Imported files become editable text; the original keeps its formatting.</footer>
  </aside>;
}
