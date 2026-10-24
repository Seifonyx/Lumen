// Ask your chats: finds the parts of your history closest in meaning to a question (even with different words)
// and answers from them, with numbers that open the chat each part came from.
import { Loader2, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HistoryIndex, type Hit } from '../lib/history-search';
import { useStore } from '../store';
import Modal from './Modal';
import { toPlainText } from '../lib/markdown';

export default function AskChats({ initial, onClose, onOpenChat }: { initial: string; onClose: () => void; onOpenChat?: (id: string) => void }) {
  const uid = useStore((s) => s.user?.uid);
  const index = useMemo(() => (uid ? new HistoryIndex(uid) : null), [uid]);
  const [question, setQuestion] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  const run = async (q: string) => {
    if (!index || !q.trim()) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setError(''); setHits(null); setAnswer(null);
    try {
      const chats = useStore.getState().chats;
      setStatus('Reading your chats…');
      const { limited } = await index.update(chats, (done, total) => total > 0 && setStatus(`Reading your chats… ${done} of ${total}`), ac.signal);
      if (ac.signal.aborted) return;
      setStatus('Searching…');
      const found = await index.search(q, chats, 8, ac.signal);
      if (ac.signal.aborted) return;
      setHits(found);
      if (limited) setError('Gemini asked Lumen to slow down, so only part of your history was read this time. Ask again in a minute to read the rest.');
      if (!found.length) { setStatus(null); return; }
      setStatus('Writing an answer…');
      const text = await useStore.getState().answerFromHistory(q, found);
      if (ac.signal.aborted) return;
      setAnswer(text);
      if (!text) setError("Couldn't write an answer right now, but the related chats are below.");
    } catch (e) {
      if (!ac.signal.aborted) setError((e as Error).message);
    } finally {
      if (abort.current === ac) setStatus(null);
    }
  };
  useEffect(() => { if (initial.trim()) void run(initial); return () => abort.current?.abort(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Selecting a citation is a forward navigation, not a Back action that restores the old chat.
  const open = (chatId: string) => { if (onOpenChat) onOpenChat(chatId); else { useStore.getState().selectChat(chatId); onClose(); } };
  const cite = (text: string) => text.split(/(\[\d{1,2}\])/).map((part, i) => {
    const n = /^\[(\d+)\]$/.exec(part)?.[1];
    const hit = n ? hits?.[Number(n) - 1] : undefined;
    return hit ? <button key={i} type="button" className="ask-cite" title={`Open “${hit.title}”`} onClick={() => open(hit.chatId)}>{n}</button> : <span key={i}>{part}</span>;
  });
  return (
    <Modal title="Ask your chats" onClose={onClose} wide>
      <div className="ask-chats">
        <form className="ask-form" onSubmit={(e) => { e.preventDefault(); void run(question); }}>
          <label className="search"><Search size={16} /><input autoFocus dir="auto" aria-label="Question about your chats" placeholder="What did I decide about…" value={question} onChange={(e) => setQuestion(e.target.value)} /></label>
          <button type="submit" className="btn primary" disabled={!question.trim() || Boolean(status)}><Sparkles size={15} /> Ask</button>
        </form>
        <p className="muted small">Finds what you talked about even if you don’t remember the exact words. Uses your Gemini key; the index stays on this device.</p>
        {status && <div className="ask-status" role="status"><Loader2 size={16} className="spin" /> {status}</div>}
        {error && <p className="ask-error" role="alert">{error}</p>}
        {answer && <div className="ask-answer" dir="auto">{cite(answer)}</div>}
        {hits && (hits.length ? (
          <>
            <h3 className="ask-subtitle">Related chats</h3>
            <ol className="ask-hits">
              {hits.map((h, i) => (
                <li key={i}><button type="button" onClick={() => open(h.chatId)}>
                  <span className="ask-n">{i + 1}</span>
                  <span className="ask-hit"><strong dir="auto">{h.title}</strong><span className="muted small" dir="auto">{toPlainText(h.text).replace(/\s+/g, ' ').slice(0, 180)}</span></span>
                  <span className="muted small ask-date">{new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </button></li>
              ))}
            </ol>
          </>
        ) : !status && <p className="muted small">Nothing in your chats seems related.</p>)}
      </div>
    </Modal>
  );
}
