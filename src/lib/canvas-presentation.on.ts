// The Canvas presentation, on. Builds select this module in place of canvas-presentation.ts: production when
// LUMEN_CANVAS=1 (vite.config.ts), and the synthetic QA review build always (vite.qa.config.ts, through its adapter),
// so both run the same switch. Loads the Canvas tokens and styles; the Routing Center stays a lazy chunk.
import '../styles/canvas.css';
import '../styles/canvas-composer.css';
import '../styles/canvas-shell.css';
import '../styles/canvas-routing.css';
import '../styles/canvas-screens.css';
import { lazy } from 'react';

export const CANVAS_COMPOSER = true;
export const CANVAS_SHELL = true;
export const RoutingCenter = lazy(() => import('../components/RoutingCenter'));
