import { Check, Copy, TextSelect } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/util';
import Modal from './Modal';
import WritingTools from './WritingTools';
import { useStore } from '../store';

/** A quiet reading surface: selections stay inside this message, away from chat controls. */
export default function TextSelection({ text, open: shown, onClose, messageId }: { text: string; open?: boolean; onClose?: () => void; messageId?: string }) {
  const [ownOpen, setOwnOpen] = useState(false);
  // Controlled from a menu (open + onClose), or its own button.
  const controlled = shown !== undefined;
  const open = controlled ? shown : ownOpen;
  const setOpen = (v: boolean) => (controlled ? !v && onClose?.() : setOwnOpen(v));
  const [selected, setSelected] = useState('');
  const [copied, setCopied] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const surface = content.current;
    const modal = surface?.closest<HTMLElement>('.modal');
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = [...(modal?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') || [])];
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) { event.preventDefault(); first?.focus(); }
    };
    const changed = () => {
      const selection = window.getSelection();
      setSelected(selection && content.current?.contains(selection.anchorNode) && content.current.contains(selection.focusNode) ? selection.toString() : '');
      setCopied(false);
    };
    document.addEventListener('selectionchange', changed);
    document.addEventListener('keydown', trap);
    return () => {
      document.removeEventListener('selectionchange', changed);
      document.removeEventListener('keydown', trap);
      const selection = window.getSelection();
      if (surface?.contains(selection?.anchorNode || null)) selection?.removeAllRanges();
    };
  }, [open]);
  return <>
    {!controlled && <button className="msg-action" aria-label="Select text" title="Select text" onClick={() => { setSelected(''); setCopied(false); setOpen(true); }}><TextSelect size={15} /></button>}
    {open && <Modal title="Select text" full onClose={() => setOpen(false)}>
      <div className="text-selection-view">
        <div className="text-selection-tools">
          <span className="muted small">Select the words you want to copy.</span>
          <div>
            <button className="btn small ghost" onClick={() => {
              if (!content.current) return;
              const range = document.createRange(); range.selectNodeContents(content.current);
              const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
              setSelected(text); setCopied(false);
            }}>Select all</button>
            <button className="btn small" disabled={!selected} onPointerDown={(e) => e.preventDefault()} onClick={async () => { if (await copyText(selected)) setCopied(true); }}>
              {copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copied' : 'Copy selected'}
            </button>
          </div>
        </div>
        <div ref={content} className="selectable-text" dir="auto" tabIndex={0}>{text}</div>
        {messageId && selected.trim().length >= 3 && (
          <div className="text-selection-writing" onPointerDown={(e) => { if ((e.target as Element).closest("button")) e.preventDefault(); }}>
            <WritingTools key={selected} text={selected.trim()} chatId={useStore.getState().currentId || undefined} messageId={messageId} onDone={() => setOpen(false)} />
          </div>
        )}
      </div>
    </Modal>}
  </>;
}
