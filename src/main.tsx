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

// Swipe from the left edge to open the chats sidebar.
let touchStartX = 0;
let touchStartY = 0;
let isTrackingEdgeSwipe = false;
const EDGE_WIDTH = 32;
const THRESHOLD = 50;

document.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  isTrackingEdgeSwipe = touchStartX <= EDGE_WIDTH;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (!isTrackingEdgeSwipe || e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = Math.abs(t.clientY - touchStartY);

  if (dx > THRESHOLD && dy < 50) {
    isTrackingEdgeSwipe = false;
    window.dispatchEvent(new CustomEvent('model-router:swipe-edge'));
  }
}, { passive: true });

document.addEventListener('touchend', () => {
  isTrackingEdgeSwipe = false;
}, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
