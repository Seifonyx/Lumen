import { FolderGit2, FolderKanban, Images, Pencil, ChartNoAxesCombined } from 'lucide-react';
import { useEffect, useRef } from 'react';
import './touch.css';

interface Props {
  onClose: () => void;
  onFiles: () => void;
  onRepo: () => void;
  onCanvas: () => void;
  onAnalysis: () => void;
  onProject?: () => void;
  projectName?: string;
  repoName?: string;
  anchor?: { left: number; bottom: number };
}

/** Phone-style "+" menu: one place for photos, files and a GitHub repository. */
export default function AttachSheet({ onClose, onFiles, onRepo, onCanvas, onAnalysis, repoName, anchor }: Props) {
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
    const onResize = () => close.current();
    window.addEventListener('keydown', onKey);
    if (anchor) window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      if (previous?.isConnected) previous.focus();
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
        {onProject && (
          <button type="button" className="sheet-row" onClick={pick(onProject)}>
            <span className="sheet-icon"><FolderKanban size={19} /></span>
            <span className="sheet-text">
              <span className="sheet-title">{projectName ? `Project (${projectName})` : 'Project settings'}</span>
              <span className="sheet-hint">Instructions, reference files &amp; model</span>
            </span>
          </button>
        )}
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
