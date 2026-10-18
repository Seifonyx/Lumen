import { Loader2, Merge, RotateCcw, Save, Square } from 'lucide-react';
import { modelLabel, useStore } from '../store';
import Modal from './Modal';
import Markdown from './Markdown';
import type {ComparedAnswer} from '../types';

function AnswerStatus({status}:{status:ComparedAnswer['status']}) {
  return <span role="status" className="sr-only">{status==='loading'?'Answer in progress':status==='done'?'Answer ready':''}</span>;
}

export default function ComparisonResultsModal() {
  const comparison = useStore((s) => s.comparison);
  const comparing = useStore((s) => s.comparing);
  const catalog = useStore((s) => s.catalog);
  const { cancelComparison, clearComparison, saveComparisonAnswer, combineComparison, retryComparison } = useStore.getState();
  if (!comparison) return null;
  const close = () => { if (comparing) cancelComparison(); clearComparison(); };
  const ready = comparison.answers.filter((a) => a.status === 'done').length;
  const combined = comparison.combined;

  return (
    <Modal title="Model comparison" onClose={close} wide>
      <div className="comparison-results">
        <div className="comparison-question" dir="auto"><b>Your question</b><p>{comparison.prompt}</p></div>
        <p className="muted small comparison-cost">Sent to {comparison.answers.length} models. Retries and combining may add model requests.</p>
        {combined && (
          <article className={`comparison-card comparison-combined${combined.status === 'loading' ? ' live' : ''}`}>
            <header><strong><Merge size={15} /> Combined answer</strong>{combined.model && <span className="muted small">written by {modelLabel(catalog, combined.model)}</span>}{combined.status === 'loading' && <Loader2 size={15} className="spin" />}</header>
            <AnswerStatus status={combined.status} />
            <div className="comparison-answer" dir="auto">
              {combined.text && <Markdown text={combined.text} streaming={combined.status === 'loading'} />}
              {combined.error && <p className="error-msg" role="alert">{combined.error}</p>}
              {combined.status === 'stopped' && <p className="muted small" role="status">Stopped.</p>}
              {!combined.text && !combined.error && combined.status === 'loading' && <p className="muted small">Reading the answers…</p>}
            </div>
            {combined.status === 'done' && <button className="btn small primary comparison-save" onClick={() => saveComparisonAnswer('combined')}><Save size={14} /> Continue with this answer</button>}
          </article>
        )}
        <div className="comparison-grid">
          {comparison.answers.map((answer) => <article key={answer.model} className="comparison-card">
            <header><strong>{modelLabel(catalog, answer.model)}</strong>{answer.status === 'loading' && <Loader2 size={15} className="spin" />}</header>
            <AnswerStatus status={answer.status} />
            <div className="comparison-answer" dir="auto">
              {answer.text && <Markdown text={answer.text} streaming={answer.status === 'loading'} />}
              {answer.error && <p className="error-msg" role="alert">{answer.error}</p>}
              {answer.status === 'stopped' && <p className="muted small" role="status">Stopped.</p>}
              {!answer.text && !answer.error && answer.status === 'loading' && <p className="muted small">Waiting for answer…</p>}
              {!!answer.sources?.length && <div className="comparison-sources">{answer.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>)}</div>}
            </div>
            {answer.status === 'done' && <button className="btn small comparison-save" onClick={() => saveComparisonAnswer(answer.model)}><Save size={14} /> Continue with this answer</button>}
            {(answer.status === 'error' || answer.status === 'stopped') && <button className="btn small" style={{ margin: '0 12px 12px' }} disabled={comparing} onClick={() => void retryComparison(answer.model)}><RotateCcw size={14} /> Retry this model</button>}
          </article>)}
        </div>
        <div className="comparison-actions" style={{ flexWrap: 'wrap' }}>
          {ready >= 2 && combined?.status !== 'loading' && <button className="btn" disabled={comparing} onClick={() => void combineComparison()} title="One model writes the best answer from all of them, and lists where they disagreed"><Merge size={15} /> {combined?.status === 'done' ? 'Combine again' : 'Combine into one answer'}</button>}
          <span className="spacer" />{comparing && <button className="btn" onClick={cancelComparison}><Square size={14} /> Stop</button>}<button className="btn" onClick={close}>{comparing ? 'Stop and close' : 'Close'}</button></div>
      </div>
    </Modal>
  );
}
