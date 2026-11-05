import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';
import { applyUpdate } from '../lib/update-safety';

/** The ordinary build's "A new version is ready" bar (Canvas offers it in Settings only). Reload waits, saying why,
 *  while something would be lost (src/lib/update-safety.ts). */
export default function UpdateBar() {
  const apply = useStore((s) => s.updateReady);
  const busy = useStore((s) => s.streamingChatId !== null);
  const [hidden, setHidden] = useState(false);
  if (!apply || hidden) return null;
  return (
    <div className="update-bar" role="status">
      <span>A new version of Lumen is ready.</span>
      <button className="btn small primary" disabled={busy} title={busy ? 'Available when the reply finishes' : undefined} onClick={() => { const reason = applyUpdate(); if (reason) useStore.getState().toast(reason); }}>
        <RefreshCw size={14} /> Reload
      </button>
      <button className="icon-btn xs" aria-label="Later" onClick={() => setHidden(true)}>
        <X size={14} />
      </button>
    </div>
  );
}
