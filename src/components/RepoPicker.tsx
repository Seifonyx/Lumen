import { GitBranch, KeyRound, Loader2, Lock, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { hasGitHub, listBranches, listRepos, type RepoInfo } from '../lib/github';
import { useStore } from '../store';
import Modal from './Modal';
import { isTouch } from '../lib/util';

/** Choose a GitHub repository and branch for the current chat. */
export default function RepoPicker({ onClose }: { onClose: () => void }) {
  const connectRepo = useStore((s) => s.connectRepo);
  const setUi = useStore((s) => s.setUi);
  const token = useStore((s) => s.keys.github);
  const [repos, setRepos] = useState<RepoInfo[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<RepoInfo | null>(null);
  const [branches, setBranches] = useState<string[] | null>(null);
  const [branch, setBranch] = useState('');

  useEffect(() => {
    if (!token || !hasGitHub()) return;
    listRepos().then(setRepos, (e) => setError((e as Error).message));
  }, [token]);

  useEffect(() => {
    if (!chosen) return;
    setBranches(null);
    setBranch(chosen.defaultBranch);
    listBranches(chosen.owner, chosen.repo).then(setBranches, () => setBranches([chosen.defaultBranch]));
  }, [chosen]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos || []).filter((r) => !q || r.fullName.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
  }, [repos, query]);

  if (!token) {
    return (
      <Modal title="Work on a GitHub repository" onClose={onClose}>
        <div className="repo-picker pad">
          <p className="muted">
            To read your code and commit changes, Lumen needs a GitHub token (free). Create a <b>fine-grained token</b> for the repositories you want, with
            <b> Contents</b> and <b>Pull requests</b> set to <b>Read and write</b> (and <b>Actions: Read</b> to see test results), then paste it under API keys.
          </p>
          <div className="editor-actions">
            <a className="btn" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">
              Create a token
            </a>
            <button className="btn primary" onClick={() => { onClose(); setUi({ settingsOpen: true, settingsTab: 'keys' }); }}>
              <KeyRound size={15} /> Add it in Settings
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Work on a GitHub repository" onClose={onClose}>
      <div className="repo-picker">
        {!chosen ? (
          <>
            <label className="search">
              <Search size={16} />
              <input type="search" autoFocus={!isTouch()} placeholder="Search your repositories" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {error && <p className="error-text">{error}</p>}
            {!repos && !error && (
              <p className="muted small"><Loader2 size={14} className="spin" /> Loading your repositories…</p>
            )}
            <ul className="repo-list">
              {shown.map((r) => (
                <li key={r.fullName}>
                  <button className="repo-row" onClick={() => setChosen(r)}>
                    <span className="model-meta">
                      <span className="model-title">
                        {r.fullName} {r.private && <Lock size={12} className="muted" />}
                      </span>
                      <span className="model-sub">{r.description || `Default branch: ${r.defaultBranch}`}</span>
                    </span>
                  </button>
                </li>
              ))}
              {repos && !shown.length && <li className="muted small pad">No repositories match. The token may not include them.</li>}
            </ul>
          </>
        ) : (
          <div className="repo-confirm">
            <p className="setting-label">{chosen.fullName}</p>
            <label className="field-block">
              <span className="setting-label"><GitBranch size={14} /> Branch</span>
              {branches ? (
                <select value={branch} onChange={(e) => setBranch(e.target.value)}>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}{b === chosen.defaultBranch ? ' (default)' : ''}</option>
                  ))}
                </select>
              ) : (
                <span className="muted small"><Loader2 size={14} className="spin" /> Loading branches…</span>
              )}
            </label>
            <p className="muted small">The AI sees the file list and reads files when needed. Nothing changes on GitHub until you commit.</p>
            <div className="editor-actions">
              <button className="btn ghost" onClick={() => setChosen(null)}>Back</button>
              <button
                className="btn primary"
                disabled={!branch}
                onClick={() => {
                  connectRepo({ owner: chosen.owner, repo: chosen.repo, branch, defaultBranch: chosen.defaultBranch });
                  onClose();
                }}
              >
                Open repository
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
