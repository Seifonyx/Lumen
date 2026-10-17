// The menu a long press opens on a phone: the background dims and blurs, the item you held lifts out of it
// (a copy, so nothing underneath moves) and its actions appear right beside it, like iOS and Android.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusScope } from '../lib/focus-scope';
import { Exit, motionOff } from '../lib/motion';
import { installMenuScrub } from '../lib/menu-scrub';

export interface ContextItem {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

const MARGIN = 12;
/** Width and height without transforms, to the fraction of a pixel (text that just fits mustn't wrap). */
const exactSize = (el: HTMLElement) => {
  const s = getComputedStyle(el);
  const extra = s.boxSizing === 'border-box' ? [0, 0] : [parseFloat(s.paddingLeft) + parseFloat(s.paddingRight) + parseFloat(s.borderLeftWidth) + parseFloat(s.borderRightWidth), parseFloat(s.paddingTop) + parseFloat(s.paddingBottom) + parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth)];
  return [parseFloat(s.width) + extra[0] || el.offsetWidth, parseFloat(s.height) + extra[1] || el.offsetHeight];
};
const GAP = 8;

/** `anchor` is what lifts out; `wrap` gives the copy the classes of the container its styles depend on, and
 *  `pad` the space around it in the lifted card. */
export default function ContextMenu({ anchor, at, items, label, align = 'start', wrap = '', pad = 0, onClose }: { anchor: HTMLElement; at?: number; items: ContextItem[]; label: string; align?: 'start' | 'end'; wrap?: string; pad?: number; onClose: () => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top: number; left: number; width: number; height: number; offset: number; menuTop: number; menuLeft: number; from: number } | null>(null);
  useFocusScope(layer, true, onClose);
  useLayoutEffect(() => menu.current ? installMenuScrub(menu.current, anchor) : undefined, [anchor]);

  useLayoutEffect(() => {
    // Its unscaled box (it may still be easing back from the slight press-in).
    const b = anchor.getBoundingClientRect(), [w, h] = exactSize(anchor);
    const r = { top: b.top + (b.height - h) / 2, left: b.left + (b.width - w) / 2, width: w, height: h, right: b.left + (b.width + w) / 2 };
    const vh = window.innerHeight, vw = window.innerWidth;
    const menuH = menu.current?.offsetHeight || items.length * 46 + 12;
    const menuW = Math.min(250, vw - MARGIN * 2);
    const full = r.height + pad * 2;
    const height = Math.min(full, Math.max(80, vh * 0.42), vh - menuH - GAP - MARGIN * 3);
    // Long items show the part around where you pressed.
    const offset = Math.max(0, Math.min(full - height, (at ?? r.top) - r.top - height / 2));
    const from = r.top - pad + offset;
    const top = Math.max(MARGIN + 20, Math.min(from, vh - MARGIN - menuH - GAP - height));
    const width = Math.min(r.width + pad * 2, vw - MARGIN * 2);
    const left = Math.max(MARGIN, Math.min(r.left - pad, vw - MARGIN - width));
    const menuLeft = align === 'end' ? Math.max(MARGIN, Math.min(r.right - menuW, vw - MARGIN - menuW)) : Math.max(MARGIN, Math.min(r.left, vw - MARGIN - menuW));
    setPlace({ top, left, width, height, offset, menuTop: top + height + GAP, menuLeft, from });
  }, [anchor, at, items.length, align, pad]);

  useLayoutEffect(() => {
    const box = preview.current;
    if (!place || !box) return;
    const copy = anchor.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
    copy.removeAttribute('id');
    copy.classList.remove('pressing');
    copy.style.width = `${exactSize(anchor)[0]}px`;
    copy.style.margin = '0';
    copy.style.maxWidth = 'none';
    const holder = document.createElement('div');
    holder.className = `ctx-copy ${wrap}`;
    holder.style.padding = `${pad}px`;
    // Keep the text size it inherits in the conversation (the Text size setting).
    const inherited = getComputedStyle(anchor.parentElement || anchor);
    holder.style.fontSize = inherited.fontSize;
    holder.style.lineHeight = inherited.lineHeight;
    holder.style.marginTop = `${-place.offset}px`;
    holder.append(copy);
    box.replaceChildren(holder);
    // Without padding the card is the item itself (a bubble keeps its own shape).
    if (!pad) { box.style.background = 'transparent'; box.style.borderRadius = getComputedStyle(anchor).borderRadius; }
    // Focus the menu itself (arrow keys move into it) so no item shows a focus ring after a touch.
    menu.current?.focus({ preventScroll: true });
    if (motionOff()) return;
    const spring = getComputedStyle(document.documentElement).getPropertyValue('--spring-pop').trim() || 'ease-out';
    // iPhone glass look (iOS 26): the item lifts a little higher and the menu grows out of it like a droplet.
    const glass = document.documentElement.classList.contains('glass');
    box.animate([{ transform: `translateY(${place.from - place.top}px) scale(1)` }, { transform: `translateY(0) scale(${glass ? 1.035 : 1.02})` }], { duration: glass ? 460 : 380, easing: spring, fill: 'both' });
    menu.current?.animate(glass
      ? [{ opacity: 0, transform: 'translateY(-10px) scale(.4)', filter: 'blur(8px)' }, { opacity: 1, filter: 'blur(0)', offset: 0.5 }, { opacity: 1, transform: 'none', filter: 'blur(0)' }]
      : [{ opacity: 0, transform: 'translateY(-6px) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: glass ? 480 : 340, easing: spring });
  }, [place, anchor, wrap, pad]);

  return createPortal(
    <Exit kind="fade">
      <div className="ctx-layer" ref={layer} tabIndex={-1}>
        <div className="ctx-scrim" onClick={onClose} aria-hidden="true" />
        <div className="ctx-preview" ref={preview} aria-hidden="true" style={place ? { top: place.top, left: place.left, width: place.width, height: place.height } : { visibility: 'hidden' }} />
        <div className="menu ctx-menu" role="menu" aria-label={label} tabIndex={-1} ref={menu} onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          const list = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
          const i = list.indexOf(document.activeElement as HTMLButtonElement);
          list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
        }} style={place ? { top: place.menuTop, left: place.menuLeft, transformOrigin: align === 'end' ? 'top right' : 'top left' } : { visibility: 'hidden' }}>
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? 'danger' : undefined} onClick={() => { onClose(); it.onSelect(); }}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Exit>,
    document.body,
  );
}
