import { useMemo, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import Modal from './Modal';
import FilterMenu from './FilterMenu';
import { modelLabel, useStore } from '../store';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';

const NONE: string[] = [];
const NO_INFO: Record<string, { reason: string; at: number; label?: string }> = {};

/** Settings → Models: every removed model, why and when, with Keep (bring back) and Restore all. */
export default function RemovedModels({ onClose }: { onClose: () => void }) {
  // Selectors return stored values only (a fresh [] or {} each render would loop forever).
  const removed = useStore((s) => s.settings.unavailableModels) || NONE;
  const info = useStore((s) => s.settings.unavailableInfo) || NO_INFO;
  const { restoreModel, updateSettings, loadCatalog } = useStore.getState();
  const [query, setQuery] = useState('');
  const [provider, setProvider] = useState('all');
  const name = (id: string) => info[id]?.label || modelLabel(null, id);
  const providers = [...new Set(removed.map((id) => providerOfId(id)))];
  const rows = useMemo(() => removed
    .filter((id) => (provider === 'all' || providerOfId(id) === provider) && (!query.trim() || `${name(id)} ${info[id]?.reason || ''}`.toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => (info[b]?.at || 0) - (info[a]?.at || 0)), [removed, info, provider, query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal title="Removed models" onClose={onClose}>
      <div className="removed-models">
        <p className="muted small">Hidden from your lists and from Auto because they couldn’t answer. Keep brings one back; if it really is broken, the next check removes it again.</p>
        <div className="list-toolbar">
          <label className="search"><Search size={16} /><input type="search" aria-label="Search removed models" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          {providers.length > 1 && <FilterMenu label="Provider" value={provider} onChange={setProvider} options={[{ value: 'all', label: 'All providers', count: removed.length }, ...providers.map((p) => ({ value: p, label: PROVIDER_NAMES[p as keyof typeof PROVIDER_NAMES] || p, count: removed.filter((id) => providerOfId(id) === p).length }))]} />}
        </div>
        {rows.length ? (
          <ul className="mc-list removed-list">
            {rows.map((id) => (
              <li key={id}>
                <span className="mc-name">
                  <b dir="auto">{name(id)}</b>
                  <small>{PROVIDER_NAMES[providerOfId(id) as keyof typeof PROVIDER_NAMES] || providerOfId(id)} · {info[id]?.reason || 'Removed before reasons were recorded'}{info[id]?.at ? ` · ${new Date(info[id].at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}</small>
                </span>
                <button className="btn ghost small" onClick={() => restoreModel(id, false)} aria-label={`Keep ${name(id)}`}><RotateCcw size={14} /> Keep</button>
              </li>
            ))}
          </ul>
        ) : <p className="muted small">{removed.length ? 'No matches.' : 'No removed models.'}</p>}
        <div className="mc-actions">
          {removed.length > 0 && <button className="btn ghost" onClick={async () => { if (!confirm(`Bring back all ${removed.length} removed models?`)) return; updateSettings({ unavailableModels: [], unavailableInfo: {} }); await loadCatalog(); }}>Restore all</button>}
          <button className="btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </Modal>
  );
}
