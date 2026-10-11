import { diffLines } from 'diff';
import { applyEdit, type Edit } from './edits';

export interface EditPart { start: number; end: number; before: string; after: string }
export interface EditReview {
  proposal: string;
  repo: string;
  base: string | null;
  parts: EditPart[];
  decisions: ('pending' | 'accepted' | 'rejected')[];
  expected: string | null;
  original: string | null;
}
export const reviewKey = (messageId: string | undefined, path: string) => JSON.stringify([messageId || '', path]);

/** Contiguous changed lines form a part; unchanged lines retain exact bytes. */
export function editParts(before: string, after: string): EditPart[] {
  const parts: EditPart[] = [];
  let offset = 0;
  let part: EditPart | undefined;
  for (const change of diffLines(before, after)) {
    if (!change.added && !change.removed) { part = undefined; offset += change.value.length; continue; }
    if (!part) { part = { start: offset, end: offset, before: '', after: '' }; parts.push(part); }
    if (change.removed) { part.before += change.value; offset += change.value.length; part.end = offset; }
    else part.after += change.value;
  }
  return parts;
}

export function makeEditReview(base: string | null, edit: Edit, repo: string, original: string | null): EditReview {
  const result = applyEdit(base, edit);
  if (!result.ok) throw new Error(result.reason || 'This proposal no longer matches the file. Ask for a fresh edit.');
  const after = result.deleted ? null : result.text;
  // Creating or deleting a file is one decision, including empty files.
  const parts = base === null || after === null
    ? [{ start: 0, end: (base || '').length, before: base || '', after: after || '' }]
    : editParts(base, after);
  return { proposal: JSON.stringify(edit), repo, base, original, parts, decisions: parts.map(() => 'pending'), expected: base };
}

export function reviewText(review: EditReview): string | null {
  const edit = JSON.parse(review.proposal) as Edit;
  if (edit.kind === 'delete') return review.decisions[0] === 'accepted' ? null : review.base;
  if (review.base === null) return review.decisions[0] === 'accepted' ? review.parts[0].after : null;
  let out = review.base;
  for (let i = review.parts.length - 1; i >= 0; i--) {
    if (review.decisions[i] !== 'accepted') continue;
    const p = review.parts[i];
    out = out.slice(0, p.start) + p.after + out.slice(p.end);
  }
  return out;
}
