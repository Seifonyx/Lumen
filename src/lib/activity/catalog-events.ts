// Turns a model-list refresh into journal events: a failure (once, until it recovers or someone retries) and a recovery.
// A refresh that finds a healthy provider again stays silent, so the log never fills with routine ticks.
import type { Catalog, ModelInfo } from '../../types';
import { record } from './journal';

type Status = NonNullable<Catalog['providerStatus']>[string];
const WORDS: Record<NonNullable<Status['errorKind']>, string> = { auth: 'The provider refused the key', 'rate-limit': 'The provider is limiting requests', timeout: 'The provider didn’t answer in time', network: 'Couldn’t reach the provider', provider: 'The provider had a problem listing its models', invalid: 'The provider’s answer couldn’t be read' };
const ownerOf = (m: ModelInfo) => m.id.split(':')[0];

export function logCatalogChanges(before: Catalog['providerStatus'], after: Catalog['providerStatus'], models: ModelInfo[], requested: boolean) {
  for (const [provider, next] of Object.entries(after || {})) {
    const prev = before?.[provider];
    if (prev && prev.lastAttempt === next.lastAttempt) continue;
    if (next.state === 'error') {
      if (prev?.state === 'error' && !requested) continue;
      record({ category: 'provider', level: 'error', provider, title: 'Model list couldn’t refresh', detail: WORDS[next.errorKind || 'provider'] });
    } else if (prev?.state === 'error') {
      const n = models.filter((m) => ownerOf(m) === provider || (provider === 'gemini' && m.provider === 'google')).length;
      record({ category: 'provider', level: 'success', provider, title: 'Provider working again', detail: `${n} ${n === 1 ? 'model' : 'models'} listed${next.state === 'stale' ? ' (cached)' : ''}` });
    }
  }
}
