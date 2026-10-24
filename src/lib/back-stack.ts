// Canvas local presentations join the same screen history as canonical pages. Registrations are ordered:
// updating a draft refreshes its restore callback without moving it above a later sheet.
import { useEffect, useRef } from 'react';
type Layer = { close: () => void; restore?: () => void; key: string; context?: string };
const layers = new Map<symbol, Layer>();
let contextReader = () => '';
export const configureBackLayerContext = (read: () => string) => { contextReader = read; };
const rawTop = () => [...layers.values()].at(-1);
const top = () => [...layers.values()].reverse().find(layer => layer.context === contextReader());
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());
export const backLayerOpen = () => Boolean(top());
export const backLayerIdentity = () => top()?.key || null;
export const backLayerRestore = () => top()?.restore || null;
export const clearBackLayerRestore = () => { layers.clear(); };
export const subscribeBackLayers = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function closeTopBackLayer() {
 const token = [...layers.keys()].at(-1);
 if (!token) return false;
 const current = layers.get(token)!;
 layers.delete(token); notify(); current.close(); return true;
}
/** Close presentations above the history target; return whether that target is still mounted. */
export function reconcileBackLayers(key: string | null) {
 while (layers.size && (!key || rawTop()?.key !== key)) closeTopBackLayer();
 return Boolean(key && rawTop()?.key === key);
}
export function useBackLayer(open: boolean, close: () => void, restore?: () => void, key = 'layer') {
 const token = useRef(Symbol('presentation'));
 const latest = useRef<Layer>({ close, restore, key }); latest.current = { close, restore, key };
 useEffect(() => {
   if (!open) return;
   layers.set(token.current, { ...latest.current, context: contextReader() }); notify();
   return () => { if (layers.delete(token.current)) notify(); };
 }, [open]);
 useEffect(() => {
   if (open && layers.has(token.current)) { layers.set(token.current, { ...latest.current, context: layers.get(token.current)?.context }); notify(); }
 }, [open, restore, key]);
}
