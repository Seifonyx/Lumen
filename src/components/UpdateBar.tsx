import { RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';

/** "A new version is ready" bar, shown after an update has downloaded in the background. */
export default function UpdateBar() {
  const apply = useStore((s) => s.updateReady);
  const busy = useStore((s) => s.streamingChatId !== null);
  const [hidden, setHidden] = useState(false);
  if (!apply || hidden) return null;
  return (
    <div className="update-bar" role="status">
      <span>A new version of Lumen is ready.</span>
      <button className="btn small primary" disabled={busy} title={busy ? 'Available when the reply finishes' : undefined} onClick={apply}>
        <RefreshCw size={14} /> Reload
      </button>
      <button className="icon-btn xs" aria-label="Later" onClick={() => setHidden(true)}>
        <X size={14} />
      </button>
    </div>
  );
}
