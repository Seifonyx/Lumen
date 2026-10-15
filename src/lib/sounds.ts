// An optional soft sound when you send (Settings → General → Sound when sending; off by default). Made on
// the fly with Web Audio (no file to download). On iPhone it's an "ambient" sound: it respects the silent
// switch and doesn't pause music that's playing.
import { useStore } from '../store';

let ctx: AudioContext | null = null;

export function playSend() {
  if (!useStore.getState().settings.sendSound) return;
  try {
    const session = (navigator as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    // A quick rising "pop": two soft sine tones with a short fade.
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.07, t + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    out.connect(ctx.destination);
    for (const [f0, f1] of [[540, 880], [1080, 1320]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
      const g = ctx.createGain();
      g.gain.value = f0 > 1000 ? 0.25 : 1;
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 0.18);
    }
  } catch { /* no audio here */ }
}
