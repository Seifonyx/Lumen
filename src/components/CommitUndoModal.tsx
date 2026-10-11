import { useEffect, useState } from 'react';
import { ChevronRight, ExternalLink, Loader2, RotateCcw } from 'lucide-react';
import { previewUndo, type UndoPreview } from '../lib/commit-undo';
import { useStore } from '../store';
import type { Chat } from '../types';
import Modal from './Modal';

export default function CommitUndoModal({chat,onClose}: {chat:Chat;onClose():void}) {
  const undo = useStore(s => s.undoLastCommit);
  const [preview,setPreview] = useState<UndoPreview | null>(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [result,setResult] = useState<{sha:string;url:string} | null>(null);
  const [reload,setReload] = useState(0);
  const blocked = Object.keys(chat.changes || {}).length > 0;
  const streaming = useStore(s => s.streamingChatId === chat.id);
  const performUndo = async () => {
    if (!preview || busy) return;
    setBusy(true); setError('');
    try { setResult(await undo(chat.id,preview)); }
    catch(e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!chat.repo) return;
    const controller = new AbortController(); let live = true;
    setPreview(null); setError(''); setLoading(true);
    previewUndo(chat.repo, controller.signal).then(p => {if(live)setPreview(p)}, e => {if(live)setError((e as Error).message)}).finally(() => {if(live)setLoading(false)});
    return () => {live=false;controller.abort()};
  }, [chat.id,chat.repo?.owner,chat.repo?.repo,chat.repo?.branch,reload]);
  return <Modal title="Undo last commit" onClose={() => {if(!busy)onClose()}} wide>
    <div className="edit-review-body commit-undo">
      <p className="muted small">Restore the version before the latest commit on <strong>{chat.repo?.branch}</strong>. This creates a new revert commit and preserves the history.</p>
      {(blocked || streaming) && <p role="alert" className="edit-warn">Finish or discard your uncommitted work before undoing a commit. Your draft is preserved.</p>}
      {loading && <p className="muted small"><Loader2 size={14} className="spin" /> Loading last commit…</p>}
      {error && <p role="alert" className="edit-warn">{error}</p>}
      {result ? <section className="commit-undo-result" aria-label="Undo complete"><strong>Commit undone</strong><p>Your branch now contains the previous version.</p><a href={result.url} target="_blank" rel="noopener noreferrer">View revert commit <ExternalLink size={13}/></a></section> : preview && <>
        <div className="commit-undo-summary"><strong>{preview.title}</strong><a href={preview.url} target="_blank" rel="noopener noreferrer"><code>{preview.sha.slice(0,7)}</code> <ExternalLink size={12}/></a></div>
        <p className="muted small">{preview.partial ? 'Showing the first 100 changed files. Undo restores the entire commit, including files beyond this preview.' : `${preview.files.length} changed file${preview.files.length===1?'':'s'}. Undo restores all files, including images and other binaries.`} The changes below will be reversed.</p>
        <div className="commit-undo-files">{preview.files.map((file,i) => <details key={i}><summary><ChevronRight size={14}/><span>{file.path}</span><span className="muted small">{file.status}</span></summary>{file.patch ? <pre>{file.patch}</pre> : <p className="muted small">No text diff available. The file will be restored from the previous commit.</p>}</details>)}</div>
      </>}
      <div className="diff-footer edit-part-actions">
        {result ? <button className="btn small" onClick={onClose}>Done</button> : <>
          <button className="btn ghost small" disabled={busy || loading} onClick={() => setReload(n => n+1)}>Reload preview</button>
          <button className="btn primary small" disabled={!preview || busy || loading || blocked || streaming || Boolean(error)} onClick={() => void performUndo()}>{busy ? <Loader2 size={14} className="spin"/> : <RotateCcw size={14}/>} {busy?'Undoing…':'Undo and push'}</button>
        </>}
      </div>
    </div>
  </Modal>;
}
