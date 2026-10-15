// Springs for gestures: a released sheet or drawer keeps the speed of your finger and settles naturally,
// can be caught again mid-flight, and resists (rubber-bands) when pulled past its end.

/** Recent finger samples → velocity in px/ms (average over the last ~80 ms, so one jittery event doesn't count). */
export class Velocity {
  private s: { t: number; v: number }[] = [];
  add(value: number, t = performance.now()) {
    this.s.push({ t, v: value });
    while (this.s.length > 2 && t - this.s[0].t > 80) this.s.shift();
  }
  get(t = performance.now()) {
    if (this.s.length < 2 || t - this.s[this.s.length - 1].t > 100) return 0;
    const a = this.s[0], b = this.s[this.s.length - 1];
    return (b.v - a.v) / Math.max(1, b.t - a.t);
  }
  reset() { this.s = []; }
}

/** Past an end, movement is resisted more the further you pull (like iOS). `dimension` is the element size. */
export const rubberBand = (overshoot: number, dimension: number, c = 0.55) =>
  Math.sign(overshoot) * (1 - 1 / ((Math.abs(overshoot) * c) / dimension + 1)) * dimension;

export type SpringOptions = { stiffness?: number; damping?: number; mass?: number; restDelta?: number; restSpeed?: number };

/**
 * Animates a value from `from` to `to`, starting at `velocity` (px/ms), calling `onUpdate` each frame.
 * Returns a handle: `stop()` freezes it where it is (for catching it mid-flight) and `value()` reads it.
 */
export function spring(from: number, to: number, velocity: number, onUpdate: (v: number) => void, onDone?: () => void, opts: SpringOptions = {}) {
  const { stiffness = 420, damping = 40, mass = 1, restDelta = 0.4, restSpeed = 0.02 } = opts;
  let x = from, v = velocity * 1000; // px/s
  let last = performance.now(), frame = 0, running = true;
  const step = (now: number) => {
    if (!running) return;
    let dt = Math.min(0.032, (now - last) / 1000);
    last = now;
    // Small fixed steps keep a stiff spring stable on slow frames.
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240);
      const force = -stiffness * (x - to) - damping * v;
      v += (force / mass) * h;
      x += v * h;
      dt -= h;
    }
    if (Math.abs(x - to) < restDelta && Math.abs(v) / 1000 < restSpeed) {
      running = false;
      onUpdate(to);
      onDone?.();
      return;
    }
    onUpdate(x);
    frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return {
    stop() { running = false; cancelAnimationFrame(frame); return x; },
    value: () => x,
    velocity: () => v / 1000,
    get running() { return running; },
  };
}
export type Spring = ReturnType<typeof spring>;

// ---- Springs that run on the graphics thread.
// A spring above is stepped in JavaScript every frame, so anything else the page does (or a phone in low
// power mode, which slows those frames to 30 a second) makes it stutter. Here the whole motion, starting at
// the finger's speed, is worked out up front and handed to the browser as a CSS linear() easing curve: the
// browser then animates transform and opacity on its own thread at the screen's full rate. It can still be
// caught mid-flight: stop() reads where the curve is at that moment and holds it there.

const linearOk = typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', 'linear(0, 1)');
type Frames = (v: number) => [HTMLElement | null | undefined, Keyframe][];

/** The spring's path from 0 to 1 (with a starting speed in "whole distances per ms"), sampled for linear(). */
function curve(v0: number, span: number, { stiffness = 420, damping = 40, mass = 1, restDelta = 0.5 }: SpringOptions) {
  // At rest once within half a pixel (or 0.1% for tiny values) and barely moving.
  const near = Math.max(0.001, restDelta / Math.abs(span));
  const dt = 1 / 240;
  let x = 0, v = v0 * 1000, t = 0;
  const xs = [0];
  while (t < 3) {
    const force = -stiffness * (x - 1) - damping * v;
    v += (force / mass) * dt; x += v * dt; t += dt;
    xs.push(x);
    if (Math.abs(x - 1) < near && Math.abs(v) < near * 10) break;
  }
  xs[xs.length - 1] = 1;
  return { xs, ms: t * 1000, dt: dt * 1000 };
}

/**
 * Animates from `from` to `to` (velocity in px/ms, like spring()), painting each element with the keyframe
 * `frames(value)` gives it. Transform and opacity run on the compositor. Returns stop() (freezes it where it
 * is and returns that value), value() and running, like spring().
 */
export function springTo(from: number, to: number, velocity: number, frames: Frames, onDone?: () => void, opts: SpringOptions = {}) {
  const apply = (v: number) => frames(v).forEach(([el, kf]) => { if (el) Object.assign(el.style, kf); });
  const span = to - from;
  if (!linearOk || Math.abs(span) < 0.5) {
    if (Math.abs(span) < 0.5) { apply(to); onDone?.(); return { stop: () => to, value: () => to, get running() { return false; } }; }
    // Older browsers: the frame-by-frame spring.
    const s = spring(from, to, velocity, apply, onDone, opts);
    return { stop: () => { const v = s.stop(); apply(v); return v; }, value: () => s.value(), get running() { return s.running; } };
  }
  const c = curve(velocity / span, span, opts);
  // Up to ~80 points is plenty for a smooth curve.
  const step = Math.max(1, Math.ceil(c.xs.length / 80));
  const points: string[] = [];
  for (let i = 0; i < c.xs.length; i += step) points.push(`${+c.xs[i].toFixed(4)} ${+((i / (c.xs.length - 1)) * 100).toFixed(2)}%`);
  points.push('1 100%');
  const easing = `linear(${points.join(', ')})`;
  const start = performance.now();
  const a = frames(from), b = frames(to);
  apply(to);
  const runs = a.flatMap(([el, kf], i) => (el ? [el.animate([kf, b[i][1]], { duration: c.ms, easing })] : []));
  let running = true;
  const at = () => {
    const i = Math.min(c.xs.length - 1, Math.round((performance.now() - start) / c.dt));
    return from + span * c.xs[i];
  };
  const done = () => { if (!running) return; running = false; runs.forEach((r) => r.cancel()); onDone?.(); };
  const timer = window.setTimeout(done, c.ms + 20);
  return {
    stop() {
      if (!running) return to;
      const v = at();
      running = false;
      clearTimeout(timer);
      apply(v);
      runs.forEach((r) => r.cancel());
      return v;
    },
    value: () => (running ? at() : to),
    get running() { return running; },
  };
}
export type Motion = ReturnType<typeof springTo>;
