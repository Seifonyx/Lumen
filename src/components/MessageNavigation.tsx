import { List, Search, X } from 'lucide-react';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusScope } from '../lib/focus-scope';
import { overviewStops, type MessageStop } from '../lib/message-navigation';
import './message-navigation.css';

export default function MessageNavigation({ stops, activeId, onJump, height, width }: {
  stops: MessageStop[]; activeId: string | null; onJump(id: string): void; height: number; width: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedId, setFocusedId] = useState<string|null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string|null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useFocusScope(dialog, open, () => setOpen(false));
  const compact = width < 760 || height < 260;
  const capacity = Math.max(0, Math.min(8, Math.floor((height * .65 - 48) / 44)));
  const overview = useMemo(() => overviewStops(stops, capacity, activeId), [stops, capacity, activeId]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? stops.filter(stop => `${stop.ordinal} ${stop.preview}`.toLocaleLowerCase().includes(needle)) : stops;
  }, [stops, query]);
  const rows = useVirtualizer({ count: filtered.length, enabled: open, getScrollElement: () => list.current,
    getItemKey: index => filtered[index].id, estimateSize: () => 68, overscan: 4,
    rangeExtractor: range => {
      const pinned = filtered.flatMap((stop,index) => stop.id === focusedId || stop.id === pendingFocusId ? [index] : []);
      return [...new Set([...defaultRangeExtractor(range), ...pinned])].sort((a,b)=>a-b);
    } });
  useEffect(() => {
    if (!open) return;
    if (query) rows.scrollToOffset(0);
    else {
      const index = filtered.findIndex(stop => stop.id === activeId);
      if (index >= 0) rows.scrollToIndex(index, { align: 'center' });
    }
  }, [open, query, rows]); // Scrolling the conversation must not reset the open list.
  const choose = (id: string) => { setOpen(false); onJump(id); };
  const items = rows.getVirtualItems();
  useLayoutEffect(() => {
    if (!open || !pendingFocusId) return;
    const button = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') || [])].find(item => item.dataset.navId === pendingFocusId);
    if (button) { button.focus({preventScroll:true}); setPendingFocusId(null); }
  }, [open, pendingFocusId, items]);
  useEffect(() => { setPendingFocusId(null); setFocusedId(null); }, [open, query]);

  return <>
    <nav className={`message-navigation${compact ? ' compact' : ''}`} aria-label="Sent message navigation">
      <button ref={trigger} type="button" className="message-nav-trigger" aria-label={`Navigate sent messages (${stops.length})`}
        title="Navigate sent messages" aria-haspopup="dialog" aria-expanded={open} onClick={() => { trigger.current?.focus({preventScroll:true}); setQuery(''); setOpen(true); }}>
        <List size={18} aria-hidden="true" /><span>{stops.length>=1000 ? `${Math.floor(stops.length/1000)}k` : stops.length}</span>
      </button>
      {!compact && <div className="message-nav-rail">
        {overview.map(stop => <button type="button" key={stop.id} className="message-nav-tick" aria-current={stop.id === activeId ? 'location' : undefined}
          aria-label={`Jump to sent message ${stop.ordinal}: ${stop.preview}`} title={`${stop.ordinal}. ${stop.preview}`}
          onClick={() => onJump(stop.id)}><span aria-hidden="true" /></button>)}
      </div>}
    </nav>
    {open && createPortal(<div className="message-nav-backdrop" onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div ref={dialog} className="message-nav-dialog" role="dialog" aria-modal="true" aria-labelledby="message-nav-title" tabIndex={-1}>
        <header><div><h2 id="message-nav-title">Sent messages</h2><p>{stops.length} messages · choose one to jump back</p></div>
          <button type="button" className="icon-btn" aria-label="Close message navigation" onClick={() => setOpen(false)}><X size={18} /></button>
        </header>
        <label className="message-nav-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Find a sent message" placeholder="Find a message…"
          value={query} onChange={event => setQuery(event.target.value)} /></label>
        <div ref={list} className="message-nav-list" role="region" aria-label="Sent messages list" onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setFocusedId(null)}}>
          {filtered.length ? <div className="message-nav-list-inner" style={{ height: rows.getTotalSize() }}>
            {items.map(item => { const stop = filtered[item.index]; return <button key={stop.id} type="button" className="message-nav-row" data-nav-id={stop.id}
              aria-label={`Jump to sent message ${stop.ordinal}: ${stop.preview}`} aria-current={stop.id === activeId ? 'location' : undefined}
              style={{ transform: `translateY(${item.start}px)` }} onClick={() => choose(stop.id)} onFocus={()=>setFocusedId(stop.id)}
              onKeyDown={event => {
                if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
                event.preventDefault(); const index = event.key === 'Home' ? 0 : event.key === 'End' ? filtered.length - 1 : Math.max(0, Math.min(filtered.length - 1, item.index + (event.key === 'ArrowUp' ? -1 : 1)));
                rows.scrollToIndex(index, { align: 'auto' });
                setPendingFocusId(filtered[index]?.id ?? null);
              }}><span className="message-nav-number">{stop.ordinal}</span><span className="message-nav-preview" dir="auto">{stop.preview}</span></button>; })}
          </div> : <p className="message-nav-empty" role="status">No sent messages match “{query}”.</p>}
        </div>
        <footer>{query ? `${filtered.length} matches` : 'Only your messages are listed. Auto-added context is excluded.'}</footer>
      </div>
    </div>, document.body)}
  </>;
}
