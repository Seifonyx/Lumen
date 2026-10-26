import { remaining, type ModelUsage, type UsageView } from './usage';

export type UsageEvidenceRow = {
  id: string;
  usage: ModelUsage | null;
  status: 'temporarily-blocked' | 'no-block-recorded';
  allowance: 'known' | 'unknown';
  remaining: number | null;
  blockedUntil: number | null;
};

export type UsageEvidence = {
  available: boolean;
  requests: number | null;
  tokens: number | null;
  blocked: number;
  rows: UsageEvidenceRow[];
  knownResetAt: number | null;
};

/** Pure presentation adapter. It adds no inference beyond evidence already held by UsageView. */
export function usageEvidence(view: UsageView | null, modelIds: string[], now = Date.now()): UsageEvidence {
  if (!view) return { available: false, requests: null, tokens: null, blocked: 0, rows: [], knownResetAt: null };
  const ids = [...new Set([...modelIds, ...Object.keys(view.models).filter((id) => view.models[id].requests > 0)])];
  const rows = ids.map((id): UsageEvidenceRow => {
    const usage = view.models[id] || null;
    const sharedOpenRouterBlock = id.startsWith('openrouter:') && id.endsWith(':free') && view.openrouter.limit !== null && view.openrouter.used >= view.openrouter.limit
      ? view.openrouter.resetAt : null;
    const blockedUntil = usage?.blockedUntil && usage.blockedUntil > now ? usage.blockedUntil : sharedOpenRouterBlock;
    return {
      id,
      usage,
      status: blockedUntil ? 'temporarily-blocked' : 'no-block-recorded',
      allowance: usage?.quota !== null && usage?.quota !== undefined ? 'known' : 'unknown',
      remaining: remaining(view, id),
      blockedUntil,
    };
  }).sort((a, b) => Number(Boolean(b.blockedUntil)) - Number(Boolean(a.blockedUntil)) || (b.usage?.requests || 0) - (a.usage?.requests || 0));
  const usages = Object.values(view.models);
  const resetCandidates = [
    ...rows.flatMap((row) => row.blockedUntil ? [row.blockedUntil] : []),
    ...(view.openrouter.limit !== null ? [view.openrouter.resetAt] : []),
    ...(usages.some((usage) => usage.id.startsWith('gemini:') && usage.quota !== null) ? [view.geminiResetAt] : []),
  ].filter((at) => at > now);
  return {
    available: true,
    requests: usages.reduce((sum, usage) => sum + usage.requests, 0),
    tokens: usages.reduce((sum, usage) => sum + usage.input + usage.output, 0),
    blocked: rows.filter((row) => row.blockedUntil).length,
    rows,
    knownResetAt: resetCandidates.length ? Math.min(...resetCandidates) : null,
  };
}
