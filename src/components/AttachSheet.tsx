import { FolderGit2, Images, Pencil, ChartNoAxesCombined } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useFocusScope } from '../lib/focus-scope';
import './touch.css';

interface Props {
  onClose: () => void;
  onFiles: () => void;
  onRepo: () => void;
  onCanvas: () => void;
  onAnalysis: () => void;
  repoName?: string;
  anchor?: { left: number; bottom: number };
}

/** Phone-style "+" menu: one place for photos, files and a GitHub repository. */
export default function AttachSheet({ onClose, onFiles, onRepo, onCanvas, onAnalysis, repoName, anchor }: Props) {
  const startY = useRef<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useFocusScope(ref,true,onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onResize = () => close.current();
    if (anchor) window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // The file pickers must open straight from the tap, so each row runs its action first and then closes.
  const pick = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div className={`sheet-backdrop${anchor ? ' sheet-popover-backdrop' : ''}`} onClick={onClose}>
      <div
        ref={ref}
        className="sheet"
        style={anchor ? { left: anchor.left, bottom: anchor.bottom } : undefined}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
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
        <button type="button" className="sheet-row" onClick={pick(onCanvas)}><span className="sheet-icon"><Pencil size={19} /></span><span className="sheet-text"><span className="sheet-title">Document canvas</span><span className="sheet-hint">Write, import and edit a draft</span></span></button>
        <button type="button" className="sheet-row" onClick={pick(onAnalysis)}><span className="sheet-icon"><ChartNoAxesCombined size={19} /></span><span className="sheet-text"><span className="sheet-title">Data analysis</span><span className="sheet-hint">Calculate, clean and chart locally</span></span></button>
        <button type="button" className="sheet-row" onClick={pick(onFiles)}>
          <span className="sheet-icon"><Images size={19} /></span>
          <span className="sheet-text">
            <span className="sheet-title">Photos &amp; files</span>
            <span className="sheet-hint">Images, documents and spreadsheets</span>
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
