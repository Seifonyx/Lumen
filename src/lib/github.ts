// GitHub, straight from the browser with the user's own token (a fine-grained personal access
// token with Contents and Pull requests access). Reads repos and files, and commits changes with
// the Git Data API: blobs/tree → commit → branch, then optionally a pull request.

const API = 'https://api.github.com';
let token = '';
export const setGitHubToken = (t: string) => {
  token = (t || '').trim();
};
export const hasGitHub = () => Boolean(token);

export class GitHubError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function gh<T = any>(path: string, init: RequestInit & { raw?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        accept: init.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new GitHubError("Couldn't reach GitHub. Check your connection.", 0);
  }
  if (!res.ok) {
    let message = `GitHub error ${res.status}`;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      /* not JSON */
    }
    if (res.status === 401) message = 'GitHub refused the token. Check it under Settings → API keys.';
    if (res.status === 403 && /resource not accessible/i.test(message)) message = "Your GitHub token doesn't have permission for this. Give it Contents (and Pull requests) read & write access.";
    if (res.status === 404) message = `Not found on GitHub (${message}). The token may not have access to this repository.`;
    throw new GitHubError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (init.raw ? res.text() : res.json()) as Promise<T>;
}

const enc = (p: string) => p.split('/').map(encodeURIComponent).join('/');

export interface RepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  pushedAt: string;
  description: string;
}

export async function listRepos(): Promise<RepoInfo[]> {
  const list = await gh<any[]>('/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member');
  return list.map((r) => ({
    owner: r.owner.login,
    repo: r.name,
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    private: r.private,
    pushedAt: r.pushed_at,
    description: r.description || '',
  }));
}

export async function listBranches(owner: string, repo: string): Promise<string[]> {
  const list = await gh<any[]>(`/repos/${owner}/${repo}/branches?per_page=100`);
  return list.map((b) => b.name);
}

export interface TreeEntry {
  path: string;
  size: number;
}

/** Every file in the branch (GitHub sends up to ~100,000 entries). */
export async function getTree(owner: string, repo: string, branch: string): Promise<{ files: TreeEntry[]; truncated: boolean }> {
  const t = await gh<any>(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  return { files: (t.tree || []).filter((e: any) => e.type === 'blob').map((e: any) => ({ path: e.path, size: e.size || 0 })), truncated: Boolean(t.truncated) };
}

/** A file's text at a branch (null if it doesn't exist). */
export async function getFile(owner: string, repo: string, path: string, branch: string): Promise<string | null> {
  try {
    return await gh<string>(`/repos/${owner}/${repo}/contents/${enc(path)}?ref=${encodeURIComponent(branch)}`, { raw: true });
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return null;
    throw e;
  }
}

export interface Change {
  path: string;
  /** new text, or null to delete the file */
  content: string | null;
}

/** Commits changes on top of `base` and points `target` (new or existing branch) at the commit. */
export async function commitChanges(o: { owner: string; repo: string; base: string; target: string; message: string; changes: Change[] }): Promise<{ sha: string; url: string }> {
  const r = `/repos/${o.owner}/${o.repo}`;
  const ref = await gh<any>(`${r}/git/ref/heads/${enc(o.base)}`);
  const parent = ref.object.sha as string;
  const baseCommit = await gh<any>(`${r}/git/commits/${parent}`);
  const tree = await gh<any>(`${r}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseCommit.tree.sha,
      tree: o.changes.map((c) => (c.content === null ? { path: c.path, mode: '100644', type: 'blob', sha: null } : { path: c.path, mode: '100644', type: 'blob', content: c.content })),
    }),
  });
  const commit = await gh<any>(`${r}/git/commits`, { method: 'POST', body: JSON.stringify({ message: o.message, tree: tree.sha, parents: [parent] }) });
  if (o.target === o.base) {
    await gh(`${r}/git/refs/heads/${enc(o.base)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
  } else {
    try {
      await gh(`${r}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${o.target}`, sha: commit.sha }) });
    } catch (e) {
      // The branch already exists: move it (only if this is a fast-forward).
      if (!(e instanceof GitHubError) || e.status !== 422) throw e;
      await gh(`${r}/git/refs/heads/${enc(o.target)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
    }
  }
  return { sha: commit.sha, url: commit.html_url || `https://github.com/${o.owner}/${o.repo}/commit/${commit.sha}` };
}

export async function openPullRequest(o: { owner: string; repo: string; head: string; base: string; title: string; body: string }): Promise<string> {
  const pr = await gh<any>(`/repos/${o.owner}/${o.repo}/pulls`, { method: 'POST', body: JSON.stringify({ title: o.title, head: o.head, base: o.base, body: o.body }) });
  return pr.html_url;
}
