// Canvas Routing Center, Tier 5 panels (loaded on first use): the model-list refresh and the routing file. All on this device: no server, no new storage, keys never read or shown.
import { useRef, useState } from 'react';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { useStore } from '../store';
import { exportRouting, readRouting } from '../lib/routing-transfer';
import type { ModelInfo, Settings } from '../types';

const providerId = (model: ModelInfo) => (model.provider === 'google' ? 'gemini' : model.provider);

/** Refresh model list: asks the enabled providers for their model lists again (the catalog refresh Lumen already runs;
 * no message is sent, nothing is spent, replies are not tested) and reports this provider's result in words. Keys are
 * never read or shown here. The button leads when refreshing is the next useful step; otherwise it stays quiet. */
export function CheckConnection({ provider, primary }: { provider: string; primary?: boolean }) {
  const [state, setState] = useState<{ busy: boolean; result?: string; ok?: boolean }>({ busy: false });
  const run = async () => {
    const at = Date.now();
    setState({ busy: true });
    await useStore.getState().loadCatalog(true).catch(() => {});
    const status = useStore.getState().catalog?.providerStatus?.[provider];
    const count = useStore.getState().catalog?.models.filter((m) => providerId(m) === provider).length || 0;
    const fresh = Boolean(status && status.lastAttempt >= at - 1000);
    const words: Record<string, string> = { auth: 'The provider refused the key.', 'rate-limit': 'The provider is limiting requests. Try again in a minute.', timeout: 'The provider didn’t answer in time.', network: 'Couldn’t reach the provider.', provider: 'The provider had a problem listing its models.', invalid: 'The provider answered with something Lumen couldn’t read.' };
    const ok = fresh && status?.state === 'ready';
    setState({ busy: false, ok, result: ok ? `${count} ${count === 1 ? 'model' : 'models'} listed.` : !fresh ? 'No answer yet. Try again in a moment.' : words[status?.errorKind || ''] || 'The refresh didn’t complete.' });
  };
  return (
    <>
      <button type="button" className={primary ? 'rc-primary' : 'rc-quiet'} disabled={state.busy} onClick={() => void run()}><RefreshCw size={15} className={state.busy ? 'spin' : undefined} aria-hidden="true" />{state.busy ? 'Refreshing…' : 'Refresh model list'}</button>
      <p className="rc-check" role="status">{state.result && <><span className={state.ok ? 'rc-ok' : 'rc-bad'}>{state.ok ? 'Model list refreshed' : 'Not refreshed'}</span> · {state.result} No message was sent.</>}</p>
    </>
  );
}

/** Policies: save the routing settings to a file, or bring them in from one. Keys and connections are never included. */
export function RoutingFile() {
  const settings = useStore((s) => s.settings), catalog = useStore((s) => s.catalog);
  const [pending, setPending] = useState<{ patch: Partial<Settings>; summary: string[] } | null>(null), [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const save = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportRouting(settings), null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `lumen-routing-${new Date().toISOString().slice(0, 10)}.json` });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const open = async (f?: File) => {
    setError(''); setPending(null);
    if (!f) return;
    try { setPending(readRouting(await f.text(), settings, new Set((catalog?.models || []).map((m) => m.id)))); } catch (e) { setError((e as Error).message); }
    if (file.current) file.current.value = '';
  };
  return (
    <section className="rc-card rc-transfer">
      <div className="rc-panel-title"><div><h3>Routing file</h3><p className="rc-muted">Auto’s preference, fallback, enabled models and Layouts. Never keys or connections.</p></div>
        <span className="rc-transfer-actions"><button type="button" className="rc-link" onClick={save}><Download size={15} />Export</button><button type="button" className="rc-link" onClick={() => file.current?.click()}><Upload size={15} />Import</button></span></div>
      <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void open(e.target.files?.[0])} />
      {error && <p className="rc-notice" role="alert">{error}</p>}
      {pending && <div className="rc-import" role="group" aria-label="Import preview">
        <p>This file will change:</p><ul>{pending.summary.map((x) => <li key={x}>{x}</li>)}</ul>
        <span className="rc-transfer-actions"><button type="button" className="rc-primary" onClick={() => { useStore.getState().updateSettings(pending.patch); setPending(null); useStore.getState().toast('Routing settings imported'); }}>Apply</button><button type="button" className="rc-link" onClick={() => setPending(null)}>Cancel</button></span>
      </div>}
    </section>
  );
}
