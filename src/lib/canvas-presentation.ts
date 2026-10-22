/**
 * Switches for the Canvas presentation. Off in the ordinary build: each constant folds away together with every
 * branch it guards, so production output is unchanged. Only the synthetic QA review build turns them on, by
 * substituting qa/iphone/adapters/canvas-presentation.ts (which also loads the Canvas styles). Not runtime
 * toggles, query parameters or security boundaries.
 *   CANVAS_COMPOSER — CP02: compact capsule → engaged → expanded writing sheet.
 *   CANVAS_SHELL    — CP03: unified Projects/conversations navigation, header breadcrumb and reading layout.
 */
export const CANVAS_COMPOSER = false;
export const CANVAS_SHELL = false;
