import { Blocks, ExternalLink, FolderGit2 } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';
import { listRepos } from '../lib/github';

export default function ConnectorsTab() {
  const keys = useStore((s) => s.keys), owner = useStore((s) => s.user?.uid);
  const [token, setToken] = useState(keys.github || ''), [busy, setBusy] = useState(false), [status, setStatus] = useState('');
  const mine = () => useStore.getState().user?.uid === owner;
  const save = async () => { setBusy(true); setStatus(''); try { await useStore.getState().saveApiKeys({ ...useStore.getState().keys, github: token.trim() }); if (mine()) setStatus('Token saved.'); } catch { setStatus('Could not save the token.'); } finally { setBusy(false); } };
  const verify = async () => { setBusy(true); setStatus(''); try { const repos = await listRepos(); if (mine()) setStatus(`Connection verified · ${repos.length} repositories available.`); } catch { if (mine()) setStatus('Could not access repositories. Check your token and repository permissions.'); } finally { setBusy(false); } };
  const disconnect = async () => { setBusy(true); try { await useStore.getState().saveApiKeys({ ...useStore.getState().keys, github: '' }); setToken(''); setStatus('Disconnected.'); } catch { setStatus('Could not disconnect.'); } finally { setBusy(false); } };
  const changed = token.trim() !== (keys.github || '');

  return (
    <div className="settings-section">
      <div className="settings-card connector-card">
        <div className="connector-head">
          <span className="connector-icon" aria-hidden="true"><FolderGit2 size={20} /></span>
          <span className="setting-text">
            <span className="setting-label">GitHub</span>
            <span className="setting-hint">Read code, review pull requests and propose changes.</span>
          </span>
          <span className={`key-status-pill ${keys.github ? 'configured' : 'unset'}`}>{keys.github ? 'Connected' : 'Not connected'}</span>
        </div>
        <div className="connector-body">
          <label className="provider-field" htmlFor="github-token">
            <span>Personal access token</span>
            <input id="github-token" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="github_pat_…" value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <p className="setting-hint">
            Use a fine-grained token for selected repositories. Contents and Pull requests: read and write. Actions: read.{' '}
            <a className="link-btn small inline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Create a token <ExternalLink size={12} /></a>
          </p>
          <div className="connector-actions">
            <button className="btn primary" disabled={busy || !changed} onClick={() => void save()}>Save connection</button>
            <button className="btn" disabled={busy || !keys.github || changed} onClick={() => void verify()}>Test connection</button>
            <span className="spacer" />
            <button className="btn ghost danger" disabled={busy || !keys.github} onClick={() => void disconnect()}>Disconnect</button>
          </div>
          {status && <p className="connector-status" role="status">{status}</p>}
        </div>
        <div className="connector-foot">
          <span className="setting-text">
            <span className="setting-label">Repositories</span>
            <span className="setting-hint">Open one to browse files, run checks and edit code with a model.</span>
          </span>
          <button className="btn small" disabled={!keys.github} onClick={() => useStore.getState().setUi({ settingsOpen: false, repoPicker: true })}><Blocks size={15} /> Open repository</button>
        </div>
      </div>
    </div>
  );
}
