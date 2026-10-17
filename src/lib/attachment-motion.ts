import { useLayoutEffect, useRef, type RefObject } from 'react';
import { motionOff } from './motion';

/** Local FLIP: scroll positions don't count as chip movement; interrupted motion starts where it is. */
export function useAttachmentMotion(tray: RefObject<HTMLElement | null>, order: string, scope: string) {
  const positions = useRef(new Map<string, { x: number; y: number }>());
  const runs = useRef(new Map<string, Animation>());
  const heightRun = useRef<Animation | null>(null);
  const height = useRef(0);
  const lastScope = useRef(scope);
  useLayoutEffect(() => {
    const root = tray.current;
    if (!root) return;
    if (lastScope.current !== scope) {
      runs.current.forEach(a => a.cancel()); runs.current.clear();
      heightRun.current?.cancel(); positions.current.clear(); height.current = 0;
      lastScope.current = scope;
    }
    const off = motionOff();
    const oldHeight = heightRun.current?.playState === 'running' ? root.offsetHeight : height.current;
    heightRun.current?.cancel();
    const nextHeight = root.offsetHeight;
    if (!off && oldHeight !== nextHeight) {
      heightRun.current = root.animate([{ height: `${oldHeight}px` }, { height: `${nextHeight}px` }], { duration: 240, easing: 'cubic-bezier(.16,1,.3,1)' });
      heightRun.current.id = 'attachment-tray';
    }
    height.current = nextHeight;
    const next = new Map<string, { x: number; y: number }>();
    root.querySelectorAll<HTMLElement>('.attachment:not(.exit-ghost)').forEach(el => {
      const key = el.dataset.attachmentKey!;
      const was = positions.current.get(key);
      const current = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform);
      runs.current.get(key)?.cancel();
      const now = { x: el.offsetLeft, y: el.offsetTop };
      next.set(key, now);
      if (off) return;
      const dx = was ? was.x + current.m41 - now.x : 0;
      const dy = was ? was.y + current.m42 - now.y : 6;
      if (was && Math.abs(dx) < 1 && Math.abs(dy) < 1 && current.a === 1) return;
      const animation = el.animate(was
        ? [{ transform: `translate(${dx}px,${dy}px) scale(${current.a},${current.d})` }, { transform: 'none' }]
        : [{ opacity: .4, transform: 'translateY(6px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.16,1,.3,1)' });
      animation.id = was ? 'attachment-reflow' : 'attachment-enter';
      runs.current.set(key, animation);
    });
    for (const [key, run] of runs.current) if (!next.has(key)) { run.cancel(); runs.current.delete(key); }
    positions.current = next;
  }, [tray, order, scope]);
  useLayoutEffect(() => () => { runs.current.forEach(a => a.cancel()); heightRun.current?.cancel(); }, []);
}
