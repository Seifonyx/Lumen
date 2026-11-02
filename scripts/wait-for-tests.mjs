// Deploy's gate: waits for the full Tests run on the commit being deployed and fails unless it passed. Pull requests
// run only the affected tests; the full set runs after merging, and nothing ships before it passes.
// A commit that changed only documentation has no Tests run of its own (the workflow skips it): then the newest
// passing run on an earlier main commit counts, provided everything since it is documentation.
//   GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA (set by Actions). WAIT_MINUTES (default 45).
import { execFileSync } from 'node:child_process';

const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, GITHUB_SHA: sha } = process.env;
const deadline = Date.now() + Number(process.env.WAIT_MINUTES || 45) * 60_000;
const docsOnly = (f) => f.endsWith('.md') || f.startsWith('docs/');
const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8' }).trim(); } catch { return null; } };
const api = async (path) => { const r = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } }); if (!r.ok) throw new Error(`${r.status} ${path}`); return r.json(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let noted = '';
const say = (m) => { if (m !== noted) console.log(m); noted = m; };
for (let first = Date.now(); Date.now() < deadline; await sleep(30_000)) {
  const { workflow_runs: runs } = await api('/actions/workflows/tests.yml/runs?branch=main&per_page=40');
  const mine = runs.filter((r) => r.head_sha === sha && r.event !== 'pull_request');
  const done = mine.find((r) => r.status === 'completed' && r.conclusion === 'success');
  if (done) { console.log(`✓ Tests passed on ${sha.slice(0, 7)}: ${done.html_url}`); process.exit(0); }
  const running = mine.find((r) => r.status !== 'completed');
  if (running) { say(`Waiting for Tests on ${sha.slice(0, 7)}: ${running.html_url}`); continue; }
  if (mine.length) { console.log(`✗ Tests did not pass on ${sha.slice(0, 7)} (${mine[0].conclusion}): ${mine[0].html_url}`); process.exit(1); }
  // No run for this commit: fine only when it changed nothing but documentation since the newest tested commit before
  // it, and that commit's run passes (waiting for it if it is still running).
  const earlier = runs.find((r) => r.event !== 'pull_request' && git('merge-base', '--is-ancestor', r.head_sha, sha) !== null);
  const since = earlier && git('diff', '--name-only', earlier.head_sha, sha);
  if (typeof since === 'string' && since.split('\n').filter(Boolean).every(docsOnly)) {
    if (earlier.status !== 'completed') { say(`Only documentation since ${earlier.head_sha.slice(0, 7)}; waiting for its Tests: ${earlier.html_url}`); continue; }
    if (earlier.conclusion === 'success') { console.log(`✓ ${sha.slice(0, 7)} changed only documentation since ${earlier.head_sha.slice(0, 7)}, whose Tests passed: ${earlier.html_url}`); process.exit(0); }
    console.log(`✗ Tests did not pass on ${earlier.head_sha.slice(0, 7)}, the last tested commit before ${sha.slice(0, 7)}: ${earlier.html_url}`); process.exit(1);
  }
  // The run may not have been created yet just after a merge.
  if (Date.now() - first > 5 * 60_000) { console.log(`✗ No Tests run for ${sha.slice(0, 7)}; run the Tests workflow on main first.`); process.exit(1); }
  say(`Waiting for a Tests run on ${sha.slice(0, 7)} to appear…`);
}
console.log('✗ Gave up waiting for Tests.');
process.exit(1);
