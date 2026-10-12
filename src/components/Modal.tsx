import { X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusScope } from '../lib/focus-scope';

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
  const titleId=useId();
  useFocusScope(ref,true,onClose);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}${full ? ' full' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2 className="modal-title" id={titleId}>{title}</h2>
          <div className="modal-actions">
            {actions}
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>,document.body
  );
}
