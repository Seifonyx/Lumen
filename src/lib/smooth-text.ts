// A reply that arrives in bursts (some providers and networks send several seconds of text at once) is shown
// flowing in at a steady pace instead of jumping, as in ChatGPT and Claude. The pace follows the stream: it
// measures how often new text arrives and reveals what's waiting so that it runs out about when the next
// piece is due. Text is revealed up to the end of a word, so words never appear half-written.
import { useEffect, useRef, useState } from 'react';
import { motionOff } from './motion';

const STEP_MS = 80;          // how often the shown text grows (about 12 times a second)
const BURSTY_MS = 250;       // text arriving further apart than this is paced; closer together it already flows
const MIN_RATE = 0.03;       // never slower than ~30 characters a second
const CATCH_UP_MS = 900;     // a big backlog is shown within about this long, so the reply never lags far behind

/** The part of `text` to show now. While `streaming`, it trails the received text smoothly; afterwards it
 *  finishes revealing quickly and then equals `text`. */
export function useSmoothText(text: string, streaming: boolean): string {
  const [shown, setShown] = useState(() => (streaming ? 0 : text.length));
  const st = useRef({ shown: streaming ? 0 : text.length, arrivals: [] as number[], prev: text.length, timer: 0, last: 0, every: STEP_MS });
  const live = useRef({ text, streaming });
  live.current = { text, streaming };

  useEffect(() => {
    const s = st.current;
    if (text.length > s.prev) {
      s.arrivals.push(performance.now());
      if (s.arrivals.length > 8) s.arrivals.shift();
    }
    s.prev = text.length;
    if (text.length < s.shown) { s.shown = text.length; setShown(s.shown); } // edited or restarted
    // Only bursty streams are paced: when text already arrives often, showing it as it comes is smooth and cheapest.
    const a = s.arrivals, gaps = a.slice(1).map((x, i) => x - a[i]);
    const bursty = gaps.length > 0 && gaps.reduce((x, y) => x + y, 0) / gaps.length > BURSTY_MS;
    if (motionOff() || (gaps.length > 0 && !bursty && !s.timer)) { s.shown = text.length; setShown(s.shown); return; }
    if (s.shown >= text.length || s.timer) return;
    s.last = performance.now();
    const step = () => {
      const now = performance.now(), dt = now - s.last;
      s.last = now;
      // A step that ran late means the phone is busy: take fewer, bigger steps; ease back when it's idle.
      s.every = dt > s.every + 40 ? Math.min(400, s.every * 1.6) : Math.max(STEP_MS, s.every * 0.9);
      const { text: t, streaming: on } = live.current;
      const backlog = t.length - s.shown;
      if (backlog <= 0) { s.timer = 0; return; }
      // The usual gap between pieces of text, from the last few arrivals.
      const a = s.arrivals, gaps = a.slice(1).map((x, i) => x - a[i]);
      const gap = gaps.length ? Math.min(2500, Math.max(60, gaps.reduce((x, y) => x + y, 0) / gaps.length)) : 300;
      const rate = Math.max(MIN_RATE, backlog / (on ? Math.min(gap, CATCH_UP_MS) : 250));
      let next = Math.min(t.length, s.shown + Math.max(1, Math.round(rate * dt)));
      // Finish the word being revealed (but don't wait for one that hasn't arrived yet).
      const space = t.slice(next).search(/\s/);
      if (space >= 0 && space < 14) next += space;
      else if (space < 0 && on) next = Math.max(s.shown, next);
      else if (space < 0) next = t.length;
      s.shown = next;
      setShown(next);
      s.timer = s.shown < t.length ? window.setTimeout(step, s.every) : 0;
    };
    s.timer = window.setTimeout(step, 0);
  }, [text, streaming]);

  useEffect(() => () => { clearTimeout(st.current.timer); }, []);
  return shown >= text.length ? text : text.slice(0, shown);
}
