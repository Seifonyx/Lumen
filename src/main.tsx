import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles.css';
import App from './App';
import './design.css';
import './feature-surfaces.css';
import './workspace.css';
import './layout.css';
import './identity.css';
import { initViewport } from './lib/viewport';

// iPhone: keep the app on the visible area while the keyboard is open.
initViewport();

// No zooming on phones: pinch is blocked here for iPhone (Safari's gesture events) and by
// `touch-action: pan-x pan-y` elsewhere (styles.css), which also stops double-tap zoom; fields use 16px+
// text so iPhones don't zoom in on focus. Not done in the viewport tag, which zoom tools rely on.
const noZoom = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', noZoom);
document.addEventListener('gesturechange', noZoom);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
