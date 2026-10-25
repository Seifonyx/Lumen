// Presentation of canonical connection/discovery facts, never inference health or a new provider policy.
import type { Catalog } from '../types';
type Discovery = NonNullable<Catalog['providerStatus']>[string];
export function providerPresentation({ keySaved, enabled, status, modelCount }: { keySaved: boolean; enabled: boolean; status?: Discovery; modelCount: number }) {
  const setupLabel = !keySaved ? 'No key saved' : enabled ? 'Enabled' : 'Permission off';
  const catalogLabel = status?.state === 'ready' ? 'Catalog ready' : status?.state === 'stale' ? 'Cached catalog' : status?.state === 'error' ? 'Discovery failed' : 'Not checked';
  const failures = {
    auth: 'The provider refused this connection. Update the saved key in connection settings, then refresh the model list.',
    network: 'The network could not reach this provider. Check your connection and try again; cached models may remain visible.',
    timeout: 'This provider did not answer in time. Try again when the connection is stable.',
    'rate-limit': 'The provider limited catalog requests. Wait before refreshing again; this does not establish an inference allowance.',
    provider: 'The provider could not list its models. Try again later or review its service status.',
    invalid: 'The model list could not be read. Review this provider’s connection settings, then try again.',
  };
  const guidance = !keySaved ? 'Save a provider key in connection settings to discover its models.'
    : !enabled ? 'A key is saved, but this provider is not enabled. Review its permission in connection settings.'
    : status?.errorKind ? failures[status.errorKind]
    : status?.state === 'ready' ? modelCount ? 'Model discovery completed. Choosing a model still follows your saved permissions.' : 'Discovery completed, but no compatible models were listed.'
    : status?.state === 'stale' ? 'A cached model list is available. Refresh the model list to update it.'
    : status?.state === 'error' ? 'Listing did not complete. Refresh the model list or review its settings.'
    : 'No model list yet. Refresh the model list to request it.';
  const auth = status?.errorKind === 'auth';
  const verdict = !keySaved ? 'No key saved' : !enabled ? 'Permission off' : auth ? 'Key needs attention'
    : status?.state === 'ready' ? modelCount ? 'Catalog ready' : 'No compatible models'
    : status?.state === 'stale' ? 'Cached catalog' : status?.state === 'error' ? 'Discovery failed' : 'Not checked';
  const nextStep = !keySaved ? 'Add a key' : !enabled ? 'Enable provider' : auth ? 'Review key'
    : status?.state === 'ready' && modelCount ? 'View models' : 'Refresh model list';
  const attention = Boolean(keySaved && enabled && (status?.state !== 'ready' || !modelCount));
  const light: 'on' | 'stale' | 'fail' | 'off' = !keySaved || !enabled ? 'off' : auth || status?.state === 'error' ? 'fail'
    : status?.state === 'stale' ? 'stale' : status?.state === 'ready' && modelCount ? 'on' : 'off';
  return { setupLabel, catalogLabel, guidance, verdict, nextStep, light, replyLabel: 'Not tested by model listing', attention,
    tone: keySaved && enabled && !attention ? 'ready' : attention ? 'attention' : 'neutral' };
}
