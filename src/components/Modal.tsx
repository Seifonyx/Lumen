import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  full?: boolean;
}

export default function Modal({ title, onClose, children, actions, wide, full }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const previousFocus = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    window.addEventListener('keydown', onKey);
    // Keep an input's autofocus, and don't reset focus when the modal re-renders.
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previousFocus.current?.isConnected) previousFocus.current.focus();
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}${full ? ' full' : ''}`} role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <div className="modal-actions">
            {actions}
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
