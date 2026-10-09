import { CheckCircle2, ExternalLink, Loader2, Wrench, X, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { failureReport, watchChecks, type ChecksView } from '../lib/ci';
import { uid } from '../lib/util';
import { useStore } from '../store';
import type { Chat } from '../types';

/** Above the message box in a coding chat: the last commit's GitHub test results, and a way to fix failures. */
export default function ChecksBar({ chat }: { chat: Chat }) {
  const send = useStore((s) => s.send);
  const dismiss = useStore((s) => s.dismissChecks);
  const busy = useStore((s) => Boolean(s.streamingChatId));
  const toast = useStore((s) => s.toast);
  const [view, setView] = useState<ChecksView>({ state: 'loading', checks: [] });
  const [fixing, setFixing] = useState(false);
  const c = chat.lastCommit;
  const repo = chat.repo;

  useEffect(() => {
    if (!c || c.dismissed || !repo) return;
    return watchChecks(repo.owner, repo.repo, c.sha, setView);
  }, [c?.sha, c?.dismissed, repo?.owner, repo?.repo]);

  if (!c || c.dismissed || !repo || view.state === 'none' || view.state === 'error') return null;

  const failed = view.checks.filter((x) => x.state === 'failure');
  const running = view.checks.filter((x) => x.state === 'pending');
  const short = c.sha.slice(0, 7);

  const fix = async () => {
    setFixing(true);
    try {
      const report = await failureReport(repo.owner, repo.repo, view.checks);
      const text = [
        `The GitHub checks failed after commit ${short} on ${c.branch}:`,
        report.summary || failed.map((x) => `${x.name} failed`).join('\n'),
        report.log ? 'The relevant part of the log is attached.' : "(The log couldn't be loaded. The token may need Actions: Read access.)",
        'Find the cause, read or search the files you need, and fix it with edit blocks.',
      ].join('\n\n');
      const files = report.log ? [{ id: uid(), kind: 'text' as const, name: 'github-checks.log', mime: 'text/plain', size: report.log.length, text: report.log }] : [];
      await send(text, files);
    } catch (e) {
      toast(`Couldn't load the failure details: ${(e as Error).message}`, 'error');
    } finally {
      setFixing(false);
    }
  };

  const link = (url: string, label: string) => (
    <a href={url} target="_blank" rel="noopener noreferrer" className="checks-link">
      {label} <ExternalLink size={11} />
    </a>
  );

  return (
    <div className={`checks-bar ${view.state}`} role="status">
      {view.state === 'loading' || view.state === 'pending' ? (
        <Loader2 size={15} className="spin" />
      ) : view.state === 'success' ? (
        <CheckCircle2 size={15} />
      ) : (
        <XCircle size={15} />
      )}
      <span className="checks-text">
        {view.state === 'loading' && <>Looking for test results of <code>{short}</code>…</>}
        {view.state === 'pending' && <>Checks running on <code>{short}</code>: {running.map((x) => x.name).join(', ')}</>}
        {view.state === 'success' && <>All checks passed on <code>{short}</code> ({view.checks.length})</>}
        {view.state === 'failure' && <>Failed on <code>{short}</code>: {failed.map((x) => x.name).join(', ')}</>}
        {view.state === 'denied' && <>To see test results here, give your GitHub token <b>Actions: Read</b> access.</>}
      </span>
      {view.state === 'denied' && link('https://github.com/settings/personal-access-tokens', 'Token settings')}
      {view.state === 'failure' && failed[0]?.url && link(failed[0].url, 'Details')}
      {(view.state === 'pending' || view.state === 'success') && view.checks[0]?.url && link(view.checks[0].url, 'View')}
      {view.state === 'failure' && (
        <button className="btn small primary" onClick={() => void fix()} disabled={fixing || busy}>
          {fixing ? <Loader2 size={14} className="spin" /> : <Wrench size={14} />} Fix this failure
        </button>
      )}
      <button className="icon-btn xs" onClick={() => dismiss(chat.id)} aria-label="Hide test results"><X size={13} /></button>
    </div>
  );
}
