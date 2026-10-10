/** True on iPhone, iPad and iPod (iPadOS reports itself as a Mac, so touch support gives it away). */
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** True when the app was opened from the Home Screen (full screen, no browser bar). */
export const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
