import { useLayoutEffect, useRef, type RefObject } from 'react';
import { motionOff } from './motion';

const easing = 'cubic-bezier(.16,1,.3,1)';
/** A file preview expands from its actual card and returns to its current location. */
export function usePreviewMotion(panel: RefObject<HTMLElement | null>, origin: HTMLElement | null | undefined, onClose: () => void) {
  const animations = useRef<Animation[]>([]);
  const closing = useRef(false);
  const mounted = useRef(false);
  const target = () => {
    const el = panel.current;
    const source = origin?.isConnected ? origin.getBoundingClientRect() : null;
    if (!el || !source || source.width < 2 || source.height < 2 || source.bottom <= 0 || source.top >= innerHeight || source.right <= 0 || source.left >= innerWidth) return null;
    const box = el.getBoundingClientRect();
    // Read the resting layout, independent of an interrupted transform.
    const width = el.offsetWidth, height = el.offsetHeight;
    const parent = el.parentElement?.getBoundingClientRect();
    const cx = parent ? parent.left + el.offsetLeft + width / 2 : box.left + box.width / 2;
    const cy = parent ? parent.top + el.offsetTop + height / 2 : box.top + box.height / 2;
    return `translate(${source.left + source.width / 2 - cx}px, ${source.top + source.height / 2 - cy}px) scale(${source.width / width}, ${source.height / height})`;
  };
  const cancel = () => { animations.current.forEach(a => a.cancel()); animations.current = []; };
  useLayoutEffect(() => {
    mounted.current = true;
    closing.current = false;
    const el = panel.current;
    if (origin && el && !motionOff()) {
      const from = target();
      const animation = el.animate([{ transform: from || 'scale(.98)', opacity: .4 }, { transform: 'none', opacity: 1 }], { duration: from ? 340 : 180, easing });
      animation.id = 'preview-expand';
      animations.current.push(animation);
    }
    return () => { mounted.current = false; cancel(); };
  }, [panel, origin]); // eslint-disable-line react-hooks/exhaustive-deps

  return () => {
    if (closing.current) return;
    const el = panel.current;
    if (!origin || !el || motionOff()) { onClose(); return; }
    closing.current = true;
    const current = getComputedStyle(el);
    const from = { transform: current.transform, opacity: current.opacity };
    const to = target();
    cancel();
    const animation = el.animate([from, { transform: to || 'scale(.98)', opacity: 0 }], { duration: to ? 240 : 160, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    animation.id = 'preview-return';
    animations.current.push(animation);
    const backdrop = el.parentElement;
    if (backdrop) animations.current.push(backdrop.animate([{ opacity: getComputedStyle(backdrop).opacity }, { opacity: 0 }], { duration: to ? 240 : 160, fill: 'forwards' }));
    animation.finished.then(() => { if (mounted.current) onClose(); }).catch(() => {});
  };
}
