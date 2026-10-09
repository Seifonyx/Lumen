// Test results after a commit: GitHub Actions runs for the commit (and commit statuses such as
// deploy previews), watched until they finish, with the failing part of the log for the model to fix.
// Needs the token's "Actions: Read" permission; without it the app says so instead.

import { gh, GitHubError } from './github';

export type CheckState = 'pending' | 'success' | 'failure' | 'neutral';

export interface Check {
  id: string;
  name: string;
  state: CheckState;
  url: string;
  /** Actions run id (for jobs and logs) */
  runId?: number;
}

export interface ChecksView {
  state: 'loading' | 'none' | 'pending' | 'success' | 'failure' | 'denied' | 'error';
  checks: Check[];
  error?: string;
}

const conclusion = (status: string, c: string | null): CheckState =>
  status !== 'completed' ? 'pending' : c === 'success' ? 'success' : c === 'skipped' || c === 'neutral' ? 'neutral' : 'failure';

export async function fetchChecks(owner: string, repo: string, sha: string): Promise<Check[]> {
  const runs = await gh<any>(`/repos/${owner}/${repo}/actions/runs?head_sha=${sha}&per_page=30`);
  const checks: Check[] = (runs.workflow_runs || []).map((r: any) => ({
    id: `run-${r.id}`,
    name: r.name || r.display_title || 'Workflow',
    state: conclusion(r.status, r.conclusion),
    url: r.html_url,
    runId: r.id,
  }));
  // Commit statuses (e.g. Vercel or Netlify previews): optional, the token may not allow them.
  try {
    const st = await gh<any>(`/repos/${owner}/${repo}/commits/${sha}/status`);
    for (const s of st.statuses || []) {
      checks.push({ id: `status-${s.context}`, name: s.context, state: s.state === 'success' ? 'success' : s.state === 'pending' ? 'pending' : 'failure', url: s.target_url || '' });
    }
  } catch {
    /* not allowed or none */
  }
  return checks;
}

export function overall(checks: Check[]): ChecksView['state'] {
  if (!checks.length) return 'none';
  if (checks.some((c) => c.state === 'pending')) return 'pending';
  return checks.some((c) => c.state === 'failure') ? 'failure' : 'success';
}

// ---------------------------------------------------------------- watching

type Listener = (v: ChecksView) => void;
interface Watch {
  view: ChecksView;
  listeners: Set<Listener>;
  timer?: ReturnType<typeof setTimeout>;
  started: number;
  tick: () => Promise<void>;
}
const watches = new Map<string, Watch>();

/**
 * Follows a commit's checks: every 15 s while anything runs (and for up to 2 minutes while none
 * have started), stopping when they finish, nobody is looking, or after 30 minutes.
 * Returns an unsubscribe function.
 */
export function watchChecks(owner: string, repo: string, sha: string, listener: Listener): () => void {
  const k = `${owner}/${repo}@${sha}`;
  let watch = watches.get(k);
  if (!watch) {
    const w: Watch = {
      view: { state: 'loading', checks: [] },
      listeners: new Set(),
      started: Date.now(),
      tick: async () => {
        w.timer = undefined;
        try {
          const checks = await fetchChecks(owner, repo, sha);
          w.view = { state: overall(checks), checks };
        } catch (e) {
          const denied = e instanceof GitHubError && (e.status === 403 || e.status === 404);
          w.view = { state: denied ? 'denied' : 'error', checks: [], error: (e as Error).message };
        }
        w.listeners.forEach((l) => l(w.view));
        const age = Date.now() - w.started;
        const again = w.view.state === 'pending' || w.view.state === 'error' || (w.view.state === 'none' && age < 120_000);
        if (again && age < 30 * 60_000 && w.listeners.size) w.timer = setTimeout(() => void w.tick(), 15_000);
      },
    };
    watches.set(k, w);
    watch = w;
    void w.tick();
  } else if (!watch.timer && ['pending', 'error'].includes(watch.view.state)) {
    // Coming back to a commit whose checks were still running: pick the polling up again.
    watch.started = Date.now();
    void watch.tick();
  }
  const w = watch;
  w.listeners.add(listener);
  listener(w.view);
  return () => {
    w.listeners.delete(listener);
    if (!w.listeners.size && w.timer) {
      clearTimeout(w.timer);
      w.timer = undefined;
    }
  };
}

// ---------------------------------------------------------------- failure details

/** The part of a log that explains a failure: error lines with the lines before them. */
export function logExcerpt(log: string, max = 8000): string {
  const lines = log.split(/\r?\n/).map((l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, '').replace(/\x1b\[[0-9;]*m/g, ''));
  const bad = /##\[error\]|\berror\b|\bfail(ed|ure|s)?\b|✗|✘|exception|traceback|cannot find|not found|exit code [1-9]/i;
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (!bad.test(l) || /^\s*(##\[group\]|Run |shell:)/.test(l)) return;
    for (let j = Math.max(0, i - 12); j <= Math.min(lines.length - 1, i + 3); j++) keep.add(j);
  });
  let picked = [...keep].sort((a, b) => a - b);
  if (!picked.length) picked = lines.map((_, i) => i).slice(-80);
  let out = '';
  let prev = -2;
  for (const i of picked) {
    if (i !== prev + 1) out += '…\n';
    out += `${lines[i]}\n`;
    prev = i;
  }
  // Too long: keep the end, where the decisive errors usually are.
  return out.length > max ? `…\n${out.slice(out.length - max)}` : out;
}

export interface FailureReport {
  summary: string;
  log: string;
}

/** What failed (workflow → job → step) and the relevant log lines, for the model. */
export async function failureReport(owner: string, repo: string, checks: Check[]): Promise<FailureReport> {
  const parts: string[] = [];
  const logs: string[] = [];
  for (const c of checks.filter((x) => x.state === 'failure')) {
    if (!c.runId) {
      parts.push(`${c.name} failed${c.url ? ` (${c.url})` : ''}`);
      continue;
    }
    const jobs = await gh<any>(`/repos/${owner}/${repo}/actions/runs/${c.runId}/jobs?per_page=50`).catch(() => ({ jobs: [] }));
    const failed = (jobs.jobs || []).filter((j: any) => j.conclusion === 'failure');
    if (!failed.length) parts.push(`Workflow "${c.name}" failed`);
    for (const j of failed.slice(0, 3)) {
      const steps = (j.steps || []).filter((s: any) => s.conclusion === 'failure').map((s: any) => s.name);
      parts.push(`Workflow "${c.name}", job "${j.name}" failed${steps.length ? ` at step "${steps.join('", "')}"` : ''}`);
      const log = await gh<string>(`/repos/${owner}/${repo}/actions/jobs/${j.id}/logs`, { raw: true }).catch(() => '');
      if (log) logs.push(`===== ${c.name} / ${j.name} =====\n${logExcerpt(log, 6000)}`);
    }
  }
  return { summary: parts.join('\n'), log: logs.join('\n\n') };
}
