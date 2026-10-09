import { useMemo } from 'react';
import { lineStats, unifiedDiff } from '../lib/edits';
import Modal from './Modal';

export function DiffLines({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => unifiedDiff(before, after), [before, after]);
  return (
    <div className="diff">
      {rows.map((r, i) =>
        r.type === 'gap' ? (
          <div key={i} className="diff-gap">⋯</div>
        ) : (
          <div key={i} className={`diff-line ${r.type}`}>
            <span className="diff-no">{r.oldNo ?? ''}</span>
            <span className="diff-no">{r.newNo ?? ''}</span>
            <span className="diff-sign">{r.type === 'add' ? '+' : r.type === 'del' ? '−' : ' '}</span>
            <code>{r.text || ' '}</code>
          </div>
        ),
      )}
    </div>
  );
}

/** Before/after of one file. `before` null = new file, `after` null = deleted. */
export default function DiffView({ path, before, after, onClose, footer }: { path: string; before: string | null; after: string | null; onClose: () => void; footer?: React.ReactNode }) {
  const stats = lineStats(before ?? '', after ?? '');
  return (
    <Modal
      title={
        <span className="preview-title">
          <span>{path}</span>
          <span className="muted small">
            {before === null ? 'New file · ' : after === null ? 'Deleted · ' : ''}
            <span className="add-n">+{stats.added}</span> <span className="del-n">−{stats.removed}</span>
          </span>
        </span>
      }
      onClose={onClose}
      wide
    >
      <div className="diff-wrap">
        <DiffLines before={before ?? ''} after={after ?? ''} />
      </div>
      {footer && <div className="diff-footer">{footer}</div>}
    </Modal>
  );
}
