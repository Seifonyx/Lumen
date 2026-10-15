// Settings → Data: bring in your history from ChatGPT, Claude or Gemini. Lumen reads the export file, says
// what it found, and you choose to import everything or only the most recent chats.
import { FileUp, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { readImport, type ImportResult } from '../lib/import-chats';
import { useStore } from '../store';

const RECENT = 100;
const LOTS = 15_000; // messages: syncing more than this can take more than a day on the free plan

export default function ImportChats() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [found, setFound] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const { importChats, toast } = useStore.getState();
  const messages = found ? found.chats.reduce((n, c) => n + c.messages.length, 0) : 0;
  const run = async (chats: ImportResult['chats']) => {
    setBusy(true);
    try {
      const n = await importChats(chats);
      toast(`Imported ${n.toLocaleString()} chat${n === 1 ? '' : 's'} from ${found!.source}.`, 'success');
      setFound(null);
    } catch (e) {
      toast(`Couldn't import: ${(e as Error).message}`, 'error');
    } finally { setBusy(false); }
  };
  return (
    <div className="setting-row import-row">
      <span className="setting-text">
        <span className="setting-label">Import from ChatGPT, Claude or Gemini</span>
        {found ? (
          <span className="setting-hint import-found" role="status">
            Found {found.chats.length.toLocaleString()} {found.source} chat{found.chats.length === 1 ? '' : 's'} ({messages.toLocaleString()} messages).
            {messages > LOTS && ' That many can take a day or two to reach your other devices on the free plan.'}
          </span>
        ) : (
          <span className="setting-hint">Use the export file from the other app (.zip, .json, or Gemini's My Activity file). Importing the same file again updates those chats.</span>
        )}
      </span>
      <span className="setting-ctrl import-actions">
        {found ? (
          <>
            <button className="btn small" disabled={busy} onClick={() => run(found.chats)}>{busy && <Loader2 size={14} className="spin" />}Import all</button>
            {found.chats.length > RECENT && <button className="btn small ghost" disabled={busy} onClick={() => run([...found.chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENT))}>Latest {RECENT}</button>}
            <button className="btn small ghost" disabled={busy} onClick={() => setFound(null)}>Cancel</button>
          </>
        ) : (
          <button className="btn small" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 size={14} className="spin" /> : <FileUp size={14} />} Import
          </button>
        )}
      </span>
      <input
        ref={fileRef}
        type="file"
        accept=".zip,.json,.html,application/zip,application/json,text/html"
        hidden
        aria-label="Export file to import"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setBusy(true);
          try {
            const result = await readImport(file);
            if (!result.chats.length) toast(`That ${result.source} file has no chats in it.`, 'error');
            else setFound(result);
          } catch {
            toast("Lumen couldn't read that file. Use the export from ChatGPT, Claude or Gemini.", 'error');
          } finally { setBusy(false); }
        }}
      />
    </div>
  );
}
