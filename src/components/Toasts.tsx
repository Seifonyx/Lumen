import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useStore } from '../store';

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          {t.kind === 'error' ? <TriangleAlert size={18} /> : t.kind === 'success' ? <CheckCircle2 size={18} /> : <Info size={18} />}
          <span dir="auto">{t.text}</span>
          <button className="icon-btn sm" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
