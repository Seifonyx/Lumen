// Canvas Back for a layer that lives in a component's own state (Phase 2 slice 3): the All chats dialog opened from
// the tree. While open it registers here; CanvasNav treats it like a page shown over the chat: one history entry, and
// the browser's Back (or Safari's edge swipe) closes it instead of leaving Lumen. One layer at a time is all the tree
// opens; a newer registration replaces an older one.
import { useEffect, useRef } from 'react';

let layer: (() => void) | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const backLayerOpen = () => layer !== null;
export const subscribeBackLayers = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
/** Closes the open layer; returns whether there was one. */
export function closeTopBackLayer() {
  const close = layer;
  if (!close) return false;
  layer = null;
  notify();
  close();
  return true;
}

/** Registers `open` as the Back layer; `close` is called when Back closes it. */
export function useBackLayer(open: boolean, close: () => void) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return;
    const mine = () => latest.current();
    layer = mine;
    notify();
    return () => { if (layer === mine) { layer = null; notify(); } };
  }, [open]);
}
