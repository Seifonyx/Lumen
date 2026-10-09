import { ShieldCheck } from 'lucide-react';
import { KIND_LABEL, obscure, type Finding } from '../lib/privacy';
import Modal from './Modal';

/** Shown before sending when the privacy shield finds personal details (in "Ask me" mode). */
export default function PrivacyCheck({
  findings,
  unchecked,
  onMask,
  onAsIs,
  onEdit,
}: {
  findings: Finding[];
  /** images/PDFs attached, which can't be checked */
  unchecked: number;
  onMask: () => void;
  onAsIs: () => void;
  onEdit: () => void;
}) {
  const groups = new Map<string, string[]>();
  for (const f of findings) groups.set(KIND_LABEL[f.kind], [...(groups.get(KIND_LABEL[f.kind]) || []), f.value]);
  return (
    <Modal title="Personal details found" onClose={onEdit}>
      <div className="privacy-check">
        <p className="muted">
          The privacy shield found {findings.length} detail{findings.length === 1 ? '' : 's'} that free models don't need. Masked, the model sees placeholders like{' '}
          <code>[PHONE_1]</code> and you still see the real values in its reply.
        </p>
        <ul className="privacy-found">
          {[...groups].map(([label, values]) => (
            <li key={label}>
              <span className="setting-label">{label}</span>
              <span className="privacy-values">
                {[...new Set(values)].slice(0, 4).map((v) => (
                  <code key={v} dir="auto">{obscure(v)}</code>
                ))}
                {new Set(values).size > 4 && <span className="muted small">+{new Set(values).size - 4} more</span>}
              </span>
            </li>
          ))}
        </ul>
        {unchecked > 0 && <p className="muted small">Images and PDFs can't be checked — look over {unchecked === 1 ? 'the attached one' : `the ${unchecked} attached`} yourself.</p>}
        <div className="privacy-actions">
          <button className="btn ghost" onClick={onEdit}>Edit message</button>
          <div className="spacer" />
          <button className="btn" onClick={onAsIs}>Send as is</button>
          <button className="btn primary" onClick={onMask} autoFocus>
            <ShieldCheck size={15} /> Mask and send
          </button>
        </div>
      </div>
    </Modal>
  );
}
