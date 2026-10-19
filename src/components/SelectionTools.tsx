// Select words in a reply and a small "Writing tools" button appears next to them; it opens the tools for just
// that text (see WritingTools).
import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import WritingTools from './WritingTools';

interface Picked { text: string; messageId: string; x: number; top: number; bottom: number }

export default function SelectionTools() {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    let timer = 0;
    const check = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (openRef.current) return;
        const sel = window.getSelection();
        const text = sel?.toString().trim() || '';
        if (!sel || sel.rangeCount === 0 || text.length < 3) { setPicked(null); return; }
        const node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
        const end = sel.focusNode instanceof Element ? sel.focusNode : sel.focusNode?.parentElement;
        const md = node?.closest('.main .msg.assistant .markdown');
        const row = md?.closest<HTMLElement>('[data-message-id]');
        if (!md || !row || !end || !md.contains(end)) { setPicked(null); return; }
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setPicked({ text, messageId: row.dataset.messageId!, x: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom });
      }, 180);
    };
    document.addEventListener('selectionchange', check);
    // A user can select text before this optional chunk mounts.
    check();
    const away = (e: PointerEvent) => { if (openRef.current && !box.current?.contains(e.target as Node)) { setOpen(false); setPicked(null); } };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && openRef.current) { setOpen(false); setPicked(null); } };
    const scroll = () => { if (!openRef.current) setPicked(null); };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, true);
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange', check); document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key); window.removeEventListener('scroll', scroll, true); };
  }, []);
  if (!picked) return null;
  const width = open ? Math.min(420, window.innerWidth - 24) : 150;
  const left = Math.max(12, Math.min(window.innerWidth - width - 12, picked.x - width / 2));
  // Below the selection when there's room (the phone's own copy menu sits above it), otherwise above.
  const below = picked.bottom + 12 + (open ? 220 : 44) < window.innerHeight;
  const style = below ? { left, top: picked.bottom + 10, width: open ? width : undefined } : { left, bottom: window.innerHeight - picked.top + 10, width: open ? width : undefined };
  return (
    <div ref={box} className={`selection-tools${open ? ' open' : ''}`} style={style} onPointerDown={(e) => { if (!open) e.preventDefault(); }}>
      {open ? (
        <WritingTools text={picked.text} chatId={useStore.getState().currentId || undefined} messageId={picked.messageId} onDone={() => { setOpen(false); setPicked(null); window.getSelection()?.removeAllRanges(); }} />
      ) : (
        <button type="button" className="selection-tools-btn" onClick={() => setOpen(true)}><Sparkles size={14} /> Writing tools</button>
      )}
    </div>
  );
}
