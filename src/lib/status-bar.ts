// iPhone Home Screen app: the status bar above Lumen. With apple-mobile-web-app-status-bar-style `default`, iOS 26 draws
// an opaque bar and colours it from the page itself (a full-width fixed layer at the top, otherwise the page
// background), not from theme-color, and only takes the colour again when such a layer appears or disappears at the
// top. At launch it kept a colour that wasn't the page's until the drawer's scrim came and went (the owner's "launch
// band", 2026-11-05 recordings: gone once the drawer opened; #126's theme-color change could not reach it).
//
// This does what the drawer does, without being seen: a thin fixed strip in the colour already at the top of the screen
// appears for a moment and goes again, so iOS takes that colour. With no layer there iOS falls back to the page
// background, so that is kept the colour of the screen on show too (Router and Settings are a grouped grey in Light,
// the chat white). It runs once Lumen's own first frame is on screen, when the screen or the theme (in Lumen or on the
// iPhone) changes and when the page comes back from the back-forward cache, and shows the strip only when the colour
// changed. Canvas only (CanvasNav loads this with Lumen's first frame), and only in an iPhone Home Screen app: in a Safari tab,
// Safari colours its own bars.
// (iPhone and Home Screen are checked here as in device.ts, without importing it: sharing that module with this lazy
// one would split it out of the start-up bundle into a file of its own.)
const homeScreenIPhone = () => (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
  && (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

const HOLD_MS = 600; // long enough for iOS to see the layer (and outlast the theme switch), short enough to go unnoticed
let strip: HTMLDivElement | null = null, timer = 0, synced = '';

const opaque = (color: string) => {
  if (!color || color === 'transparent') return false;
  const parts = color.match(/[\d.]+/g) || [];
  const alpha = color.includes('/') ? Number(color.split('/').pop()!.replace(/[^\d.]/g, '')) : parts.length > 3 ? Number(parts[3]) : 1;
  return alpha >= 0.99;
};

/** The colour on screen 4 px below the top, at the centre (where iOS looks): the first opaque background there. */
export function topColor(): string {
  for (const el of document.elementsFromPoint(innerWidth / 2, 4)) {
    if (el === strip || el === document.body || el === document.documentElement) continue;
    const color = getComputedStyle(el).backgroundColor;
    if (opaque(color)) return color;
  }
  return getComputedStyle(document.body).backgroundColor;
}

/** Shows the strip for a moment so iOS takes the status bar's colour from the page again. */
function resample(color: string) {
  if (!strip) {
    strip = document.createElement('div');
    strip.className = 'status-bar-sample';
    strip.setAttribute('aria-hidden', 'true');
  }
  window.clearTimeout(timer);
  const show = () => { strip!.style.backgroundColor = color; document.body.append(strip!); timer = window.setTimeout(() => strip?.remove(), HOLD_MS); };
  // iOS reacts to the layer appearing, not to its colour changing: one still showing goes for a frame first.
  if (strip.isConnected) { strip.remove(); requestAnimationFrame(show); } else show();
}

/** Keeps the page background the colour at the top of the screen on show, and has iOS take it when it changed. */
export function syncStatusBar() {
  const body = document.body.style;
  body.removeProperty('background-color'); // (the stylesheet's own, for this theme; no paint in between)
  const color = topColor(), page = getComputedStyle(document.body).backgroundColor;
  if (color !== page) body.backgroundColor = color;
  if (color !== synced) { synced = color; resample(color); }
}

let queued = 0;
const afterPaint = () => { if (!queued) queued = requestAnimationFrame(() => { queued = requestAnimationFrame(() => { queued = 0; syncStatusBar(); }); }); };

// Screens (the chat, Router, Settings, Library, …) are the app's own children: one appearing, going or being hidden is
// when the colour at the top can change, including a screen whose code arrives a moment after it was chosen.
let watched: Element | null = null;
const screens = new MutationObserver(afterPaint);
const watchApp = () => {
  const app = document.querySelector('#root > .app');
  if (app === watched) return;
  screens.disconnect(); watched = app;
  if (app) screens.observe(app, { childList: true, attributes: true, attributeFilter: ['hidden'], subtree: false });
};

/** Starts once Lumen's own first frame is mounted (CanvasNav); returns how to stop (signing out unmounts it). */
export function installStatusBarSampling(): () => void {
  if (!homeScreenIPhone()) return () => {};
  synced = '';
  afterPaint(); watchApp();
  // (The app's container is replaced on signing in and out.)
  const root = new MutationObserver(() => { watchApp(); afterPaint(); });
  const rootEl = document.getElementById('root');
  if (rootEl) root.observe(rootEl, { childList: true });
  const media = matchMedia('(prefers-color-scheme: dark)');
  const restored = (event: PageTransitionEvent) => { if (event.persisted) { synced = ''; afterPaint(); } };
  window.addEventListener('lumen:appearance', afterPaint);
  media.addEventListener?.('change', afterPaint);
  window.addEventListener('pageshow', restored);
  return () => {
    root.disconnect(); screens.disconnect(); watched = null;
    window.removeEventListener('lumen:appearance', afterPaint);
    media.removeEventListener?.('change', afterPaint);
    window.removeEventListener('pageshow', restored);
  };
}
