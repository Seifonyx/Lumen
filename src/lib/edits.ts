// Code edits written by models, in blocks like:
//   ````edit:src/app.ts                 ````delete:old/file.ts
//   <<<<<<< SEARCH                      ````
//   exact old lines
//   =======
//   new lines
//   >>>>>>> REPLACE
//   ````
// An edit block without SEARCH/REPLACE markers is the whole new file (or a new file).

import { diffLines } from 'diff';

export interface Hunk {
  search: string;
  replace: string;
}

export type Edit =
  | { kind: 'patch'; path: string; hunks: Hunk[] }
  | { kind: 'write'; path: string; content: string }
  | { kind: 'delete'; path: string };

const HUNK = /<{5,9} ?SEARCH[^\n]*\n([\s\S]*?)\n?={5,9}[^\n]*\n([\s\S]*?)\n?>{5,9} ?REPLACE[^\n]*/g;

export const EDIT_FENCE = /^(edit|delete)[:\s]\s*(.+?)\s*$/i;

/** Cleans a path a model wrote ("./src/a.ts", "`src/a.ts`") into a repo path. */
export function cleanPath(p: string): string {
  return p.trim().replace(/^[`'"]+|[`'"]+$/g, '').replace(/^\.?\//, '').replace(/\\/g, '/');
}

export function parseEdit(kind: 'edit' | 'delete', rawPath: string, body: string): Edit {
  const path = cleanPath(rawPath);
  if (kind === 'delete') return { kind: 'delete', path };
  const hunks: Hunk[] = [];
  HUNK.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = HUNK.exec(body)); ) hunks.push({ search: m[1], replace: m[2] });
  if (hunks.length) return { kind: 'patch', path, hunks };
  return { kind: 'write', path, content: body.endsWith('\n') ? body : `${body}\n` };
}

/** Finds `search` in `text`: exactly, or line by line ignoring indentation and trailing spaces. */
function locate(text: string, search: string): { start: number; end: number } | null {
  if (!search.trim()) return null;
  const exact = text.indexOf(search);
  if (exact >= 0) return { start: exact, end: exact + search.length };
  const lines = text.split('\n');
  const want = search.replace(/\n+$/, '').split('\n').map((l) => l.trim());
  // Skip blank lines at the edges of the search, which models often add or drop.
  while (want.length && !want[0]) want.shift();
  while (want.length && !want[want.length - 1]) want.pop();
  if (!want.length) return null;
  outer: for (let i = 0; i + want.length <= lines.length; i++) {
    for (let j = 0; j < want.length; j++) if (lines[i + j].trim() !== want[j]) continue outer;
    const start = lines.slice(0, i).join('\n').length + (i ? 1 : 0);
    const end = start + lines.slice(i, i + want.length).join('\n').length;
    return { start, end };
  }
  return null;
}

/**
 * When the model's SEARCH only matched with different indentation, gives each replacement line the
 * file's indentation: from the original line it matches, else the line at the same position, else
 * the line before it.
 */
function reindent(found: string, search: string, replace: string): string {
  const ws = (l: string) => /^[ \t]*/.exec(l)?.[0] ?? '';
  const foundLines = found.split('\n');
  const searchLines = search.replace(/\n+$/, '').split('\n').filter((l) => l.trim());
  const realLines = foundLines.filter((l) => l.trim());
  const byText = new Map<string, string>();
  searchLines.forEach((l, i) => realLines[i] !== undefined && byText.set(l.trim(), ws(realLines[i])));
  const out: string[] = [];
  let k = 0;
  for (const line of replace.split('\n')) {
    if (!line.trim()) {
      out.push(line);
      continue;
    }
    const indent = byText.get(line.trim()) ?? (realLines[k] !== undefined && replace.split('\n').filter((l) => l.trim()).length === realLines.length ? ws(realLines[k]) : ws(out.filter((l) => l.trim()).at(-1) || ''));
    out.push(indent + line.trimStart());
    k++;
  }
  return out.join('\n');
}

export type ApplyResult = { ok: true; text: string } | { ok: false; failed: number; text: string };

