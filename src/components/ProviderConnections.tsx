import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ExternalLink, Eye, EyeOff, Search, X } from 'lucide-react';
import type { ApiKeys } from '../lib/firebase';
import FilterMenu from './FilterMenu';
import { DEFAULT_PROVIDER_RELAY_URL, EXTRA_PROVIDERS } from '../lib/ai/provider-config.js';

type ExtraId = keyof typeof EXTRA_PROVIDERS;
type MainId = 'gemini' | 'openrouter' | 'groq' | 'cerebras';
export type MainProvider = { id: MainId; label: string; placeholder: string; link: string; hint: string; linkText?: string };
type Filter = 'all' | 'free' | 'connected';

/** Providers with a free tier that needs no payment details. */
export const FREE = new Set<string>(['gemini', 'openrouter', 'groq', 'cerebras', 'mistral', 'cohere', 'nvidia', 'huggingface', 'cloudflare', ...Object.entries(EXTRA_PROVIDERS).filter(([, v]) => 'free' in v && v.free).map(([k]) => k)]);

/** Every provider in one list, with filters. Built-in providers work as soon as a key is added; the others also need "Enable". */
export default function ProviderConnections({ main, draft, setDraft, saved, targetProvider, onShowAllProviders, compact }: { compact?: boolean; targetProvider?: string | null; onShowAllProviders?: () => void; main: MainProvider[]; draft: ApiKeys; setDraft: (value: ApiKeys) => void; saved: ApiKeys }) {
  const focused = targetProvider || null;
  const target = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (focused) { target.current?.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true }); target.current?.scrollIntoView({ block: 'start' }); } }, [focused]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const extras = Object.keys(EXTRA_PROVIDERS) as ExtraId[];
  // On a first visit (no keys yet) the built-in providers start open; they stay open after the first save.
  const [firstRun] = useState(() => !main.some((p) => (saved[p.id] || '').trim()));
  const connected = (id: string) => Boolean((saved[id as keyof ApiKeys] as string | undefined)?.trim()) && (!(id in EXTRA_PROVIDERS) || saved.providerAccess?.[id as ExtraId] === true);
  const all = [...main.map((p) => ({ id: p.id as string, label: p.label })), ...extras.map((id) => ({ id: id as string, label: EXTRA_PROVIDERS[id].label }))];
  const q = query.trim().toLowerCase();
  const visible = all.filter((p) => focused ? p.id === focused : (filter === 'all' || (filter === 'free' ? FREE.has(p.id) : connected(p.id))) && (!q || p.label.toLowerCase().includes(q)));
  const counts: Record<Filter, number> = { all: all.length, free: all.filter((p) => FREE.has(p.id)).length, connected: all.filter((p) => connected(p.id)).length };

  const keyInput = (id: string, label: string, placeholder?: string) => {
    const val = (draft[id as keyof ApiKeys] as string | undefined) || '';
    const visibleKey = Boolean(shown[id]);
    return (
      <div className="key-input-wrap">
        <input type={visibleKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder={placeholder ?? 'Paste your API key'} aria-label={`${label} API key`} value={val} onChange={(e) => setDraft({ ...draft, [id]: e.target.value })} />
        {val && <button className="icon-btn sm" onClick={() => setDraft({ ...draft, [id]: '' })} aria-label="Clear key" title="Clear"><X size={14} /></button>}
        <button className="icon-btn sm" onClick={() => setShown((s) => ({ ...s, [id]: !s[id] }))} aria-label={visibleKey ? 'Hide' : 'Reveal'} title={visibleKey ? 'Hide' : 'Reveal'}>{visibleKey ? <EyeOff size={14} /> : <Eye size={14} />}</button>
      </div>
    );
  };
  // Router's provider page (compact): the fields sit flat on the page, under its own heading; a pill appears only
  // while there are unsaved edits. Settings keeps one collapsible card per provider.
  const card = (id: string, className: string, head: React.ReactNode, unsaved: boolean, body: React.ReactNode) => compact
    ? <div key={id} className={`${className} sb-key`} data-provider={id}>{unsaved && <span className="key-status-pill unset">Unsaved changes</span>}{body}</div>
    : <details key={id} className={className} data-provider={id} ref={focused === id ? target : undefined} open={focused === id || (className.includes('key-provider-card') && firstRun) || undefined}>{head}{body}</details>;
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
      {firstRun && (!focused || (compact && focused === 'gemini')) && (
        <div className="welcome-guide" role="note" aria-label="Getting started">
          <strong>Welcome to Lumen</strong>
          <p>It talks to free AI models using your own keys, which stay private to your account. One free key is enough to start:</p>
          <ol>
            <li>Open Google AI Studio and sign in with your Google account.</li>
            <li>Tap <b>Create API key</b> and copy it.</li>
            <li>Paste it into <b>Google AI Studio (Gemini)</b> below, then <b>Save keys</b>.</li>
          </ol>
          <a className="btn primary small" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Get a free Gemini key</a>
          <p className="muted small">Groq, Cerebras and OpenRouter are free too and add more models; you can add them any time.</p>
        </div>
      )}
      {focused && !compact && <div className="provider-target-head"><p className="muted small">Connection settings · {all.find(p => p.id === focused)?.label}</p><button type="button" className="btn small" onClick={() => onShowAllProviders?.()}>All providers</button></div>}
      {!focused && <div className="provider-toolbar">
        <label className="search provider-search">
          <Search size={14} />
          <input type="search" aria-label="Search providers" placeholder="Search providers" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <FilterMenu<Filter> label="Show providers" value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All providers', count: counts.all },
          { value: 'free', label: 'Free tier', count: counts.free },
          { value: 'connected', label: 'Enabled with key', count: counts.connected },
        ]} />
      </div>}

      <div className={compact ? 'sb-key-list' : 'settings-card'}>
        {visible.length === 0 && <p className="muted small provider-none">{filter === 'connected' && !q ? 'No providers have a saved key and permission enabled. Add a key under All providers.' : 'No providers match.'}</p>}
        {visible.map(({ id }) => {
          const m = main.find((p) => p.id === id);
          if (m) {
            const on = Boolean((saved[m.id] || '').trim()), unsaved = (draft[m.id] || '') !== (saved[m.id] || '');
            return card(id, 'provider-connection key-provider-card', summary(id, m.label, unsaved ? 'Unsaved changes' : on ? 'Key saved' : 'Not set', on), unsaved,
                <div className="provider-connection-body">
                  <p className="muted small">{m.hint} <a className="link-btn small inline" href={m.link} target="_blank" rel="noopener noreferrer">{m.linkText || 'Get a free key'} <ExternalLink size={12} /></a></p>
                  {keyInput(m.id, m.label, m.placeholder)}
                </div>);
          }
          const x = id as ExtraId, provider = EXTRA_PROVIDERS[x];
          const enabled = draft.providerAccess?.[x] === true;
          const unsaved = (draft[x] || '') !== (saved[x] || '') || enabled !== (saved.providerAccess?.[x] === true);
          return card(id, 'provider-connection', summary(id, provider.label, unsaved ? 'Unsaved changes' : enabled && saved[x] ? 'Key saved · on' : saved[x] ? 'Saved · off' : 'Not set', !unsaved && Boolean(enabled && saved[x])), unsaved,
              <div className="provider-connection-body">
                <p className="muted small">{provider.hint} <a className="link-btn small inline" href={provider.link} target="_blank" rel="noopener noreferrer">Provider dashboard <ExternalLink size={12} /></a></p>
                {keyInput(x, provider.label)}
                {x === 'alibaba' && <label className="provider-field"><span>Model Studio endpoint</span><input type="url" autoCapitalize="none" spellCheck={false} aria-label="Alibaba Cloud endpoint" placeholder={EXTRA_PROVIDERS.alibaba.base} value={draft.alibabaBaseUrl || ''} onChange={(e) => setDraft({ ...draft, alibabaBaseUrl: e.target.value })} /><span className="muted small">Paste the official base URL from your Model Studio workspace. Leave blank for the legacy Singapore endpoint.</span></label>}
                {x === 'cloudflare' && <label className="provider-field"><span>Cloudflare account ID</span><input aria-label="Cloudflare account ID" autoCapitalize="none" spellCheck={false} value={draft.cloudflareAccountId || ''} onChange={(e) => setDraft({ ...draft, cloudflareAccountId: e.target.value })} /></label>}
                <label className="provider-consent"><input type="checkbox" checked={enabled} onChange={(e) => setDraft({ ...draft, providerAccess: { ...draft.providerAccess, [x]: e.target.checked } })} /><span>Enable {provider.label}. Its models may use credits or charges; set a spending limit in its dashboard.</span></label>
              </div>);
        })}
      </div>

      {(!compact || (focused && focused in EXTRA_PROVIDERS && ('relay' in EXTRA_PROVIDERS[focused as ExtraId] || 'fallback' in EXTRA_PROVIDERS[focused as ExtraId]))) && <details className="settings-card provider-relay">
        <summary><span>Relay</span><span className="key-status-pill unset">{draft.providerRelayUrl ? 'Your relay' : 'Built-in'}</span><ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="provider-connection-body">
          <p className="muted small">NVIDIA and Cloudflare always connect through this app’s relay; other providers use it only if they turn away requests from browsers. Your key and prompt pass through it, and it stores neither. Leave the URL blank to use it, or enter a relay you control.</p>
          <label className="provider-field"><span>Custom relay URL (optional)</span><input type="url" aria-label="Provider relay URL" placeholder={DEFAULT_PROVIDER_RELAY_URL} autoCapitalize="none" spellCheck={false} value={draft.providerRelayUrl || ''} onChange={(e) => setDraft({ ...draft, providerRelayUrl: e.target.value })} /></label>
          <a className="link-btn small inline" href="https://github.com/Seifonyx/lumen/blob/main/server/provider-relay/README.md" target="_blank" rel="noopener noreferrer">Relay setup <ExternalLink size={12} /></a>
        </div>
      </details>}
      {!focused && <p className="muted small provider-retired">GitHub Models was retired on July 30, 2026; your GitHub coding connection still works. <a className="link-btn small inline" href="https://docs.github.com/en/github-models" target="_blank" rel="noopener noreferrer">Notice <ExternalLink size={12} /></a></p>}
    </section>
  );
}
