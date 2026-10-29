/**
 * Switches for the Canvas presentation. Off in the ordinary build: each constant folds away together with every
 * branch it guards, so its output is unchanged. Builds turn them on by resolving this module to
 * canvas-presentation.on.ts (which also loads the Canvas styles): production with LUMEN_CANVAS=1 (vite.config.ts,
 * set by the Deploy workflow) and the synthetic QA review build. Not runtime toggles, query parameters or security
 * boundaries.
 *   CANVAS_COMPOSER — CP02: compact capsule → engaged → expanded writing sheet.
 *   CANVAS_SHELL    — CP03: unified Projects/conversations navigation, header breadcrumb and reading layout.
 *   RoutingCenter   — CP04: the lazily loaded Canvas Routing Center (src/components/RoutingCenter.tsx). The loader
 *                     lives only in the "on" module, so the ordinary build has no import of it at all.
 *   BrandWordmark,  — the Lumen identity (Crease, approved 2026-10-23; src/components/BrandCrease.tsx): the
 *   BrandMark         integrated wordmark and the standalone mark. Null here, so the ordinary build imports no artwork.
 *   CanvasNav       — Phase 2 navigation (src/components/CanvasNav.tsx): Back closes pages shown in place of the chat,
 *                     focus returns to where it came from, and the collapsed sidebar becomes a rail.
 *   newGeneralChat  — Phase 2 slice 2: the global New chat (src/lib/new-chat.ts), always outside projects. Null here,
 *                     so shared callers (⌘⇧O, the command palette) keep the ordinary newChat.
 *   loadTreeKeys    — Phase 2 slice 2: loads the Canvas tree's arrow keys (src/lib/tree-keys.ts). The loader lives only
 *                     in the "on" module, so the ordinary build emits no chunk for it.
 */
import type { ComponentType } from 'react';
export type BrandArtProps = { height: number; decorative?: boolean; className?: string };
export const CANVAS_COMPOSER = false;
export const CANVAS_SHELL = false;
export const RoutingCenter: ComponentType | null = null;
export const BrandWordmark: ComponentType<BrandArtProps> | null = null;
export const BrandMark: ComponentType<BrandArtProps> | null = null;
export const CanvasNav: ComponentType<{ collapsed: boolean; onExpand: () => void }> | null = null;
export const loadTreeKeys: (() => Promise<typeof import('./tree-keys')>) | null = null;
export const newGeneralChat: (() => void) | null = null;

export const PhoneNavigation: import('react').ComponentType<import('../components/PhoneNavigation').PhoneNavigationProps> | null = null;
export const navigateBack: typeof import('./screen-history').screenBack | null = null;
export const exitFeature: typeof import('./screen-history').exitFeature | null = null;
export const featureExitLabel: typeof import('./screen-history').featureExitLabel | null = null;
export const useScreenMemory: typeof import('./screen-memory').useScreenMemory | null = null;
export const CanvasFilterMenu: typeof import('../components/FilterMenu').default | null = null;
export const useScreenBackLayer: typeof import('./back-stack').useBackLayer | null = null;
export const CanvasLibraryActions: typeof import('../components/CanvasLibraryActions').default | null = null;
export const CanvasCollectionPage: typeof import('../components/CanvasCollectionPage').default | null = null;
export const CanvasToolsWorkspace: typeof import('../components/ToolsWorkspace').default | null = null;
export const navigateScreen: typeof import('./screen-history').navigateScreen | null = null;
export const CanvasScreenActions: typeof import('../components/ScreenActions').default | null = null;

export const replaceScreen: typeof import('./screen-history').replaceScreen | null = null;
export const finishScreen: typeof import('./screen-history').finishScreen | null = null;

export const forgetScreenMemory: typeof import('./screen-memory').forgetScreenMemory | null = null;

export const CanvasPhoneSections: typeof import('../components/PhoneSections').default | null = null;

export const useProviderSettingsTarget: typeof import('./provider-settings-target').useProviderSettingsTarget | null = null;

export const clearProviderSettingsTarget: typeof import('./provider-settings-target').clearProviderSettingsTarget | null = null;
