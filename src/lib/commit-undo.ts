import { gh, githubKeyGeneration } from './github';
import type { RepoLink } from '../types';

export interface UndoPreview {
  repo: RepoLink;
  sha: string;
  parent: string;
  tree: string;
  title: string;
  url: string;
  keyGeneration: number;
  files: { path: string; status: string; patch?: string }[];
  partial: boolean;
}
const sha = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/i.test(value)) throw new Error('GitHub returned an invalid commit snapshot.');
  return value;
};
const base = (r: RepoLink) => `/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}`;
const branch = (r: RepoLink) => r.branch.split('/').map(encodeURIComponent).join('/');
async function request<T = any>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  return gh<T>(path, { ...init, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) });
}
export async function previewUndo(repo: RepoLink, signal?: AbortSignal): Promise<UndoPreview> {
  const keyGeneration = githubKeyGeneration();
  const valid = () => { if (keyGeneration !== githubKeyGeneration() || signal?.aborted) throw new Error('GitHub key changed or loading stopped. Load a fresh preview.'); };
  const r = base(repo);
  const head = await request(`${r}/git/ref/heads/${branch(repo)}`, {}, signal); valid();
  const id = sha(head.object?.sha);
  const commit = await request(`${r}/git/commits/${id}`, {}, signal); valid();
  if (commit.parents?.length !== 1) throw new Error(commit.parents?.length ? 'Merge commits need a choice of parent. Undo them on GitHub or with Git.' : 'The first commit has no previous version to restore.');
  const parent = sha(commit.parents[0].sha);
  const previous = await request(`${r}/git/commits/${parent}`, {}, signal); valid();
  const tree = sha(previous.tree?.sha);
  if (tree === commit.tree?.sha) throw new Error('This commit has no file changes to undo.');
  const details = await request(`${r}/commits/${id}?per_page=100`, {}, signal); valid();
  const check = await request(`${r}/git/ref/heads/${branch(repo)}`, {}, signal); valid();
  if (check.object?.sha !== id) throw new Error('The branch changed while loading. Load a fresh preview.');
  const files = Array.isArray(details.files) ? details.files.slice(0,100).map((f: any) => ({ path: String(f.filename), status: String(f.status), patch: typeof f.patch === 'string' ? f.patch.slice(0,20_000) : undefined })) : [];
  return { repo: { ...repo }, sha: id, parent, tree, title: String(commit.message || '').split('\n')[0].slice(0,200), url: `https://github.com/${repo.owner}/${repo.repo}/commit/${id}`, keyGeneration, files, partial: files.length >= 100 };
}

/** Restore the parent tree with a new child commit; never reset or force-push. */
export async function undoCommit(preview: UndoPreview, assertWorkspace: () => void) {
  const valid = () => { assertWorkspace(); if (preview.keyGeneration !== githubKeyGeneration()) throw new Error('GitHub key changed. Load a fresh preview.'); };
  valid();
  const r = base(preview.repo);
  const ref = await request(`${r}/git/ref/heads/${branch(preview.repo)}`); valid();
  if (ref.object?.sha !== preview.sha) throw new Error('The branch changed since this preview. Nothing was undone; load it again.');
  const commit = await request(`${r}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `Revert "${preview.title}"\n\nThis reverts commit ${preview.sha}.`, tree: sha(preview.tree), parents: [sha(preview.sha)] }) }); valid();
  const id = sha(commit.sha);
  try {
    await request(`${r}/git/refs/heads/${branch(preview.repo)}`, { method: 'PATCH', body: JSON.stringify({ sha: id, force: false }) });
  } catch (e) {
    throw new Error(`Could not confirm undo. Check the branch on GitHub before retrying. ${(e as Error).message}`);
  }
  try { valid(); }
  catch { throw new Error('The account or workspace changed after publishing. Undo may already be committed; check the original branch on GitHub.'); }
  return { sha: id, url: `https://github.com/${preview.repo.owner}/${preview.repo.repo}/commit/${id}` };
}
