// CP04: whether the Canvas Routing Center is open, and on which section. Presentation state only (no settings,
// credentials or routing inputs); used only while CANVAS_SHELL is on. Kept apart from the component so the
// navigation can open it without loading the Routing Center itself.
import { useSyncExternalStore } from 'react';

export type RoutingSection = 'overview' | 'providers' | 'models' | 'policies' | 'usage' | 'diagnostics';
let state: { open: boolean; section: RoutingSection } = { open: false, section: 'overview' };
const listeners = new Set<() => void>();
const set = (next: typeof state) => { state = next; listeners.forEach((fn) => fn()); };

export const openRoutingCenter = (section: RoutingSection = 'overview') => set({ open: true, section });
export const closeRoutingCenter = () => { if (state.open) set({ ...state, open: false }); };
export const showRoutingSection = (section: RoutingSection) => set({ ...state, section });
export const useRoutingCenter = () => useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => state);
