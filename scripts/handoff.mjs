// Lumen's live state, computed on demand so it can never go stale (it is not stored in the repo).
//
//   npm run handoff                    branch, main, production deploy, open PRs, stray branches
//   node scripts/handoff.mjs --offline git only (no GitHub API or live-site check)
//   node scripts/handoff.mjs --check   non-blocking reminder when a commit omits HANDOFF.md
//
// Claude Code prints this at session start (.claude/settings.json); other agents can run it on demand.
// HANDOFF.md is the current checkpoint; AGENTS.md asks agents to update it as they work.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const REPO = 'Seifonyx/Lumen';
const SITE = 'https://lumen-chat.web.app/';
const args = new Set(process.argv.slice(2));
const offline = args.has('--offline');

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const short = (sha) => (sha || '').slice(0, 7);
const handoffBranch = () => readFileSync(new URL('../HANDOFF.md', import.meta.url), 'utf8').match(/^- \*\*Branch:\*\* `([^`]+)`/m)?.[1];

if (args.has('--check')) {
  // Remind on every branch, including main and an already-described branch; never block a commit.
  const staged = git('diff', '--cached', '--name-only').split('\n').filter(Boolean);
  if (staged.length && !staged.includes('HANDOFF.md'))
    console.error('\nhandoff: update HANDOFF.md with progress, checks and the next action before you stop.\n');
  process.exit(0);
}

async function json(url) {
  const response = await fetch(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'lumen-handoff' }, signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

async function github() {
  if (offline) return null;
  try {
    const [deploys, pulls] = await Promise.all([
      json(`https://api.github.com/repos/${REPO}/actions/workflows/deploy.yml/runs?status=success&per_page=1`),
      json(`https://api.github.com/repos/${REPO}/pulls?state=open&per_page=20`),
    ]);
    const run = deploys.workflow_runs?.[0];
    return {
      deploy: run && { sha: run.head_sha, at: run.updated_at?.slice(0, 16).replace('T', ' '), url: run.html_url },
      pulls: pulls.map((p) => ({ number: p.number, title: p.title, branch: p.head?.ref, draft: p.draft, url: p.html_url })),
    };
  } catch { return null; }
}

async function liveAsset() {
  if (offline) return '';
  try {
    const html = await (await fetch(SITE, { signal: AbortSignal.timeout(4000) })).text();
    return html.match(/assets\/(index-[\w-]+\.js)/)?.[1] || '';
  } catch { return ''; }
}

if (!offline) git('fetch', 'origin', '--quiet', '--prune');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const head = git('log', '-1', '--format=%h %s');
const main = git('log', '-1', '--format=%h %s (%cs)', 'origin/main');
const [behind, ahead] = (git('rev-list', '--left-right', '--count', 'origin/main...HEAD') || '? ?').split(/\s+/);
const dirty = git('status', '--porcelain').split('\n').filter(Boolean);
const recent = git('log', '-6', '--first-parent', '--format=%h %s (%cs)', 'origin/main').split('\n').filter(Boolean).map((l) => `  ${l}`).join('\n');
const unmerged = git('branch', '--no-merged', 'origin/main', '--format=%(refname:short)').split('\n').filter(Boolean);
const [hub, asset] = await Promise.all([github(), liveAsset()]);

const out = ['Lumen live state (scripts/handoff.mjs)', ''];
out.push(`Branch      ${branch} at ${head}; ${ahead} ahead, ${behind} behind origin/main`);
out.push(`Worktree    ${dirty.length ? `${dirty.length} uncommitted file(s): ${dirty.slice(0, 8).map((l) => l.slice(3)).join(', ')}${dirty.length > 8 ? ', …' : ''}` : 'clean'}`);
out.push(`main        ${main || 'unknown'}`);
if (hub?.deploy) {
  const pending = git('rev-list', '--count', `${hub.deploy.sha}..origin/main`);
  out.push(`Production  last successful Deploy built ${short(hub.deploy.sha)} at ${hub.deploy.at} UTC${asset ? ` (live entry ${asset})` : ''}`);
  out.push(`            ${pending && pending !== '0' ? `main is ${pending} commit(s) past it; docs-only commits need no deploy` : 'main matches production'}  ${hub.deploy.url}`);
} else out.push(`Production  ${offline ? 'not checked (offline)' : 'GitHub unreachable; check the Deploy workflow'}${asset ? `; live entry ${asset}` : ''}`);
if (hub) out.push(`Open PRs    ${hub.pulls.length ? hub.pulls.map((p) => `#${p.number} ${p.title} (${p.branch}${p.draft ? ', draft' : ''})`).join('\n            ') : 'none'}`);
out.push(`Unmerged    ${unmerged.length ? unmerged.join(', ') : 'none'} (local branches not in main)`);
const described = handoffBranch();
out.push(`HANDOFF.md  "Now" describes ${described ? `\`${described}\`` : 'no branch'}${described && described !== branch && branch !== 'main' ? ' — not this branch; it may be out of date' : ''}`);
out.push('', 'Recent main:', recent || '  unknown', '', 'Next: read AGENTS.md and HANDOFF.md; keep the checkpoint current as you work.');
console.log(out.join('\n'));
