// Swipe a chat row sideways, like Mail: left uncovers Delete (a long swipe deletes straight away), right pins or
// unpins. The row follows the finger, keeps its speed when you let go, and you feel a tap when a swipe passes
// the point where it will act. One row is open at a time; touching anywhere else closes it.
import { haptic } from './haptics';
import { rubberBand, springTo, Velocity, type Motion } from './spring';

const REVEAL = 88; // width of the Delete button
const PIN_AT = 72; // swipe right this far (or flick) to pin
const PROJECT_MS = 160;

export function installSwipeRows(list: HTMLElement, { onDelete, onPin }: { onDelete: (id: string, row: HTMLElement) => void; onPin: (id: string) => void }) {
  let drag: { row: HTMLElement; face: HTMLElement; id: string; x: number; y: number; base: number; claimed: boolean; armed: boolean; tid: number } | null = null;
  let open: { row: HTMLElement; face: HTMLElement } | null = null;
  const anims = new Map<HTMLElement, Motion>();
  let swiped = 0;
  const speed = new Velocity();
  const set = (row: HTMLElement, face: HTMLElement, x: number) => {
    face.style.transform = Math.abs(x) > 0.01 ? `translateX(${x}px)` : '';
    row.dataset.swipe = x < 0 ? 'end' : x > 0 ? 'start' : '';
    const w = row.offsetWidth;
    row.style.setProperty('--swipe', String(Math.min(1, Math.abs(x) / (x < 0 ? Math.max(REVEAL, w * 0.6) : PIN_AT))));
  };
  const settle = (row: HTMLElement, face: HTMLElement, from: number, to: number, v: number, done?: () => void) => {
    anims.get(row)?.stop();
    set(row, face, from || to);
    anims.set(row, springTo(from, to, v, (x) => [[face, { transform: Math.abs(x) > 0.01 ? `translateX(${x}px)` : 'translateX(0)' }]], () => { anims.delete(row); set(row, face, to); done?.(); }, { stiffness: 520, damping: 44 }));
  };
  const current = (face: HTMLElement) => new DOMMatrixReadOnly(getComputedStyle(face).transform === 'none' ? undefined : getComputedStyle(face).transform).m41;
  const closeOpen = (except?: HTMLElement) => {
    if (!open || open.row === except) return;
    const { row, face } = open;
    open = null;
    settle(row, face, current(face), 0, 0);
  };

  const start = (e: TouchEvent) => {
    const face = (e.target as Element).closest<HTMLElement>('.swipe-face');
    const row = face?.closest<HTMLElement>('[data-flip]');
    if (!face || !row || e.touches.length !== 1 || (e.target as Element).closest('input')) { closeOpen(); return; }
    closeOpen(row);
    const t = e.touches[0];
    // A row that's still moving is caught where it is.
    const moving = anims.get(row);
    if (moving) { set(row, face, moving.stop()); anims.delete(row); }
    drag = { row, face, id: row.dataset.flip!, x: t.clientX, y: t.clientY, base: current(face), claimed: false, armed: false, tid: t.identifier };
    speed.reset(); speed.add(t.clientX);
  };
  const move = (e: TouchEvent) => {
    if (!drag) return;
    const t = [...e.touches].find((x) => x.identifier === drag!.tid);
    if (!t) return;
    const dx = t.clientX - drag.x, dy = t.clientY - drag.y;
    if (!drag.claimed) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      drag.claimed = true;
      drag.row.classList.add('swiping');
    }
    speed.add(t.clientX);
    const w = drag.row.offsetWidth;
    let x = drag.base + dx;
    if (x > PIN_AT) x = PIN_AT + rubberBand(x - PIN_AT, w);
    if (x < -w) x = -w;
    set(drag.row, drag.face, x);
    // A tap you can feel when the swipe passes the point where letting go acts.
    const armed = x > PIN_AT - 2 || x < -w * 0.6;
    if (armed !== drag.armed) { drag.armed = armed; drag.row.classList.toggle('armed', armed); if (armed) haptic('light'); }
  };
  const end = (e: TouchEvent) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.claimed) swiped = performance.now();
    d.row.classList.remove('swiping', 'armed');
    if (!d.claimed) {
      // A tap on a row that's open closes it instead of opening the chat.
      if (open?.row === d.row) { if (e.cancelable) e.preventDefault(); closeOpen(); }
      return;
    }
    if (e.cancelable) e.preventDefault();
    const x = current(d.face), v = speed.get(), w = d.row.offsetWidth;
    const projected = x + v * PROJECT_MS;
    if (x < -w * 0.6 || (x < -REVEAL && v < -1.2)) {
      // Long swipe left: delete now.
      open = null;
      haptic('medium');
      settle(d.row, d.face, x, -w, Math.min(v, -1), () => onDelete(d.id, d.row));
    } else if (x > PIN_AT - 2 || (x > 24 && v > 0.6)) {
      haptic('light');
      settle(d.row, d.face, x, 0, v, () => onPin(d.id));
    } else if (projected < -REVEAL / 2) {
      open = { row: d.row, face: d.face };
      settle(d.row, d.face, x, -REVEAL, v);
    } else {
      if (open?.row === d.row) open = null;
      settle(d.row, d.face, x, 0, v);
    }
  };
  // Swallow the click that a swipe's lift would make.
  const click = (e: MouseEvent) => {
    if (performance.now() - swiped < 400 && (e.target as Element).closest('.swipe-face')) { e.preventDefault(); e.stopPropagation(); }
  };
  list.addEventListener('touchstart', start, { passive: true });
  list.addEventListener('touchmove', move, { passive: true });
  list.addEventListener('touchend', end);
  list.addEventListener('touchcancel', end);
  list.addEventListener('click', click, true);
  return () => {
    anims.forEach((a) => a.stop());
    list.removeEventListener('touchstart', start);
    list.removeEventListener('touchmove', move);
    list.removeEventListener('touchend', end);
    list.removeEventListener('touchcancel', end);
    list.removeEventListener('click', click, true);
  };
}
