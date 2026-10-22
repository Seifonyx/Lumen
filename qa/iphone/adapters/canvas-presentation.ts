// Synthetic QA build only: replaces src/lib/canvas-presentation.ts (vite.qa.config.ts) so the review shows the
// Canvas presentation (CP02 composer and writing sheet, CP03 navigation, header and reading). Loads the Canvas
// tokens and styles; the ordinary build never reaches these stylesheets.
import '../../../src/styles/canvas.css';
import '../../../src/styles/canvas-composer.css';
import '../../../src/styles/canvas-shell.css';

export const CANVAS_COMPOSER = true;
export const CANVAS_SHELL = true;
