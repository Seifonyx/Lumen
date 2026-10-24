// Ephemeral, account-scoped browsing state; never persisted or placed in browser history.
import { useRef, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import { useStore } from '../store';
const memory = new Map<string, unknown>();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export const forgetScreenMemory = (screen: string) => { memory.delete(`${useStore.getState().user?.uid}:${screen}`); listeners.forEach(fn => fn()); };
export const clearScreenMemory = () => memory.clear();
export function useScreenMemory<T>(screen: string, initial: T, explicit = false): [T, Dispatch<SetStateAction<T>>] {
 const owner = useStore(s => s.user?.uid), key = `${owner}:${screen}`;
 const initialized = useRef<string | null>(null);
 if (initialized.current !== key) { if (explicit || !memory.has(key)) memory.set(key, initial); initialized.current = key; }
 const value = useSyncExternalStore(subscribe, () => memory.has(key) ? memory.get(key) as T : initial);
 return [value, (update: SetStateAction<T>) => { const previous = memory.has(key) ? memory.get(key) as T : initial; memory.set(key, typeof update === 'function' ? (update as (current: T) => T)(previous) : update); listeners.forEach(fn => fn()); }];
}
