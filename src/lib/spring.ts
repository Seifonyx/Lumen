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
