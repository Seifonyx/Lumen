// Which tests a change can affect. Used by `npm run test:affected` (local) and scripts/ci-plan.mjs (pull requests).
// Changed test files, and suites using a changed test helper, are always in. For each changed app file it collects the
// words a test could use to find the changed code (quoted strings such as labels and aria-labels, class names, JSX
// text) from the added and removed lines. A suite is affected when it quotes one of those words or uses one of those
// classes. Words found in more than an eighth of all suites say too little and are ignored, except a label or class
// that left its file entirely: old tests still look for it. Some changes reach everything; `broad` names them, and
// callers then run the full set.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, extname } from 'node:path';

export const E2E = 'tests/e2e', SEC = 'tests/security';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const listFile = (f) => readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
/** Suites per place they run: canvas-core (in-app on Canvas), canvas-phone (Canvas, directly), webkit (Safari engine). */
export const lists = () => ({ canvasCore: listFile(`${E2E}/canvas-core.txt`), canvasPhone: listFile(`${E2E}/canvas-phone.txt`), webkit: listFile(`${E2E}/webkit.txt`) });

// Files whose change can reach any test: build and test machinery, the app's entry, store and shared state.
const BROAD = [/^package(-lock)?\.json$/, /^vite.*\.config\.ts$/, /^tsconfig/, /^firebase\.json$/, /^index\.html$/, /^\.github\//,
  /^scripts\/(?!handoff|brand)/, /^server\//, /^src\/(main|App|store)\.tsx?$/, /^src\/lib\/(db|firebase|canvas-presentation(\.on)?|screen-history|back-stack|focus-scope|util)\.ts$/,
  /^src\/(app|glass)\.css$/, /^tests\/e2e\/helpers\/preview-profile\.cjs$/, /^tests\/e2e\/(canvas-core|canvas-phone|webkit)\.txt$/];

const NOISE = /^(?:true|false|null|none|auto|button|click|div|span|string|number|object|function|default|utf8|text|value|label|title|name|type|role|dialog|menu|main|link|img|input|submit|hidden|small|primary|success|error|info|light|dark|use strict)$/i;
const EVERYWHERE = new Set(['New chat', 'Send', 'Stop', 'Settings', 'Library', 'Router', 'Projects', 'Search', 'Close', 'Cancel', 'Save', 'Delete', 'Open sidebar', 'Open chats', 'Message', 'Return to chat']);
const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const used = (w) => w.startsWith('.') ? new RegExp(`${escape(w)}(?![\\w-])`) : new RegExp(`['"\`]${escape(w)}['"\`]|name: ?/\\^?${escape(w)}`);

export function affected({ base } = {}) {
  base ??= (() => { try { return git('merge-base', 'HEAD', 'origin/main'); } catch { return 'origin/main'; } })();
  const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  const changed = [...new Set([...git('diff', '--name-only', base).split('\n'), ...untracked].filter((f) => f && existsSync(f)))];
  const suites = readdirSync(E2E).filter((f) => f.endsWith('.cjs'));
  const contracts = readdirSync(SEC).filter((f) => /^private-qa-.+\.mjs$/.test(f) && f !== 'private-qa-isolation.mjs');
  const text = Object.fromEntries([...suites.map((f) => `${E2E}/${f}`), ...contracts.map((f) => `${SEC}/${f}`)].map((p) => [p, readFileSync(p, 'utf8')]));

  // Words a test could use to find the changed code in this file.
  const words = (file) => {
    const src = untracked.includes(file) ? readFileSync(file, 'utf8')
      : git('diff', '-U0', base, '--', file).split('\n').filter((l) => /^[+-](?![+-])/.test(l)).map((l) => l.slice(1)).join('\n');
    const out = new Set();
    // Kept: a class (".name"), a label (a capital letter or several words) or a hyphenated token. Dropped: code words
    // such as 'scroll', paths, URLs, template pieces and the labels every screen has.
    const add = (w) => {
      w = w.trim();
      const cls = /^\.[a-z][\w-]+$/i.test(w);
      if (w.length < 3 || w.length > 60 || !/[a-z]/i.test(w) || NOISE.test(w) || EVERYWHERE.has(w)) return;
      if (!cls && (!/[A-Z ]|-/.test(w) || /^[./@]|\$\{|\\|^https?:/.test(w))) return;
      out.add(w);
    };
    if (extname(file) === '.css') { for (const [, c] of src.matchAll(/\.([a-z][\w-]{2,})/gi)) add(`.${c}`); return out; }
    for (const [, , s] of src.matchAll(/(['"])((?:(?!\1)[^\n\\])+)\1/g)) {
      add(s);
      // className lists: each class on its own.
      if (/^[a-z][\w-]*(?: [a-z][\w-]*)+$/.test(s)) for (const c of s.split(' ')) if (c.includes('-')) add(`.${c}`);
      else if (/^[a-z]+-[\w-]+$/.test(s)) add(`.${s}`);
    }
    for (const [, t] of src.matchAll(/>\s*([A-Z][^<>{}\n]{2,58}?)\s*</g)) add(t);
    return out;
  };

  const hits = new Map(); // test path -> reasons
  const mark = (path, why) => { if (!hits.has(path)) hits.set(path, new Set()); hits.get(path).add(why); };
  for (const f of changed) {
    if (text[f]) mark(f, 'changed');
    if (f.startsWith(`${E2E}/helpers/`)) for (const p of Object.keys(text)) if (text[p].includes(`helpers/${basename(f)}`)) mark(p, `uses ${basename(f)}`);
  }
  const appFiles = changed.filter((f) => f.startsWith('src/') && /\.(tsx?|css)$/.test(f));
  const limit = Math.max(4, Math.ceil(Object.keys(text).length / 8));
  for (const f of appFiles) {
    const now = readFileSync(f, 'utf8');
    for (const w of words(f)) {
      const re = used(w), found = Object.keys(text).filter((p) => re.test(text[p]));
      const removed = !now.includes(w.startsWith('.') ? w.slice(1) : w);
      if (found.length && (removed || found.length <= limit)) for (const p of found) mark(p, `${basename(f)}: ${removed ? 'removed ' : ''}${w}`);
    }
  }
  const picked = [...hits.keys()].sort();
  return {
    base, changed, appFiles, hits, picked,
    broad: changed.filter((f) => BROAD.some((re) => re.test(f))),
    e2e: picked.filter((p) => p.startsWith(E2E)).map((p) => basename(p, '.cjs')),
    contracts: picked.filter((p) => p.startsWith(SEC)).map((p) => basename(p, '.mjs').replace('private-qa-', '')),
    total: suites.length,
  };
}
