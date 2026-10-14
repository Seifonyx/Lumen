import { useState } from 'react';
import { ChevronDown, ExternalLink, Eye, EyeOff, Search, X } from 'lucide-react';
import type { ApiKeys } from '../lib/firebase';
import { DEFAULT_PROVIDER_RELAY_URL, EXTRA_PROVIDERS } from '../lib/ai/provider-config.js';

type ExtraId = keyof typeof EXTRA_PROVIDERS;
type MainId = 'gemini' | 'openrouter' | 'groq' | 'cerebras';
export type MainProvider = { id: MainId; label: string; placeholder: string; link: string; hint: string; linkText?: string };
type Filter = 'all' | 'free' | 'connected';

/** Providers with a free tier that needs no payment details. */
const FREE = new Set<string>(['gemini', 'openrouter', 'groq', 'cerebras', 'mistral', 'cohere', 'nvidia', 'huggingface', 'cloudflare']);

/** Every provider in one list, with filters. Built-in providers work as soon as a key is added; the others also need "Enable". */
export default function ProviderConnections({ main, draft, setDraft, saved }: { main: MainProvider[]; draft: ApiKeys; setDraft: (value: ApiKeys) => void; saved: ApiKeys }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const extras = Object.keys(EXTRA_PROVIDERS) as ExtraId[];
  // On a first visit (no keys yet) the built-in providers start open; they stay open after the first save.
  const [firstRun] = useState(() => !main.some((p) => (saved[p.id] || '').trim()));
  const connected = (id: string) => Boolean((saved[id as keyof ApiKeys] as string | undefined)?.trim()) && (!(id in EXTRA_PROVIDERS) || saved.providerAccess?.[id as ExtraId] === true);
  const all = [...main.map((p) => ({ id: p.id as string, label: p.label })), ...extras.map((id) => ({ id: id as string, label: EXTRA_PROVIDERS[id].label }))];
  const q = query.trim().toLowerCase();
  const visible = all.filter((p) => (filter === 'all' || (filter === 'free' ? FREE.has(p.id) : connected(p.id))) && (!q || p.label.toLowerCase().includes(q)));
  const counts: Record<Filter, number> = { all: all.length, free: all.filter((p) => FREE.has(p.id)).length, connected: all.filter((p) => connected(p.id)).length };

  const keyInput = (id: string, label: string, placeholder?: string) => {
    const val = (draft[id as keyof ApiKeys] as string | undefined) || '';
    const visibleKey = Boolean(shown[id]);
    return (
      <div className="key-input-wrap">
        <input type={visibleKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder={placeholder} aria-label={`${label} API key`} value={val} onChange={(e) => setDraft({ ...draft, [id]: e.target.value })} />
        {val && <button className="icon-btn sm" onClick={() => setDraft({ ...draft, [id]: '' })} aria-label="Clear key" title="Clear"><X size={14} /></button>}
        <button className="icon-btn sm" onClick={() => setShown((s) => ({ ...s, [id]: !s[id] }))} aria-label={visibleKey ? 'Hide' : 'Reveal'} title={visibleKey ? 'Hide' : 'Reveal'}>{visibleKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
      </div>
    );
  };
  const summary = (id: string, label: string, status: string, on: boolean) => (
    <summary>
      <span className="provider-name">{label}{FREE.has(id) && <span className="provider-free">Free tier</span>}</span>
      <span className={`key-status-pill ${on ? 'configured' : 'unset'}`}>{status}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </summary>
  );

  return (
    <section className="provider-connections" aria-labelledby="providers-heading">
      <h3 id="providers-heading" className="sr-only">Providers</h3>
      <div className="provider-toolbar">
        <div className="segmented provider-filters" role="radiogroup" aria-label="Show providers">
          {(['all', 'free', 'connected'] as Filter[]).map((f) => (
            <button key={f} role="radio" aria-checked={filter === f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'free' ? 'Free tier' : 'Connected'} <span className="provider-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <label className="search provider-search">
          <Search size={14} />
          <input type="search" aria-label="Search providers" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="settings-card">
        {visible.length === 0 && <p className="muted small provider-none">{filter === 'connected' && !q ? 'No providers connected yet. Add a key to any provider under All.' : 'No providers match.'}</p>}
        {visible.map(({ id }) => {
          const m = main.find((p) => p.id === id);
          if (m) {
            const on = Boolean((saved[m.id] || '').trim());
            return (
              <details key={id} className="provider-connection key-provider-card" data-provider={id} open={firstRun || undefined}>
                {summary(id, m.label, on ? 'Key entered' : 'Not set', on)}
                <div className="provider-connection-body">
                  <p className="muted small">{m.hint} <a className="link-btn small inline" href={m.link} target="_blank" rel="noopener noreferrer">{m.linkText || 'Get a free key'} <ExternalLink size={12} /></a></p>
                  {keyInput(m.id, m.label, m.placeholder)}
                </div>
              </details>
            );
          }
          const x = id as ExtraId, provider = EXTRA_PROVIDERS[x];
          const enabled = draft.providerAccess?.[x] === true;
          return (
            <details key={id} className="provider-connection" data-provider={id}>
              {summary(id, provider.label, enabled && draft[x] ? 'Enabled' : draft[x] ? 'Saved · off' : 'Not set', Boolean(enabled && draft[x]))}
              <div className="provider-connection-body">
                <p className="muted small">{provider.hint} <a className="link-btn small inline" href={provider.link} target="_blank" rel="noopener noreferrer">Provider dashboard <ExternalLink size={12} /></a></p>
                {keyInput(x, provider.label)}
                {x === 'alibaba' && <label className="provider-field"><span>Model Studio endpoint</span><input type="url" autoCapitalize="none" spellCheck={false} aria-label="Alibaba Cloud endpoint" placeholder={EXTRA_PROVIDERS.alibaba.base} value={draft.alibabaBaseUrl || ''} onChange={(e) => setDraft({ ...draft, alibabaBaseUrl: e.target.value })} /><span className="muted small">Paste the official base URL from your Model Studio workspace. Leave blank for the legacy Singapore endpoint.</span></label>}
                {x === 'cloudflare' && <label className="provider-field"><span>Cloudflare account ID</span><input aria-label="Cloudflare account ID" autoCapitalize="none" spellCheck={false} value={draft.cloudflareAccountId || ''} onChange={(e) => setDraft({ ...draft, cloudflareAccountId: e.target.value })} /></label>}
                <label className="provider-consent"><input type="checkbox" checked={enabled} onChange={(e) => setDraft({ ...draft, providerAccess: { ...draft.providerAccess, [x]: e.target.checked } })} /><span>Enable {provider.label}. Its models may use credits or charges; set a spending limit in its dashboard.</span></label>
              </div>
            </details>
          );
        })}
      </div>

      <details className="settings-card provider-relay">
        <summary><span>NVIDIA & Cloudflare relay</span><span className="key-status-pill unset">{draft.providerRelayUrl ? 'Your relay' : 'Built-in'}</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="provider-connection-body">
          <p className="muted small">Your key and prompt pass through this app’s relay to NVIDIA or Cloudflare. The relay stores neither. Leave the URL blank to use it, or enter a relay you control.</p>
          <label className="provider-field"><span>Custom relay URL (optional)</span><input type="url" aria-label="Provider relay URL" placeholder={DEFAULT_PROVIDER_RELAY_URL} autoCapitalize="none" spellCheck={false} value={draft.providerRelayUrl || ''} onChange={(e) => setDraft({ ...draft, providerRelayUrl: e.target.value })} /></label>
          <a className="link-btn small inline" href="https://github.com/Seifonyx/Model-Router/blob/main/server/provider-relay/README.md" target="_blank" rel="noopener noreferrer">Relay setup <ExternalLink size={12} /></a>
        </div>
      </details>
      <p className="muted small provider-retired">GitHub Models was retired on July 30, 2026; your GitHub coding connection still works. <a className="link-btn small inline" href="https://docs.github.com/en/github-models" target="_blank" rel="noopener noreferrer">Notice <ExternalLink size={12} /></a></p>
    </section>
  );
}
