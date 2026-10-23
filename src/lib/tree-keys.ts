// The Canvas tree's arrow keys (Phase 2 slice 2), loaded by SidebarCanvas with the tree's first focus. Up/Down move
// between rows' main controls, Home/End to the ends, Right opens a folder or section (then enters it), Left closes it
// or returns to the row that holds this one; Up from the first row returns to search. Rows inside a closed folder are
// inert and never reached; row menus and other secondary buttons stay on Tab. No roles change, so every row keeps
// its button semantics for screen readers.
const shown = (el: Element | null | undefined): el is HTMLElement => el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0 && !el.closest('[inert], [hidden]');

/** The row that holds `el`: its folder's row inside a project, otherwise its section's toggle. */
function parentRow(el: HTMLElement): HTMLElement | null {
  if (!el.matches('.cv-project-row')) {
    const folder = el.closest('.cv-project')?.querySelector<HTMLElement>(':scope > .cv-project-row');
    if (folder) return folder;
  }
  return el.closest('.cv-fold')?.previousElementSibling?.querySelector<HTMLElement>('.cv-section-toggle') ?? null;
}
export function treeKeys(e: KeyboardEvent, tree: HTMLElement, ROW: string, search: HTMLInputElement | null, reveal: (row: Element) => void) {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const target = e.target as HTMLElement;
  if (!target.matches(ROW) || target.closest('[role="menu"], .row-menu')) return;
  const rows = [...tree.querySelectorAll<HTMLElement>(ROW)].filter(shown);
  const i = rows.indexOf(target);
  if (i < 0) return;
  const expanded = target.getAttribute('aria-expanded');
  let next: HTMLElement | null | undefined = null;
  if (e.key === 'ArrowDown') next = rows[i + 1];
  else if (e.key === 'ArrowUp') next = i === 0 ? search : rows[i - 1];
  else if (e.key === 'Home') next = rows[0];
  else if (e.key === 'End') next = rows[rows.length - 1];
  else if (e.key === 'ArrowRight' && expanded === 'false') { e.preventDefault(); target.click(); return; }
  else if (e.key === 'ArrowRight' && expanded === 'true') next = rows[i + 1];
  else if (e.key === 'ArrowLeft' && expanded === 'true') { e.preventDefault(); target.click(); return; }
  else if (e.key === 'ArrowLeft') next = parentRow(target);
  else return;
  e.preventDefault();
  if (next) { next.focus({ preventScroll: true }); reveal(next); }
}
