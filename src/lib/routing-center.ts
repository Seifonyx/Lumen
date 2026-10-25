// CP04: whether the Canvas Routing Center is open, and on which section. Presentation state only (no settings,
// credentials or routing inputs); used only while CANVAS_SHELL is on. Kept apart from the component so the
// navigation can open it without loading the Routing Center itself.
import { useSyncExternalStore } from 'react';

export type RoutingSection = 'models' | 'providers' | 'policies' | 'usage' | 'diagnostics';
/** Old in-session history snapshots may still contain Overview, which is now Models.
 * Normalize at both entry and replay: a removed section never becomes a phantom page. */
const validSections = new Set<RoutingSection>(['models', 'providers', 'policies', 'usage', 'diagnostics']);
export const normalizeRoutingSection = (section: RoutingSection | 'overview' | string): RoutingSection =>
  validSections.has(section as RoutingSection) ? section as RoutingSection : 'models';
let state: { open: boolean; section: RoutingSection; provider?: string | null; settingsTarget?: { provider: string; owner: string } | null } = { open: false, section: 'models' };
const listeners = new Set<() => void>();
const set = (next: typeof state) => { state = next; listeners.forEach((fn) => fn()); };

export const openRoutingCenter = (section: RoutingSection | 'overview' = 'models') => set({ open: true, section: normalizeRoutingSection(section) });
export const closeRoutingCenter = () => { if (state.open) set({ ...state, open: false }); };
export const showRoutingSection = (section: RoutingSection | 'overview') => set({ ...state, section: normalizeRoutingSection(section), provider: null });
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const routingCenterOpen = () => state.open;
export const subscribeRoutingCenter = subscribe;
export const useRoutingCenter = () => useSyncExternalStore(subscribe, () => state);

export const getRoutingScreen = () => state;
export const restoreRoutingScreen = (next: typeof state | { open: boolean; section: 'overview'; provider?: string | null }) =>
  set({ ...next, section: normalizeRoutingSection(next.section) });
export const showRoutingProvider = (provider: string | null) => set({ ...state, provider });

export const setRoutingSettingsTarget = (settingsTarget: typeof state.settingsTarget) => set({ ...state, settingsTarget });
