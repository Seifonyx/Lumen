/** Touch menus preview one option while sliding, then activate only the release target. */
export function installMenuScrub(menu: HTMLElement, origin?: HTMLElement): () => void {
  const highlight = document.createElement('div');
  highlight.className = 'menu-touch-highlight';
  highlight.setAttribute('aria-hidden', 'true');
  menu.append(highlight);
  menu.classList.add('menu-scrub');
  let preview: HTMLButtonElement | null = null;
  let touch: { id: number; x: number; y: number } | null = null;
  let blocked = false, edgeFrame = 0;
  const optionAt = (x: number, y: number) => {
    const button = document.elementFromPoint(x, y)?.closest<HTMLButtonElement>('button[role="menuitem"]');
    return button && menu.contains(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true' ? button : null;
  };
  const show = (button: HTMLButtonElement | null) => {
    const first = !preview;
    if (preview !== button) {
      preview?.removeAttribute('data-menu-preview');
      preview = button;
      preview?.setAttribute('data-menu-preview', 'true');
    }
    highlight.hidden = !button;
    if (!button) return;
    const r = button.getBoundingClientRect(), m = menu.getBoundingClientRect();
    const sx = m.width / menu.offsetWidth || 1, sy = m.height / menu.offsetHeight || 1;
    highlight.style.transition = first ? 'none' : '';
    highlight.style.transform = `translate(${(r.left - m.left) / sx - menu.clientLeft + menu.scrollLeft}px, ${(r.top - m.top) / sy - menu.clientTop + menu.scrollTop}px)`;
    highlight.style.width = `${r.width / sx}px`;
    highlight.style.height = `${r.height / sy}px`;
    highlight.style.borderRadius = getComputedStyle(button).borderRadius;
    highlight.dataset.danger = String(button.classList.contains('danger'));
    // The shared highlight sits in the menu, so mirror any inner list's clipping as it scrolls.
    let top = 0, right = 0, bottom = 0, left = 0;
    for (let p = button.parentElement; p && p !== menu; p = p.parentElement) {
      const style = getComputedStyle(p), box = p.getBoundingClientRect();
      if (style.overflowY !== 'visible') { top = Math.max(top, (box.top - r.top) / sy); bottom = Math.max(bottom, (r.bottom - box.bottom) / sy); }
      if (style.overflowX !== 'visible') { left = Math.max(left, (box.left - r.left) / sx); right = Math.max(right, (r.right - box.right) / sx); }
    }
    highlight.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
  };
  highlight.hidden = true;
  const reset = () => { touch = null; cancelAnimationFrame(edgeFrame); edgeFrame = 0; show(null); };
  const edgeScroll = () => {
    edgeFrame = 0;
    if (!touch) return;
    let scroller = menu;
    for (let el = document.elementFromPoint(touch.x, touch.y); el && menu.contains(el); el = el.parentElement) {
      if (el instanceof HTMLElement && el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) { scroller = el; break; }
      if (el === menu) break;
    }
    if (scroller.scrollHeight <= scroller.clientHeight) return;
    const r = scroller.getBoundingClientRect(), zone = Math.min(30, r.height / 4);
    if (touch.x < r.left || touch.x > r.right || touch.y < r.top || touch.y > r.bottom) return;
    const speed = touch.y < r.top + zone ? -(r.top + zone - touch.y) / zone
      : touch.y > r.bottom - zone ? (touch.y - r.bottom + zone) / zone : 0;
    const before = scroller.scrollTop;
    scroller.scrollTop += speed * 7;
    if (scroller.scrollTop === before) return;
    show(optionAt(touch.x, touch.y));
    edgeFrame = requestAnimationFrame(edgeScroll);
  };
  const start = (event: TouchEvent) => {
    reset(); blocked = event.touches.length !== 1;
    if (blocked) return;
    const t = event.touches[0], button = optionAt(t.clientX, t.clientY);
    if (!button) return;
    menu.dataset.menuInput = 'touch';
    touch = { id: t.identifier, x: t.clientX, y: t.clientY };
    if (event.cancelable) event.preventDefault(); // Keep touch focus and native callouts off the option.
    show(button);
  };
  const move = (event: TouchEvent) => {
    if (event.touches.length !== 1) { reset(); blocked = true; return; }
    if (blocked) return;
    const t = event.touches[0];
    // The menu can appear halfway through a hold. Native touches retain the original row as their target.
    if (!touch && origin && event.target instanceof Node && origin.contains(event.target)) touch = { id: t.identifier, x: t.clientX, y: t.clientY };
    if (!touch || touch.id !== t.identifier) return;
    menu.dataset.menuInput = 'touch';
    if (event.cancelable) event.preventDefault();
    touch.x = t.clientX; touch.y = t.clientY;
    show(optionAt(t.clientX, t.clientY));
    if (!edgeFrame) edgeFrame = requestAnimationFrame(edgeScroll);
  };
  const end = (event: TouchEvent) => {
    if (!touch) return;
    const t = [...event.changedTouches].find(t => t.identifier === touch!.id);
    const button = !blocked && !event.touches.length && t ? optionAt(t.clientX, t.clientY) : null;
    // Prevent the compatibility click from reaching a different control after the menu unmounts.
    if (event.cancelable) event.preventDefault();
    reset();
    button?.click();
  };
  const cancel = () => { reset(); blocked = true; };
  const hover = (event: PointerEvent) => { if (!touch && event.pointerType === 'mouse') { menu.dataset.menuInput = 'pointer'; show(optionAt(event.clientX, event.clientY)); } };
  const keyboard = () => { menu.dataset.menuInput = 'keyboard'; };
  const focus = (event: FocusEvent) => {
    if (!touch && event.target instanceof HTMLButtonElement && menu.contains(event.target)) show(event.target);
  };
  const scroll = () => { if (touch) show(optionAt(touch.x, touch.y)); else show(null); };
  const callout = (event: Event) => event.preventDefault();
  document.addEventListener('touchstart', start, { capture: true, passive: false });
  document.addEventListener('touchmove', move, { capture: true, passive: false });
  document.addEventListener('touchend', end, { capture: true, passive: false });
  document.addEventListener('touchcancel', cancel, true);
  document.addEventListener('pointermove', hover, { passive: true });
  document.addEventListener('visibilitychange', cancel);
  document.addEventListener('keydown', keyboard, true);
  menu.addEventListener('focusin', focus);
  menu.addEventListener('scroll', scroll, { passive: true, capture: true });
  menu.addEventListener('contextmenu', callout);
  window.addEventListener('blur', cancel);
  return () => {
    reset(); highlight.remove(); menu.classList.remove('menu-scrub'); delete menu.dataset.menuInput;
    document.removeEventListener('touchstart', start, true);
    document.removeEventListener('touchmove', move, true);
    document.removeEventListener('touchend', end, true);
    document.removeEventListener('touchcancel', cancel, true);
    document.removeEventListener('pointermove', hover);
    document.removeEventListener('visibilitychange', cancel);
    document.removeEventListener('keydown', keyboard, true);
    menu.removeEventListener('focusin', focus);
    menu.removeEventListener('scroll', scroll, true);
    menu.removeEventListener('contextmenu', callout);
    window.removeEventListener('blur', cancel);
  };
}
