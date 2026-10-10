import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles.css';
import App from './App';
import './design.css';
import { initViewport } from './lib/viewport';

// iPhone: keep the app on the visible area while the keyboard is open.
initViewport();

// No zooming on phones: iOS ignores user-scalable=no, so pinch gestures are stopped here too.
const noZoom = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', noZoom);
document.addEventListener('gesturechange', noZoom);
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
