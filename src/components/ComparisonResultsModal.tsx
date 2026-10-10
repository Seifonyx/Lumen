import { Loader2, Save } from 'lucide-react';
import { modelLabel, useStore } from '../store';
import Modal from './Modal';
import Markdown from './Markdown';

export default function ComparisonResultsModal() {
  const comparison = useStore((s) => s.comparison);
  const comparing = useStore((s) => s.comparing);
  const catalog = useStore((s) => s.catalog);
  const { cancelComparison, clearComparison, saveComparisonAnswer } = useStore.getState();
  if (!comparison) return null;
  const close = () => { if (comparing) cancelComparison(); clearComparison(); };

  return (
    <Modal title="Model comparison" onClose={close} wide>
      <div className="comparison-results">
        <div className="comparison-question" dir="auto"><b>Your question</b><p>{comparison.prompt}</p></div>
        <p className="muted small comparison-cost">Sent to {comparison.answers.length} models · one request per model</p>
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
        <div className="comparison-actions"><span className="spacer" /><button className="btn" onClick={close}>{comparing ? 'Stop and close' : 'Close'}</button></div>
      </div>
    </Modal>
  );
}
