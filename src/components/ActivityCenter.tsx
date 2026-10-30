// Router → Activity: Overview, Logs and Quotas. Loaded on first use, in its own chunk (Canvas only).
// Reads what Lumen already has — saved chats (request outcomes), the device journal (src/lib/activity/journal.ts),
// usage counters and limits (src/lib/usage.ts), sync quota (src/lib/quota.ts) and the browser's storage estimate —
// and shows only real values. Estimates are labelled; unknown limits stay unknown. Never prompts, answers or keys.
import './activity.css';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AlertTriangle, ArrowUpRight, Check, ChevronRight, CircleCheck, Copy, Download, Info, OctagonAlert, RefreshCw, Search, X } from 'lucide-react';
import { modelLabel, useStore } from '../store';
import { useScreenMemory } from '../lib/screen-memory';
import { navigateScreen } from '../lib/screen-history';
import { closeRoutingCenter, showRoutingProvider, showRoutingSection } from '../lib/routing-center';
import { journal, subscribe } from '../lib/activity/journal';
import { buildLog, CATEGORY_LABEL, exportRows, LEVEL_LABEL, queryLog, toCsv, type LogCategory, type LogEntry, type LogLevel, type Range } from '../lib/activity/log';
import { advice, forecast, formatAmount, needsAttention, ratio, sortByUrgency, stateOf, type QuotaMetric, type QuotaState } from '../lib/activity/quotas';
import { thresholds } from '../lib/activity/alerts';
import { metricsFrom, providerName } from '../lib/activity/metrics';
import { answersByDay } from '../lib/chat-records';
import { formatTokens } from '../lib/usage';
import FilterMenu from './FilterMenu';

export type ActivityView = 'overview' | 'logs' | 'quotas';
const VIEWS: [ActivityView, string][] = [['overview', 'Overview'], ['logs', 'Logs'], ['quotas', 'Quotas']];

// ---------- shared hooks and words
const useJournal = () => useSyncExternalStore(subscribe, journal, journal);
function useNow(every = 30_000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), every); return () => clearInterval(t); }, [every]);
  return now;
}
function useStorageEstimate() {
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => { let live = true; void navigator.storage?.estimate?.().then((e) => { if (live && e.quota) setEst({ usage: e.usage || 0, quota: e.quota }); }).catch(() => {}); return () => { live = false; }; }, []);
  return est;
}
function useLog() {
  const chats = useStore((s) => s.chats), events = useJournal();
  return useMemo(() => buildLog(chats, events), [chats, events]);
}
function useMetrics() {
  const usage = useStore((s) => s.usage), firebaseUsage = useStore((s) => s.firebaseUsage), catalog = useStore((s) => s.catalog);
  const storage = useStorageEstimate();
  return useMemo(() => metricsFrom({ usage, firebaseUsage, catalog }, storage), [usage, firebaseUsage, catalog, storage]);
}
const useThresholds = () => thresholds(useStore((s) => s.settings.quotaWarnAt));

