import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { clearProviderSettingsTarget, useProviderSettingsTarget } from '../lib/canvas-presentation';
import { normalizeKeys, validAlibabaBase, validRelayUrl } from '../lib/ai/provider-config.js';
import type { ApiKeys } from '../lib/firebase';
import { useStore } from '../store';
import KeySafety from './KeySafety';
import ProviderConnections, { type MainProvider } from './ProviderConnections';

const KEY_FIELDS: { id: 'gemini' | 'openrouter' | 'groq' | 'cerebras' | 'github'; label: string; placeholder: string; link: string; hint: string; linkText?: string }[] = [
  { id: 'gemini', label: 'Google AI Studio (Gemini)', placeholder: 'AIza…', link: 'https://aistudio.google.com/apikey', hint: 'Best all-rounder: reads images and PDFs, searches the web.' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-…', link: 'https://openrouter.ai/keys', hint: 'Dozens of free open models (DeepSeek, Qwen, Llama…).' },
  { id: 'groq', label: 'Groq', placeholder: 'gsk_…', link: 'https://console.groq.com/keys', hint: 'Very fast answers (Llama, GPT-OSS, Qwen). Generous free limits.' },
  { id: 'cerebras', label: 'Cerebras', placeholder: 'csk-…', link: 'https://cloud.cerebras.ai/platform', hint: 'The fastest replies; about 1 million free tokens a day.' },
  {
    id: 'github',
    label: 'GitHub (for coding)',
    placeholder: 'github_pat_…',
    link: 'https://github.com/settings/personal-access-tokens/new',
    linkText: 'Create a token',
    hint: 'Lets chats read your repositories and commit changes. Use a fine-grained token with Contents and Pull requests set to Read and write, and Actions set to Read (for test results).',
  },
];

/** The API key editor: every provider, or one provider (Router's provider page) when `provider` is set. */
export default function KeysPanel({ provider }: { provider?: string } = {}) {
  const keys = useStore((s) => s.keys);
  const owner = useStore((s) => s.user?.uid);
  const linked = useProviderSettingsTarget?.(owner) ?? null;
  const targetProvider = provider ?? linked;
  const saveApiKeys = useStore((s) => s.saveApiKeys);
  const toast = useStore((s) => s.toast);
  const [draft, setDraft] = useState<ApiKeys>(() => normalizeKeys(keys) as unknown as ApiKeys);
  const [busy, setBusy] = useState(false);
  const changed = JSON.stringify(normalizeKeys(draft)) !== JSON.stringify(normalizeKeys(keys));
  const validation = draft.alibabaBaseUrl && !validAlibabaBase(draft.alibabaBaseUrl) ? 'Use an official Alibaba Cloud Model Studio base URL.'
    : draft.providerRelayUrl && !validRelayUrl(draft.providerRelayUrl) ? 'Your relay must use HTTPS without a username, password or query.'
    : draft.providerAccess?.cloudflare && draft.cloudflare && !/^[a-f0-9]{32}$/i.test(draft.cloudflareAccountId?.trim() || '') ? 'Enter the 32-character Cloudflare account ID.'
    : '';


  return (
    <div className="settings-section">
      <ProviderConnections compact={Boolean(provider)} onShowAllProviders={clearProviderSettingsTarget || undefined} targetProvider={targetProvider} main={KEY_FIELDS.filter((field): field is MainProvider => field.id !== 'github')} draft={draft} setDraft={setDraft} saved={keys} />
      {validation && <p className="error-text" role="alert">{validation}</p>}
      <div className="settings-actions">
        <span className="muted small">Saved on this device, then synced privately to your account when connected.</span>
        <button
          className="btn primary"
          disabled={busy || !changed || Boolean(validation)}
          onClick={async () => {
            setBusy(true);
            try {
              await saveApiKeys(draft);
              toast('Keys saved on this device. Account sync continues when connected.', 'success');
            } catch (e) {
              toast(`Couldn't save keys: ${(e as Error).message}`, 'error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Loader2 size={16} className="spin" />} Save keys
        </button>
      </div>

      <KeySafety />
    </div>
  );
}
