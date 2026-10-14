// Keyboard shortcuts: one list used by the key handler in App.tsx and the cheat sheet.
import { isMac } from './util';

export type ShortcutId = 'new-chat' | 'palette' | 'sidebar' | 'settings' | 'library' | 'focus' | 'copy-last' | 'delete-chat' | 'help' | 'stop';
export type Shortcut = { id: ShortcutId; label: string; keys: string[]; group: 'Chats' | 'Navigation' | 'Message box' };

const mod = isMac ? '⌘' : 'Ctrl';
export const SHORTCUTS: Shortcut[] = [
  { id: 'new-chat', label: 'New chat', keys: [mod, 'Shift', 'O'], group: 'Chats' },
  { id: 'copy-last', label: 'Copy the last reply', keys: [mod, 'Shift', ';'], group: 'Chats' },
  { id: 'delete-chat', label: 'Delete this chat', keys: [mod, 'Shift', 'Backspace'], group: 'Chats' },
  { id: 'stop', label: 'Stop the reply', keys: ['Esc'], group: 'Chats' },
  { id: 'palette', label: 'Search and jump to anything', keys: [mod, 'K'], group: 'Navigation' },
  { id: 'sidebar', label: 'Show or hide the sidebar', keys: [mod, 'Shift', 'S'], group: 'Navigation' },
  { id: 'library', label: 'Open the Library', keys: [mod, 'Shift', 'L'], group: 'Navigation' },
  { id: 'settings', label: 'Open Settings', keys: [mod, ','], group: 'Navigation' },
  { id: 'help', label: 'Show keyboard shortcuts', keys: [mod, '/'], group: 'Navigation' },
  { id: 'focus', label: 'Go to the message box', keys: ['/'], group: 'Message box' },
];

const editable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/** Which shortcut a key press means, if any. Single keys (/, ?) only count outside text fields. */
export function matchShortcut(e: KeyboardEvent): ShortcutId | null {
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (mod && e.shiftKey && key === 'o') return 'new-chat';
  if (mod && !e.shiftKey && key === 'k') return 'palette';
  if (mod && e.shiftKey && key === 's') return 'sidebar';
  if (mod && e.shiftKey && key === 'l') return 'library';
  if (mod && !e.shiftKey && key === ',') return 'settings';
  if (mod && (key === '/' || key === '?')) return 'help';
  if (mod && e.shiftKey && (key === ';' || key === ':')) return 'copy-last';
  if (mod && e.shiftKey && key === 'backspace') return 'delete-chat';
  if (!mod && !e.altKey && !editable(e.target)) {
    if (key === '?') return 'help';
    if (key === '/') return 'focus';
  }
  return null;
}