const ago = (t: number, now = Date.now()) => {
  const m = Math.round((now - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const until = (t: number, now = Date.now()) => {
  const m = Math.max(1, Math.round((t - now) / 60000));
  return m < 60 ? `${m} min` : m < 2880 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${Math.round(m / 1440)} days`;
};
// dateStyle/timeStyle can't be combined with timeZoneName, so the fields are spelled out.
const clock = (t: number, timeZone?: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone, timeZoneName: 'short' }).format(t);
const time = (t: number) => new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(t);
const dayLabel = (t: number, now = Date.now()) => {
  const d = new Date(t).toDateString(), today = new Date(now).toDateString(), y = new Date(now - 864e5).toDateString();
  return d === today ? 'Today' : d === y ? 'Yesterday' : new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(t);
};
const TZ_WORDS: Record<string, string> = { 'America/Los_Angeles': 'Pacific time', UTC: 'UTC' };
const SOURCE_WORDS: Record<QuotaMetric['source'], [string, string]> = {
  provider: ['Reported by the provider', 'The provider reported this limit for your key.'],
  learned: ['Limit learned from the provider', 'The provider reported this limit when a request reached it; Lumen remembers it.'],
  counted: ['Counted by Lumen', 'Lumen’s own count of requests it sent. Use from other apps or devices on the same key isn’t included, so the real figure can be higher.'],
  device: ['Browser estimate', 'The browser’s own estimate for this site.'],
};
const STATE_WORDS: Record<QuotaState, string> = { ok: 'Within limit', warning: 'Nearing limit', critical: 'Almost used up', exhausted: 'Used up', blocked: 'Paused by provider', unknown: 'No known limit', unlimited: 'No limit' };
const LevelIcon = ({ level, size = 15 }: { level: LogLevel; size?: number }) => level === 'error' ? <OctagonAlert size={size} aria-hidden="true" /> : level === 'warning' ? <AlertTriangle size={size} aria-hidden="true" /> : level === 'success' ? <CircleCheck size={size} aria-hidden="true" /> : <Info size={size} aria-hidden="true" />;

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="ac-copy" aria-label={`Copy ${label}`} onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); }}>{done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}<span className="sr-only" role="status">{done ? 'Copied' : ''}</span></button>;
}

// ---------- page
export default function ActivityCenter({ start }: { start?: ActivityView }) {
  const [view, setView] = useScreenMemory<ActivityView>('activity-view', start || 'overview');
  // A link to Diagnostics (or any start view) wins over the remembered one.
  useEffect(() => { if (start) setView(start); }, [start]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabs = useRef<HTMLDivElement>(null);
  const onKey = (e: React.KeyboardEvent) => {
    const i = VIEWS.findIndex(([v]) => v === view), n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? VIEWS.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = VIEWS[(n + VIEWS.length) % VIEWS.length][0];
    setView(next);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLButtonElement>(`#ac-tab-${next}`)?.focus());
  };
  return (
    <div className="rc-body ac">
      <div className="ac-head">
        <div className="rc-page-intro"><h2 className="rc-h2">Activity</h2><p className="rc-muted">What Lumen used, how your requests ended, and how much is left. Provider limits appear only when known.</p></div>
        <div className="ac-tabs" role="tablist" aria-label="Activity views" ref={tabs} onKeyDown={onKey}>
          {VIEWS.map(([id, label]) => <button key={id} id={`ac-tab-${id}`} type="button" role="tab" aria-selected={view === id} aria-controls="ac-panel" tabIndex={view === id ? 0 : -1} onClick={() => setView(id)}>{label}</button>)}
        </div>
      </div>
      <div id="ac-panel" role="tabpanel" aria-labelledby={`ac-tab-${view}`} className="ac-panel">
        {view === 'overview' ? <Overview go={setView} /> : view === 'logs' ? <Logs /> : <Quotas />}
      </div>
    </div>
  );
}

// ---------- Overview
function Overview({ go }: { go: (v: ActivityView) => void }) {
  const now = useNow();
  const chats = useStore((s) => s.chats), usage = useStore((s) => s.usage), catalog = useStore((s) => s.catalog);
  const log = useLog(), metrics = useMetrics(), t = useThresholds();
  const { days, models } = useMemo(() => answersByDay(chats, 14, now), [chats, now]);
  const requestsToday = Object.values(usage?.models || {}).reduce((n, m) => n + m.requests, 0);
  const tokensToday = Object.values(usage?.models || {}).reduce((n, m) => n + m.input + m.output, 0);
  const sum = (list: typeof days) => list.reduce((a, d) => ({ ok: a.ok + d.answers, failed: a.failed + d.failed, stopped: a.stopped + d.stopped }), { ok: 0, failed: 0, stopped: 0 });
  const week = sum(days.slice(7)), prior = sum(days.slice(0, 7));
  const weekTotal = week.ok + week.failed + week.stopped, priorTotal = prior.ok + prior.failed + prior.stopped;
  const success = weekTotal ? Math.round((week.ok / weekTotal) * 100) : null;
  const known = metrics.filter((m) => m.limit !== null);
  const urgent = sortByUrgency(metrics, t, now).filter((m) => needsAttention(stateOf(m, t, now)));
  const failing = Object.entries(catalog?.providerStatus || {}).filter(([, s]) => s.state === 'error');
  const recent = log.slice(0, 6);
  const change = priorTotal ? Math.round(((weekTotal - priorTotal) / priorTotal) * 100) : null;
  return (
    <div className="ac-overview">
      {(urgent.length > 0 || failing.length > 0) && (
        <section className="ac-alerts" aria-labelledby="ac-alerts-title">
          <h3 id="ac-alerts-title" className="ac-label">Needs attention</h3>
          <ul>
            {urgent.slice(0, 3).map((m) => { const s = stateOf(m, t, now); return (
              <li key={m.id} data-state={s}><LevelIcon level={s === 'warning' ? 'warning' : 'error'} /><span><strong>{m.label}</strong> · {providerName(m.owner)}<small>{STATE_WORDS[s]}{m.used !== null && m.limit ? ` · ${formatAmount(m.used, m.unit)} of ${formatAmount(m.limit, m.unit)}` : ''}{m.blockedUntil && m.blockedUntil > now ? ` · until ${time(m.blockedUntil)}` : m.period.kind === 'day' ? ` · resets in ${until(m.period.resetAt, now)}` : ''}</small></span><button type="button" className="rc-link" onClick={() => go('quotas')}>Quotas</button></li>
            ); })}
            {failing.slice(0, 3).map(([p]) => <li key={p} data-state="error"><LevelIcon level="error" /><span><strong>{providerName(p)}</strong><small>Model list couldn’t refresh</small></span><button type="button" className="rc-link" onClick={() => navigateScreen(() => { showRoutingSection('providers'); showRoutingProvider(p); })}>Open</button></li>)}
          </ul>
        </section>
      )}
      <section className="ac-tiles" aria-label="Key figures" data-evidence-source="app-counters">
        <div className="ac-tile"><span>Requests today</span><strong>{usage ? requestsToday.toLocaleString() : '—'}</strong><small>Counted by Lumen</small></div>
        <div className="ac-tile"><span>Tokens today</span><strong>{usage ? formatTokens(tokensToday) : '—'}</strong><small>Sent and received</small></div>
        <div className="ac-tile"><span>Completed, 7 days</span><strong>{success === null ? '—' : `${success}%`}</strong><small>{weekTotal ? `${week.ok} of ${weekTotal} requests` : 'No requests yet'}</small></div>
        <div className="ac-tile"><span>Allowances</span><strong>{known.length ? `${urgent.length ? urgent.length : 'All'} ${urgent.length ? 'need attention' : 'fine'}` : '—'}</strong><small>{known.length ? `${known.length} with a known limit` : 'No known limits yet'}</small></div>
      </section>
      <section className="ac-card ac-trend" aria-labelledby="ac-trend-title" data-evidence-source="saved-chats">
        <div className="ac-card-head"><h3 id="ac-trend-title" className="rc-h3">Requests, last 14 days</h3><span className="rc-muted">{change === null ? `${weekTotal} this week` : `${weekTotal} this week · ${change >= 0 ? '+' : ''}${change}% vs the week before`}</span></div>
        <TrendChart days={days} />
        <p className="rc-muted ac-legend"><span><span className="ac-key ac-key-ok" />Completed</span><span><span className="ac-key ac-key-stopped" />Stopped</span><span><span className="ac-key ac-key-failed" />Failed</span><span>From this account’s saved chats</span></p>
      </section>
      <div className="ac-split">
        <section className="ac-card" aria-labelledby="ac-recent-title">
          <div className="ac-card-head"><h3 id="ac-recent-title" className="rc-h3">Recent activity</h3><button type="button" className="rc-link" onClick={() => go('logs')}>All logs <ChevronRight size={14} aria-hidden="true" /></button></div>
          {recent.length ? <ol className="ac-mini-log">{recent.map((e) => <li key={e.id} data-level={e.level}><LevelIcon level={e.level} /><span><strong>{e.title}</strong><small>{[e.model && modelLabel(catalog, e.model), !e.model && e.provider && providerName(e.provider), e.detail].filter(Boolean).join(' · ')}</small></span><time dateTime={new Date(e.at).toISOString()}>{ago(e.at, now)}</time></li>)}</ol>
            : <p className="ac-empty">Nothing yet. Requests and provider events appear here as they happen.</p>}
        </section>
        <section className="ac-card" aria-labelledby="ac-models-title">
          <div className="ac-card-head"><h3 id="ac-models-title" className="rc-h3">Most used models</h3><span className="rc-muted">14 days</span></div>
          {models.length ? <ol className="ac-rank">{models.slice(0, 5).map(([id, n]) => <li key={id}><span>{modelLabel(catalog, id)}</span><span className="ac-rank-bar" style={{ inlineSize: `${(n / models[0][1]) * 100}%` }} aria-hidden="true" /><strong>{n}</strong></li>)}</ol>
            : <p className="ac-empty">No completed requests in saved chats yet.</p>}
        </section>
      </div>
    </div>
  );
}

function TrendChart({ days }: { days: { day: number; answers: number; failed: number; stopped: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.answers + d.failed + d.stopped));
  const label = (t: number) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric' }).format(t);
  const empty = days.every((d) => !d.answers && !d.failed && !d.stopped);
  return (
    <figure className="ac-chart" data-empty={empty || undefined}>
      <ol aria-hidden="true">{days.map((d) => { const n = d.answers + d.failed + d.stopped; return (
        <li key={d.day} title={`${label(d.day)}: ${d.answers} completed, ${d.stopped} stopped, ${d.failed} failed`}>
          <span className="ac-bar" style={{ blockSize: `${(n / max) * 100}%` }}><span className="ac-bar-failed" style={{ flexGrow: d.failed }} /><span className="ac-bar-stopped" style={{ flexGrow: d.stopped }} /><span className="ac-bar-ok" style={{ flexGrow: d.answers }} /></span>
          <small>{new Date(d.day).getDate()}</small>
        </li>
      ); })}</ol>
      {empty && <figcaption className="ac-empty">No requests in the last two weeks.</figcaption>}
      <table className="sr-only"><caption>Requests per day, last 14 days</caption><thead><tr><th>Day</th><th>Completed</th><th>Stopped</th><th>Failed</th></tr></thead><tbody>{days.map((d) => <tr key={d.day}><td>{label(d.day)}</td><td>{d.answers}</td><td>{d.stopped}</td><td>{d.failed}</td></tr>)}</tbody></table>
    </figure>
  );
}

// ---------- Logs
type RangeKey = 'today' | '24h' | '7d' | '30d' | 'all' | 'custom';
const PAGE = 50;
const toDay = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const fromDay = (s: string, end = false) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0).getTime(); };

