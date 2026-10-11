import { useState } from 'react';
import { makeEditReview, reviewKey } from '../lib/edit-review';
import type { Edit } from '../lib/edits';
import { planRepo } from '../lib/coding-plan';
import { selectCurrentChat, useStore } from '../store';
import { DiffLines } from './DiffView';
import Modal from './Modal';

export default function EditReview({ edit, current, messageId, allowed, onClose }: { edit: Edit; current: string | null; messageId?: string; allowed: boolean; onClose(): void }) {
  const chat = useStore(selectCurrentChat);
  const decide = useStore(s => s.decideEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [initial] = useState(() => chat?.editReviews?.[reviewKey(messageId, edit.path)] || makeEditReview(current, edit, planRepo(chat?.repo), chat?.changes?.[edit.path] ? chat.changes[edit.path].original : current));
  if (!chat) return null;
  const review = chat.editReviews?.[reviewKey(messageId, edit.path)] || initial;
  const stale = review.expected !== current || review.repo !== planRepo(chat.repo) || review.proposal !== JSON.stringify(edit);
  const choose = async (part: number | 'all', decision: 'accepted' | 'rejected') => {
    setBusy(true); setError('');
    try { await decide(chat.id, edit, messageId, part, decision); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <Modal title={`Review ${edit.path}`} onClose={onClose} wide>
    <div className="edit-review-body">
    <p className="muted small">Accept the blocks you want in your draft. GitHub changes only when you commit.</p>
    {(stale || error) && <p role="alert" className="edit-warn">{error || 'The file changed after this review. Request a fresh proposal to continue.'}</p>}
    <div className="edit-parts">
      {review.parts.map((part, i) => <section className="edit-part" key={i} aria-label={`Change ${i + 1}`}>
        <header><strong>Change {i + 1} of {review.parts.length}</strong><span className="muted small">{review.decisions[i]}</span></header>
        <div className="diff-wrap"><DiffLines before={part.before} after={part.after} /></div>
        <div className="edit-part-actions">
          <button className="btn ghost small" disabled={busy || stale || !allowed || review.decisions[i] === 'rejected'} onClick={() => void choose(i, 'rejected')}>Reject</button>
          <button className="btn small" disabled={busy || stale || !allowed || review.decisions[i] === 'accepted'} onClick={() => void choose(i, 'accepted')}>Accept</button>
        </div>
      </section>)}
    </div>
    <div className="diff-footer edit-part-actions">
      <button className="btn ghost small" disabled={busy || stale || !allowed || !review.decisions.includes('pending')} onClick={() => void choose('all', 'rejected')}>Reject remaining</button>
      <button className="btn primary small" disabled={busy || stale || !allowed || !review.decisions.includes('pending')} onClick={() => void choose('all', 'accepted')}>{busy ? 'Saving…' : 'Accept remaining'}</button>
    </div>
    </div>
  </Modal>;
}
