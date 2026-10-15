import { Loader2, Merge, Save } from 'lucide-react';
import { modelLabel, useStore } from '../store';
import Modal from './Modal';
import Markdown from './Markdown';

export default function ComparisonResultsModal() {
  const comparison = useStore((s) => s.comparison);
  const comparing = useStore((s) => s.comparing);
  const catalog = useStore((s) => s.catalog);
  const { cancelComparison, clearComparison, saveComparisonAnswer, combineComparison } = useStore.getState();
  if (!comparison) return null;
  const close = () => { if (comparing) cancelComparison(); clearComparison(); };
  const ready = comparison.answers.filter((a) => a.status === 'done').length;
  const combined = comparison.combined;

  return (
    <Modal title="Model comparison" onClose={close} wide>
      <div className="comparison-results">
        <div className="comparison-question" dir="auto"><b>Your question</b><p>{comparison.prompt}</p></div>
        <p className="muted small comparison-cost">Sent to {comparison.answers.length} models · one request per model</p>
        {combined && (
          <article className={`comparison-card comparison-combined${combined.status === 'loading' ? ' live' : ''}`}>
            <header><strong><Merge size={15} /> Combined answer</strong>{combined.model && <span className="muted small">written by {modelLabel(catalog, combined.model)}</span>}{combined.status === 'loading' && <Loader2 size={15} className="spin" />}</header>
            <div className="comparison-answer" dir="auto">
              {combined.text ? <Markdown text={combined.text} streaming={combined.status === 'loading'} /> : combined.error ? <p className="error-msg">{combined.error}</p> : <p className="muted small">Reading the answers…</p>}
            </div>
            {combined.status === 'done' && <button className="btn small primary comparison-save" onClick={() => saveComparisonAnswer('combined')}><Save size={14} /> Continue with this answer</button>}
          </article>
        )}
        <div className="comparison-grid">
          {comparison.answers.map((answer) => <article key={answer.model} className="comparison-card">
            <header><strong>{modelLabel(catalog, answer.model)}</strong>{answer.status === 'loading' && <Loader2 size={15} className="spin" />}</header>
            <div className="comparison-answer" dir="auto">
              {answer.text ? <Markdown text={answer.text} streaming={answer.status === 'loading'} /> : answer.error ? <p className="error-msg">{answer.error}</p> : answer.status === 'stopped' ? <p className="muted small">Stopped.</p> : <p className="muted small">Waiting for answer…</p>}
              {!!answer.sources?.length && <div className="comparison-sources">{answer.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}
            </div>
            {answer.status === 'done' && <button className="btn small comparison-save" onClick={() => saveComparisonAnswer(answer.model)}><Save size={14} /> Continue with this answer</button>}
          </article>)}
        </div>
        <div className="comparison-actions">
          {ready >= 2 && combined?.status !== 'loading' && <button className="btn" disabled={comparing} onClick={() => void combineComparison()} title="One model writes the best answer from all of them, and lists where they disagreed"><Merge size={15} /> {combined?.status === 'done' ? 'Combine again' : 'Combine into one answer'}</button>}
          <span className="spacer" /><button className="btn" onClick={close}>{comparing ? 'Stop and close' : 'Close'}</button></div>
      </div>
    </Modal>
  );
}
