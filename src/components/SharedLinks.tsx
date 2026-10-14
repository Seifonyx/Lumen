import { useEffect, useState } from 'react';
import { Copy, Link2Off } from 'lucide-react';
import { listShares, shareUrl, stopSharing, type ShareInfo } from '../lib/share';
import { copyText } from '../lib/util';
import { useStore } from '../store';

/** Settings → Privacy & data: every public link you've made, with a way to turn each off. */
export default function SharedLinks() {
  const owner = useStore((s) => s.user?.uid);
  const toast = useStore((s) => s.toast);
  const [links, setLinks] = useState<ShareInfo[] | null>(null);
  useEffect(() => {
    if (!owner) return;
    let live = true;
    listShares(owner).then((all) => { if (live) setLinks(all); }).catch(() => { if (live) setLinks([]); });
    return () => { live = false; };
  }, [owner]);
  const remove = async (id: string) => {
    if (!confirm('Stop sharing? The link will stop working for everyone.')) return;
    try { await stopSharing(id); setLinks((l) => (l || []).filter((x) => x.id !== id)); toast('Link removed', 'info'); }
    catch (e) { toast(`Couldn’t remove the link: ${(e as Error).message}`, 'error'); }
  };
  return (
    <div className="settings-group">
      <span className="settings-group-title">Shared links</span>
      <div className="settings-card">
        {links === null ? <p className="muted small pad">Loading…</p>
          : !links.length ? <p className="muted small pad">No public links. Create one from a chat’s menu → Share or export.</p>
          : links.map((l) => (
            <div className="setting-row" key={l.id}>
              <span className="setting-text">
                <span className="setting-label" dir="auto">{l.title}</span>
                <span className="setting-hint">{l.masked ? 'Personal details hidden · ' : ''}{l.updatedAt ? new Date(l.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Just now'}</span>
              </span>
              <span className="setting-ctrl share-row-actions">
                <button className="icon-btn sm" aria-label={`Copy link to ${l.title}`} title="Copy link" onClick={() => void copyText(shareUrl(l.id)).then((ok) => ok && toast('Link copied', 'success'))}><Copy size={15} /></button>
                <button className="icon-btn sm" aria-label={`Stop sharing ${l.title}`} title="Stop sharing" onClick={() => void remove(l.id)}><Link2Off size={15} /></button>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
