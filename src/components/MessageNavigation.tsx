import { useMemo } from 'react';
import { overviewStops, type MessageStop } from '../lib/message-navigation';

export default function MessageNavigation({ stops, activeId, onJump, height }: {
  stops: MessageStop[]; activeId: string | null; onJump(id: string, keyboard: boolean): void; height: number;
}) {
  const capacity = Math.max(1, Math.min(8, Math.floor(height / 44), Math.max(2, Math.floor(height * .65 / 44))));
  const overview = useMemo(() => overviewStops(stops, capacity, activeId), [stops, capacity, activeId]);
  if (height < 44) return null;
  return <nav className="message-navigation" aria-label="Sent message navigation">
    <div className="message-nav-rail">
      {overview.map(stop => <button type="button" key={stop.id} className="message-nav-tick" aria-current={stop.id === activeId ? 'location' : undefined}
        aria-label={`Jump to sent message ${stop.ordinal}: ${stop.preview}`} title={`${stop.ordinal}. ${stop.preview}`}
        onClick={event => onJump(stop.id, event.detail === 0)}><span aria-hidden="true" /></button>)}
    </div>
  </nav>;
}
