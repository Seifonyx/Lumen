import { haptic } from './haptics';

/**
 * iPhone glass look: tapping a dropdown opens an iOS 26 pop-up menu (glass, a checkmark by the chosen option)
 * that grows out of it, instead of the browser's own picker. Works for every <select> in the app: choosing an
 * option sets the select's value and fires its change event, so the app's code is unchanged.
 */
export function installGlassSelect(): () => void {
  const root = document.documentElement;
  const active = () => root.classList.contains('glass') && window.matchMedia('(max-width: 899px)').matches;
  let close: (() => void) | null = null;
  let touch: { x: number; y: number; select: HTMLSelectElement } | null = null;

  const choose = (select: HTMLSelectElement, value: string) => {
    if (select.value === value) return;
    // (The setter from the prototype, so React notices the change.)
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, value);
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const open = (select: HTMLSelectElement) => {
    close?.();
    const scrim = document.createElement('div');
    scrim.className = 'glass-select-scrim';
    const menu = document.createElement('div');
    menu.className = 'menu glass-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', select.getAttribute('aria-label') || 'Choose');
    let current: HTMLButtonElement | null = null;
    const add = (option: HTMLOptionElement) => {
      if (option.hidden) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.disabled = option.disabled;
      const on = option.value === select.value;
      b.setAttribute('aria-selected', String(on));
      b.innerHTML = `<span class="glass-select-check" aria-hidden="true">${on ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ''}</span>`;
      const label = document.createElement('span');
      label.textContent = option.textContent;
      label.dir = 'auto';
      b.append(label);
      b.addEventListener('click', () => { haptic(); choose(select, option.value); close?.(); select.focus({ preventScroll: true }); });
      if (on) current = b;
      menu.append(b);
    };
    for (const child of [...select.children]) {
      if (child instanceof HTMLOptGroupElement) {
        const head = document.createElement('div');
        head.className = 'glass-select-group';
        head.textContent = child.label;
        menu.append(head);
        for (const o of child.querySelectorAll('option')) add(o);
      } else if (child instanceof HTMLOptionElement) add(child);
    }
    document.body.append(scrim, menu);
    // Under the dropdown, or above it when there's more room there; never off-screen.
    const r = select.getBoundingClientRect(), vh = window.visualViewport?.height || innerHeight, gap = 8, edge = 12;
    const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
    const up = below < 240 && above > below;
    menu.style.maxHeight = `${Math.max(160, up ? above : below)}px`;
    const width = Math.min(Math.max(r.width, 220), innerWidth - 2 * edge);
    menu.style.width = `${width}px`;
    const rtl = getComputedStyle(select).direction === 'rtl';
    const left = Math.min(Math.max(edge, rtl ? r.right - width : r.left), innerWidth - width - edge);
    menu.style.left = `${left}px`;
    if (up) { menu.style.bottom = `${vh - r.top + gap}px`; menu.style.transformOrigin = `${rtl ? 'right' : 'left'} bottom`; }
    else { menu.style.top = `${r.bottom + gap}px`; menu.style.transformOrigin = `${rtl ? 'right' : 'left'} top`; }
    (current as HTMLButtonElement | null)?.scrollIntoView({ block: 'nearest' });
    (current as HTMLButtonElement | null || menu.querySelector<HTMLButtonElement>('button'))?.focus({ preventScroll: true });
    select.setAttribute('aria-expanded', 'true');
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close?.(); select.focus({ preventScroll: true }); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const list = [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
        const i = list.indexOf(document.activeElement as HTMLButtonElement);
        list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
      }
    };
    const dismiss = (e: Event) => { e.preventDefault(); close?.(); };
    scrim.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', key, true);
    window.addEventListener('resize', dismiss);
    close = () => {
      close = null;
      select.removeAttribute('aria-expanded');
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', dismiss);
      scrim.remove();
      menu.classList.add('closing');
      setTimeout(() => menu.remove(), 160);
    };
  };

  const target = (e: Event) => {
    const el = e.target;
    if (!active() || !(el instanceof HTMLSelectElement) || el.disabled || el.multiple || el.size > 1) return null;
    return el;
  };
  // A tap (not a scroll that started on it) opens the menu; the browser's picker is held back.
  const touchStart = (e: TouchEvent) => { const s = target(e); touch = s && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY, select: s } : null; };
  const touchEnd = (e: TouchEvent) => {
    const t = touch; touch = null;
    if (!t) return;
    const c = e.changedTouches[0];
    if (!c || Math.hypot(c.clientX - t.x, c.clientY - t.y) > 10) return;
    if (e.cancelable) e.preventDefault();
    open(t.select);
  };
  const mouseDown = (e: MouseEvent) => {
    const s = target(e);
    if (!s || e.button !== 0) return;
    e.preventDefault();
    open(s);
  };
  // Keyboard: Space, Enter or Alt+↓ on a focused dropdown open the same menu.
  const keyDown = (e: KeyboardEvent) => {
    const s = target(e);
    if (!s || close) return;
    if (e.key === ' ' || e.key === 'Enter' || (e.altKey && e.key === 'ArrowDown')) { e.preventDefault(); open(s); }
  };
  document.addEventListener('touchstart', touchStart, { passive: true, capture: true });
  document.addEventListener('touchend', touchEnd, { passive: false, capture: true });
  document.addEventListener('mousedown', mouseDown, true);
  document.addEventListener('keydown', keyDown, true);
  return () => {
    close?.();
    document.removeEventListener('touchstart', touchStart, true);
    document.removeEventListener('touchend', touchEnd, true);
    document.removeEventListener('mousedown', mouseDown, true);
    document.removeEventListener('keydown', keyDown, true);
  };
}
