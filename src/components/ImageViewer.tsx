// Full-screen photo viewer, like the Photos app: the picture grows out of the one you tapped, pinch or
// double-tap to zoom, drag to look around when zoomed, and swipe it down (or up) to put it back, with the
// background fading as you go. Tap once to hide or show the buttons. Opened from anywhere with openImage().
import { Download, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusScope } from '../lib/focus-scope';
import { haptic } from '../lib/haptics';
import { motionOff } from '../lib/motion';
import { rubberBand, springTo, Velocity, type Motion } from '../lib/spring';
import { saveBlob } from '../lib/util';

export type ImageRequest = { src: string; alt: string; name?: string; from?: HTMLElement | null };
export const openImage = (detail: ImageRequest) => window.dispatchEvent(new CustomEvent('mr:image', { detail }));

/** Scale, offset, and how much of the thumbnail's crop is still applied (1 = cropped like the thumbnail). */
type View = { s: number; x: number; y: number; k?: number };
const MAX = 4;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Mounted once (App): shows the viewer when openImage() is called. */
export function ImageViewerHost() {
  const [req, setReq] = useState<ImageRequest | null>(null);
  useEffect(() => {
    const open = (e: Event) => setReq((e as CustomEvent<ImageRequest>).detail);
    window.addEventListener('mr:image', open);
    return () => window.removeEventListener('mr:image', open);
  }, []);
  return req ? <ImageViewer key={req.src} req={req} onClose={() => setReq(null)} /> : null;
}

