// Canvas presentation: Router owns API keys, models and routing, layouts and usage. A request for one of those
// Settings sections, from anywhere, opens the matching Router place instead, in one history step, so Back never
// lands on a Settings page that would only redirect again. Installed by CanvasNav with screen history (Canvas only).
import { navigateScreen, replaceScreen } from './screen-history';
import { getRoutingScreen, openRoutingCenter, setRoutingSettingsTarget, showRoutingProvider, type RoutingSection } from './routing-center';
import { registerSettingsRoute } from '../store';
import { AI_PROVIDERS } from './ai/provider-config.js';

const ROUTER_TABS: Record<string, RoutingSection> = { keys: 'providers', models: 'routing', layouts: 'policies', usage: 'usage' };

export const installRouterSettingsRoute = () => registerSettingsRoute((patch, state) => {
  const tab = patch.settingsTab ?? (patch.settingsOpen ? state.settingsTab : undefined);
  const section = tab ? ROUTER_TABS[tab] : undefined;
  if (!section || !(patch.settingsOpen === true || state.settingsOpen || getRoutingScreen().open)) return false;
  const routing = getRoutingScreen();
  const linked = section === 'providers' && routing.settingsTarget?.owner === state.user?.uid ? routing.settingsTarget?.provider : null;
  // A first visit with no provider key starts on Google AI Studio, whose free key is enough to begin.
  const noKeys = !AI_PROVIDERS.some((id) => { const value = state.keys[id as keyof typeof state.keys]; return typeof value === 'string' && value.trim(); });
  const provider = linked || (section === 'providers' && noKeys ? 'gemini' : null);
  // Re-routing a Settings section that is already showing (it opened before this hook was installed) replaces that
  // history entry instead of adding one, so Back never returns to a section that would only redirect again.
  const already = state.settingsOpen && patch.settingsOpen === undefined && patch.settingsTab === state.settingsTab;
  (already ? replaceScreen : navigateScreen)(() => {
    openRoutingCenter(section);
    if (provider) showRoutingProvider(provider);
    setRoutingSettingsTarget(null);
    const { settingsOpen: _open, settingsTab: _tab, ...rest } = patch;
    state.setUi({ ...rest, settingsOpen: false, settingsTab: '', page: null, sidebarOpen: false });
  });
  return true;
});
