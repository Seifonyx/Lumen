// Canvas presentation metadata, carried by the existing opaque screen-history snapshots.
// No independent navigation state, credentials, persistence or network.
import { AI_PROVIDERS } from './ai/provider-config.js';
import { getRoutingScreen, setRoutingSettingsTarget, useRoutingCenter } from './routing-center';
export function requestProviderSettings(provider: string, owner: string | undefined): boolean {
  const target = owner && AI_PROVIDERS.includes(provider) ? { provider, owner } : null;
  setRoutingSettingsTarget(target);
  return Boolean(target);
}
export function getProviderSettingsTarget(owner: string | undefined): string | null {
  const target = getRoutingScreen().settingsTarget;
  return target && target.owner === owner ? target.provider : null;
}

export const clearProviderSettingsTarget = () => setRoutingSettingsTarget(null);

export function useProviderSettingsTarget(owner: string | undefined): string | null {
  const { settingsTarget } = useRoutingCenter();
  return settingsTarget && settingsTarget.owner === owner ? settingsTarget.provider : null;
}
