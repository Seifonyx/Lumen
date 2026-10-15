import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { Exit, useFlip } from '../lib/motion';

export default function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  // Toasts slide in, lift away when they go, and the others close the gap smoothly.
  const box = useRef<HTMLDivElement>(null);
  useFlip(box, toasts.map((t) => t.id).join(','));
  // At the top level, so a notification's button (Undo) still works while a window is open.
  return createPortal(
    <div className="toasts" role="status" aria-live="polite" ref={box}>
      {toasts.map((t) => (
        <Exit key={t.id} kind="toast">
          <div className={`toast toast-${t.kind}`} data-flip={t.id}>
            {t.kind === 'error' ? <TriangleAlert size={16} /> : t.kind === 'success' ? <CheckCircle2 size={16} /> : <Info size={16} />}
            <span dir="auto">{t.text}</span>
            {t.action && <button className="toast-action" onClick={() => { dismiss(t.id); t.action!.run(); }}>{t.action.label}</button>}
            <button className="icon-btn sm" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        </Exit>
      ))}
    </div>,
    document.body,
  );
}
