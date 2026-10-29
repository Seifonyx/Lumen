// Canvas presentation: Router owns API keys, models and routing, layouts and usage. A request for one of those
// Settings sections, from anywhere, opens the matching Router place instead, in one history step, so Back never
// lands on a Settings page that would only redirect again. Installed by CanvasNav with screen history (Canvas only).
import { navigateScreen } from './screen-history';
import { getRoutingScreen, openRoutingCenter, setRoutingSettingsTarget, showRoutingProvider, type RoutingSection } from './routing-center';
import { registerSettingsRoute } from '../store';

const ROUTER_TABS: Record<string, RoutingSection> = { keys: 'providers', models: 'routing', layouts: 'policies', usage: 'usage' };

export const installRouterSettingsRoute = () => registerSettingsRoute((patch, state) => {
  const tab = patch.settingsTab ?? (patch.settingsOpen ? state.settingsTab : undefined);
  const section = tab ? ROUTER_TABS[tab] : undefined;
  if (!section || !(patch.settingsOpen === true || state.settingsOpen || getRoutingScreen().open)) return false;
  const routing = getRoutingScreen();
  const provider = section === 'providers' && routing.settingsTarget?.owner === state.user?.uid ? routing.settingsTarget?.provider : null;
  navigateScreen(() => {
    openRoutingCenter(section);
    if (provider) showRoutingProvider(provider);
    setRoutingSettingsTarget(null);
    const { settingsOpen: _open, settingsTab: _tab, ...rest } = patch;
    state.setUi({ ...rest, settingsOpen: false, settingsTab: '', page: null, sidebarOpen: false });
  });
  return true;
});
