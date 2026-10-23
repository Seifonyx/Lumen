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
 */
import type { ComponentType } from 'react';
export type BrandArtProps = { height: number; decorative?: boolean; className?: string };
export const CANVAS_COMPOSER = false;
export const CANVAS_SHELL = false;
export const RoutingCenter: ComponentType | null = null;
export const BrandWordmark: ComponentType<BrandArtProps> | null = null;
export const BrandMark: ComponentType<BrandArtProps> | null = null;
