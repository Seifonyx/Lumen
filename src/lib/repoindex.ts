// Repository index for the coding workspace: the text of the project's source files, loaded once per
// session, so models can search the code ([[search: term]]), see a map of what each file defines,
// and get the files a request is about attached without asking.

import type { Chat, RepoLink } from '../types';
import type { TreeEntry } from './github';
import { NOISE, originalFile, repoTree } from './workspace';

const TEXT = /\.(m?[jt]sx?|cjs|cts|mts|vue|svelte|astro|html?|css|scss|less|json|jsonc|ya?ml|toml|md|mdx|txt|py|rb|go|rs|java|kt|kts|swift|c|cc|cpp|h|hpp|cs|php|sh|bash|zsh|sql|graphql|gql|prisma|rules|xml|ini|env\.example|gradle|dart|lua|r|scala|ex|exs|erl|clj|elm|hs)$|(^|\/)(Dockerfile|Makefile|Procfile|\.gitignore|\.editorconfig|LICENSE|README)$/i;
const MAX_FILES = 400;
const MAX_FILE = 150_000;
const MAX_TOTAL = 4_000_000;

export interface RepoIndex {
  /** path → text as on GitHub */
  files: Map<string, string>;
  /** false when the repo was too big to load everything */
  complete: boolean;
}

const indexes = new Map<string, Promise<RepoIndex>>();
const key = (r: RepoLink) => `${r.owner}/${r.repo}@${r.branch}`;

/** Which files are worth indexing, smallest first so a big repo still gets the most files. */
export function indexable(all: TreeEntry[]): { take: TreeEntry[]; complete: boolean } {
  const wanted = all.filter((f) => !NOISE.test(f.path) && TEXT.test(f.path) && f.size <= MAX_FILE && !/\.min\.(js|css)$/.test(f.path));
  const take: TreeEntry[] = [];
  let total = 0;
  for (const f of [...wanted].sort((a, b) => a.size - b.size)) {
    if (take.length >= MAX_FILES || total + f.size > MAX_TOTAL) break;
    take.push(f);
    total += f.size;
  }
  return { take, complete: take.length === wanted.length };
}

/** Loads (once per session) the text of the repository's source files. */
export function repoIndex(r: RepoLink): Promise<RepoIndex> {
  const k = key(r);
  if (!indexes.has(k)) {
    const p = (async () => {
      const tree = await repoTree(r);
      const { take, complete } = indexable(tree.files);
      const files = new Map<string, string>();
      const queue = [...take];
      const worker = async () => {
        for (let f = queue.shift(); f; f = queue.shift()) {
          const text = await originalFile(r, f.path).catch(() => null);
          if (text !== null) files.set(f.path, text);
        }
      };
      await Promise.all(Array.from({ length: 8 }, worker));
      return { files, complete: complete && !tree.truncated };
    })();
    indexes.set(k, p);
    p.catch(() => indexes.delete(k));
  }
  return indexes.get(k)!;
}

export function forgetIndex(r?: RepoLink) {
  if (!r) { indexes.clear(); return; }
  indexes.delete(key(r));
}

/** The index if it's ready within `ms`, otherwise null (it keeps loading in the background). */
export async function indexSoon(r: RepoLink, ms: number): Promise<RepoIndex | null> {
  return Promise.race([repoIndex(r).catch(() => null), new Promise<null>((res) => setTimeout(() => res(null), ms))]);
}

/** Current text of every indexed file, with this chat's uncommitted changes on top. */
function currentTexts(chat: Chat, index: RepoIndex): Map<string, string> {
  const out = new Map(index.files);
  for (const [path, change] of Object.entries(chat.changes || {})) {
    if (change.content === null) out.delete(path);
    else out.set(path, change.content);
  }
  return out;
}

// ---------------------------------------------------------------- search

const SEARCH = /\[\[?\s*(?:search|grep|find)\s*:\s*([^\]\n]+?)\s*\]\]?/gi;

