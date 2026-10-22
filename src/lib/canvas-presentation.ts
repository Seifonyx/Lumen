/**
 * Switches for the Canvas presentation. Off in the ordinary build: each constant folds away together with every
 * branch it guards, so production output is unchanged. Only the synthetic QA review build turns them on, by
 * substituting qa/iphone/adapters/canvas-presentation.ts (which also loads the Canvas styles). Not runtime
 * toggles, query parameters or security boundaries.
 *   CANVAS_COMPOSER — CP02: compact capsule → engaged → expanded writing sheet.
 *   CANVAS_SHELL    — CP03: unified Projects/conversations navigation, header breadcrumb and reading layout.
 *   RoutingCenter   — CP04: the lazily loaded Canvas Routing Center (src/components/RoutingCenter.tsx). The loader
 *                     lives only in the QA replacement, so the ordinary build has no import of it at all.
 */
import type { ComponentType } from 'react';
export const CANVAS_COMPOSER = false;
export const CANVAS_SHELL = false;
export const RoutingCenter: ComponentType | null = null;