function Logs() {
  const all = useLog(), catalog = useStore((s) => s.catalog), now = useNow(60_000);
  const [q, setQ] = useScreenMemory('activity-logs', { text: '', category: 'all' as LogCategory | 'all', level: 'all' as LogLevel | 'all', range: '7d' as RangeKey, from: toDay(Date.now() - 6 * 864e5), to: toDay(Date.now()), order: 'newest' as 'newest' | 'oldest', titles: false, shown: PAGE });
  const [open, setOpen] = useState<LogEntry | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const label = (id: string) => modelLabel(catalog, id);
  const range: Range = q.range === 'custom' ? { from: fromDay(q.from), to: fromDay(q.to, true) } : q.range;
  const rows = useMemo(() => queryLog(all, { text: q.text, categories: q.category === 'all' ? [] : [q.category], levels: q.level === 'all' ? [] : [q.level], range, order: q.order, titles: q.titles, modelLabel: label }, now), [all, q.text, q.category, q.level, q.range, q.from, q.to, q.order, q.titles, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const inRange = useMemo(() => queryLog(all, { range }, now), [all, q.range, q.from, q.to, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<typeof q>) => setQ((s) => ({ ...s, shown: PAGE, ...patch }));
  const errors = rows.filter((r) => r.level === 'error').length, warnings = rows.filter((r) => r.level === 'warning').length;
  const filtered = Boolean(q.text || q.category !== 'all' || q.level !== 'all');
  const save = (kind: 'csv' | 'json') => {
    const data = exportRows(rows, q.titles, label);
    const blob = new Blob([kind === 'csv' ? toCsv(data) : JSON.stringify(data, null, 2)], { type: kind === 'csv' ? 'text/csv' : 'application/json' });
    const url = URL.createObjectURL(blob), a = Object.assign(document.createElement('a'), { href: url, download: `lumen-activity-${toDay(Date.now())}.${kind}` });
    a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // Saved chats sync on their own and the journal updates live; Refresh re-reads both and asks providers for fresh
  // model lists (no message is sent).
  const refresh = async () => { setRefreshing(true); try { await useStore.getState().loadCatalog(true); } catch { /* recorded as an event */ } finally { setRefreshing(false); } };
  const visible = rows.slice(0, q.shown);
  const groups: [string, LogEntry[]][] = [];
  for (const r of visible) { const d = dayLabel(r.at, now); const g = groups.at(-1); if (g && g[0] === d) g[1].push(r); else groups.push([d, [r]]); }
  return (
    <div className="ac-logs" data-evidence-source="saved-request-outcomes">
      <div className="ac-toolbar">
        <div className="rc-search ac-search"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search logs" placeholder="Search events, models, ids" value={q.text} onChange={(e) => set({ text: e.target.value })} />{q.text && <button type="button" aria-label="Clear log search" onClick={() => set({ text: '' })}><X size={16} aria-hidden="true" /></button>}</div>
        <div className="ac-filters">
          <FilterMenu<RangeKey> label="Time" value={q.range} onChange={(range) => set({ range })} options={[{ value: '7d', label: 'Last 7 days' }, { value: 'today', label: 'Today' }, { value: '24h', label: 'Last 24 hours' }, { value: '30d', label: 'Last 30 days' }, { value: 'all', label: 'All time' }, { value: 'custom', label: 'Custom dates' }]} />
          <FilterMenu<LogCategory | 'all'> label="Type" value={q.category} onChange={(category) => set({ category })} options={[{ value: 'all', label: 'All types', count: inRange.length }, ...(Object.keys(CATEGORY_LABEL) as LogCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c], count: inRange.filter((e) => e.category === c).length }))]} />
          <FilterMenu<LogLevel | 'all'> label="Status" value={q.level} onChange={(level) => set({ level })} options={[{ value: 'all', label: 'All statuses', count: inRange.length }, ...(['error', 'warning', 'success', 'info'] as LogLevel[]).map((l) => ({ value: l, label: LEVEL_LABEL[l], count: inRange.filter((e) => e.level === l).length }))]} />
          <FilterMenu<'newest' | 'oldest'> label="Order" value={q.order} onChange={(order) => set({ order })} options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }]} />
        </div>
        {q.range === 'custom' && <div className="ac-dates"><label>From <input type="date" value={q.from} max={q.to} onChange={(e) => e.target.value && set({ from: e.target.value })} /></label><label>To <input type="date" value={q.to} min={q.from} max={toDay(Date.now())} onChange={(e) => e.target.value && set({ to: e.target.value })} /></label></div>}
      </div>
      <div className="ac-summary">
        <p role="status">{rows.length.toLocaleString()} {rows.length === 1 ? 'event' : 'events'}{errors ? ` · ${errors} ${errors === 1 ? 'error' : 'errors'}` : ''}{warnings ? ` · ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}` : ''}</p>
        <div className="ac-actions">
          <label className="ac-check"><input type="checkbox" checked={q.titles} onChange={(e) => setQ((s) => ({ ...s, titles: e.target.checked }))} /> Show chat titles</label>
          <button type="button" className="rc-quiet ac-icon" aria-label={refreshing ? 'Refreshing' : 'Refresh'} title="Refresh" onClick={() => void refresh()} disabled={refreshing}><RefreshCw size={16} className={refreshing ? 'spin' : undefined} aria-hidden="true" /></button>
          <button type="button" className="rc-quiet" disabled={!rows.length} onClick={() => save('csv')}><Download size={15} aria-hidden="true" />CSV</button>
          <button type="button" className="rc-quiet" disabled={!rows.length} onClick={() => save('json')}><Download size={15} aria-hidden="true" />JSON</button>
        </div>
      </div>
      {rows.length ? <>
        {groups.map(([day, list]) => (
          <section key={day} className="ac-day" aria-label={day}>
            <h3 className="ac-label">{day}</h3>
            <ul className="ac-log">{list.map((e) => (
              <li key={e.id}>
                <button type="button" className="ac-row" data-level={e.level} aria-haspopup="dialog" onClick={() => setOpen(e)}>
                  <span className="ac-row-icon"><LevelIcon level={e.level} /><span className="sr-only">{LEVEL_LABEL[e.level]}: </span></span>
                  <span className="ac-row-main"><strong>{e.title}{e.count && e.count > 1 ? <small> ×{e.count}</small> : null}</strong><small>{[e.model ? label(e.model) : e.provider && providerName(e.provider), e.detail, q.titles && e.chatTitle].filter(Boolean).join(' · ') || CATEGORY_LABEL[e.category]}</small></span>
                  <span className="ac-row-meta"><span className="ac-tag">{CATEGORY_LABEL[e.category]}</span><time dateTime={new Date(e.at).toISOString()}>{time(e.at)}</time></span>
                </button>
              </li>
            ))}</ul>
          </section>
        ))}
        {rows.length > q.shown && <div className="ac-more"><button type="button" className="rc-quiet" onClick={() => setQ((s) => ({ ...s, shown: s.shown + PAGE }))}>Show {Math.min(PAGE, rows.length - q.shown)} more</button><span className="rc-muted">Showing {q.shown} of {rows.length}</span></div>}
      </> : <div className="ac-empty-state" role="status">
        <p><strong>{all.length ? 'No events match' : 'No activity yet'}</strong></p>
        <p className="rc-muted">{all.length ? 'Try another search, type, status or time range.' : 'Requests from saved chats and events such as model-list refreshes, limits and sync changes will be listed here.'}</p>
        {all.length > 0 && (filtered || q.range !== 'all') && <button type="button" className="rc-link" onClick={() => set({ text: '', category: 'all', level: 'all', range: 'all' })}>Show everything</button>}
      </div>}
      <p className="rc-muted ac-foot">Requests come from this account’s saved chats; other events are kept on this device for 30 days. Logs never include prompts, answers, provider replies or keys.</p>
      {open && <LogDetail entry={open} titles={q.titles} onClose={() => setOpen(null)} />}
    </div>
  );
}

