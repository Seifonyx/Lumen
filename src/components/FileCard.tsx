import { Download, Eye, FileCode2, FileSpreadsheet, FileText, FileType2, Globe, Loader2, Pencil, Presentation, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { parseDeck } from '../lib/generate/deck-spec';
import { printDocument } from '../lib/generate/doc-html';
import { buildFile, fileKind, type FileKind } from '../lib/generate';
import { parseWorkbook } from '../lib/generate/sheet-spec';
import { safeFileName, saveBlob } from '../lib/util';
import { useStore } from '../store';

const ICONS: Record<FileKind, [typeof FileText, string]> = {
  docx: [FileText, 'blue'],
  pdf: [FileType2, 'red'],
  xlsx: [FileSpreadsheet, 'green'],
  csv: [FileSpreadsheet, 'green'],
  pptx: [Presentation, 'orange'],
  html: [Globe, 'purple'],
  markdown: [FileText, 'gray'],
  code: [FileCode2, 'gray'],
  text: [FileText, 'gray'],
  unsupported: [FileText, 'gray'],
};

export default function FileCard({ name: rawName, content, complete }: { name: string; content: string; complete: boolean }) {
  const name = safeFileName(rawName, 'file.txt');
  const { kind, label } = fileKind(name);
  const [Icon, tone] = ICONS[kind];
  const setUi = useStore((s) => s.setUi);
  const toast = useStore((s) => s.toast);
  const [busy, setBusy] = useState(false);

  const detail = useMemo(() => {
    if (!complete) return null;
    if (kind === 'pptx') {
      const d = parseDeck(content);
      return d ? `${d.slides.length} slide${d.slides.length === 1 ? '' : 's'}` : null;
    }
    if (kind === 'xlsx') {
      const w = parseWorkbook(content);
      return w ? `${w.sheets.length} sheet${w.sheets.length === 1 ? '' : 's'} · ${w.sheets.reduce((n, s) => n + s.rows.length, 0)} rows` : null;
    }
    return null;
  }, [complete, kind, content]);

  const save = async () => {
    if (kind === 'pdf') {
      printDocument(content, name);
      return;
    }
    setBusy(true);
    try {
      await saveBlob(await buildFile(name, content), name);
    } catch (e) {
      toast(`Couldn't create ${name}: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`file-card tone-${tone}`}>
      <div className="file-icon">
        <Icon size={24} />
      </div>
      <div className="file-info">
        <div className="file-name" dir="auto" title={name}>{name}</div>
        <div className="file-kind">
          {complete ? (
            <>
              {label}
              {detail && <> · {detail}</>}
            </>
          ) : (
            <span className="writing"><Loader2 size={13} className="spin" /> Writing…</span>
          )}
        </div>
      </div>
      {complete && kind !== 'unsupported' && (
        <div className="file-actions">
          <button className="icon-btn sm" onClick={() => useStore.getState().openCanvas(name, content)} aria-label={`Edit ${name} in canvas`} title="Edit in canvas"><Pencil size={16} /></button>
          <button className="btn ghost small" onClick={() => setUi({ preview: { name, content } })} aria-label={`Preview ${name}`}>
            <Eye size={16} /> <span className="hide-xs">Preview</span>
          </button>
          <button className="btn primary small" onClick={save} disabled={busy} aria-label={kind === 'pdf' ? `Save ${name} as PDF` : `Save ${name}`}>
            {busy ? <Loader2 size={16} className="spin" /> : kind === 'pdf' ? <Printer size={16} /> : <Download size={16} />}
            <span>{kind === 'pdf' ? 'Save PDF' : 'Save'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
