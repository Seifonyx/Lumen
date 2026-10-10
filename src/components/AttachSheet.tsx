import { Camera, FolderGit2, Images } from 'lucide-react';
import { useEffect, useRef } from 'react';
import './touch.css';

interface Props {
  onClose: () => void;
  onFiles: () => void;
  onCamera: () => void;
  onRepo: () => void;
  repoName?: string;
  showCamera?: boolean;
}

/** Phone-style "+" menu: one place for photos, files, the camera and a GitHub repository. */
export default function AttachSheet({ onClose, onFiles, onCamera, onRepo, repoName, showCamera = true }: Props) {
  const startY = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  // The file pickers must open straight from the tap, so each row runs its action first and then closes.
  const pick = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Add to your message"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { startY.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          const from = startY.current;
          startY.current = null;
          if (from !== null && e.changedTouches[0].clientY - from > 70) onClose();
        }}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <button type="button" className="sheet-row" onClick={pick(onFiles)}>
          <span className="sheet-icon"><Images size={19} /></span>
          <span className="sheet-text">
            <span className="sheet-title">Photos &amp; files</span>
            <span className="sheet-hint">From your library or the Files app</span>
          </span>
        </button>
        {showCamera && <button type="button" className="sheet-row" onClick={pick(onCamera)}>
          <span className="sheet-icon"><Camera size={19} /></span>
          <span className="sheet-text">
            <span className="sheet-title">Take a photo</span>
            <span className="sheet-hint">Use the camera</span>
          </span>
        </button>}
        <button type="button" className="sheet-row" onClick={pick(onRepo)}>
          <span className="sheet-icon"><FolderGit2 size={19} /></span>
          <span className="sheet-text">
            <span className="sheet-title">{repoName ? 'Open repository' : 'GitHub repository'}</span>
            <span className="sheet-hint">{repoName || 'Work on code from a repo'}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
