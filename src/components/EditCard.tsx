import { AlertTriangle, Check, FileCode2, FileMinus2, FilePlus2, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { applyEdit, isApplied, lineStats, parseEdit, type Edit } from '../lib/edits';
import { currentFile } from '../lib/workspace';
import { selectCurrentChat, useStore } from '../store';
import DiffView from './DiffView';

/** Loads the file the edit changes (with this chat's uncommitted changes). */
function useCurrent(path: string) {
  const chat = useStore(selectCurrentChat);
  const version = chat?.changes?.[path]?.content;
  const [current, setCurrent] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!chat?.repo) return;
    let live = true;
    currentFile(chat, path).then((t) => live && setCurrent(t), () => live && setCurrent(null));
    return () => {
      live = false;
    };
  }, [path, version, chat?.repo?.branch]); // eslint-disable-line react-hooks/exhaustive-deps
  return { chat, current };
}

/** A change a model proposed to a repository file: review, apply, undo. */
export default function EditCard({ kind, path, content, complete }: { kind: 'edit' | 'delete'; path: string; content: string; complete: boolean }) {
  const edit = useMemo(() => parseEdit(kind, path, content), [kind, path, content]);
  const { chat, current } = useCurrent(edit.path);
  const applyEdits = useStore((s) => s.applyEdits);
  const revertChange = useStore((s) => s.revertChange);
  const toast = useStore((s) => s.toast);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);

  const result = current === undefined ? null : applyEdit(current, edit);
  const applied = current !== undefined && isApplied(current, edit);
  const after = edit.kind === 'delete' ? null : result?.text ?? null;
  const stats = result ? lineStats(current ?? '', after ?? '') : null;
  const Icon = edit.kind === 'delete' ? FileMinus2 : current === null ? FilePlus2 : FileCode2;

  const apply = async () => {
    if (!chat) return;
    setBusy(true);
    const r = await applyEdits(chat.id, [edit]);
    setBusy(false);
    if (r.failed.length) toast(`Couldn't apply the change to ${edit.path}.`, 'error');
  };

  return (
    <div className={`edit-card${applied ? ' applied' : ''}${result && !result.ok && !applied ? ' failed' : ''}`}>
      <span className="edit-icon"><Icon size={16} /></span>
      <div className="edit-info">
        <div className="edit-path" title={edit.path}>{edit.path}</div>
        <div className="file-kind">
          {!complete ? (
            <span className="writing"><Loader2 size={12} className="spin" /> Writing…</span>
          ) : !chat?.repo ? (
            'Connect a repository to apply this'
          ) : current === undefined ? (
            <span className="writing"><Loader2 size={12} className="spin" /> Checking…</span>
          ) : applied ? (
            'Applied'
          ) : result && !result.ok ? (
            <span className="edit-warn"><AlertTriangle size={12} /> {('reason' in result && result.reason) || "The code it changes isn't in the file — ask the AI to read it again"}</span>
          ) : (
            <>
              {edit.kind === 'delete' ? 'Delete file' : current === null ? 'New file' : 'Edit'}
              {stats && (
                <>
                  {' · '}<span className="add-n">+{stats.added}</span> <span className="del-n">−{stats.removed}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
      {complete && chat?.repo && current !== undefined && (
        <div className="file-actions">
          {result?.ok && !applied && (
            <button className="btn ghost small" onClick={() => setReview(true)}>Review</button>
          )}
          {applied ? (
            <button className="btn ghost small" onClick={() => revertChange(chat.id, edit.path)} title="Undo every change to this file">
              <RotateCcw size={14} /> Undo
            </button>
          ) : (
            result?.ok && (
              <button className="btn primary small" disabled={busy} onClick={() => void apply()}>
                {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Apply
              </button>
            )
          )}
        </div>
      )}
      {review && result?.ok && (
        <DiffView
          path={edit.path}
          before={current ?? null}
          after={after}
          onClose={() => setReview(false)}
          footer={
            <button className="btn primary small" onClick={() => { setReview(false); void apply(); }}>
              <Check size={14} /> Apply this change
            </button>
          }
        />
      )}
    </div>
  );
}

/** "Apply all" for replies with several edits. */
export function ApplyAll({ edits }: { edits: Edit[] }) {
  const chat = useStore(selectCurrentChat);
  const applyEdits = useStore((s) => s.applyEdits);
  const setUi = useStore((s) => s.setUi);
  const toast = useStore((s) => s.toast);
  const [busy, setBusy] = useState(false);
  if (!chat?.repo) return null;
  return (
    <div className="apply-all">
      <span className="muted small">{edits.length} file changes</span>
      <button
        className="btn small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await applyEdits(chat.id, edits);
          setBusy(false);
          toast(
            r.failed.length
              ? `Applied ${r.applied}; couldn't apply ${r.failed.join(', ')}.`
              : r.applied
                ? `Applied ${r.applied} change${r.applied === 1 ? '' : 's'}. Review and commit in the Changes tab.`
                : 'All of these are already applied.',
            r.failed.length ? 'error' : 'success',
          );
          if (r.applied) setUi({ workspaceOpen: true });
        }}
      >
        {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Apply all
      </button>
    </div>
  );
}
