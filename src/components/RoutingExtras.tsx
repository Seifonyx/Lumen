// Canvas Routing Center, Tier 5 panels (loaded on first use): the connection check, usage history and request log read
// from saved chats, and the routing file. All on this device: no server, no new storage, keys never read or shown.
import { useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Upload } from 'lucide-react';
import { modelLabel, useStore } from '../store';
import { answersByDay, recentRequests } from '../lib/chat-records';
import { exportRouting, readRouting } from '../lib/routing-transfer';
import type { ModelInfo, Settings } from '../types';

const providerId = (model: ModelInfo) => (model.provider === 'google' ? 'gemini' : model.provider);
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

/** Check connection: asks the providers for their model lists again (the catalog refresh Lumen already runs; no message
 * is sent and nothing is spent) and reports this provider's result in words. Keys are never read or shown here. */
export function CheckConnection({ provider }: { provider: string }) {
  const [state, setState] = useState<{ busy: boolean; at?: number; result?: string; ok?: boolean }>({ busy: false });
  const run = async () => {
    const at = Date.now();
    setState({ busy: true });
    await useStore.getState().loadCatalog(true).catch(() => {});
    const status = useStore.getState().catalog?.providerStatus?.[provider];
    const count = useStore.getState().catalog?.models.filter((m) => providerId(m) === provider).length || 0;
    const fresh = Boolean(status && status.lastAttempt >= at - 1000);
    const words: Record<string, string> = { auth: 'The provider refused the key. Update it in Settings → Keys.', 'rate-limit': 'The provider is rate limiting requests right now. Try again in a minute.', timeout: 'The provider didn’t answer in time.', network: 'Couldn’t reach the provider. Check your connection.', provider: 'The provider had a problem listing its models.', invalid: 'The provider answered with something Lumen couldn’t read.' };
    const ok = fresh && status?.state === 'ready';
    setState({ busy: false, at: Date.now(), ok, result: ok ? `Catalog refreshed. ${count} ${count === 1 ? 'model' : 'models'} listed.` : !fresh ? 'No answer yet. Check again in a moment.' : words[status?.errorKind || ''] || 'The check didn’t complete.' });
  };
  return (
    <div className="rc-check">
      <button type="button" className="rc-link" disabled={state.busy} onClick={() => void run()}><RefreshCw size={15} className={state.busy ? 'spin' : undefined} />{state.busy ? 'Checking…' : 'Check connection'}</button>
      <p className="rc-muted" role="status">{state.result ? <><span className={state.ok ? 'rc-ok' : 'rc-bad'}>{state.ok ? 'Model list reached' : 'Not confirmed'}</span> · {state.result}</> : 'Refreshes enabled providers’ catalogs and shows this provider’s result. No message is sent.'}</p>
    </div>
  );
}

/** Usage history from saved chats: answers per day for two weeks and which models gave them. */
export function UsageHistory() {
  const chats = useStore((s) => s.chats), catalog = useStore((s) => s.catalog);
  const { days, models } = useMemo(() => answersByDay(chats), [chats]);
  const max = Math.max(1, ...days.map((d) => d.answers + d.failed)), total = days.reduce((n, d) => n + d.answers, 0);
  const label = (t: number) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(t);
  return (
    <section className="rc-card rc-history" aria-label="Answers in the last two weeks">
      <div className="rc-panel-title"><h3>Last 14 days</h3><span className="rc-muted">{total} {total === 1 ? 'answer' : 'answers'} in your saved chats</span></div>
      {total || days.some((d) => d.failed) ? <>
        <ol className="rc-bars">{days.map((d) => (
          <li key={d.day} title={`${label(d.day)}: ${d.answers} answered${d.failed ? `, ${d.failed} failed` : ''}`}>
            <span className="rc-bar" style={{ blockSize: `${((d.answers + d.failed) / max) * 100}%` }}><span style={{ blockSize: `${(d.failed / Math.max(1, d.answers + d.failed)) * 100}%` }} /></span>
            <small aria-hidden="true">{new Date(d.day).getDate()}</small>
            <span className="sr-only">{label(d.day)}: {d.answers} answered{d.failed ? `, ${d.failed} failed` : ''}</span>
          </li>
        ))}</ol>
        <ul className="rc-history-models">{models.slice(0, 5).map(([id, n]) => <li key={id}><span>{modelLabel(catalog, id)}</span><strong>{n}</strong></li>)}</ul>
      </> : <p className="rc-muted">No answers in your saved chats in the last two weeks.</p>}
      <p className="rc-muted">Counted from chats saved on this device. Incognito chats and deleted chats aren’t included; hatched parts are answers that failed.</p>
    </section>
  );
}

/** Diagnostics: how recent requests ended, from saved chats. No prompts or answers; chat titles only when asked. */
export function RequestLog() {
  const chats = useStore((s) => s.chats), catalog = useStore((s) => s.catalog);
  const [titles, setTitles] = useState(false);
  const rows = useMemo(() => recentRequests(chats), [chats]);
  const words = { answered: 'Answered', rerouted: 'Rerouted', stopped: 'Stopped', failed: 'Failed' } as const;
  return (
    <section className="rc-card rc-log">
      <div className="rc-panel-title"><h3>Recent requests</h3>{rows.length > 0 && <label className="rc-toggle"><input type="checkbox" checked={titles} onChange={(e) => setTitles(e.target.checked)} /> Show chat titles</label>}</div>
      {rows.length ? <ol>{rows.map((r, i) => (
        <li key={`${r.chatId}-${r.at}-${i}`}>
          <span className={`rc-log-outcome${r.outcome === 'failed' ? ' rc-bad' : ''}`}>{words[r.outcome]}</span>
          <span className="rc-log-main"><strong>{modelLabel(catalog, r.model)}</strong>{r.detail && <small>{r.detail}</small>}{titles && <small dir="auto">{r.chatTitle}</small>}</span>
          <time className="rc-muted" dateTime={new Date(r.at).toISOString()}>{ago(r.at)}</time>
        </li>
      ))}</ol> : <p className="rc-muted">No answers recorded yet.</p>}
      <p className="rc-muted">From chats saved on this device. Shows the model and how each request ended, never what was asked or answered.</p>
    </section>
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
