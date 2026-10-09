import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './styles.css';
import App from './App';

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
