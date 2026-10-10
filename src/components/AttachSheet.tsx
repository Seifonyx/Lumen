import { Camera, FolderGit2, Images } from 'lucide-react';
import { useEffect, useRef } from 'react';
import './touch.css';

interface Props {
  onClose: () => void;
  onFiles: () => void;
  onCamera: () => void;
  onRepo: () => void;
  repoName?: string;
}

/** Phone-style "+" menu: one place for photos, files, the camera and a GitHub repository. */
export default function AttachSheet({ onClose, onFiles, onCamera, onRepo, repoName }: Props) {
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The file pickers must open straight from the tap, so each row runs its action first and then closes.
  const pick = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
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
        <button type="button" className="sheet-row" onClick={pick(onCamera)}>
          <span className="sheet-icon"><Camera size={19} /></span>
          <span className="sheet-text">
            <span className="sheet-title">Take a photo</span>
            <span className="sheet-hint">Use the camera</span>
          </span>
        </button>
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
