// Whether Lumen may reload into a new version right now, from the owners of each kind of work in progress. Asked only
// when an update is about to be applied (Settings → Update, or the ordinary build's bar); a reason means it waits and
// the update stays ready. A typed draft is safe (it is saved on every change and restored after the reload, with the
// screen and reading position: src/lib/resume.ts); work that exists only in memory is not.
import { useStore } from '../store';
import { indexing } from './knowledge/engine';
import { heldBy } from './update-hold';

export function updateBlocker(): string | null {
  const s = useStore.getState();
  if (s.authed === null) return 'Available once your account has loaded.';
  if (s.streamingChatId) return 'Available once the reply finishes.';
  if (s.comparing) return 'Available once the comparison finishes.';
  if (s.compactingChatId) return 'Available once the chat summary finishes.';
  if (s.canvasEditingChatId) return 'Available once the document edit finishes.';
  if (s.runningTaskId) return 'Available once the scheduled task finishes.';
  if (indexing()) return 'Available once Knowledge finishes indexing.';
  return heldBy();
}

/** Applies a ready update if nothing would be lost; otherwise returns why not (and the update stays ready). */
export function applyUpdate(): string | null {
  const apply = useStore.getState().updateReady;
  if (!apply) return null;
  const reason = updateBlocker();
  if (reason) return reason;
  apply();
  return null;
}
