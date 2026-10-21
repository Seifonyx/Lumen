// Synthetic QA build only: replaces src/lib/canvas-presentation.ts (vite.qa.config.ts) so the review shows the
// CP02 Canvas composer and writing sheet. Loads the Canvas tokens and composer styles; the ordinary build never
// reaches either stylesheet.
import '../../../src/styles/canvas.css';
import '../../../src/styles/canvas-composer.css';

export const CANVAS_COMPOSER = true;
