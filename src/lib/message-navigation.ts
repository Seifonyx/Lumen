import type { Message } from '../types';

export interface MessageStop { id: string; index: number; ordinal: number; preview: string; }

/** Actual user turns only; automatic repository/file context is not a sent question. */
export function messageStops(messages: Message[]): MessageStop[] {
  const stops: MessageStop[] = [];
  messages.forEach((message, index) => {
    if (message.role !== 'user' || message.auto) return;
    const text = message.text.slice(0, 260).replace(/\s+/g, ' ').trim();
    stops.push({ id: message.id, index, ordinal: stops.length + 1,
      preview: text.slice(0, 120) || message.files?.map(file => file.name).join(', ').slice(0, 120) || 'Attachment message' });
  });
  return stops;
}

/** A small overview keeps the rail useful in histories with thousands of turns. */
export function overviewStops(stops: MessageStop[], capacity: number, activeId: string | null): MessageStop[] {
  if (capacity <= 0) return [];
  if (stops.length <= capacity) return stops;
  if (capacity === 1) return [stops.find(stop => stop.id === activeId) || stops.at(-1)!];
  const indexes = new Set(Array.from({ length: capacity }, (_, i) => Math.round(i * (stops.length - 1) / (capacity - 1))));
  const active = stops.findIndex(stop => stop.id === activeId);
  if (active > 0 && active < stops.length - 1 && !indexes.has(active) && capacity > 2) {
    const interior = [...indexes].filter(i => i > 0 && i < stops.length - 1);
    indexes.delete(interior.reduce((a, b) => Math.abs(a - active) < Math.abs(b - active) ? a : b));
    indexes.add(active);
  }
  return [...indexes].sort((a, b) => a - b).map(index => stops[index]);
}

export function stopAtIndex(stops: MessageStop[], index: number): string | null {
  let low = 0, high = stops.length - 1, result: string | null = null;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (stops[mid].index <= index) { result = stops[mid].id; low = mid + 1; }
    else high = mid - 1;
  }
  return result || stops[0]?.id || null;
}
