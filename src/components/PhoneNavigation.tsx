import { ChevronLeft, Menu } from 'lucide-react';
import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
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
