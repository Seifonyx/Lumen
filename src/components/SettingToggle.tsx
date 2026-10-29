import { haptic } from '../lib/haptics';

/** A labelled on/off row used across Settings and Router. */
export default function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="setting-row">
      <span className="setting-text">
        <span className="setting-label">{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <span className="setting-ctrl">
        <input type="checkbox" className="switch" checked={checked} onChange={(e) => { haptic(); onChange(e.target.checked); }} />
      </span>
    </label>
  );
}
