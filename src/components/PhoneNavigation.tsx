import { ChevronLeft, Menu } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { screenBack, screenHasBack } from '../lib/screen-history';
import { useStore } from '../store';
export interface PhoneNavigationProps { title: string; onBack?: () => void; actions?: ReactNode }
/** One leading navigation control; actions belong to the current screen, not a second app menu. */
export default function PhoneNavigation({ title, onBack, actions }: PhoneNavigationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { if (!document.activeElement?.matches('input,textarea,select')) heading.current?.focus({ preventScroll:true }); }, [title]);
  const canBack = Boolean(onBack) || screenHasBack();
  return <header className="phone-navigation">
    <button type="button" aria-label={canBack ? 'Back' : 'Open navigation'} onClick={() => canBack ? screenBack(onBack) : onBack ? onBack() : useStore.getState().setUi({ sidebarOpen: true })}>
      {canBack ? <ChevronLeft size={28} /> : <Menu size={22} />}
    </button>
    <h1 ref={heading} tabIndex={-1}>{title}</h1><div className="phone-navigation-actions">{actions}</div>
  </header>;
}
