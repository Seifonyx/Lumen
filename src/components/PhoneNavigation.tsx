import { ChevronLeft, Menu } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { featureExitLabel, screenHasBack, screenUp } from '../lib/screen-history';
import { useStore } from '../store';
export interface PhoneNavigationProps { title: string; onBack?: () => void; actions?: ReactNode; backTarget?: 'settings-index' | 'settings-exit' }
/** One leading navigation control; actions belong to the current screen, not a second app menu. Back goes up: a Settings section to the Settings list, any other screen out of its feature (screenUp). */
export default function PhoneNavigation({ title, onBack, actions, backTarget }: PhoneNavigationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { if (!document.activeElement?.matches('input,textarea,select')) heading.current?.focus({ preventScroll:true }); }, [title]);
  const canBack = Boolean(onBack) || screenHasBack();
  return <header className="phone-navigation">
    <button type="button" aria-label={!canBack ? 'Open navigation' : backTarget === 'settings-index' ? 'Back to Settings' : featureExitLabel()} onClick={() => canBack ? screenUp() : useStore.getState().setUi({ sidebarOpen: true })}>
      {canBack ? <ChevronLeft size={28} /> : <Menu size={22} />}
    </button>
    <h1 ref={heading} tabIndex={-1}>{title}</h1><div className="phone-navigation-actions">{actions}</div>
  </header>;
}
