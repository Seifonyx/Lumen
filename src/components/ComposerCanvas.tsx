// CP02 Canvas composer presentation (approved Canvas design, Gate 1): a calm capsule at rest, a second row
// while writing, and a writing sheet over the conversation when expanded. Reached only when CANVAS_COMPOSER is
// on (src/lib/canvas-presentation.ts); the ordinary build folds every use away.
// Presentation only. The draft, attachments, tools, privacy checks, dispatch and Send/Stop stay in Composer;
// the same mounted form and textarea change layout, so selection, undo history and IME composition carry over.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type RefObject } from 'react';
import { useFocusScope } from '../lib/focus-scope';
import { useSheetDrag } from '../lib/sheet-drag';
import { estimateTokens } from '../lib/routing';
import { formatTokens } from '../lib/usage';
import { installMessageActionTaps } from '../lib/message-taps';

export type ComposerPresentation = 'resting' | 'engaged' | 'expanded';

interface Options {
  input: RefObject<HTMLTextAreaElement | null>;
  /** Account + chat: a different scope starts collapsed. */
  scope: string;
  /** What the message box shows (draft plus any dictation in progress). */
  value: string;
  attachments: number;
  title?: string;
  autosize: () => void;
  /** What's in force for the next message, shown as chips above the input: web search, and the project a new chat starts in. */
  context: { search: boolean; project: { id: string; name: string } | null; turnOffSearch: () => void; leaveProject: () => void };
}

