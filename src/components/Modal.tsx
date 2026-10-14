import { X } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusScope } from '../lib/focus-scope';
import { isSheetScreen, useSheetDrag } from '../lib/sheet-drag';
import { Exit } from '../lib/motion';

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
  // Phones: small windows open as bottom sheets you can drag down to close.
  const [sheet] = useState(() => !wide && !full && isSheetScreen());
  useSheetDrag(ref, onClose, sheet);

  // Closing: the backdrop fades while the window shrinks away (computers) or the sheet slides down (phones).
  return createPortal(
    <Exit kind="fade" parts={[['.modal', sheet ? 'sheet' : full || wide ? 'fade' : 'modal']]}>
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}${full ? ' full' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        {sheet && <div className="sheet-grip" aria-hidden="true" />}
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
    </div>
    </Exit>,document.body
  );
}
