import { CircleCheck, Clock, OctagonAlert } from 'lucide-react';
import { FREE_LIMITS, type Op } from '../lib/quota';
import { formatTokens, formatUntil, remaining, type UsageView } from '../lib/usage';
import { modelLabel, useStore } from '../store';

function Bar({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
  return (
    <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} aria-label={`${used} of ${limit} used`}>
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
    <div className="usage-card firebase-card">
      <div className="usage-card-head">
        <span className="setting-label">Firebase free plan (sync)</span>
        <span className="muted small">resets {formatUntil(fb.resetAt)}</span>
      </div>
      {OPS.map(([op, label]) => (
        <div key={op} className="fb-row">
          <span className="small">{label}</span>
          <span className="muted small">
            {fb.used[op].toLocaleString()} / {FREE_LIMITS[op].toLocaleString()}
          </span>
          <Bar used={fb.used[op]} limit={FREE_LIMITS[op]} />
        </div>
      ))}
      <span className={`setting-hint${fb.level === 'normal' ? '' : ' warn'}`}>{status} Shared by everyone invited; counted by the app, so it's approximate.</span>
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

  return (
    <div className="settings-section usage">
      <div className="usage-summary">
        <div>
          <div className="usage-big">{total}</div>
          <div className="muted small">requests today</div>
        </div>
        <div className="muted small usage-resets">
          Google limits reset {formatUntil(view.geminiResetAt)}
          {hasOpenRouter && (
            <>
              <br />
              OpenRouter limits reset {formatUntil(view.openrouter.resetAt)}
            </>
          )}
          {(catalog?.providers.groq || catalog?.providers.cerebras) && (
            <>
              <br />
              {[catalog?.providers.groq && 'Groq', catalog?.providers.cerebras && 'Cerebras'].filter(Boolean).join(' and ')} limits reset {formatUntil(view.openrouter.resetAt)}
            </>
          )}
        </div>
      </div>

      {hasOpenRouter && view.openrouter.limit && (
        <div className="usage-card">
          <div className="usage-card-head">
            <span className="setting-label">OpenRouter free models</span>
            <span className="muted small">
              {view.openrouter.used} of {view.openrouter.limit} today
            </span>
          </div>
          <Bar used={view.openrouter.used} limit={view.openrouter.limit} />
          <span className="setting-hint">All free OpenRouter models share this daily allowance.</span>
        </div>
      )}

      <ul className="model-list usage-list">
        {rows.map(({ id, u, blocked, left, isFreeOR }) => (
          <li key={id} className="usage-row">
            <div className="usage-row-head">
              <span className="model-title">{modelLabel(catalog, id)}</span>
              <Status until={blocked} />
            </div>
            <div className="model-sub">
              {u?.requests || 0} request{u?.requests === 1 ? '' : 's'}
              {u && u.input + u.output > 0 && ` · ${formatTokens(u.input)} in / ${formatTokens(u.output)} out tokens`}
              {left !== null && !isFreeOR && (blocked ? ` · daily limit ${u?.quota}` : ` · ${left} left today`)}
              {left === null && !isFreeOR && (blocked ? '' : ' · daily limit not known yet')}
            </div>
            {u?.quota && !isFreeOR && <Bar used={u.requests} limit={u.quota} />}
          </li>
        ))}
      </ul>

      <FirebaseCard />

      <p className="muted small">
        Google doesn't tell apps their limits in advance, so Model Router learns each model's daily limit the first time it's reached. Models at their
        limit are skipped automatically until they reset. Counts are shared across your devices.
      </p>
    </div>
  );
}