const PHONE = '(max-width: 899px)';
const HEAD_ID = 'canvas-writing-title';
// Lucide's Maximize2 drawn inline: an imported icon module is kept by the ordinary build even when unused.
const ExpandIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 3h6v6" /><path d="m21 3-7 7" /><path d="m3 21 7-7" /><path d="M9 21H3v-6" />
  </svg>
);
// Globe, FolderKanban and X, inline for the same reason.
const icon = (paths: string[], size = 13) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths.map((d) => <path key={d} d={d} />)}
  </svg>
);
const GLOBE = ['M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20', 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'];
const FOLDER = ['M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z', 'M8 10v4', 'M12 10v2', 'M16 10v6'];
const CLOSE = ['M18 6 6 18', 'm6 6 12 12'];

export function useCanvasComposer({ input, scope, value, attachments, title, autosize, context }: Options) {
  const form = useRef<HTMLFormElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false); focusedRef.current = focused;
  const pressing = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [restHeight, setRestHeight] = useState(0);
  // Desktop: the sheet is anchored to the window, centred on the conversation column it rose from.
  const [column, setColumn] = useState<{ left: number; width: number } | null>(null);
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE).matches);
  const selection = useRef<{ start: number; end: number; direction: 'forward' | 'backward' | 'none'; scroll: number } | null>(null);
  const restore = useRef(false);

  // (Lives with the composer because Canvas always mounts it beside the conversation.)
  useEffect(() => installMessageActionTaps(), []);

  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const sync = () => setPhone(query.matches);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useLayoutEffect(() => { restore.current = false; setExpanded(false); }, [scope]);

  const measureColumn = useCallback(() => {
    const r = form.current?.parentElement?.getBoundingClientRect();
    if (r) setColumn({ left: Math.round(r.left), width: Math.round(r.width) });
  }, []);
  useEffect(() => {
    if (!expanded) return;
    window.addEventListener('resize', measureColumn);
    return () => window.removeEventListener('resize', measureColumn);
  }, [expanded, measureColumn]);

  const toggle = useCallback((open: boolean) => {
    const el = input.current;
    if (el) selection.current = { start: el.selectionStart, end: el.selectionEnd, direction: el.selectionDirection, scroll: el.scrollTop };
    // The composer leaves the page flow while it is a sheet: keep its place so the conversation doesn't move.
    if (open) setRestHeight(form.current?.parentElement?.offsetHeight || 0);
    if (open) measureColumn();
    restore.current = true;
    setExpanded(open);
  }, [input, measureColumn]);
  const collapse = useCallback(() => toggle(false), [toggle]);

  // A press holds the state until it ends. Inside the composer that keeps its controls in place; elsewhere (a message's
  // controls, while the box has focus) the composer would otherwise shrink mid-press, move the target and lose the click.
  const press = useCallback(() => {
    pressing.current = true;
    const settle = () => {
      window.removeEventListener('pointerup', settle, true); window.removeEventListener('pointercancel', settle, true);
      // After the click has been delivered: engaged while the message box (or a control after it) has focus.
      setTimeout(() => { pressing.current = false; const f = form.current, a = document.activeElement; setFocused(Boolean(f && a && f.contains(a) && (a === input.current || focusedRef.current))); }, 0);
    };
    window.addEventListener('pointerup', settle, true); window.addEventListener('pointercancel', settle, true);
  }, [input]);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (focusedRef.current && !pressing.current && !form.current?.contains(e.target as Node)) press(); };
    window.addEventListener('pointerdown', outside, true);
    return () => window.removeEventListener('pointerdown', outside, true);
  }, [press]);

  // Nested focus ownership (the picker, usage, attach and privacy dialogs stack above it) and Escape/Tab.
  useFocusScope(form, expanded, collapse);
  // Phone: drag the header down to put writing away; a released or interrupted drag springs back.
  useSheetDrag(form, collapse, expanded && phone, scrim);

  useLayoutEffect(() => {
    const el = input.current, sheet = form.current;
    // A drag that closed the sheet leaves it translated off screen; the form stays mounted, so reset it.
    if (!expanded && sheet) { sheet.style.transform = ''; sheet.style.transition = ''; }
    autosize();
    if (!restore.current || !el) return;
    restore.current = false;
    const saved = selection.current;
    el.focus({ preventScroll: true });
    if (saved) { el.setSelectionRange(saved.start, saved.end, saved.direction); el.scrollTop = saved.scroll; }
  }, [expanded, input, autosize]);

  const state: ComposerPresentation = expanded ? 'expanded' : focused || value || attachments ? 'engaged' : 'resting';
  const trimmed = value.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;

  return {
    state,
    expanded,
    // Above the input: what the next message will use. The same choices stay removable with one tap.
    chips: (context.search || context.project) ? (
      <div className="repo-strip cv-context-chips">
        {context.search && <span className="ctx-chip">{icon(GLOBE)} Web search<button type="button" className="icon-btn xs" aria-label="Turn off web search" onClick={context.turnOffSearch}>{icon(CLOSE, 12)}</button></span>}
        {context.project && <span className="ctx-chip" title={`New chat in ${context.project.name}`}>{icon(FOLDER)} <span className="ctx-chip-name">{context.project.name}</span><button type="button" className="icon-btn xs" aria-label="Remove from project" onClick={context.leaveProject}>{icon(CLOSE, 12)}</button></span>}
      </div>
    ) : null,
    collapse: () => { if (expanded) collapse(); },
    wrap: {
      'data-lumen-canvas-foundation': '',
      'data-lumen-canvas-composer': '',
      'data-composer-state': state,
      style: expanded ? ({
        ...(restHeight ? { '--canvas-rest-h': `${restHeight}px` } : {}),
        ...(column ? { '--canvas-column-left': `${column.left}px`, '--canvas-column-width': `${column.width}px` } : {}),
      } as CSSProperties) : undefined,
    },
    form: {
      ref: form,
      role: expanded ? 'dialog' : undefined,
      'aria-modal': expanded || undefined,
      'aria-labelledby': expanded ? HEAD_ID : undefined,
      // Only the message box engages the composer (at once: it is itself the press target). Other controls never
      // change the state mid-press: the click would land on a control that has moved, or lose one about to hide
      // (Safari doesn't focus buttons, so the box blurs on pointer down). The state settles once the press ends.
      // Focus coming back from one of its own dialogs (usage, picker: phones show them as sheets outside the form)
      // keeps it engaged, so the control it returns to stays on screen.
      onFocus: (e: FocusEvent<HTMLFormElement>) => { if ((e.target as Element) === input.current || (e.relatedTarget as Element | null)?.closest('[role="dialog"]')) setFocused(true); },
      onBlur: (e: FocusEvent<HTMLFormElement>) => { if (!pressing.current && !e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false); },
      onPointerDown: press,
    },
    // Escape in the message box is handled here (not by the focus scope) so an IME composition can cancel first.
    textarea: { 'data-local-escape': '' },
    escape: (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== 'Escape' || !expanded || e.nativeEvent.isComposing) return false;
      e.preventDefault();
      e.stopPropagation();
      collapse();
      return true;
    },
    head: expanded ? (
      <div className="canvas-sheet-head sheet-grab">
        <span className="sheet-grip" aria-hidden="true" title="Drag down to put away" />
        <div>
          <span className="canvas-sheet-label">Writing</span>
          <strong id={HEAD_ID}>{title || 'New chat'}</strong>
        </div>
        <span className="canvas-sheet-count">{words} {words === 1 ? 'word' : 'words'} · ~{formatTokens(estimateTokens(value))} {estimateTokens(value) === 1 ? 'token' : 'tokens'}</span>
        <button type="button" className="canvas-sheet-done" aria-label="Done, collapse writing" title="Collapse writing (Esc)" onClick={collapse}>Done</button>
      </div>
    ) : null,
    expand: expanded ? null : (
      <button type="button" className="canvas-expand" aria-label="Expand writing" aria-expanded={false} aria-controls="message-input" title="Expand writing" onClick={() => toggle(true)}>
        <ExpandIcon />
      </button>
    ),
    scrim: expanded ? <div ref={scrim} className="sheet-backdrop canvas-writing-scrim" aria-hidden="true" onClick={collapse} /> : null,
  };
}
