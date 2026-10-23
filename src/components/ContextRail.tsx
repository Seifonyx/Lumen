// Canvas context rail (1280 px and wider, off by default): the open chat's outline (your questions), the sources its
// answers cited and which models answered. Read from the chat itself; nothing is fetched or stored except the on/off
// choice on this device. Closing it, or a narrower window, gives the reading column its full width back.
import { useEffect, useMemo, useState } from 'react';
import { modelLabel, useStore } from '../store';
import type { Chat } from '../types';
import { messageStops } from '../lib/message-navigation';
import { routeWords } from '../lib/route-words';
import { rerouteReason } from '../lib/reroute';

// Icons are drawn inline: ChatView imports this module in every build, and lucide's icon objects survive tree-shaking.
const Icon = ({ d, size }: { d: string; size: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;
const PANEL = 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v18', CLOSE = 'M18 6 6 18M6 6l12 12';
const KEY = 'lumen.contextRail';
const listeners = /* @__PURE__ */ new Set<() => void>();
let on: boolean | undefined;
const saved = () => (on ??= (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })());
const setRail = (next: boolean) => {
  on = next;
  try { if (next) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* private mode */ }
  listeners.forEach((l) => l());
};
const useRail = () => {
  const [open, setOpen] = useState(saved);
  useEffect(() => { const l = () => setOpen(saved()); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  return open;
};
export const jumpToMessage = (id: string) => window.dispatchEvent(new CustomEvent('lumen:jump', { detail: id }));

export function RailToggle() {
  const open = useRail();
  return (
    <button type="button" className="icon-btn cv-rail-toggle" aria-pressed={open} aria-controls="cv-context-rail" aria-label={open ? 'Hide chat details' : 'Show chat details'} title={open ? 'Hide chat details' : 'Outline, sources and models'} onClick={() => setRail(!open)}>
      <Icon d={PANEL} size={18} />
    </button>
  );
}

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export function ContextRail({ chat }: { chat: Chat | null | undefined }) {
  const open = useRail(), catalog = useStore((s) => s.catalog);
  const stops = useMemo(() => (chat ? messageStops(chat.messages) : []), [chat]);
  const sources = useMemo(() => {
    const seen = new Map<string, { title: string; url: string }>();
    for (const m of chat?.messages || []) for (const s of m.sources || []) if (/^https?:\/\//.test(s.url) && !seen.has(s.url)) seen.set(s.url, s);
    return [...seen.values()];
  }, [chat]);
  const answers = useMemo(() => (chat?.messages || []).filter((m) => m.role === 'assistant' && m.model && m.status !== 'streaming'), [chat]);
  // Reflect the saved choice on the app frame so the reading column makes room (CSS only acts at 1280 px and wider).
  const shown = open && Boolean(chat?.messages.length);
  useEffect(() => {
    document.querySelector('.app[data-lumen-canvas-shell]')?.toggleAttribute('data-context-rail', shown);
    return () => document.querySelector('.app[data-lumen-canvas-shell]')?.removeAttribute('data-context-rail');
  }, [shown]);
  if (!open || !chat?.messages.length) return null;
  return (
    <aside id="cv-context-rail" className="cv-rail" aria-label="Chat details">
      <header><h2>Chat details</h2><button type="button" className="icon-btn" aria-label="Hide chat details" onClick={() => setRail(false)}><Icon d={CLOSE} size={16} /></button></header>
      <section aria-labelledby="cv-rail-outline">
        <h3 id="cv-rail-outline">Outline</h3>
        {stops.length ? <ol>{stops.map((s) => <li key={s.id}><button type="button" dir="auto" onClick={() => jumpToMessage(s.id)}><span>{s.ordinal}</span>{s.preview}</button></li>)}</ol> : <p>No questions yet.</p>}
      </section>
      <section aria-labelledby="cv-rail-sources">
        <h3 id="cv-rail-sources">Sources</h3>
        {sources.length ? <ul>{sources.slice(0, 30).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer"><strong dir="auto">{s.title && !/^https?:/.test(s.title) ? s.title : host(s.url)}</strong><small>{host(s.url)}</small></a></li>)}</ul> : <p>No answer in this chat cited a source.</p>}
      </section>
      <section aria-labelledby="cv-rail-route">
        <h3 id="cv-rail-route">Models</h3>
        {answers.length ? <ol>{answers.slice(-12).map((m) => {
          const reroute = rerouteReason(m.notices);
          return <li key={m.id}><button type="button" onClick={() => jumpToMessage(m.id)}><strong>{modelLabel(catalog, m.model)}</strong><small>{reroute ? `Rerouted: ${reroute}` : m.via ? `${m.via} layout` : m.route ? routeWords(m.route) : m.status === 'error' ? 'Failed' : 'No route recorded'}</small></button></li>;
        })}</ol> : <p>No answers yet.</p>}
      </section>
    </aside>
  );
}
