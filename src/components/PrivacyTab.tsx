import { useMemo, useState } from 'react';
import { KIND_LABEL, Masker } from '../lib/privacy';
import { useStore } from '../store';

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string };
type ChoiceProps = { value: 'ask' | 'auto'; onChange: (v: 'ask' | 'auto') => void; label: string; options: ['ask' | 'auto', string][] };

const SAMPLE = 'Patient Ahmed Mahmoud, MRN: 0045821, DOB: 12/03/1985, phone 01012345678 — summarize his labs.';

export default function PrivacyTab({ Toggle, Choice }: { Toggle: (p: ToggleProps) => React.ReactElement; Choice: (p: ChoiceProps) => React.ReactElement }) {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [sample, setSample] = useState(SAMPLE);
  const preview = useMemo(() => new Masker().mask(sample), [sample]);

  return (
    <div className="settings-section privacy-tab">
      <Toggle
        label="Privacy shield"
        hint="Before anything goes to a free model, hide phone numbers, emails, national IDs, card and bank numbers, medical record numbers, dates of birth, passwords and patient names. Checked on this device only."
        checked={settings.privacyShield}
        onChange={(v) => update({ privacyShield: v })}
      />
      {settings.privacyShield && (
        <>
          <Choice label="When something is found" value={settings.privacyMode} onChange={(v) => update({ privacyMode: v })} options={[['ask', 'Ask me'], ['auto', 'Mask automatically']]} />
          <Toggle
            label="Show real values in replies"
            hint="The model only sees placeholders like [PHONE_1]; the app puts the real details back when showing its reply."
            checked={settings.privacyRestore}
            onChange={(v) => update({ privacyRestore: v })}
          />
        </>
      )}
      <div className="field-block">
        <span className="setting-label">Try it</span>
        <span className="setting-hint">Type anything — this is what a model would see. Nothing here is sent.</span>
        <textarea dir="auto" rows={3} value={sample} onChange={(e) => setSample(e.target.value)} style={{ minHeight: 0 }} />
        <div className="privacy-preview" dir="auto">
          {preview.text.split(/(\[[A-Z_]+_\d+\])/).map((part, i) => (/^\[[A-Z_]+_\d+\]$/.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
        </div>
        <span className="muted small">{preview.count ? `${preview.count} detail${preview.count === 1 ? '' : 's'} hidden` : 'Nothing found'}</span>
      </div>
      <p className="muted small">
        Looks for: {Object.values(KIND_LABEL).join(', ')}. Names are recognised after words like “patient”, “Mr/Mrs” or “المريض”. Images and PDFs can't be checked, and no
        checker is perfect — it's a safety net, not a guarantee.
      </p>
    </div>
  );
}
