// Presentation of canonical connection/discovery facts, never inference health or a new provider policy.
import type { Catalog } from '../types';
type Discovery = NonNullable<Catalog['providerStatus']>[string];
export function providerPresentation({ keySaved, enabled, status, modelCount }: { keySaved: boolean; enabled: boolean; status?: Discovery; modelCount: number }) {
  const setupLabel = !keySaved ? 'No key saved' : enabled ? 'Enabled' : 'Permission off';
  const catalogLabel = status?.state === 'ready' ? 'Catalog ready' : status?.state === 'stale' ? 'Cached catalog' : status?.state === 'error' ? 'Discovery failed' : 'Not checked';
  const failures = {
    auth: 'The provider refused this connection. Update the saved key in connection settings, then check again.',
    network: 'The network could not reach this provider. Check your connection and try again; cached models may remain visible.',
    timeout: 'This provider did not answer in time. Try again when the connection is stable.',
    'rate-limit': 'The provider limited catalog requests. Wait before checking again; this does not establish an inference allowance.',
    provider: 'The provider could not list its models. Try again later or review its service status.',
    invalid: 'The model list could not be read. Review this provider’s connection settings, then try again.',
  };
  const guidance = !keySaved ? 'Save a provider key in connection settings to discover its models.'
    : !enabled ? 'A key is saved, but this provider is not enabled. Review its permission in connection settings.'
    : status?.errorKind ? failures[status.errorKind]
    : status?.state === 'ready' ? modelCount ? 'Model discovery completed. Choosing a model still follows your saved permissions.' : 'Discovery completed, but no compatible models were listed.'
    : status?.state === 'stale' ? 'A cached model list is available. Check the connection to refresh discovery.'
    : status?.state === 'error' ? 'Discovery did not complete. Check the connection or review its settings.'
    : 'No discovery result yet. Check the connection to request its model list.';
  return { setupLabel, catalogLabel, guidance, replyLabel: 'Not verified by discovery',
    attention: Boolean(keySaved && enabled && status && status.state !== 'ready'),
    tone: keySaved && enabled && status?.state === 'ready' ? 'ready' : keySaved && enabled && status?.state !== undefined ? 'attention' : 'neutral' };
}
