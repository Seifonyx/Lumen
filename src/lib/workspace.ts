// Coding workspace: a chat linked to a GitHub repository. Keeps the repo's file list and file
// contents cached for the session, reads files with uncommitted edits taken into account, and
// writes the instructions that tell models how to read files and propose edits.

import type { Attachment, Chat, RepoLink } from '../types';
import { getFile, getTree, type TreeEntry } from './github';
import { uid } from './util';

const trees = new Map<string, Promise<{ files: TreeEntry[]; truncated: boolean }>>();
const files = new Map<string, Promise<string | null>>();
const key = (r: RepoLink) => `${r.owner}/${r.repo}@${r.branch}`;

export function repoTree(r: RepoLink, refresh = false) {
  const k = key(r);
  if (refresh || !trees.has(k)) {
    const p = getTree(r.owner, r.repo, r.branch);
    trees.set(k, p);
    p.catch(() => trees.delete(k));
  }
  return trees.get(k)!;
}

/** The file as it is on GitHub (cached for this session). */
export function originalFile(r: RepoLink, path: string): Promise<string | null> {
  const k = `${key(r)}:${path}`;
  if (!files.has(k)) {
    const p = getFile(r.owner, r.repo, path, r.branch);
    files.set(k, p);
    p.catch(() => files.delete(k));
  }
  return files.get(k)!;
}

/** The file as this chat currently has it: uncommitted changes first, then GitHub. */
export async function currentFile(chat: Chat, path: string): Promise<string | null> {
  if (!chat.repo) return null;
  const change = chat.changes?.[path];
  if (change) return change.content;
  return originalFile(chat.repo, path);
}

/** Forget cached files after a commit or branch switch. */
export function forgetRepo(r: RepoLink) {
  const prefix = key(r);
  trees.delete(prefix);
  for (const k of [...files.keys()]) if (k.startsWith(`${prefix}:`)) files.delete(k);
}

/** Small, stable fingerprint of a file's text (to know whether it was already sent). */
export function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${(h >>> 0).toString(36)}`;
}

const MAX_FILE = 200_000;

/** Repository files as chat attachments (the model sees them inside <file name="path"> tags). */
export async function filesAsAttachments(chat: Chat, paths: string[]): Promise<{ files: Attachment[]; missing: string[] }> {
  const out: Attachment[] = [];
  const missing: string[] = [];
  for (const path of paths) {
    const text = await currentFile(chat, path).catch(() => null);
    if (text === null) {
      missing.push(path);
      continue;
    }
    const body = text.length > MAX_FILE ? `${text.slice(0, MAX_FILE)}\n…(file cut: ${text.length.toLocaleString()} characters in total)` : text;
    out.push({ id: uid(), kind: 'text', name: path, mime: 'text/plain', size: text.length, text: body });
  }
  return { files: out, missing };
}

// Files that only cost tokens in the overview.
export const NOISE = /(^|\/)(\.git|node_modules|dist|build|\.next|coverage|vendor)\/|\.(png|jpe?g|gif|webp|ico|svg|woff2?|ttf|eot|otf|mp[34]|mov|zip|gz|pdf|lock)$|(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;

/** Repository files the model has already been given in this chat (attached, loaded or kept in context). */
export function seenPaths(chat: Chat): Set<string> {
  const seen = new Set(chat.context || []);
  for (const m of chat.messages) if (m.role === 'user') for (const f of m.files || []) seen.add(f.name);
  return seen;
}

/**
 * Repository files a reply names, e.g. "please share `src/App.tsx` and store.ts". Matches exact paths,
 * paths ending in what was written (components/App.tsx) and file names that only one file has.
 */
export function mentionedPaths(text: string, all: TreeEntry[]): string[] {
  const paths = all.map((f) => f.path).filter((p) => !NOISE.test(p));
  const set = new Set(paths);
  const out: string[] = [];
  const prose = text.replace(/(`{3,}|~{3,})[\s\S]*?\1/g, ' '); // not inside code blocks
  for (const m of prose.matchAll(/[\w@~.\-/]*[\w-]\.[A-Za-z][A-Za-z0-9]{0,7}\b/g)) {
    const t = m[0].replace(/^\.?\//, '').replace(/[.,:;]+$/, '');
    if (!t || /^https?:|^www\./i.test(t) || t.length < 3) continue;
    let hit = set.has(t) ? t : '';
    if (!hit) {
      const ends = paths.filter((p) => p.endsWith(`/${t}`));
      if (ends.length === 1) hit = ends[0];
    }
    if (hit && !out.includes(hit)) out.push(hit);
    if (out.length >= 8) break;
  }
  return out;
}

