import { CircleCheck, Clock, OctagonAlert } from 'lucide-react';
import { FREE_LIMITS, type Op } from '../lib/quota';
import { formatTokens, formatUntil, type UsageView } from '../lib/usage';
import { usageEvidence } from '../lib/usage-presentation';
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
      <span className="status">
        <CircleCheck size={14} /> No block recorded
      </span>
    );
  }
  const soon = until - Date.now() < 10 * 60_000;
  return (
    <span className={`status ${soon ? 'wait' : 'blocked'}`}>
      {soon ? <Clock size={14} /> : <OctagonAlert size={14} />} Temporarily blocked · retry {formatUntil(until)}
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

export default function UsageTab({ context = 'settings' }: { context?: 'settings' | 'prism' }) {
  const view = useStore((s) => s.usage) as UsageView | null;
  const catalog = useStore((s) => s.catalog);
  const enabled = useStore((s) => s.settings.enabledModels);
  const hasOpenRouter = Boolean(catalog?.providers.openrouter);

  if (!view) return <div className={`settings-section usage${context === 'prism' ? ' usage-prism' : ''}`}><div className={context === 'prism' ? 'rc-card' : 'settings-card usage-card'} role="status"><strong>App counters unavailable</strong><p className="muted rc-muted">Daily request and token activity appears after this account's usage record loads. No zero balance is assumed.</p></div><FirebaseCard /></div>;

  const evidence = usageEvidence(view, enabled);
  const rows = evidence.rows;

  return (
    <div className={`settings-section usage${context === 'prism' ? ' usage-prism' : ''}`}>
      <div data-evidence-source="app-counters"><h3>Recorded by Lumen today</h3><p className="muted rc-muted">Synced app counters for this account. They are activity records, not provider billing or proof of connection.</p></div>
      <div className="usage-stats">
        <div className="usage-stat usage-stat-main">
          <span className="usage-big">{evidence.requests}</span>
          <span className="usage-stat-label">requests recorded</span>
        </div>
        <div className="usage-stat">
          <span className="usage-stat-value">{formatTokens(evidence.tokens || 0)}</span>
          <span className="usage-stat-label">tokens recorded</span>
        </div>
        <div className="usage-stat">
          <span className="usage-stat-value">{evidence.blocked}</span>
          <span className="usage-stat-label">temporary blocks</span>
        </div>
        <div className="usage-stat">
          <span className="usage-stat-value" title={evidence.knownResetAt ? `Recorded reset ${formatUntil(evidence.knownResetAt)}` : undefined}>{evidence.knownResetAt ? shortUntil(evidence.knownResetAt) : 'Unknown'}</span>
          <span className="usage-stat-label">next known reset</span>
        </div>
      </div>

      <details className="settings-group usage-model-disclosure rc-provenance" open={context !== 'prism'}>
        <summary><span>Per-model activity</span><small>{rows.length} {rows.length === 1 ? 'model' : 'models'} recorded or enabled</small></summary>
        <ul className="settings-card usage-list">
          {rows.map(({ id, usage: u, blockedUntil, remaining: left }) => {
            const isFreeOR = id.startsWith('openrouter:') && id.endsWith(':free');
            return (
            <li key={id} className="usage-row">
              <div className="usage-row-head">
                <span className="usage-model">
                  <span className="model-title">{modelLabel(catalog, id)}</span>
                  {Object.hasOwn(EXTRA_PROVIDERS, id.split(':')[0]) && <span className="usage-provider">{PROVIDER_NAMES[providerOfId(id)]}</span>}
                </span>
                <Status until={blockedUntil} />
              </div>
              <div className="model-sub">
                {u?.requests || 0} request{u?.requests === 1 ? '' : 's'}
                {u && u.input + u.output > 0 && ` · ${formatTokens(u.input)} in / ${formatTokens(u.output)} out tokens`}
                {left !== null && !isFreeOR && (blockedUntil ? ` · recorded daily allowance ${u?.quota}` : ` · ${left} of ${u?.quota} recorded allowance left`)}
                {left === null && !isFreeOR && ' · provider allowance unknown'}
                {isFreeOR && ' · uses the shared OpenRouter pool'}
              </div>
              {u?.quota && !isFreeOR && <Bar used={u.requests} limit={u.quota} />}
            </li>);
          })}
        </ul>
      </details>

      <div className="settings-group">
        <span className="settings-group-title">Known shared limits</span>
        {hasOpenRouter && view.openrouter.limit && (
          <div className="settings-card usage-card usage-pool">
            <div className="usage-card-head">
              <span className="setting-text">
                <span className="setting-label">OpenRouter free models</span>
                <span className="setting-hint">Provider-reported daily pool shared by free OpenRouter models</span>
              </span>
              <span className="usage-reset-note">{view.openrouter.used} of {view.openrouter.limit} today</span>
            </div>
            <Bar used={view.openrouter.used} limit={view.openrouter.limit} />
          </div>
        )}
        <FirebaseCard />
      </div>

      <p className="muted small usage-foot">Limits and reset times appear only when Lumen has provider evidence for them. Unknown allowances stay unknown and have no progress bar.</p>
    </div>
  );
}
