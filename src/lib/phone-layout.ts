import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 899px)';
const snapshot = () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches;
const subscribe = (changed: () => void) => {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
};
/** Presentation breakpoint only. Never owns navigation, drafts or persisted preferences. */
export function usePhoneLayout() { return useSyncExternalStore(subscribe, snapshot, () => false); }
