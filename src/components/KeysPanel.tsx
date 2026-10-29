import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { clearProviderSettingsTarget, useProviderSettingsTarget, useScreenMemory } from '../lib/canvas-presentation';
import { EXTRA_PROVIDERS, normalizeKeys, validAlibabaBase, validRelayUrl } from '../lib/ai/provider-config.js';
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

// One provider's own fields: its key and permission, plus the endpoint, account ID or relay it alone depends on.
const providerFields = (id: string): (keyof ApiKeys)[] => {
  const extra = EXTRA_PROVIDERS[id as keyof typeof EXTRA_PROVIDERS] as { relay?: boolean; fallback?: boolean } | undefined;
  return [id as keyof ApiKeys, ...(id === 'alibaba' ? ['alibabaBaseUrl' as const] : []), ...(id === 'cloudflare' ? ['cloudflareAccountId' as const] : []), ...(extra?.relay || extra?.fallback ? ['providerRelayUrl' as const] : [])];
};
/** The saved keys with only `id`'s fields taken from the draft, so a page never writes back another provider's key. */
function withProvider(saved: ApiKeys, draft: ApiKeys, id: string): ApiKeys {
  const next = { ...saved } as Record<string, unknown>;
  for (const field of providerFields(id)) next[field] = draft[field];
  if (id in EXTRA_PROVIDERS) next.providerAccess = { ...saved.providerAccess, [id]: draft.providerAccess?.[id as keyof typeof EXTRA_PROVIDERS] === true };
  return next as unknown as ApiKeys;
}

/** The API key editor: every provider, or one provider (Router's provider page) when `provider` is set. */
export default function KeysPanel({ provider }: { provider?: string } = {}) {
  const keys = useStore((s) => s.keys);
  const owner = useStore((s) => s.user?.uid);
  const linked = useProviderSettingsTarget?.(owner) ?? null;
  const targetProvider = provider ?? linked;
  const saveApiKeys = useStore((s) => s.saveApiKeys);
  const toast = useStore((s) => s.toast);
  const [local, setLocal] = useState<ApiKeys>(() => normalizeKeys(keys) as unknown as ApiKeys);
  // A provider page keeps its unsaved edits across Back/Forward (screen memory: in memory only, per account) and is
  // always rebased on the saved keys, so saving it changes that provider's fields and nothing else.
  const remembered = useScreenMemory?.<ApiKeys | null>(`keys-draft:${provider ?? ''}`, null) ?? null;
  const [stored, setStored] = remembered ?? [null, () => {}];
  const draft = provider && remembered ? withProvider(keys, stored ?? keys, provider) : local;
  const setDraft = (value: ApiKeys) => provider && remembered ? setStored(value) : setLocal(value);
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
              if (provider && remembered) setStored(null);
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