function LogDetail({ entry: e, titles, onClose }: { entry: LogEntry; titles: boolean; onClose: () => void }) {
  const catalog = useStore((s) => s.catalog);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = dialog.current; if (d && !d.open) d.showModal(); }, []);
  const fields: [string, string, boolean?][] = [
    ['Status', LEVEL_LABEL[e.level]], ['Type', CATEGORY_LABEL[e.category]], ['When', clock(e.at)], ...(e.count && e.count > 1 ? [['Repeats', `${e.count} times within a minute`] as [string, string]] : []),
    ...(e.model ? [['Model', modelLabel(catalog, e.model)] as [string, string], ['Model id', e.model, true] as [string, string, boolean]] : []),
    ...(e.provider ? [['Provider', providerName(e.provider)] as [string, string]] : []),
    ...(e.detail ? [[e.level === 'error' ? 'Reason' : 'Detail', e.detail] as [string, string]] : []),
    ...(e.route ? [['Why this model', e.route] as [string, string]] : []),
    ...(titles && e.chatTitle ? [['Chat', e.chatTitle] as [string, string]] : []),
    ['Source', e.source === 'saved-chat' ? 'Saved chat (synced with your account)' : 'This device'], ['Event id', e.id, true],
  ];
  return (
    <dialog ref={dialog} className="ac-detail" aria-labelledby="ac-detail-title" onClose={onClose} onClick={(ev) => { if (ev.target === dialog.current) dialog.current?.close(); }}>
      <div className="ac-detail-head"><span className="ac-row-icon" data-level={e.level}><LevelIcon level={e.level} size={18} /></span><h3 id="ac-detail-title">{e.title}</h3><button type="button" className="ac-close" aria-label="Close event details" onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button></div>
      <dl className="ac-fields">{fields.map(([k, v, copy]) => <div key={k}><dt>{k}</dt><dd><span dir="auto">{v}</span>{copy && <CopyButton value={v} label={k.toLowerCase()} />}</dd></div>)}</dl>
      {e.level === 'error' && e.category === 'request' && <p className="rc-muted">The provider’s own message isn’t shown, because it can quote what you asked.</p>}
      <div className="ac-detail-actions">
        {e.chatId && <button type="button" className="rc-primary" onClick={() => { dialog.current?.close(); closeRoutingCenter(); useStore.getState().selectChat(e.chatId!); }}>Open chat <ArrowUpRight size={15} aria-hidden="true" /></button>}
        {!e.chatId && e.provider && e.provider !== 'lumen' && <button type="button" className="rc-primary" onClick={() => { dialog.current?.close(); navigateScreen(() => { showRoutingSection('providers'); showRoutingProvider(e.provider!); }); }}>Open provider</button>}
        <button type="button" className="rc-quiet" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(exportRows([e], titles, (id) => modelLabel(catalog, id))[0], null, 2)).catch(() => {})}><Copy size={15} aria-hidden="true" />Copy details</button>
      </div>
    </dialog>
  );
}

