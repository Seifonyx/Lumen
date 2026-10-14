import { CircleCheck, Clock, OctagonAlert } from 'lucide-react';
import { FREE_LIMITS, type Op } from '../lib/quota';
import { formatTokens, formatUntil, remaining, type UsageView } from '../lib/usage';
import { modelLabel, useStore } from '../store';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';
import { EXTRA_PROVIDERS } from '../lib/ai/provider-config.js';

function Bar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(used, limit)} aria-valuetext={`${used} of ${limit} used`} aria-label={`${used} of ${limit} used`}>
      <div className={`meter-fill${pct >= 90 ? ' high' : pct >= 70 ? ' mid' : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Status({ until }: { until: number | null }) {
  if (!until) {
    return (
      <span className="status ok">
        <CircleCheck size={14} /> Available
      </span>
    );
  }
  const soon = until - Date.now() < 10 * 60_000;
  return (
    <span className={`status ${soon ? 'wait' : 'blocked'}`}>
      {soon ? <Clock size={14} /> : <OctagonAlert size={14} />} {soon ? 'Busy' : 'Limit reached'} · back {formatUntil(until)}
    </span>
  );
}

const shortUntil = (at: number) => {
  const mins = Math.max(1, Math.round((at - Date.now()) / 60000));
  return mins < 60 ? `${mins} min` : mins < 48 * 60 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
};

const OPS: [Op, string][] = [
  ['reads', 'Reads'],
  ['writes', 'Writes'],
  ['deletes', 'Deletes'],
];

function FirebaseCard() {
  const fb = useStore((s) => s.firebaseUsage);
  const status =
    fb.level === 'paused'
      ? `Sync paused to stay free — chats are saved on each device and sync again ${formatUntil(fb.resetAt)}.`
      : fb.level === 'slow'
        ? 'Getting close: changes are synced in batches (about once a minute) to save quota.'
        : 'Well within the free plan.';
  return (
    <div className="settings-card usage-card firebase-card">
      <div className="usage-card-head">
        <span className="setting-text">
          <span className="setting-label">Cloud sync</span>
          <span className="setting-hint">Firebase free plan, shared by everyone invited</span>
        </span>
        <span className="usage-reset-note">resets {formatUntil(fb.resetAt)}</span>
      </div>
      <div className="fb-grid">
        {OPS.map(([op, label]) => (
          <div key={op} className="fb-row">
            <span className="fb-label">{label}</span>
            <span className="fb-count">{fb.used[op].toLocaleString()} / {FREE_LIMITS[op].toLocaleString()}</span>
            <Bar used={fb.used[op]} limit={FREE_LIMITS[op]} />
          </div>
        ))}
      </div>
      <span className={`setting-hint${fb.level === 'normal' ? '' : ' warn'}`}>{status} Counted by the app, so it's approximate.</span>
    </div>
  );
}

export default function UsageTab() {
  const view = useStore((s) => s.usage) as UsageView | null;
  const catalog = useStore((s) => s.catalog);
  const enabled = useStore((s) => s.settings.enabledModels);
  const hasOpenRouter = Boolean(catalog?.providers.openrouter);

  if (!view) return <div className="settings-section usage"><p className="muted pad">Usage appears once you're signed in and your models have loaded.</p><FirebaseCard /></div>;

  const ids = [...new Set([...enabled, ...Object.keys(view.models).filter((id) => view.models[id].requests > 0)])];
  const rows = ids.map((id) => {
    const u = view.models[id];
    const isFreeOR = id.startsWith('openrouter:') && id.endsWith(':free');
    const blocked = u?.blockedUntil && u.blockedUntil > Date.now() ? u.blockedUntil : isFreeOR && view.openrouter.limit && view.openrouter.used >= view.openrouter.limit ? view.openrouter.resetAt : null;
    return { id, u, blocked, left: remaining(view, id), isFreeOR };
  });
  const total = Object.values(view.models).reduce((n, m) => n + m.requests, 0);
  const tokens = Object.values(view.models).reduce((n, m) => n + m.input + m.output, 0);
  const available = rows.filter((r) => !r.blocked).length;
  rows.sort((x, y) => Number(Boolean(y.blocked)) - Number(Boolean(x.blocked)) || (y.u?.requests || 0) - (x.u?.requests || 0));
  const resets = [
    ['Google', view.geminiResetAt],
    ...(hasOpenRouter ? [['OpenRouter', view.openrouter.resetAt] as const] : []),
    ...(catalog?.providers.groq || catalog?.providers.cerebras ? [[[catalog?.providers.groq && 'Groq', catalog?.providers.cerebras && 'Cerebras'].filter(Boolean).join(' and '), view.openrouter.resetAt] as const] : []),
  ] as (readonly [string, number])[];
  const nextReset = Math.min(...resets.map(([, at]) => at).filter((at) => at > Date.now()), Infinity);

  return (
    <div className="settings-section usage">
      <div className="usage-stats">
        <div className="usage-stat usage-stat-main">
          <span className="usage-big">{total}</span>
          <span className="usage-stat-label">total requests today</span>
        </div>
        <div className="usage-stat">
          <span className="usage-stat-value">{available}<small>/{rows.length}</small></span>
          <span className="usage-stat-label">available</span>
        </div>
        <div className="usage-stat">
          <span className="usage-stat-value">{formatTokens(tokens)}</span>
          <span className="usage-stat-label">tokens used</span>
        </div>
        <div className="usage-stat">
          <span className="usage-stat-value" title={Number.isFinite(nextReset) ? `Resets ${formatUntil(nextReset)}` : undefined}>{Number.isFinite(nextReset) ? shortUntil(nextReset) : '—'}</span>
          <span className="usage-stat-label">until reset</span>
        </div>
      </div>

      <div className="settings-group">
        <span className="settings-group-title">Models</span>
        <ul className="settings-card usage-list">
          {rows.map(({ id, u, blocked, left, isFreeOR }) => (
            <li key={id} className="usage-row">
              <div className="usage-row-head">
                <span className="usage-model">
                  <span className="model-title">{modelLabel(catalog, id)}</span>
                  {Object.hasOwn(EXTRA_PROVIDERS, id.split(':')[0]) && <span className="usage-provider">{PROVIDER_NAMES[providerOfId(id)]}</span>}
                </span>
                <Status until={blocked} />
              </div>
              <div className="model-sub">
                {u?.requests || 0} request{u?.requests === 1 ? '' : 's'}
                {u && u.input + u.output > 0 && ` · ${formatTokens(u.input)} in / ${formatTokens(u.output)} out tokens`}
                {left !== null && !isFreeOR && (blocked ? ` · daily limit ${u?.quota}` : ` · ${left} left today`)}
                {left === null && !isFreeOR && (blocked ? '' : Object.hasOwn(EXTRA_PROVIDERS, id.split(':')[0]) ? ' · allowance depends on your plan' : ' · daily limit not known yet')}
                {isFreeOR && ' · uses the shared OpenRouter pool'}
              </div>
              {u?.quota && !isFreeOR && <Bar used={u.requests} limit={u.quota} />}
            </li>
          ))}
        </ul>
      </div>

      <div className="settings-group">
        <span className="settings-group-title">Shared allowances</span>
        {hasOpenRouter && view.openrouter.limit && (
          <div className="settings-card usage-card usage-pool">
            <div className="usage-card-head">
              <span className="setting-text">
                <span className="setting-label">OpenRouter free models</span>
                <span className="setting-hint">All free OpenRouter models share this daily pool</span>
              </span>
              <span className="usage-reset-note">{view.openrouter.used} of {view.openrouter.limit} today</span>
            </div>
            <Bar used={view.openrouter.used} limit={view.openrouter.limit} />
          </div>
        )}
        <FirebaseCard />
      </div>

      <p className="muted small usage-foot">
        {resets.map(([name, at]) => `${name} limits reset ${formatUntil(at)}.`).join(' ')} Limits appear when a provider reports them; unknown allowances are shown without a bar.
      </p>
    </div>
  );
}
