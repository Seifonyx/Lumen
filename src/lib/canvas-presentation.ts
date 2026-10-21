/**
 * CP02 switch for the Canvas composer presentation (compact capsule → engaged → expanded writing sheet).
 * Off in the ordinary build: this constant folds away together with every branch it guards, so production
 * output is unchanged. Only the synthetic QA review build turns it on, by substituting
 * qa/iphone/adapters/canvas-presentation.ts (which also loads the Canvas styles). Not a runtime toggle,
 * query parameter or security boundary.
 */
export const CANVAS_COMPOSER = false;