function ImageViewer({ req, onClose }: { req: ImageRequest; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [chrome, setChrome] = useState(true);
  const view = useRef<View>({ s: 1, x: 0, y: 0 });
  const anim = useRef<Motion | null>(null);
  const closing = useRef(false);
  const close = useRef<() => void>(() => {});
  useFocusScope(root, true, () => close.current());

  const crop = useRef({ x: 0, y: 0 });
  // Transform and opacity are separate from the crop so the browser can move the picture on its graphics thread.
  const frames = (v: View, fade: number): [HTMLElement | null, Keyframe][] => {
    const k = v.k || 0;
    return [
      [img.current, { transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})` }],
      [img.current, { clipPath: k > 0.001 ? `inset(${crop.current.y * k}% ${crop.current.x * k}% round ${12 * k / v.s}px)` : 'inset(0% 0% round 0px)' }],
      [bg.current, { opacity: String(fade) }],
    ];
  };
  const paint = (v: View, fade = 1) => {
    view.current = v;
    frames(v, fade).forEach(([el, kf]) => { if (el) Object.assign(el.style, kf); });
  };
  /** Where the picture you tapped is, as a view of the fitted image (for growing out of it and back). */
  const originView = (f: NonNullable<typeof fit>): View | null => {
    const o = req.from?.isConnected ? req.from.getBoundingClientRect() : null;
    if (!o || o.width < 2 || o.bottom < 0 || o.top > window.innerHeight) return null;
    const s = Math.max(o.width / f.width, o.height / f.height);
    // The thumbnail shows the middle of the picture: crop to that, and open it out as it grows.
    crop.current = { x: ((1 - Math.min(1, o.width / (f.width * s))) / 2) * 100, y: ((1 - Math.min(1, o.height / (f.height * s))) / 2) * 100 };
    return { s, x: o.left + o.width / 2 - (f.left + f.width / 2), y: o.top + o.height / 2 - (f.top + f.height / 2), k: 1 };
  };
  const stopAnim = () => {
    if (!anim.current) return;
    const t = anim.current.stop();
    anim.current = null;
    paint(along.current(t), fadeAt.current(t));
  };
  // The running animation's path, to read where it is when caught.
  const along = useRef<(t: number) => View>(() => ({ s: 1, x: 0, y: 0 }));
  const fadeAt = useRef<(t: number) => number>(() => 1);
  const animate = (to: View, { fadeTo = 1, velocity = 0, done }: { fadeTo?: number; velocity?: number; done?: () => void } = {}) => {
    stopAnim();
    const from = { ...view.current }, fade0 = Number(bg.current?.style.opacity || 1);
    if (motionOff()) { paint(to, fadeTo); done?.(); return; }
    along.current = (t) => ({ s: lerp(from.s, to.s, t), x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t), k: lerp(from.k || 0, to.k || 0, Math.min(1, Math.max(0, t))) });
    fadeAt.current = (t) => lerp(fade0, fadeTo, Math.min(1, t));
    view.current = to;
    anim.current = springTo(0, 1, velocity, (t) => frames(along.current(t), fadeAt.current(t)), () => { anim.current = null; paint(to, fadeTo); done?.(); }, { stiffness: 300, damping: 30 });
  };
  close.current = () => {
    if (closing.current || !fit) { if (!fit) onClose(); return; }
    closing.current = true;
    setChrome(false);
    const back = originView(fit);
    if (back) animate(back, { fadeTo: 0, done: onClose });
    else animate({ s: view.current.s * 0.9, x: view.current.x, y: view.current.y + (view.current.y >= 0 ? 1 : -1) * window.innerHeight * 0.6 }, { fadeTo: 0, done: onClose });
  };

  // Fit the picture to the screen, then grow it out of the one you tapped.
  const layout = () => {
    const el = img.current;
    const o = req.from?.getBoundingClientRect();
    const nw = el?.naturalWidth || o?.width || 1, nh = el?.naturalHeight || o?.height || 1;
    const vw = window.innerWidth, vh = window.innerHeight;
    const k = Math.min(vw / nw, vh / nh, nw < 400 ? 4 : Infinity);
    const width = nw * k, height = nh * k;
    setFit({ left: (vw - width) / 2, top: (vh - height) / 2, width, height });
  };
  useLayoutEffect(layout, []); // eslint-disable-line react-hooks/exhaustive-deps
  const opened = useRef(false);
  useLayoutEffect(() => {
    if (!fit || opened.current) return;
    opened.current = true;
    const start = originView(fit);
    if (start && !motionOff()) { paint(start, 0); animate({ s: 1, x: 0, y: 0 }); } else paint({ s: 1, x: 0, y: 0 });
  }, [fit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener('resize', layout); return () => window.removeEventListener('resize', layout); }); // eslint-disable-line react-hooks/exhaustive-deps

  // Touch: pinch, pan, double-tap, swipe away.
  useEffect(() => {
    const el = root.current;
    if (!el || !fit) return;
    const vw = () => window.innerWidth, vh = () => window.innerHeight;
    const cx = fit.left + fit.width / 2, cy = fit.top + fit.height / 2;
    const bounds = (s: number) => ({ x: Math.max(0, (fit.width * s - vw()) / 2), y: Math.max(0, (fit.height * s - vh()) / 2) });
    const clampView = (v: View): View => { const b = bounds(v.s); return { s: v.s, x: Math.max(-b.x, Math.min(b.x, v.x)), y: Math.max(-b.y, Math.min(b.y, v.y)) }; };
    let g: { mode: 'pan' | 'pinch' | 'dismiss' | null; x: number; y: number; d: number; mx: number; my: number; v: View; moved: boolean } | null = null;
    let lastTap = { t: 0, x: 0, y: 0 }, tapTimer = 0;
    const speed = new Velocity();
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) });
    const start = (e: TouchEvent) => {
      if ((e.target as Element).closest('button') || closing.current) return;
      stopAnim();
      const v = { ...view.current };
      if (e.touches.length === 2) {
        const m = mid(e.touches);
        g = { mode: 'pinch', x: 0, y: 0, d: m.d, mx: m.x, my: m.y, v, moved: true };
      } else if (e.touches.length === 1) {
        g = { mode: null, x: e.touches[0].clientX, y: e.touches[0].clientY, d: 0, mx: 0, my: 0, v, moved: false };
        speed.reset(); speed.add(e.touches[0].clientY);
      }
    };
    const move = (e: TouchEvent) => {
      if (!g) return;
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 2) {
        const m = mid(e.touches);
        if (g.mode !== 'pinch') { g = { mode: 'pinch', x: 0, y: 0, d: m.d, mx: m.x, my: m.y, v: { ...view.current }, moved: true }; return; }
        let s = g.v.s * (m.d / g.d);
        if (s < 1) s = 1 - rubberBand(1 - s, 1, 1.2); else if (s > MAX) s = MAX + rubberBand(s - MAX, MAX, 0.8);
        // The point between your fingers stays under them.
        const k = s / g.v.s;
        paint({ s, x: m.x - cx - (g.mx - cx - g.v.x) * k, y: m.y - cy - (g.my - cy - g.v.y) * k }, 1);
        return;
      }
      const t = e.touches[0], dx = t.clientX - g.x, dy = t.clientY - g.y;
      if (!g.moved && Math.hypot(dx, dy) < 6) return;
      g.moved = true;
      speed.add(t.clientY);
      if (!g.mode) g.mode = g.v.s > 1.02 ? 'pan' : Math.abs(dy) > Math.abs(dx) ? 'dismiss' : 'pan';
      if (g.mode === 'dismiss') {
        const p = Math.min(1, Math.abs(dy) / (vh() * 0.6));
        paint({ s: 1 - p * 0.25, x: dx * 0.6, y: dy }, 1 - p);
      } else if (g.mode === 'pan') {
        const b = bounds(g.v.s), x = g.v.x + dx, y = g.v.y + dy;
        const over = (val: number, lim: number) => (val > lim ? lim + rubberBand(val - lim, vw()) : val < -lim ? -lim + rubberBand(val + lim, vw()) : val);
        paint({ s: g.v.s, x: over(x, b.x), y: over(y, b.y) }, 1);
      }
    };
    const end = (e: TouchEvent) => {
      if (!g) return;
      if (e.touches.length === 1 && g.mode === 'pinch') { g = { mode: 'pan', x: e.touches[0].clientX, y: e.touches[0].clientY, d: 0, mx: 0, my: 0, v: { ...view.current }, moved: true }; return; }
      if (e.touches.length) return;
      const d = g;
      g = null;
      if (e.cancelable) e.preventDefault();
      if (!d.moved) {
        // Double tap: zoom in on that spot, or back out. Single tap: show or hide the buttons.
        const t = e.changedTouches[0], now = performance.now();
        if (now - lastTap.t < 300 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30) {
          clearTimeout(tapTimer); lastTap.t = 0;
          if (view.current.s > 1.05) animate({ s: 1, x: 0, y: 0 });
          else { const s = 2.5; animate(clampView({ s, x: -(t.clientX - cx) * (s - 1), y: -(t.clientY - cy) * (s - 1) })); }
          return;
        }
        lastTap = { t: now, x: t.clientX, y: t.clientY };
        tapTimer = window.setTimeout(() => setChrome((c) => !c), 300);
        return;
      }
      const v = speed.get();
      if (d.mode === 'dismiss') {
        const y = view.current.y;
        if (Math.abs(y + v * 160) > 140 || (Math.abs(v) > 0.6 && Math.sign(v) === Math.sign(y))) { haptic(); close.current(); }
        else animate({ s: 1, x: 0, y: 0 });
        return;
      }
      const s = Math.max(1, Math.min(MAX, view.current.s));
      animate(s <= 1.02 ? { s: 1, x: 0, y: 0 } : clampView({ ...view.current, s }));
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('touchcancel', end);
    return () => {
      clearTimeout(tapTimer);
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, [fit]);

  const download = async () => {
    try { await saveBlob(await (await fetch(req.src)).blob(), req.name || 'image.png'); } catch { /* not downloadable */ }
  };
  // Mouse: click the picture to zoom in or out, the background (or Esc) to close.
  const click = (e: React.MouseEvent) => {
    if (matchMedia('(pointer: coarse)').matches || (e.target as Element).closest('button')) return;
    if (e.target !== img.current) { close.current(); return; }
    if (!fit) return;
    if (view.current.s > 1.05) animate({ s: 1, x: 0, y: 0 });
    else { const s = 2, cx = fit.left + fit.width / 2, cy = fit.top + fit.height / 2; const b = { x: Math.max(0, (fit.width * s - innerWidth) / 2), y: Math.max(0, (fit.height * s - innerHeight) / 2) }; animate({ s, x: Math.max(-b.x, Math.min(b.x, -(e.clientX - cx) * (s - 1))), y: Math.max(-b.y, Math.min(b.y, -(e.clientY - cy) * (s - 1))) }); }
  };

  return createPortal(
    <div className={`image-viewer${chrome ? '' : ' bare'}`} ref={root} role="dialog" aria-modal="true" aria-label={req.alt || 'Image'} tabIndex={-1} onClick={click}>
      <div className="iv-backdrop" ref={bg} />
      <img ref={img} className="iv-img" src={req.src} alt={req.alt} draggable={false} onLoad={layout}
        style={fit ? { left: fit.left, top: fit.top, width: fit.width, height: fit.height } : { visibility: 'hidden' }} />
      <div className="iv-bar">
        <button type="button" className="iv-btn" aria-label="Close" onClick={() => close.current()}><X size={20} /></button>
        <button type="button" className="iv-btn" aria-label="Download" onClick={() => void download()}><Download size={19} /></button>
      </div>
    </div>,
    document.body,
  );
}
