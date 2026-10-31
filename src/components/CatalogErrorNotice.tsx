import { X } from 'lucide-react';
import { useStore } from '../store';

/** One provider's failure ("Google: API key not valid…") in words a person can act on. The raw text stays in the
 *  tooltip for diagnosis; Activity keeps the full record. */
export function catalogProblem(raw: string): { text: string; key: boolean } {
  const parts = raw.split(' · ').map((part) => {
    const at = part.indexOf(': ');
    const provider = at > 0 && at < 40 ? part.slice(0, at) : 'A provider';
    const message = at > 0 && at < 40 ? part.slice(at + 2) : part;
    if (/api.?key|unauthori[sz]ed|forbidden|permission|\b40[13]\b|invalid.*(key|token|credential)|credential/i.test(message)) return { text: `${provider} didn't accept the saved key`, key: true };
    if (/quota|rate.?limit|\b429\b|too many/i.test(message)) return { text: `${provider} is over its limit for now`, key: false };
    if (/network|fetch|timed? ?out|offline|unreachable|\b5\d\d\b/i.test(message)) return { text: `${provider} couldn't be reached`, key: false };
    return { text: `${provider} didn't send its model list`, key: false };
  });
  return { text: parts.map((p) => p.text).join('; '), key: parts.some((p) => p.key) };
}

/** Both catalogue-error surfaces share one dismissal, without clearing recovery state. */
export default function CatalogErrorNotice({ placement }: { placement: 'chat' | 'models' }) {
  const error = useStore((s) => s.catalogError);
  const dismissed = useStore((s) => s.catalogErrorDismissed);
  const dismiss = useStore((s) => s.dismissCatalogError);
  if (!error || dismissed) return null;
  const problem = catalogProblem(error);

  return (
    <div className={`catalog-error ${placement === 'chat' ? 'banner' : 'error-text small'}`} role="alert">
      <span dir="auto" title={error}>
        {placement === 'chat'
          ? <>Some models aren't available: {problem.text}.</>
          : <>Couldn't refresh every provider: {problem.text}. Models found last time are still listed; tap Refresh to try again.</>}
      </span>
      {placement === 'chat' && problem.key && (
        <button type="button" className="btn small catalog-error-fix" onClick={() => useStore.getState().setUi({ settingsOpen: true, settingsTab: 'keys' })}>Check key</button>
      )}
      <button type="button" className="icon-btn" aria-label="Dismiss model loading error" title="Dismiss" onClick={dismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
