import { X } from 'lucide-react';
import { useStore } from '../store';

/** Both catalogue-error surfaces share one dismissal, without clearing recovery state. */
export default function CatalogErrorNotice({ placement }: { placement: 'chat' | 'models' }) {
  const error = useStore((s) => s.catalogError);
  const dismissed = useStore((s) => s.catalogErrorDismissed);
  const dismiss = useStore((s) => s.dismissCatalogError);
  if (!error || dismissed) return null;

  return (
    <div className={`catalog-error ${placement === 'chat' ? 'banner' : 'error-text small'}`} role="alert">
      <span dir="auto">
        {placement === 'chat'
          ? <>Some models couldn't be loaded: {error}</>
          : <>Couldn't refresh every provider: {error}. Models found last time are still listed; tap Refresh to try again.</>}
      </span>
      <button type="button" className="icon-btn" aria-label="Dismiss model loading error" title="Dismiss" onClick={dismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
