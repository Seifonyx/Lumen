import { Share, X } from 'lucide-react';
import { useState } from 'react';
import { isIOS, isStandalone } from '../lib/device';
import './touch.css';

const KEY = 'mr.installHint';

/** On an iPhone in Safari: a one-time tip about adding the app to the Home Screen (full screen, no browser bar). */
export default function InstallHint() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (hidden || !isIOS() || isStandalone()) return null;
  return (
    <div className="install-hint" role="note">
      <Share size={18} />
      <span>
        For a full-screen app on your iPhone, open Safari's Share menu and choose <b>Add to Home Screen</b>.
      </span>
      <button
        type="button"
        className="icon-btn"
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1');
          } catch {
            // Storage unavailable: the tip just comes back next time.
          }
          setHidden(true);
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
