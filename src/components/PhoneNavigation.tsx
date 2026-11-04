import { ChevronLeft, Menu } from 'lucide-react';
import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';

/** The iOS large title: the page's name at the top of its content. While it is in view the bar's own title stays
 * hidden; once it scrolls away the bar title shows. The bar's h1 stays the page heading for assistive technology, so
 * this copy is hidden from it. Place it first inside the page's scrolling area. */
export function LargeTitle({ title }: { title: string }) {
  const node = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const el = node.current;
    let bar: HTMLElement | null = null, scroller = el?.parentElement || null;
    for (let p = el?.parentElement; p && !bar; p = p.parentElement) bar = p.querySelector<HTMLElement>(':scope > .phone-navigation');
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
    if (!el || !bar) return;
    const b = bar;
    b.dataset.large = 'shown';
    const watch = new IntersectionObserver(([e]) => { b.dataset.large = e.intersectionRatio > .5 ? 'shown' : 'away'; }, { root: scroller, threshold: [0, .5, 1] });
    watch.observe(el);
    return () => { watch.disconnect(); delete b.dataset.large; };
  }, []);
  return <p ref={node} className="large-title" aria-hidden="true">{title}</p>;
}
import { screenIsRoot, screenUp, screenSnapshot, subscribeScreens } from '../lib/screen-history';
import { useStore } from '../store';
export interface PhoneNavigationProps { title: string; onBack?: () => void; actions?: ReactNode; backTarget?: 'settings-index' | 'settings-exit' }
/** One leading navigation control, as in an iOS app: on a root screen (a place chosen in the drawer) it opens the drawer;
 * on a drill-down it goes up one level (screenUp). Actions belong to the current screen, not a second app menu. */
export default function PhoneNavigation({ title, onBack, actions, backTarget }: PhoneNavigationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { if (!document.activeElement?.matches('input,textarea,select')) heading.current?.focus({ preventScroll:true }); }, [title]);
  useSyncExternalStore(subscribeScreens, screenSnapshot);
  const root = screenIsRoot();
  return <header className="phone-navigation">
    <button type="button" aria-label={root ? 'Open navigation' : backTarget === 'settings-index' ? 'Back to Settings' : 'Back'} onClick={() => root ? useStore.getState().setUi({ sidebarOpen: true }) : screenUp(onBack)}>
      {root ? <Menu size={22} /> : <ChevronLeft size={28} />}
    </button>
    <h1 ref={heading} tabIndex={-1}>{title}</h1><div className="phone-navigation-actions">{actions}</div>
  </header>;
}
