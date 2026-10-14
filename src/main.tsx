import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './app.css';
import App from './App';
import { initViewport } from './lib/viewport';
import { loadMarkdownExtras } from './lib/markdown';
import { shareIdFromPath } from './lib/share';
const SharedChatPage = lazy(() => import('./components/SharedChatPage'));
const sharedId = shareIdFromPath();

// iPhone: keep the app on the visible area while the keyboard is open.
initViewport();

// No zooming on phones: pinch is blocked here for iPhone (Safari's gesture events) and by
// `touch-action: pan-x pan-y` elsewhere (app.css), which also stops double-tap zoom; fields use 16px+
// text so iPhones don't zoom in on focus. Not done in the viewport tag, which zoom tools rely on.
const noZoom = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', noZoom);
document.addEventListener('gesturechange', noZoom);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* A public share link shows only that chat; everything else is the app. */}
    {sharedId ? <Suspense fallback={null}><SharedChatPage id={sharedId} /></Suspense> : <App />}
  </StrictMode>,
);

// Maths and code colouring load once the app is idle, so they're ready before most replies need them.
const idle = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 5000 }) : setTimeout(fn, 2500));
window.addEventListener('load', () => idle(() => void loadMarkdownExtras()), { once: true });
