// Work that only exists in this window (files attached but not sent, dictation, a document not yet saved, code running)
// would be lost if Lumen reloaded into a new version. Each owner says so here by registering a check that reads its own
// live state when asked; nothing is copied or kept in step. Read by src/lib/update-safety.ts only when an update is
// about to be applied.
import { useEffect, useRef } from 'react';

type Hold = () => string | null;
const holds = new Set<{ current: Hold }>();

/** While mounted, `hold()` is asked before an update reloads Lumen: a short reason means "not now". */
export function useUpdateHold(hold: Hold) {
  const ref = useRef(hold);
  ref.current = hold;
  useEffect(() => { holds.add(ref); return () => { holds.delete(ref); }; }, []);
}

/** The first reason any owner gives, or null. */
export function heldBy(): string | null {
  for (const hold of holds) { const reason = hold.current(); if (reason) return reason; }
  return null;
}