// ---------- Quotas
function Quotas() {
  const now = useNow(30_000), metrics = useMetrics(), t = useThresholds();
  const settings = useStore((s) => s.settings);
  const [expanded, setExpanded] = useState<string | null>(null);
  const sorted = sortByUrgency(metrics, t, now);
  const limited = sorted.filter((m) => m.limit !== null), open = sorted.filter((m) => m.limit === null);
  // Providers first (most urgent first), then Lumen's cloud sync, then this device.
  const rank = (o: string) => o === 'device' ? 2 : o === 'lumen' ? 1 : 0;
  const owners = [...new Set(limited.map((m) => m.owner))].sort((a, b) => rank(a) - rank(b));
  const urgent = limited.filter((m) => needsAttention(stateOf(m, t, now))).length;
  return (
    <div className="ac-quotas">
      <div className="ac-quota-summary">
        <p role="status"><strong>{urgent ? `${urgent} ${urgent === 1 ? 'allowance needs' : 'allowances need'} attention` : limited.length ? 'Everything is within its limit' : 'No known limits yet'}</strong><span className="rc-muted">{limited.length} with a known limit · {open.length} counted without one</span></p>
        <details className="ac-settings"><summary>Alert settings</summary>
          <div className="ac-settings-body">
            <label className="ac-field"><span>Warn at</span><select value={Math.round(t.warnAt * 100)} onChange={(e) => useStore.getState().updateSettings({ quotaWarnAt: Number(e.target.value) / 100 })}>{[50, 60, 70, 75, 80, 85, 90, 95].map((v) => <option key={v} value={v}>{v}% used</option>)}</select></label>
            <label className="ac-check"><input type="checkbox" checked={settings.quotaAlerts !== false} onChange={(e) => useStore.getState().updateSettings({ quotaAlerts: e.target.checked })} /> Show a notice when an allowance nears or reaches its limit</label>
            <p className="rc-muted">One notice per allowance per day, at most.</p>
          </div>
        </details>
      </div>
      {owners.length ? owners.map((owner) => (
        <section key={owner} className="ac-quota-group" aria-labelledby={`ac-q-${owner}`}>
          <h3 id={`ac-q-${owner}`} className="ac-label">{providerName(owner)}</h3>
          <ul className="ac-quota-list">{limited.filter((m) => m.owner === owner).map((m) => <QuotaRow key={m.id} m={m} now={now} t={t} open={expanded === m.id} toggle={() => setExpanded(expanded === m.id ? null : m.id)} />)}</ul>
        </section>
      )) : <div className="ac-empty-state"><p><strong>No limits reported yet</strong></p><p className="rc-muted">Providers report a limit when Lumen reaches it or in their replies. Until then, Lumen shows what it has counted below and never guesses a limit.</p></div>}
      {open.length > 0 && (
        <section className="ac-quota-group" aria-labelledby="ac-q-open">
          <h3 id="ac-q-open" className="ac-label">Counted, no known limit</h3>
          <ul className="ac-open-list">{open.map((m) => <li key={m.id}><span><strong>{m.label}</strong><small>{providerName(m.owner)} · {SOURCE_WORDS[m.source][0]}{m.period.kind === 'day' ? ` · resets in ${until(m.period.resetAt, now)}` : ''}</small></span><strong>{m.used === null ? '—' : formatAmount(m.used, m.unit)}<small> {m.unit === 'bytes' ? '' : m.unit}</small></strong></li>)}</ul>
        </section>
      )}
      <p className="rc-muted ac-foot">Values come from provider reports, Lumen’s own counters and the browser. Forecasts are estimates from today’s pace. Lumen doesn’t see use from other apps on the same key, so counted figures can be lower than your provider’s.</p>
    </div>
  );
}

