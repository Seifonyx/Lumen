import { ChevronLeft, Menu } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { exitFeature, featureExitLabel, screenBack, screenHasBack } from '../lib/screen-history';
import { useStore } from '../store';
export interface PhoneNavigationProps { title: string; onBack?: () => void; actions?: ReactNode; backTarget?: 'settings-index' | 'settings-exit' }
/** One leading navigation control; actions belong to the current screen, not a second app menu. */
export default function PhoneNavigation({ title, onBack, actions }: PhoneNavigationProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => { if (!document.activeElement?.matches('input,textarea,select')) heading.current?.focus({ preventScroll:true }); }, [title]);
  useEffect(() => {
    const page = heading.current?.closest<HTMLElement>('.project-workspace-main, .canvas-panel');
    if (!page) return; // HubPage, Routing Center and Settings already own their gestures.
    let disposed = false, stop: (() => void) | undefined;
    void import('../lib/swipe-back').then(({ installSwipeBack }) => {
      if (!disposed) stop = installSwipeBack(page, () => screenHasBack() && !document.querySelector('.modal-backdrop,.sheet-backdrop,.models-pop,.ctx-layer'), () => {}, () => screenBack());
    });
    return () => { disposed = true; stop?.(); };
  }, []);
  const canBack = Boolean(onBack) || screenHasBack();
  return <header className="phone-navigation">
    <button type="button" aria-label={canBack ? featureExitLabel() : 'Open navigation'} onClick={() => canBack ? exitFeature() : useStore.getState().setUi({ sidebarOpen: true })}>
      {canBack ? <ChevronLeft size={28} /> : <Menu size={22} />}
    </button>
    <h1 ref={heading} tabIndex={-1}>{title}</h1><div className="phone-navigation-actions">{actions}</div>
  </header>;
}
