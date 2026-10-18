import { isUnavailableFailure } from './model-status.js';
// Shared recovery decisions. Callers own the authorized, currently eligible queue,
// consume the actual attempt/deadline budget, and remember metadata invalidations.
const TRANSIENT = new Set(['network', 'timeout', 'provider', 'empty', 'stream-interrupted', 'malformed']);
const TERMINAL = new Set(['cancelled', 'invalid-input', 'request-error', 'unknown']);
const NO_HEALTH_PENALTY = new Set(['cancelled', 'invalid-input', 'request-error', 'unknown', 'authentication', 'authorization', 'billing', 'rate-limit', 'quota', 'context', 'capability', 'parameters', 'request-rejected','output-limit']);

function retryDelay(input, limit) {
  const ms = input.retryAfterMs ?? (Number.isFinite(limit?.retryAfterSec) ? limit.retryAfterSec * 1000 : 0);
  return Number.isFinite(ms) && ms > 0 ? Math.min(ms, 86400_000) : 0;
}

function quotaScope(input, text) {
  const explicit = input.quotaScope || input.limit?.targetScope || input.limit?.scope;
  if (explicit === 'model') return 'model';
  if (['provider', 'account', 'project', 'organization'].includes(explicit)) return 'provider';
  // A Gemini PerProjectPerModel limit is model-specific, even though it names a project.
  if (/per.?model|for (?:the )?model\b|model\s*[`:'"]/i.test(text)) return 'model';
  if (input.provider === 'openrouter' && /free.?models?.per.day/i.test(text)) return 'provider';
  if (/(?:account|organi[sz]ation|project|billing).*(?:quota|rate|limit)|(?:quota|rate|limit).*(?:account|organi[sz]ation|project|billing)/i.test(text)) return 'provider';
  return 'model'; // An unknown temporal window does not prove an account-wide restriction.
}

/** Classify transport, adapter, validation, and provider failures without choosing models. */
export function classifyFailure(input = {}) {
  const error = input.error;
  const status = input.status ?? error?.status;
  const code = String(input.code ?? input.providerCode ?? error?.code ?? error?.type ?? '');
  const message = String(input.message ?? error?.message ?? (typeof error === 'string' ? error : ''));
  const name = error?.name || input.name;
  const provider = input.provider || input.id?.split(':')[0];
  const limit = input.limit ?? error?.limit;
  const text = `${code} ${message}`;
  const make = (kind, scope = 'model', extra = {}) => ({
    kind, scope, status, code, message, provider, id: input.id, limit,
    retryable: TRANSIENT.has(kind), healthPenalty: !NO_HEALTH_PENALTY.has(kind),
    refreshMetadata: ['model-unavailable', 'context', 'capability'].includes(kind),
    retryAfterMs: retryDelay(input, limit), ...extra,
  });

  if (name === 'AbortError' || status === 'cancelled' || status === 'aborted') return make('cancelled', 'request');
  if (input.phase === 'validation' || /^(?:invalid_input|invalid_attachment|invalid_video_uri)$/i.test(code) || /Invalid YouTube video link|Invalid attachment data/i.test(message)) return make('invalid-input', 'request');
  if (name === 'TimeoutError' || status === 'timeout' || status === 408 || status === 504) return make('timeout');
  if (code === 'incomplete_stream') return make('stream-interrupted');
  if (status === 'output-limit') return make('output-limit');
  if (code === 'malformed_stream' || name === 'SyntaxError' || status === 'malformed') return make('malformed');
  if (status === 'context' || /context[_ .-]*(?:length|window)|maximum context|input token count(?:\s*\([^)]*\))?\s*exceeds|too many (?:input )?tokens|prompt (?:is )?too long|input (?:is )?too long/i.test(text)) return make('context');
  if (status === 'capabilities' || /unsupported modalit|does not support (?:image|audio|video|pdf|tools?)(?:\b|_)|(?:image|audio|video|pdf|tools?)\b.*(?:not supported|unsupported)|(?:not support|unsupported).*\b(?:image|audio|video|pdf|tools?)\b/i.test(text)) return make('capability');
  if(isUnavailableFailure(status,message))return make('model-unavailable');
  if ([400, 403, 404, 410].includes(status) && /model|no endpoints/i.test(text) && /not (?:found|available|accessible)|does not exist|do(?:es)? not have access|permission denied|no endpoints|retired|decommissioned|no longer (?:available|supported)|requires? (?:a )?paid/i.test(text)) return make('model-unavailable');
  if (status === 401) return make('authentication', 'provider');
  if (status === 403) return make('authorization', 'provider');
  if (status === 402 || /insufficient_(?:credits|balance)|credit_balance_too_low|billing_hard_limit_reached/i.test(code)) return make('billing', 'provider');
  if (status === 429 || /rate_limit_exceeded|quota_exceeded|resource_exhausted/i.test(code)) {
    const scope = quotaScope({ ...input, provider, limit }, text);
    const kind = limit?.scope === 'day' || /exhaust|quota|daily|per.?day/i.test(text) ? 'quota' : 'rate-limit';
    return make(kind, scope, { retryable: scope === 'model' && kind === 'rate-limit' });
  }
  if (status === 400 && /unsupported|unrecognized|unknown|not supported/i.test(text) && /parameter|thinking|include.?thoughts|generation.?config|response_format/i.test(text)) return make('parameters');
  if (status === 422 || /invalid_request_error|invalid_argument/i.test(code) || /messages must (?:be|contain)|malformed (?:request|json)|invalid (?:json|request body)/i.test(message)) return make('invalid-input', 'request');
  if (status >= 500) return make('provider', 'provider');
  if (status === 'network' || status === 0 || /Failed to fetch|network (?:error|request failed)|connection failed|load failed/i.test(message)) return make('network');
  if (status === 'empty') return make('empty');
  if (status === 'blocked') return make('blocked');
  if (status === 400) return make('request-rejected'); // Provider-specific 400s can still have an eligible backup.
  if (status >= 400 && status < 500) return make('request-error', 'request');
  return make('unknown', 'request');
}

/**
 * canFallback means at least one authorized, eligible candidate remains; this
 * function never widens that queue. metadataRefreshed is caller-owned per scope.
 * Same-model retries require separate explicit opt-in and are capped at one.
 */
export function recoveryDecision(failure, {
  remainingAttempts = 0, remainingMs = 0, canFallback = false,
  visibleOutput = false, toolEffects = 'none', metadataRefreshed = false,
  allowSameModelRetry = false, retryCount = 0, random = Math.random,
} = {}) {
  const skipProvider = failure.scope === 'provider' && ['authentication', 'authorization', 'billing', 'rate-limit', 'quota'].includes(failure.kind);
  const result = (action, reason, delayMs = 0) => ({
    action, reason, skipProvider, delayMs,
    penalizeHealth: failure.healthPenalty,
    invalidateMetadata: action !== 'stop' && failure.refreshMetadata && !metadataRefreshed,
  });
  if (failure.kind === 'cancelled') return result('stop', 'cancelled');
  if (visibleOutput) return result('stop', 'partial-output');
  if (toolEffects !== 'none') return result('stop', 'tool-effects');
  if (TERMINAL.has(failure.kind)) return result('stop', 'terminal');
  if (!(remainingAttempts > 0) || !(remainingMs > 0)) return result('stop', 'budget');
  if (allowSameModelRetry && failure.retryable && !skipProvider && Number.isInteger(retryCount) && retryCount === 0) {
    const sample = random();
    const jitter = Number.isFinite(sample) ? Math.max(0, Math.min(1, sample)) : 0.5;
    const delayMs = Math.max(failure.retryAfterMs || 0, 250 * (0.75 + jitter * 0.5));
    if (delayMs < remainingMs) return result('retry-model', 'transient', delayMs);
  }
  return canFallback ? result('next-model', 'eligible-fallback') : result('stop', 'no-authorized-fallback');
}
