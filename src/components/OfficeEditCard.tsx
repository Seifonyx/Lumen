import { useMemo, useState } from 'react';
import { Check, Download, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react';
import { describeEdit, parseOfficeEdits, type EditResult } from '../lib/office/spec';
import { loadOriginal } from '../lib/office/originals';
import { safeFileName, saveBlob } from '../lib/util';
import { selectCurrentChat, useStore } from '../store';

/** A reply's edits to a Word/Excel file the user attached: what will change, and a download of the edited original. */
export default function OfficeEditCard({ name, content, complete }: { name: string; content: string; complete: boolean }) {
  const chat = useStore(selectCurrentChat);
  const toast = useStore((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<EditResult[] | null>(null);
  const excel = /\.(xlsx|xlsm)$/i.test(name);
  const Icon = excel ? FileSpreadsheet : FileText;
  const parsed = useMemo(() => {
    if (!complete) return null;
    try { return { ...parseOfficeEdits(content), error: '' }; } catch (e) { return { edits: [], name: undefined, error: (e as Error).message }; }
  }, [complete, content]);
  // The most recent attachment in this chat with that name.
  const source = useMemo(() => {
    const want = name.trim().toLowerCase();
    return chat?.messages.flatMap((m) => m.files || []).filter((f) => f.name.toLowerCase() === want).at(-1);
  }, [chat, name]);
  const outName = safeFileName(parsed?.name || name.replace(/(\.[^.]+)$/, ' (edited)$1'), name);

  const download = async () => {
    if (!parsed || !source) return;
    setBusy(true);
    try {
      const original = await loadOriginal(useStore.getState().user?.uid, source.id);
      if (!original) throw new Error(`The original ${name} isn’t on this device. Attach it again here, then ask for the edits.`);
      const { applyOfficeEdits } = await import('../lib/office/edit');
      const { blob, results } = await applyOfficeEdits(original, name, parsed.edits);
      setResults(results);
      const done = results.filter((r) => r.ok).length;
      if (!done) throw new Error('None of the edits matched the file, so nothing was changed.');
      await saveBlob(blob, outName);
      if (done < results.length) toast(`${results.length - done} of ${results.length} edits didn’t match and were skipped.`, 'info');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`file-card office-edit-card tone-${excel ? 'green' : 'blue'}`}>
      <div className="office-edit-head">
        <div className="file-icon"><Icon size={24} /></div>
        <div className="file-info">
          <div className="file-name" dir="auto" title={outName}>{outName}</div>
          <div className="file-kind">
            {!complete ? <span className="writing"><Loader2 size={13} className="spin" /> Writing edits…</span>
              : parsed?.error ? parsed.error
              : `Edits to your ${name} · ${parsed?.edits.length} change${parsed?.edits.length === 1 ? '' : 's'} · formatting kept`}
          </div>
        </div>
        {complete && !parsed?.error && (
          <div className="file-actions">
            <button className="btn small" disabled={busy || !source} onClick={() => void download()} title={source ? undefined : `Attach ${name} in this chat first`}>
              {busy ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Download edited file
            </button>
          </div>
        )}
      </div>
      {complete && !parsed?.error && !!parsed?.edits.length && (
        <ul className="office-edit-list">
          {parsed.edits.slice(0, 12).map((e, i) => {
            const r = results?.[i];
            return (
              <li key={i} className={r ? (r.ok ? 'ok' : 'miss') : ''}>
                {r && (r.ok ? <Check size={13} aria-label="Applied" /> : <X size={13} aria-label="Not applied" />)}
                <span dir="auto">{describeEdit(e)}</span>
                {r?.note && <small>{r.note}</small>}
              </li>
            );
          })}
          {parsed.edits.length > 12 && <li className="more">and {parsed.edits.length - 12} more</li>}
        </ul>
      )}
      {complete && !source && !parsed?.error && <p className="office-edit-note">Attach {name} to this chat to download the edited version.</p>}
    </div>
  );
}