/** "Search the code" requests in a reply: [[search: useStore]] */
export function searchRequests(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(SEARCH)) {
    const q = m[1].trim().replace(/^[`'"]+|[`'"]+$/g, '');
    if (q.length >= 2) out.add(q);
  }
  return [...out].slice(0, 4);
}

export const replaceSearchRequests = (text: string, fn: (q: string) => string) => text.replace(SEARCH, (_, q) => fn(q.trim().replace(/^[`'"]+|[`'"]+$/g, '')));

export interface SearchResult {
  query: string;
  count: number;
  text: string;
}

/** Finds a word or phrase (or /regex/) in the code: "path:line: text" lines, a few per file. */
export function searchCode(chat: Chat, index: RepoIndex, query: string): SearchResult {
  let re: RegExp;
  const rx = /^\/(.+)\/([a-z]*)$/.exec(query);
  try {
    re = rx ? new RegExp(rx[1], rx[2].includes('i') ? 'i' : '') : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  } catch {
    re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  const lines: string[] = [];
  let count = 0;
  let filesHit = 0;
  for (const [path, text] of [...currentTexts(chat, index)].sort(([a], [b]) => a.localeCompare(b))) {
    const hits: string[] = [];
    let inFile = 0;
    if (re.test(path)) hits.push(`${path}: (file name matches)`);
    text.split('\n').forEach((line, i) => {
      if (!re.test(line)) return;
      inFile++;
      if (hits.length < 6) hits.push(`${path}:${i + 1}: ${line.trim().slice(0, 160)}`);
    });
    if (!hits.length) continue;
    filesHit++;
    count += Math.max(inFile, 1);
    if (lines.length < 60) lines.push(...hits, ...(inFile > 6 ? [`${path}: …${inFile - 6} more`] : []));
  }
  const head = count ? `Search for "${query}": ${count} match${count === 1 ? '' : 'es'} in ${filesHit} file${filesHit === 1 ? '' : 's'}${lines.length >= 60 ? ' (first 60 lines shown)' : ''}.` : `Search for "${query}": no matches.`;
  return { query, count, text: [head, ...lines.slice(0, 60), index.complete ? '' : '(Only part of this big repository was searched.)'].filter(Boolean).join('\n') };
}

// ---------------------------------------------------------------- project map

/** Names a file defines at the top level: functions, classes, components, types. */
export function outline(path: string, text: string): string[] {
  const names: string[] = [];
  const add = (n?: string) => n && !names.includes(n) && names.push(n);
  if (/\.(m?[jt]sx?|cjs|cts|mts|vue|svelte|astro)$/.test(path)) {
    for (const m of text.matchAll(/^export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum|abstract\s+class)\s+([A-Za-z_$][\w$]*)/gm)) add(m[1]);
    for (const m of text.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^class\s+([A-Za-z_$][\w$]*)/gm)) add(m[1] || m[2]);
    for (const m of text.matchAll(/^export\s*\{([^}]+)\}/gm)) m[1].split(',').forEach((s) => add(s.trim().split(/\s+as\s+/).pop()?.trim()));
  } else if (/\.py$/.test(path)) {
    for (const m of text.matchAll(/^(?:async\s+)?def\s+(\w+)|^class\s+(\w+)/gm)) add(m[1] || m[2]);
  } else if (/\.go$/.test(path)) {
    for (const m of text.matchAll(/^func\s+(?:\([^)]*\)\s*)?(\w+)|^type\s+(\w+)/gm)) add(m[1] || m[2]);
  } else if (/\.(java|kt|cs|swift|dart|php|rb|rs)$/.test(path)) {
    for (const m of text.matchAll(/^\s*(?:pub\s+|public\s+|export\s+)?(?:class|interface|struct|enum|trait|fn|def|func|object)\s+(\w+)/gm)) add(m[1]);
  }
  return names.slice(0, 24);
}

/** "path: name, name…" for every indexed source file with definitions (kept short). */
export function projectMap(chat: Chat, index: RepoIndex, limit = 8000): string {
  let out = '';
  for (const [path, text] of [...currentTexts(chat, index)].sort(([a], [b]) => a.localeCompare(b))) {
    const names = outline(path, text);
    if (!names.length) continue;
    const line = `${path}: ${names.join(', ')}\n`;
    if (out.length + line.length > limit) {
      out += '…\n';
      break;
    }
    out += line;
  }
  return out;
}

// ---------------------------------------------------------------- relevant files

const STOP = new Set('this that with from have what when where which there their them then than they will would should could about into make made change changes code file files please want need does doesnt dont also just like more some your mine work works working add remove update fix fixes bug bugs page app the and for not but can how why use using used show button'.split(' '));
const stem = (w: string) => w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '');
const words = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem);

/**
 * Files a request is probably about, best first: file names matching its words count most, then
 * folders, then the names the file defines (e.g. "loadCatalog" → store.ts).
 */
export function relevantFiles(text: string, all: TreeEntry[], index: RepoIndex | null, max = 3): string[] {
  const want = new Set(words(text));
  if (!want.size) return [];
  const exact = new Set(text.match(/[A-Za-z_$][\w$]{3,}/g) || []);
  const scored: [string, number][] = [];
  for (const f of all) {
    if (NOISE.test(f.path) || !TEXT.test(f.path) || f.size > 60_000 || /\.(json|lock|md|txt)$/.test(f.path)) continue;
    const parts = f.path.split('/');
    const base = parts.pop()!.replace(/\.[^.]+$/, '');
    let score = 0;
    for (const w of new Set(words(base))) if (want.has(w)) score += 3;
    for (const w of new Set(parts.flatMap(words))) if (want.has(w)) score += 1;
    const body = index?.files.get(f.path);
    if (body) for (const n of outline(f.path, body)) if (exact.has(n)) score += 4;
    if (score >= 3) scored.push([f.path, score]);
  }
  return scored.sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).slice(0, max).map(([p]) => p);
}
