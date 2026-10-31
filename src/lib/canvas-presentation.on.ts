// The Canvas presentation, on. Builds select this module in place of canvas-presentation.ts: production when
// LUMEN_CANVAS=1 (vite.config.ts), and the synthetic QA review build always (vite.qa.config.ts, through its adapter),
// so both run the same switch. Loads the Canvas tokens and styles; the Routing Center stays a lazy chunk; the
// Lumen identity's brand components (Crease) ship with it.
import '../styles/canvas.css';
import '../styles/canvas-composer.css';
import '../styles/canvas-shell.css';
import '../styles/canvas-reading.css';
import '../styles/canvas-screens.css';
import '../styles/brand-crease.css';
import { lazy } from 'react';

export const CANVAS_COMPOSER = true;
export const CANVAS_SHELL = true;
const loadRoutingCenter = () => import('../components/RoutingCenter');
const loadCollection = () => import('../components/CanvasCollectionPage');
const loadToolsWorkspace = () => import('../components/ToolsWorkspace');
const loadSettingsIndex = () => import('../components/SettingsIndex');
export const RoutingCenter = lazy(loadRoutingCenter);
export type { BrandArtProps } from './canvas-presentation';
export { BrandMark, BrandWordmark } from '../components/BrandCrease';
export { default as CanvasNav } from '../components/CanvasNav';
export const loadTreeKeys = () => import('./tree-keys');
export { newGeneralChat } from './new-chat';

export const PhoneNavigation = lazy(() => import('../components/PhoneNavigation'));
export { screenBack as navigateBack } from './screen-history';
export { exitFeature, featureExitLabel } from './screen-history';
export { useScreenMemory } from './screen-memory';
export const CanvasFilterMenu = lazy(() => import('../components/FilterMenu'));
export { useBackLayer as useScreenBackLayer } from './back-stack';
export const CanvasLibraryActions = lazy(() => import('../components/CanvasLibraryActions'));
export const CanvasCollectionPage = lazy(loadCollection);
export const CanvasToolsWorkspace = lazy(loadToolsWorkspace);
export const CanvasSettingsIndex = lazy(loadSettingsIndex);
// The sidebar's places load their code on intent (pointer over or focus on the place, the phone drawer opening), so
// a tap shows the page at once. Not at start-up idle: evaluating these chunks can stall a streaming reply.
const placeLoads = { library: [loadCollection, () => import('../components/CollectionPage')], tools: [loadToolsWorkspace, () => import('../components/ToolsPage')], router: [loadRoutingCenter], settings: [loadSettingsIndex] } as const;
const requested = new Set<string>();
export const prefetchPlace = (place: keyof typeof placeLoads) => {
  if (requested.has(place)) return;
  requested.add(place);
  for (const load of placeLoads[place]) void load().catch(() => requested.delete(place));
};
export { navigateScreen } from './screen-history';
export const CanvasScreenActions = lazy(() => import('../components/ScreenActions'));

export { replaceScreen, finishScreen } from './screen-history';

export { forgetScreenMemory } from './screen-memory';

export const CanvasPhoneSections = lazy(() => import('../components/PhoneSections'));

export { useProviderSettingsTarget, clearProviderSettingsTarget } from './provider-settings-target';
