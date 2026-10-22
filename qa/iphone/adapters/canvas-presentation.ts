// Synthetic QA build only: replaces src/lib/canvas-presentation.ts (vite.qa.config.ts) with the same "on" module that
// production builds with LUMEN_CANVAS=1, so the review shows exactly the presentation production ships.
export * from '../../../src/lib/canvas-presentation.on';
