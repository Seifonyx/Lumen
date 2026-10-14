import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleCheck, CircleSlash, Clock, KeyRound, Loader2, RotateCcw } from 'lucide-react';
import Modal from './Modal';
import { modelLabel, useStore } from '../store';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';
import type { CheckResult } from '../lib/ai/model-check';

type Scope = 'mine' | 'all';
export const LAST_CHECK_KEY = 'mr.modelCheck.last';

/** Checks models with one tiny request each and removes the ones that can't answer. */
export default function ModelCheck({ onClose }: { onClose: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const enabled = useStore((s) => s.settings.enabledModels);
  const { checkModels, restoreModel, setUi } = useStore.getState();
  const [scope, setScope] = useState<Scope>('mine');
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'stopped'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' });
  const [results, setResults] = useState<CheckResult[]>([]);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const controller = useRef<AbortController | null>(null);
  // Names and "was it yours" are captured at the start: removed models leave the catalog.
  const snapshot = useRef<{ labels: Map<string, string>; mine: Set<string> }>({ labels: new Map(), mine: new Set() });
  useEffect(() => () => controller.current?.abort(), []);

  const mine = enabled.filter((id) => catalog?.models.some((m) => m.id === id));
  const all = catalog?.models.map((m) => m.id) || [];
  const ids = scope === 'mine' ? mine : all;
  const label = (id: string) => snapshot.current.labels.get(id) || modelLabel(catalog, id);

  const start = async () => {
    snapshot.current = { labels: new Map(all.map((id) => [id, modelLabel(catalog, id)])), mine: new Set(enabled) };
    const ctrl = new AbortController();
    controller.current = ctrl;
    setResults([]); setKept(new Set()); setPhase('running');
    setProgress({ done: 0, total: ids.length, current: '' });
    try {
      await checkModels(ids, ctrl.signal, (p) => {
        setProgress((prev) => ({ done: p.done, total: p.total, current: p.current ? label(p.current) : prev.current }));
        if (p.result) setResults((r) => [...r, p.result!]);
      });
      if (!ctrl.signal.aborted) { setPhase('done'); try { localStorage.setItem(LAST_CHECK_KEY, String(Date.now())); } catch { /* private mode */ } }
    } catch { setPhase('stopped'); }
  };
  const stop = () => { controller.current?.abort(); setPhase('stopped'); };
  const keep = (id: string) => { restoreModel(id, snapshot.current.mine.has(id)); setKept((k) => new Set(k).add(id)); };

  const groups = useMemo(() => ({
    working: results.filter((r) => r.outcome === 'working'),
    broken: results.filter((r) => r.outcome === 'broken'),
    busy: results.filter((r) => r.outcome === 'busy'),
    key: results.filter((r) => r.outcome === 'key'),
  }), [results]);
  const keyProviders = [...new Set(groups.key.map((r) => providerOfId(r.id)))];
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Modal title="Check models" onClose={onClose}>
      <div className="model-check">
        {phase === 'idle' ? (
          <>
            <p className="mc-intro">Sends each model one tiny message (“Reply with OK”). Models that can’t answer are <b>removed</b> from your list and from Auto. Rate-limited models and key problems are kept, since they aren’t the model’s fault.</p>
            <div className="segmented mc-scope" role="radiogroup" aria-label="Which models">
              <button role="radio" aria-checked={scope === 'mine'} className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>Your models · {mine.length}</button>
              <button role="radio" aria-checked={scope === 'all'} className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>All models · {all.length}</button>
            </div>
            <p className="muted small">Uses about {ids.length} request{ids.length === 1 ? '' : 's'} from your free allowances; no chats or files are sent. Takes about {Math.max(1, Math.ceil(ids.length / 8))} minute{ids.length > 8 ? 's' : ''}.</p>
            <button className="btn primary" disabled={!ids.length} onClick={() => void start()}>Start check</button>
          </>
        ) : (
          <>
            <div className="mc-progress" aria-live="polite">
              <div className="mc-progress-head">
                <span>{phase === 'running' ? <><Loader2 size={15} className="spin" /> Checking {progress.current || '…'}</> : phase === 'stopped' ? 'Stopped' : 'Check complete'}</span>
                <span className="mc-count">{progress.done} / {progress.total}</span>
              </div>
              <div className="meter mc-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Check progress"><div className="meter-fill" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="mc-tiles">
              <div className="mc-tile ok"><CircleCheck size={16} /><b>{groups.working.length}</b><span>working</span></div>
              <div className="mc-tile bad"><CircleSlash size={16} /><b>{groups.broken.length - kept.size}</b><span>removed</span></div>
              <div className="mc-tile wait"><Clock size={16} /><b>{groups.busy.length}</b><span>busy</span></div>
              <div className="mc-tile key"><KeyRound size={16} /><b>{groups.key.length}</b><span>key issue</span></div>
            </div>
            {keyProviders.length > 0 && (
              <div className="mc-notice">
                <KeyRound size={16} />
                <span>{keyProviders.map((p) => PROVIDER_NAMES[p] || p).join(', ')} rejected your key, so {groups.key.length === 1 ? 'its model was' : 'their models were'} kept unchecked.</span>
                <button className="btn small" onClick={() => { onClose(); setUi({ settingsTab: 'keys' }); }}>Open API keys</button>
              </div>
            )}
            {groups.broken.length > 0 && (
              <section className="mc-group">
                <h3>Removed</h3>
                <ul className="mc-list">
                  {groups.broken.map((r) => (
                    <li key={r.id} className={kept.has(r.id) ? 'kept' : ''}>
                      <span className="mc-name"><b dir="auto">{label(r.id)}</b><small>{PROVIDER_NAMES[providerOfId(r.id)] || ''} · {r.reason}</small></span>
                      {kept.has(r.id) ? <span className="muted small">Kept</span> : <button className="btn ghost small" onClick={() => keep(r.id)}><RotateCcw size={14} /> Keep anyway</button>}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {groups.busy.length > 0 && (
              <section className="mc-group">
                <h3>Kept · busy right now</h3>
                <ul className="mc-list">
                  {groups.busy.map((r) => <li key={r.id}><span className="mc-name"><b dir="auto">{label(r.id)}</b><small>{r.reason}</small></span></li>)}
                </ul>
              </section>
            )}
            <div className="mc-actions">
              {phase === 'running' ? <button className="btn" onClick={stop}>Stop</button> : <><button className="btn" onClick={() => setPhase('idle')}>Check again</button><button className="btn primary" onClick={onClose}>Done</button></>}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
