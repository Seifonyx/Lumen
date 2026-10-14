import { useEffect, useRef, useState } from 'react';
import { modelLabel, useStore } from '../store';
import type { Message } from '../types';

/** The model line under an Auto reply: tap to see why Auto chose it, what was next, and to keep it out of Auto. */
export default function RouteWhy({ message }: { message: Message }) {
  const catalog = useStore((s) => s.catalog);
  const excluded = useStore((s) => (s.settings.autoExcluded || []).includes(message.model || ''));
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', key, true); };
  }, [open]);
  const d = message.routeDetail;
  const name = modelLabel(catalog, message.model);
  return (
    <span className="route-why-wrap" ref={root}>
      <button type="button" className="model-tag route-why-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} title="Why Auto chose this model">
        {name}<span className="route-tag"> · Auto: {message.route}</span>
      </button>
      {open && (
        <span className="route-why-pop" role="dialog" aria-label="Why this model">
          <span className="rw-title">Why {name}</span>
          <ul>{(d?.why?.length ? d.why : [message.route || 'best available']).map((w) => <li key={w}>{w}</li>)}</ul>
          {!!d?.next?.length && <>
            <span className="rw-title">Next in line</span>
            <ol>{d.next.map((id) => <li key={id}>{modelLabel(catalog, id)}</li>)}</ol>
          </>}
          <label className="rw-toggle">
            <input type="checkbox" checked={excluded} onChange={(e) => useStore.getState().setAutoExcluded(message.model!, e.target.checked)} />
            <span>Never use {name} in Auto<small>You can still pick it yourself.</small></span>
          </label>
        </span>
      )}
    </span>
  );
}
