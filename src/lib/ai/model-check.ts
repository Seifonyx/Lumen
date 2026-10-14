// Model check: sends each model one tiny request and sorts the result into what it means for the user.
//   working   answered
//   broken    can't be used (not found, retired, needs payment, not a chat model, no reply, keeps failing…) → removed
//   busy      rate limit or temporary quota → kept
//   key       the provider rejected the key → kept (fix the key; it affects every model of that provider)
// Safety: if every checked model of a provider fails to answer at all, that provider is treated as
// unreachable (outage or network) and nothing of it is removed.

export type Outcome = 'working' | 'broken' | 'busy' | 'key';
export type ProbeResult = { status: number; message?: string; text?: string; ms?: number; limit?: unknown; input?: number; output?: number };
export type CheckResult = { id: string; outcome: Outcome; reason: string; ms?: number };

const short = (m = '') => m.replace(/\s+/g, ' ').replace(/^\W+/, '').slice(0, 140);

/** What one probe result means. `retry` asks for a second, larger attempt before deciding. */
export function classify(r: ProbeResult): { outcome: Outcome; reason: string } | { retry: true; reason: string } {
  const msg = r.message || '';
  if (r.status === 200) return r.text?.trim() ? { outcome: 'working', reason: '' } : { retry: true, reason: 'Answered with nothing' };
  if (r.status === 0) return { retry: true, reason: short(msg) || 'No answer' };
  if (r.status === 401 || /invalid (?:api )?key|api key not valid|unauthori[sz]ed|authentication|incorrect api key/i.test(msg) && r.status < 500 && r.status !== 404) return { outcome: 'key', reason: 'The provider rejected your key' };
  if (r.status === 402 || /insufficient (?:credit|balance|fund)|requires? (?:a )?(?:paid|credits?)|payment required|billing/i.test(msg)) return { outcome: 'broken', reason: 'Needs paid credits' };
  if (r.status === 429) {
    // Free tier with a quota of zero means the model isn't free at all.
    if (/free.?tier/i.test(msg) && /(?:limit|quota(?:value)?)\s*[:=]\s*0\b/i.test(msg)) return { outcome: 'broken', reason: 'Not available on the free tier' };
    return { outcome: 'busy', reason: 'Rate limit reached; try again later' };
  }
  if (r.status === 403) {
    if (/model|access|permission|not allowed|not available|region|country/i.test(msg)) return { outcome: 'broken', reason: short(msg) || 'No access to this model' };
    return { outcome: 'key', reason: short(msg) || 'The provider refused the request' };
  }
  if (r.status === 404) return { outcome: 'broken', reason: /no endpoints/i.test(msg) ? 'No provider is serving it right now' : 'Model not found' };
  if (r.status === 410) return { outcome: 'broken', reason: 'Retired' };
  if (r.status >= 400 && r.status < 500) return { outcome: 'broken', reason: short(msg) || `Rejected the request (${r.status})` };
  if (r.status >= 500) return { retry: true, reason: short(msg) || `Server error (${r.status})` };
  return { outcome: 'broken', reason: short(msg) || 'Unexpected response' };
}

/** After a retry: a second empty, failed or timed-out attempt means the model isn't usable. */
export function settle(first: string, second: ProbeResult): { outcome: Outcome; reason: string } {
  const c = classify(second);
  if ('outcome' in c) return c;
  return { outcome: 'broken', reason: second.status === 200 ? 'Answers with nothing' : second.status === 0 ? `Not responding (${c.reason || first})` : `Keeps failing: ${c.reason}` };
}

type Probe = (id: string, signal: AbortSignal, options?: { maxTokens?: number }) => Promise<ProbeResult>;
type Progress = { done: number; total: number; current?: string; result?: CheckResult };

/**
 * Checks models, a few at a time per provider (providers run side by side). Calls onResult as soon as
 * each model is decided, so removals happen live and stopping keeps what was found.
 */
export async function checkModels(ids: string[], probe: Probe, signal: AbortSignal, onProgress: (p: Progress) => void, { perProvider = 2, pause = (ms: number) => new Promise((r) => setTimeout(r, ms)) } = {}): Promise<CheckResult[]> {
  const byProvider = new Map<string, string[]>();
  for (const id of ids) { const p = id.split(':')[0]; byProvider.set(p, [...(byProvider.get(p) || []), id]); }
  const results: CheckResult[] = [];
  let done = 0;
  const finish = (r: CheckResult) => { results.push(r); done++; onProgress({ done, total: ids.length, result: r }); };

  await Promise.all([...byProvider.entries()].map(async ([provider, list]) => {
    const queue = [...list];
    let keyProblem = '';
    const pending: CheckResult[] = []; // "not responding" results held until we know the provider is reachable
    let answered = false;
    const worker = async () => {
      while (queue.length && !signal.aborted) {
        const id = queue.shift()!;
        if (keyProblem) { finish({ id, outcome: 'key', reason: keyProblem }); continue; }
        onProgress({ done, total: ids.length, current: id });
        let first = await probe(id, signal);
        if (signal.aborted) return;
        // A rate limit is often momentary: wait a little and try once more before calling it busy.
        if (first.status === 429) { await pause(4000); if (signal.aborted) return; first = await probe(id, signal); if (signal.aborted) return; }
        let c = classify(first);
        if ('retry' in c) {
          await pause(1500);
          if (signal.aborted) return;
          const second = await probe(id, signal, { maxTokens: 512 });
          if (signal.aborted) return;
          if (second.status > 0) answered = true;
          c = settle(c.reason, second);
          if (c.outcome === 'broken' && first.status === 0 && second.status === 0) { pending.push({ id, ...c }); continue; }
        } else answered = true;
        if (c.outcome === 'key') { keyProblem = c.reason; }
        finish({ id, outcome: c.outcome, reason: c.reason, ms: first.ms });
      }
    };
    await Promise.all(Array.from({ length: Math.min(perProvider, list.length) }, worker));
    // Nothing from this provider answered at all: an outage or network problem, not broken models.
    for (const r of pending) finish(answered ? r : { ...r, outcome: 'busy', reason: `${provider === 'gemini' ? 'Google' : provider} didn’t answer; check again later` });
  }));
  return results;
}
