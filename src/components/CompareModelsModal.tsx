import { useState } from 'react';
import { Boxes, Check } from 'lucide-react';
import { modelLabel, useStore } from '../store';
import Modal from './Modal';
import type { Attachment } from '../types';

export default function CompareModelsModal({ prompt, files, onClose, onCompare }: { prompt: string; files: Attachment[]; onClose: () => void; onCompare: (models: string[]) => void }) {
  const enabled = useStore((s) => s.settings.enabledModels);
  const defaultModel = useStore((s) => s.settings.defaultModel);
  const catalog = useStore((s) => s.catalog);
  const [selected, setSelected] = useState(() => {
    const first = enabled.includes(defaultModel) ? defaultModel : enabled[0];
    const second = enabled.find((id) => id !== first);
    return [first, second].filter(Boolean) as string[];
  });
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : current.filter(supports).length < 3 ? [...current.filter(supports), id] : current);
  const supports = (id: string) => {
    const model = catalog?.models.find((m) => m.id === id);
    return !model || (!files.some((f) => f.kind === 'image') || model.vision) && (!files.some((f) => f.kind === 'pdf') || model.pdf);
  };
  const chosen = selected.filter(supports);

  return (
    <Modal title="Compare models" onClose={onClose}>
      <div className="compare-picker">
        <p className="muted small">Each selected model gets one request. Choose two or three for side-by-side answers. Models that cannot read an attached image or PDF are disabled.</p>
        <div className="compare-prompt" dir="auto">{prompt || 'Your current message'}</div>
        <div className="compare-model-list">
          {enabled.map((id) => {
            const checked = selected.includes(id);
            return <button key={id} className={`compare-model-row${checked ? ' selected' : ''}${!supports(id) ? ' incompatible' : ''}`} disabled={!supports(id)} onClick={() => toggle(id)} aria-pressed={checked}>
              <span className="compare-check">{checked && <Check size={14} />}</span><Boxes size={16} /><span>{modelLabel(catalog, id)}</span><small>{checked ? 'Selected' : ''}</small>
            </button>;
          })}
          {!enabled.length && <p className="muted small">Enable models in Settings → Models first.</p>}
        </div>
        <div className="compare-picker-actions">
          <span className="muted small">{chosen.length}/3 selected</span>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={chosen.length < 2} onClick={() => onCompare(chosen)}>Compare</button>
        </div>
      </div>
    </Modal>
  );
}