function QuotaRow({ m, now, t, open, toggle }: { m: QuotaMetric; now: number; t: ReturnType<typeof thresholds>; open: boolean; toggle: () => void }) {
  const s = stateOf(m, t, now), r = ratio(m), f = forecast(m, now), tip = advice(m, s);
  const pct = r === null ? 0 : Math.min(100, Math.round(r * 100));
  const left = m.used !== null && m.limit !== null && Number.isFinite(m.limit) ? Math.max(0, m.limit - m.used) : null;
  const id = `ac-qd-${m.id.replace(/[^a-z0-9]/gi, '-')}`;
  return (
    <li className="ac-quota" data-state={s}>
      <button type="button" className="ac-quota-hit" aria-expanded={open} aria-controls={id} onClick={toggle}>
        <span className="ac-quota-top"><strong>{m.label}</strong><span className="ac-state">{STATE_WORDS[s]}</span></span>
        <span className="ac-meter" role="meter" aria-label={`${m.label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={m.used !== null && m.limit ? `${formatAmount(m.used, m.unit)} of ${formatAmount(m.limit, m.unit)} ${m.unit === 'bytes' ? '' : m.unit} used` : 'Unknown'}>
          <span className="ac-meter-fill" style={{ inlineSize: `${pct}%` }} /><span className="ac-meter-mark" style={{ insetInlineStart: `${Math.round(t.warnAt * 100)}%` }} />
        </span>
        <span className="ac-quota-figures"><span>{m.used === null ? '—' : formatAmount(m.used, m.unit)} <small>of {m.limit === null ? 'unknown' : formatAmount(m.limit, m.unit)} {m.unit === 'bytes' ? '' : m.unit}</small></span><span className="rc-muted">{m.blockedUntil && m.blockedUntil > now ? `Paused · ${until(m.blockedUntil, now)} left` : m.period.kind === 'day' ? `Resets in ${until(m.period.resetAt, now)}` : m.period.kind === 'minute' ? `Clears in ${until(m.period.resetAt, now)}` : `${pct}% used`}</span></span>
        <ChevronRight size={16} className="ac-quota-chev" aria-hidden="true" />
      </button>
      <div id={id} className="ac-quota-detail" hidden={!open}>
        <dl className="ac-fields">
          {left !== null && <div><dt>Remaining</dt><dd>{formatAmount(left, m.unit)} {m.unit === 'bytes' ? '' : m.unit} ({100 - pct}%)</dd></div>}
          {m.period.kind === 'day' && <div><dt>Current period</dt><dd>{clock(m.period.start, m.period.timeZone)} – {clock(m.period.resetAt, m.period.timeZone)}<small> · resets at midnight {TZ_WORDS[m.period.timeZone] || m.period.timeZone}; your time {clock(m.period.resetAt)}</small></dd></div>}
          {f && <div><dt>Forecast (estimate)</dt><dd>About {formatAmount(f.projected, m.unit)} by the reset{f.exhaustAt ? ` · would run out around ${time(f.exhaustAt)}` : m.limit && Number.isFinite(m.limit) ? ' · stays within the limit' : ''}<small> · today’s pace, about {formatAmount(Math.round(f.ratePerHour), m.unit)} an hour</small></dd></div>}
          <div><dt>Where this comes from</dt><dd>{SOURCE_WORDS[m.source][1]}{m.note ? ` ${m.note}` : ''}</dd></div>
        </dl>
        {tip && <p className="ac-tip">{tip}</p>}
        {s === 'blocked' && m.id.startsWith('requests:') && <button type="button" className="rc-link" onClick={() => navigateScreen(() => showRoutingSection('routing'))}>Routing settings</button>}
      </div>
    </li>
  );
}
