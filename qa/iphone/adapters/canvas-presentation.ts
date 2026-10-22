// Synthetic QA build only: replaces src/lib/canvas-presentation.ts (vite.qa.config.ts) so the review shows the
// Canvas presentation (CP02 composer and writing sheet, CP03 navigation, header and reading, CP04 Routing Center). Loads the Canvas
// tokens and styles; the ordinary build never reaches these stylesheets.
import '../../../src/styles/canvas.css';
import '../../../src/styles/canvas-composer.css';
import '../../../src/styles/canvas-shell.css';
import '../../../src/styles/canvas-routing.css';
import '../../../src/styles/canvas-screens.css';
import { lazy } from 'react';

export const CANVAS_COMPOSER = true;
export const CANVAS_SHELL = true;
export const RoutingCenter = lazy(() => import('../../../src/components/RoutingCenter'));
