import { ExternalLink, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GitHubError, gh, hasGitHub, listBranches } from '../lib/github';
import { useStore } from '../store';

// Preview tools: shown under Settings → General → About → Developer options, for trying changes on a
// separate test address before they go live. "Build preview" starts the "Preview" GitHub workflow on a
// branch; it deploys to the `dev` channel.

const OWNER = 'Seifonyx';
const REPO = 'lumen';
const WORKFLOW = 'preview.yml';
/** The preview channel's address (its sign-in is already set up in src/lib/firebase.ts). */
export const PREVIEW_URL = 'https://model-router--dev-82jv5mm2.web.app';
const LIVE_URL = 'https://lumen-chat.web.app';

interface Run {
  status: string;
  conclusion: string | null;
  created_at: string;
  head_branch: string;
  html_url: string;
}

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export function PreviewTools() {
  const toast = useStore((s) => s.toast);
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState('main');
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const connected = hasGitHub();
  const onPreview = location.origin === PREVIEW_URL;
  const building = Boolean(run && run.status !== 'completed');

  const loadRun = useCallback(async () => {
    try {
      const r = await gh<{ workflow_runs: Run[] }>(`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`);
      setRun(r.workflow_runs[0] || null);
    } catch {
      /* no Actions access (or no Preview workflow yet): the status line stays hidden */
    }
  }, []);

  useEffect(() => {
    if (!connected) return;
    void loadRun();
    listBranches(OWNER, REPO)
      .then((list) => {
        setBranches(list);
        setBranch(list.find((b) => b !== 'main') || 'main');
      })
      .catch(() => {});
  }, [connected, loadRun]);

  // While a build is running, check on it every 15 seconds.
  useEffect(() => {
    if (!building) return;
    const t = setInterval(() => void loadRun(), 15_000);
    return () => clearInterval(t);
  }, [building, loadRun]);

  const build = async () => {
    setBusy(true);
    try {
      await gh(`/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: branch }) });
      toast(`Building a preview from “${branch}”. It takes a few minutes.`, 'success');
      setTimeout(() => void loadRun(), 4000);
    } catch (e) {
      const blocked = e instanceof GitHubError && (e.status === 403 || e.status === 404);
      toast(
        blocked
          ? "GitHub wouldn't start it. Your token needs Actions → Read and write access. You can also start it on GitHub: Actions → Preview → Run workflow."
          : (e as Error).message,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const state = !run ? '' : building ? 'Building…' : run.conclusion === 'success' ? 'Ready' : 'Failed';

  return (
    <div className="settings-card">
      <div className="dev-warning" role="note">
        <b>For developers and testing only.</b> A preview is unfinished code from a branch. It runs on a separate address but uses your real chats and keys, so features being tested could change or break your data. Don't use it for everyday work.
      </div>
      <div className="setting-row">
        <span className="setting-text">
          <span className="setting-label">
            Preview build <span className="tag" style={{ textTransform: 'none' }}>testing</span>
          </span>
          <span className="setting-hint">
            {onPreview ? "You're on the preview build right now. " : ''}
            Try changes on a separate test address before they go live.
          </span>
        </span>
      </div>
      {connected ? (
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-label">Build from branch</span>
            <span className="setting-hint">Uploads that went to a branch other than main show up here.</span>
          </span>
          <span className="setting-ctrl">
            <select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Branch to preview">
              {(branches.length ? branches : [branch]).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button className="btn small primary" onClick={() => void build()} disabled={busy || building}>
              {busy || building ? <Loader2 size={14} className="spin" /> : null} {building ? 'Building…' : 'Build preview'}
            </button>
          </span>
        </div>
      ) : (
        <div className="setting-row">
          <span className="setting-text">
            <span className="setting-hint">To build from here, save a GitHub token with Actions (Read and write) access under API keys. Or start it on GitHub: Actions → Preview → Run workflow.</span>
          </span>
        </div>
      )}
      <div className="setting-row">
        <span className="setting-text">
          <span className="setting-label">{state ? `Last build: ${state}` : 'Preview address'}</span>
          <span className="setting-hint">
            {run ? `${run.head_branch} · ${ago(run.created_at)}` : 'A build keeps the address for 30 days.'}
            {run && state === 'Failed' && (
              <>
                {' · '}
                <a href={run.html_url} target="_blank" rel="noreferrer">
                  See why
                </a>
              </>
            )}
          </span>
        </span>
        <span className="setting-ctrl">
          <a className="btn small" href={onPreview ? LIVE_URL : PREVIEW_URL} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> {onPreview ? 'Open live site' : 'Open preview'}
          </a>
        </span>
      </div>
    </div>
  );
}