/** A reply that asks the user for code or files instead of reading them itself. */
export const asksForFiles = (text: string) =>
  /\b(please|could you|can you|kindly)\s+(share|provide|send|paste|upload|show)|\b(need|want|have) to (see|look at|read|check)|\b(contents?|code) of\b|\bshare (the|your)\b|\bpaste (the|your)\b|\bwhich file/i.test(text);

/** Instructions for a chat that works on a repository. */
export function workspaceInstructions(r: RepoLink, all: TreeEntry[], truncated: boolean, context: string[], map = ''): string {
  const listed = all.filter((f) => !NOISE.test(f.path));
  let list = '';
  let shown = 0;
  for (const f of listed) {
    if (list.length + f.path.length > 40_000) break;
    list += `${f.path}\n`;
    shown++;
  }
  const more = listed.length - shown + (truncated ? 1 : 0);
  return [
    `# Coding workspace: ${r.owner}/${r.repo} (branch ${r.branch})`,
    "You're helping the user change this GitHub repository. Its files:",
    `<repository_files>\n${list}${more > 0 ? `…and ${more} more\n` : ''}</repository_files>`,
    map ? `What each source file defines (top-level functions, classes, components, types):\n<project_map>\n${map}</project_map>` : '',
    context.length ? `The user keeps these files attached: ${context.join(', ')}.` : '',
    'Attached files appear inside <file name="path"> tags and are the current versions (including edits not committed yet).',
    "## Reading files\nYou can read any file in the list yourself — never ask the user to paste or share code. To read files that aren't attached, end your reply with one line per file, exactly like this, and write nothing after them:\n[[read: src/App.tsx]]\n[[read: package.json]]\nUse exact paths from the list (up to 8 at a time). The app loads them and you continue. Read a file before editing it — never guess its contents.",
    "## Searching the code\nTo find where something is defined or used, end your reply with [[search: text]] (case-insensitive; /regex/ also works; up to 4 searches). You get matching lines as path:line, then read the files you need. Search instead of guessing which file to change.",
    '## Changing files',
    'To change code, use edit blocks fenced with four backticks:',
    '````edit:path/to/file.ext\n<<<<<<< SEARCH\nexact lines copied from the current file\n=======\nthe new lines\n>>>>>>> REPLACE\n````',
    '- SEARCH must match the current file exactly, including indentation, and be unique: a few lines around the change, not the whole file. Several SEARCH/REPLACE pairs can go in one block.',
    '- For a new file, or to rewrite a short file completely, put the whole content in an edit block with no SEARCH/REPLACE markers.',
    '- To delete a file: ````delete:path/to/file```` with nothing inside.',
    "- Don't use file:… blocks for repository files. Keep changes focused, then briefly say what you changed and why. The user reviews and applies each edit, then commits from the app.",
    "## No terminal\nThe user works only in this app (often on a phone): there is no terminal, and they can't run commands, install packages or run git. Never tell them to run anything. Fix every problem yourself with edit blocks (to add a dependency, edit package.json). GitHub runs the project's checks after each commit, and the app sends you the results if they fail.",
    '- Each edit block must have complete marker lines (<<<<<<< SEARCH, =======, >>>>>>> REPLACE) and nothing else from these markers may end up in the code.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A branch name for committing, e.g. "model-router/fix-login-button". */
export function suggestBranch(text: string): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
  return `model-router/${slug || new Date().toISOString().slice(0, 10)}`;
}
