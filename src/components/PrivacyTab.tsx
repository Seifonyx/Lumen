import { useMemo, useState } from 'react';
import { KIND_LABEL, Masker } from '../lib/privacy';
import { useStore } from '../store';

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string };
type ChoiceProps = { value: 'ask' | 'auto'; onChange: (v: 'ask' | 'auto') => void; label: string; options: ['ask' | 'auto', string][] };

const SAMPLE = 'Mr. Ahmed Mahmoud, file number 0045821, born 12/03/1985, phone 01012345678 — draft a reply to his complaint.';

export default function PrivacyTab({ Toggle, Choice }: { Toggle: (p: ToggleProps) => React.ReactElement; Choice: (p: ChoiceProps) => React.ReactElement }) {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [sample, setSample] = useState(SAMPLE);
  const preview = useMemo(() => new Masker().mask(sample), [sample]);

  return (
    <div className="privacy-tab settings-section">
      <div className="settings-group">
        <span className="settings-group-title">Personal details</span>
        <div className="settings-card">
          <Toggle
            label="Privacy shield"
            hint="Before anything leaves your device, hide phone numbers, emails, national IDs, card numbers, account and file numbers, dates of birth, and people’s names."
            checked={settings.privacyShield}
            onChange={(v) => update({ privacyShield: v })}
          />
          {settings.privacyShield && (
            <>
              <Choice
                label="When details are detected"
                value={settings.privacyMode}
                onChange={(v) => update({ privacyMode: v })}
                options={[['ask', 'Ask me'], ['auto', 'Mask automatically']]}
              />
              <Toggle
                label="Restore real values in replies"
                hint="AI models only see tokens like [PHONE_1]; the app automatically restores original details when displaying answers."
                checked={settings.privacyRestore}
                onChange={(v) => update({ privacyRestore: v })}
              />
            </>
          )}
        </div>
      </div>

      <details className="settings-card privacy-tester">
        <summary><span className="setting-label">Preview masking</span><span className="setting-hint">Try sample text locally, before sending it to a model.</span></summary>
        <div className="privacy-tester-body">
          <textarea aria-label="Sample text to mask" dir="auto" rows={3} value={sample} onChange={(e) => setSample(e.target.value)} style={{ minHeight: 0 }} />
          <div className="privacy-preview" dir="auto">
            {preview.text.split(/(\[[A-Z_]+_\d+\])/).map((part, i) => (/^\[[A-Z_]+_\d+\]$/.test(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span className="muted small">{preview.count ? `${preview.count} detail${preview.count === 1 ? '' : 's'} masked` : 'Nothing found'}</span>
            <span className="muted small">
              Detects: {Object.values(KIND_LABEL).slice(0, 5).join(', ')} and more
            </span>
          </div>
        </div>
      </details>
    </div>
  );
}