/** Applies an edit to a file's current text (null = the file doesn't exist). */
export function applyEdit(current: string | null, edit: Edit): ApplyResult & { deleted?: boolean } {
  if (edit.kind === 'delete') return current === null ? { ok: false, failed: 1, text: '' } : { ok: true, text: '', deleted: true };
  if (edit.kind === 'write') return { ok: true, text: edit.content };
  let text = current ?? '';
  let failed = 0;
  for (const h of edit.hunks) {
    if (!h.search.trim()) {
      // An empty SEARCH adds to the end (or creates the file).
      text = text ? `${text.replace(/\n?$/, '\n')}${h.replace}\n` : `${h.replace}\n`;
      continue;
    }
    const at = locate(text, h.search);
    if (!at) {
      failed++;
      continue;
    }
    const found = text.slice(at.start, at.end);
    // Exact matches keep the model's text as written; looser matches get the file's indentation.
    const replacement = found === h.search || text.includes(h.search) ? h.replace : reindent(found, h.search, h.replace);
    text = text.slice(0, at.start) + replacement + text.slice(at.end);
  }
  return failed ? { ok: false, failed, text } : { ok: true, text };
}

/** Has this edit already been applied to `current`? */
export function isApplied(current: string | null | undefined, edit: Edit): boolean {
  if (current === undefined) return false;
  if (edit.kind === 'delete') return current === null;
  if (current === null) return false;
  if (edit.kind === 'write') return current.replace(/\s+$/, '') === edit.content.replace(/\s+$/, '');
  return edit.hunks.every((h) => (h.replace.trim() ? Boolean(locate(current, h.replace)) : !locate(current, h.search)));
}

/** Lines added and removed between two versions. */
export function lineStats(before: string, after: string): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const part of diffLines(before, after)) {
    if (part.added) added += part.count || 0;
    if (part.removed) removed += part.count || 0;
  }
  return { added, removed };
}

export interface DiffLine {
  type: 'add' | 'del' | 'same' | 'gap';
  text: string;
  oldNo?: number;
  newNo?: number;
}

/** A unified diff with 3 lines of context around each change. */
export function unifiedDiff(before: string, after: string, context = 3): DiffLine[] {
  const rows: DiffLine[] = [];
  let a = 1;
  let b = 1;
  for (const part of diffLines(before, after)) {
    const lines = part.value.replace(/\n$/, '').split('\n');
    for (const text of lines) {
      if (part.added) rows.push({ type: 'add', text, newNo: b++ });
      else if (part.removed) rows.push({ type: 'del', text, oldNo: a++ });
      else rows.push({ type: 'same', text, oldNo: a++, newNo: b++ });
    }
  }
  // Collapse long unchanged stretches.
  const keep = rows.map((r, i) => r.type !== 'same' || rows.slice(Math.max(0, i - context), i + context + 1).some((x) => x.type !== 'same'));
  const out: DiffLine[] = [];
  rows.forEach((r, i) => {
    if (keep[i]) out.push(r);
    else if (out[out.length - 1]?.type !== 'gap') out.push({ type: 'gap', text: '' });
  });
  return out;
}

// Ways models ask to read a file: [[read: a.ts]] (the one we ask for), and the variants free models
// write instead: [read: a.ts], [[read a.ts]], <read>a.ts</read>, read_file("a.ts"), READ: `a.ts`.
const READ_PATTERNS = [
  /\[\[?\s*read(?:_?file)?\s*(?::\s*|\s+)([^\]\n]+?)\s*\]\]?/gi,
  /<read(?:_file)?>\s*([^<\n]+?)\s*<\/read(?:_file)?>/gi,
  /\bread_?file\(\s*["'`]([^"'`\n]+)["'`]\s*\)/gi,
  /^\s*READ\s*:\s*`?([^`\n]+?)`?\s*$/gm,
];
// A file path: no spaces, and a folder or an extension ("[read more]" is not one).
const looksLikePath = (p: string) => Boolean(p) && !/\s/.test(p) && /[./]/.test(p);

/** "Please read this" requests in a reply: [[read: src/app.ts]] and common variants. */
export function readRequests(text: string): string[] {
  const out = new Set<string>();
  for (const re of READ_PATTERNS) for (const m of text.matchAll(re)) {
    const p = cleanPath(m[1]);
    if (looksLikePath(p)) out.add(p);
  }
  return [...out].slice(0, 8);
}

/** The same requests, for display: the text with each one replaced. */
export function replaceReadRequests(text: string, fn: (path: string) => string): string {
  return READ_PATTERNS.reduce((t, re) => t.replace(re, (all, p) => (looksLikePath(cleanPath(p)) ? fn(cleanPath(p)) : all)), text);
}
