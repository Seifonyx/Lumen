// Study: decks of flashcards and quizzes made from your chats and documents. Flashcards flip on tap; "Knew it"
// sends a card further away, "Not yet" brings it back soon. The quiz keeps your scores.
import { ArrowLeft, BookOpenCheck, Brain, Check, ChevronRight, FileText, GraduationCap, Layers, Loader2, MessageSquare, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { dueCards, grade, mastery, nextDue, StudyStore, type StudyDeck } from '../lib/study';
import { isTemporaryChat } from '../lib/temporary-chat';
import { useStore } from '../store';
import HubPage, { HubEmpty, relTime } from './HubPage';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'cards'; id: string } | { kind: 'quiz'; id: string };

const when = (t: number) => {
  const d = t - Date.now();
  if (d <= 0) return 'now';
  const h = Math.round(d / 3_600_000);
  const days = Math.round(h / 24);
  return h < 24 ? `in ${Math.max(1, h)} h` : `in ${days} ${days === 1 ? 'day' : 'days'}`;
};

export default function Study({ onClose, startFrom }: { onClose: () => void; startFrom?: { chatId: string; documentId?: string } }) {
  const uid = useStore((s) => s.user?.uid);
  const store = useMemo(() => (uid ? new StudyStore(uid) : null), [uid]);
  const [decks, setDecks] = useState<StudyDeck[]>(() => store?.cached() || []);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [making, setMaking] = useState<string | null>(null);
  useEffect(() => { if (store) void store.list().then((d) => d.length && setDecks(d)); }, [store]);
  const save = (deck: StudyDeck) => { setDecks((all) => [deck, ...all.filter((d) => d.id !== deck.id)]); void store?.put(deck); };
  const make = async (chatId: string, documentId?: string) => {
    setMaking(documentId || chatId);
    const deck = await useStore.getState().makeStudyDeck(chatId, documentId);
    setMaking(null);
    if (!deck) { useStore.getState().toast("Couldn't make a deck from that. Try again, or pick something longer.", 'error'); return; }
    save(deck);
    setView({ kind: 'cards', id: deck.id });
  };
  useEffect(() => { if (startFrom) void make(startFrom.chatId, startFrom.documentId); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const deck = 'id' in view ? decks.find((d) => d.id === view.id) : undefined;

  const dueTotal = decks.reduce((n, d) => n + dueCards(d).length, 0);
  const allScores = decks.flatMap((d) => (d.scores || []).map((x) => x.score / Math.max(1, d.quiz.length)));
  const avg = allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) : null;
  const back = view.kind === 'list' ? undefined : () => setView({ kind: 'list' });
  const title = view.kind === 'new' ? 'New deck' : deck ? deck.title : 'Study';
  const subtitle = view.kind === 'new' ? 'Pick a chat or document. Lumen makes flashcards and a quiz from it.'
    : deck ? `From “${deck.source.label}” · ${deck.cards.length} cards · ${deck.quiz.length} questions`
    : 'Flashcards and quizzes made from your chats and documents. Cards you find hard come back sooner.';
  return (
    <HubPage label="Study" title={making ? 'Making your deck' : title} subtitle={making ? 'Reading it and writing flashcards and a quiz…' : subtitle} onClose={onClose} onBack={making ? undefined : back}
      actions={view.kind === 'list' && !making && <button type="button" className="btn primary" onClick={() => setView({ kind: 'new' })}><Plus size={16} /> New deck</button>}>
      <div className="study">
        {making && <div className="study-making" role="status"><Loader2 size={20} className="spin" /> Making flashcards and a quiz…</div>}
        {!making && view.kind === 'list' && (decks.length === 0 ? (
          <HubEmpty icon={<GraduationCap size={26} />} title="No decks yet" text="Pick any chat or document and Lumen turns it into flashcards and a quiz. Your progress is saved to your account." action={<button type="button" className="btn primary" onClick={() => setView({ kind: 'new' })}><Plus size={16} /> Make your first deck</button>} />
        ) : (
          <>
            <div className="study-stats">
              <div><strong>{dueTotal}</strong><span>cards due now</span></div>
              <div><strong>{decks.length}</strong><span>{decks.length === 1 ? 'deck' : 'decks'}</span></div>
              <div><strong>{avg === null ? '—' : `${avg}%`}</strong><span>average quiz score</span></div>
            </div>
            <ul className="study-decks">
              {decks.map((d) => {
                const due = dueCards(d).length, m = Math.round(mastery(d) * 100), best = d.scores?.length ? Math.max(...d.scores.map((x) => x.score)) : null;
                return (
                  <li key={d.id} className="study-deck">
                    <div className="study-ring" style={{ ['--p' as string]: m }} aria-label={`${m}% learned`}><span>{m}%</span></div>
                    <div className="study-deck-main">
                      <strong dir="auto">{d.title}</strong>
                      <span className="muted small" dir="auto">From “{d.source.label}” · {d.cards.length} cards · {d.quiz.length} questions</span>
                      <span className="study-deck-meta">
                        {due ? <span className="study-due">{due} due</span> : <span className="muted small">Next review {when(nextDue(d))}</span>}
                        {best !== null && <span className="muted small">Best quiz {best}/{d.quiz.length}</span>}
                        <span className="muted small">{relTime(d.updatedAt)}</span>
                      </span>
                    </div>
                    <div className="study-deck-actions">
                      <button type="button" className={`btn small${due ? ' primary' : ''}`} disabled={!d.cards.length} onClick={() => setView({ kind: 'cards', id: d.id })}><Layers size={14} /> {due ? `Review ${due}` : 'Cards'}</button>
                      <button type="button" className="btn small" disabled={!d.quiz.length} onClick={() => setView({ kind: 'quiz', id: d.id })}><BookOpenCheck size={14} /> Quiz</button>
                      <button type="button" className="icon-btn sm" aria-label={`Delete ${d.title}`} onClick={() => { if (confirm(`Delete the deck "${d.title}"?`)) { setDecks((all) => all.filter((x) => x.id !== d.id)); void store?.remove(d.id); } }}><Trash2 size={15} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ))}
        {!making && view.kind === 'new' && <NewDeck onPick={make} />}
        {!making && view.kind === 'cards' && deck && <Cards deck={deck} onSave={save} onQuiz={() => setView({ kind: 'quiz', id: deck.id })} />}
        {!making && view.kind === 'quiz' && deck && <Quiz key={deck.id} deck={deck} onSave={save} onBack={() => setView({ kind: 'list' })} />}
      </div>
    </HubPage>
  );
}

function NewDeck({ onPick }: { onPick: (chatId: string, documentId?: string) => void }) {
  const chats = useStore((s) => s.chats);
  const [query, setQuery] = useState('');
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { key: string; label: string; sub: string; chatId: string; documentId?: string }[] = [];
    for (const c of [...chats].sort((a, b) => b.updatedAt - a.updatedAt)) {
      if (isTemporaryChat(c)) continue;
      for (const d of c.documents || []) if (d.content.trim().length > 200) out.push({ key: d.id, label: d.name, sub: `Document in “${c.title}”`, chatId: c.id, documentId: d.id });
      const size = c.messages.reduce((n, m) => n + m.text.length, 0);
      if (size > 300) out.push({ key: c.id, label: c.title, sub: `Chat · ${c.messages.length} messages`, chatId: c.id });
    }
    return out.filter((i) => !q || i.label.toLowerCase().includes(q)).slice(0, 60);
  }, [chats, query]);
  return (
    <div className="study-new">
      <label className="hub-search"><Search size={16} /><input type="search" placeholder="Search chats and documents" aria-label="Search chats and documents" value={query} onChange={(e) => setQuery(e.target.value)} dir="auto" /></label>
      {items.length ? (
        <ul className="study-sources">
          {items.map((i) => (
            <li key={i.key}><button type="button" onClick={() => onPick(i.chatId, i.documentId)}><span className="lib-row-icon" aria-hidden="true">{i.documentId ? <FileText size={17} /> : <MessageSquare size={17} />}</span><span className="study-source-text"><strong dir="auto">{i.label}</strong><span className="muted small">{i.sub}</span></span><ChevronRight size={16} /></button></li>
          ))}
        </ul>
      ) : <p className="muted small">No chats or documents long enough yet.</p>}
    </div>
  );
}

function Cards({ deck, onSave, onQuiz }: { deck: StudyDeck; onSave: (d: StudyDeck) => void; onQuiz: () => void }) {
  // The round: cards due when it started (missed ones come back at the end).
  const [queue, setQueue] = useState(() => dueCards(deck).map((c) => c.id));
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState({ knew: 0, missed: 0 });
  const card = deck.cards.find((c) => c.id === queue[0]);
  const answer = (knew: boolean) => {
    if (!card) return;
    const next = { ...deck, cards: deck.cards.map((c) => (c.id === card.id ? grade(c, knew) : c)), updatedAt: Date.now() };
    onSave(next);
    setFlipped(false);
    setDone((d) => ({ knew: d.knew + Number(knew), missed: d.missed + Number(!knew) }));
    setQueue((q) => (knew ? q.slice(1) : [...q.slice(1), card.id]));
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!card) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
      else if (flipped && (e.key === 'ArrowRight' || e.key === '2')) answer(true);
      else if (flipped && (e.key === 'ArrowLeft' || e.key === '1')) answer(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  return (
    <div className="study-cards">
      {card && <div className="study-head"><span className="muted small">Flashcards</span><span className="muted small">{queue.length} left</span></div>}
      {card ? (
        <>
          <button type="button" className={`flashcard${flipped ? ' flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? 'Show question' : 'Show answer'}>
            <span className="flashcard-inner">
              <span className="flashcard-face front" dir="auto"><small>Question</small>{card.q}</span>
              <span className="flashcard-face back" dir="auto"><small>Answer</small>{card.a}</span>
            </span>
          </button>
          <div className="flashcard-actions">
            {flipped ? (
              <>
                <button type="button" className="btn" onClick={() => answer(false)}><RotateCcw size={15} /> Not yet</button>
                <button type="button" className="btn primary" onClick={() => answer(true)}><Check size={15} /> Knew it</button>
              </>
            ) : <span className="muted small">Tap the card (or press Space) to see the answer.</span>}
          </div>
        </>
      ) : (
        <div className="study-empty">
          <Brain size={26} />
          <h3>{done.knew + done.missed ? 'Round done' : 'Nothing due right now'}</h3>
          <p className="muted small">{done.knew + done.missed ? `${done.knew} remembered · ${done.missed} missed along the way. ` : ''}Next cards are due {when(nextDue(deck))}.</p>
          <div className="flashcard-actions">
            <button type="button" className="btn small" onClick={() => setQueue(deck.cards.map((c) => c.id))}><Layers size={14} /> Go through all</button>
            {deck.quiz.length > 0 && <button type="button" className="btn primary small" onClick={onQuiz}><BookOpenCheck size={14} /> Take the quiz</button>}
          </div>
        </div>
      )}
    </div>
  );
}

function Quiz({ deck, onSave, onBack }: { deck: StudyDeck; onSave: (d: StudyDeck) => void; onBack: () => void }) {
  const [only, setOnly] = useState<string[] | null>(null);
  const questions = only ? deck.quiz.filter((q) => only.includes(q.id)) : deck.quiz;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const q = questions[i];
  const finish = () => {
    if (!only) onSave({ ...deck, scores: [...(deck.scores || []), { at: Date.now(), score: questions.length - wrong.length }].slice(-20), updatedAt: Date.now() });
  };
  if (!q) {
    const score = questions.length - wrong.length;
    return (
      <div className="study-empty">
        <BookOpenCheck size={26} />
        <h3>{score} of {questions.length} right</h3>
        <p className="muted small">{wrong.length ? 'Try the ones you missed again, or go back to the cards.' : 'All correct.'}</p>
        <div className="flashcard-actions">
          <button type="button" className="btn small" onClick={onBack}><ArrowLeft size={14} /> Decks</button>
          {wrong.length > 0 && <button type="button" className="btn primary small" onClick={() => { setOnly(wrong); setWrong([]); setI(0); setPicked(null); }}><RotateCcw size={14} /> Retry {wrong.length} missed</button>}
        </div>
      </div>
    );
  }
  return (
    <div className="study-quiz">
      <div className="study-head"><span className="muted small">Quiz</span><span className="muted small">Question {i + 1} of {questions.length}</span></div>
      <div className="study-meter"><span style={{ transform: `scaleX(${i / questions.length})` }} /></div>
      <h3 className="quiz-q" dir="auto">{q.q}</h3>
      <div className="quiz-options" role="group" aria-label="Answers">
        {q.options.map((o, k) => {
          const state = picked === null ? '' : k === q.answer ? ' right' : k === picked ? ' wrong' : ' dim';
          return <button key={k} type="button" className={`quiz-option${state}`} disabled={picked !== null} onClick={() => { setPicked(k); if (k !== q.answer) setWrong((w) => [...w, q.id]); }} dir="auto">
            <span className="quiz-letter">{'ABCD'[k]}</span><span>{o}</span>{picked !== null && k === q.answer && <Check size={16} />}{picked === k && k !== q.answer && <X size={16} />}
          </button>;
        })}
      </div>
      {picked !== null && (
        <div className="quiz-after">
          {q.why && <p className="muted small" dir="auto">{q.why}</p>}
          <button type="button" className="btn primary small" onClick={() => { if (i + 1 >= questions.length) finish(); setI(i + 1); setPicked(null); }}>{i + 1 >= questions.length ? 'See score' : 'Next'} <ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
}
