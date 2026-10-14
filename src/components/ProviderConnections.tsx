import { ChevronDown, ExternalLink } from 'lucide-react';
import type { ApiKeys } from '../lib/firebase';
import { DEFAULT_PROVIDER_RELAY_URL, EXTRA_PROVIDERS } from '../lib/ai/provider-config.js';

type ExtraId = keyof typeof EXTRA_PROVIDERS;
export default function ProviderConnections({ draft, setDraft }: { draft: ApiKeys; setDraft: (value: ApiKeys) => void }) {
  const ids = Object.keys(EXTRA_PROVIDERS) as ExtraId[];
  return <section className="provider-connections" aria-labelledby="additional-providers">
    <h3 id="additional-providers">More providers</h3>
    <p className="muted small">Off by default. Enable a provider only if you accept its billing terms. Enabled models may be used by Auto, comparisons, titles and tasks. Free credits can run out; set spending limits in the provider’s dashboard.</p>
    <div className="settings-card">
      {ids.map(id => {
        const provider = EXTRA_PROVIDERS[id];
        const enabled = draft.providerAccess?.[id] === true;
        return <details key={id} className="provider-connection" data-provider={id}>
          <summary><span>{provider.label}</span><span className="muted small">{enabled && draft[id] ? 'Enabled' : draft[id] ? 'Saved · off' : 'Not set'}</span><ChevronDown size={16} aria-hidden="true"/></summary>
          <div className="provider-connection-body">
            <p className="muted small">{provider.hint}</p>
            <a className="link-btn small inline" href={provider.link} target="_blank" rel="noopener noreferrer">Provider dashboard <ExternalLink size={12}/></a>
            <label className="provider-field"><span>API key</span><input aria-label={`${provider.label} API key`} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={draft[id] || ''} onChange={e => setDraft({ ...draft, [id]: e.target.value })}/></label>
            {id === 'alibaba' && <label className="provider-field"><span>Model Studio endpoint</span><input type="url" autoCapitalize="none" spellCheck={false} aria-label="Alibaba Cloud endpoint" placeholder={EXTRA_PROVIDERS.alibaba.base} value={draft.alibabaBaseUrl || ''} onChange={e => setDraft({ ...draft, alibabaBaseUrl: e.target.value })}/><span className="muted small">Paste the official base URL from your Model Studio workspace. Leave blank for the legacy Singapore endpoint.</span></label>}
            {id === 'cloudflare' && <label className="provider-field"><span>Cloudflare account ID</span><input aria-label="Cloudflare account ID" autoCapitalize="none" spellCheck={false} value={draft.cloudflareAccountId || ''} onChange={e => setDraft({ ...draft, cloudflareAccountId: e.target.value })}/></label>}
            <label className="provider-consent"><input type="checkbox" checked={enabled} onChange={e => setDraft({ ...draft, providerAccess: { ...draft.providerAccess, [id]: e.target.checked } })}/><span>Enable {provider.label} — allow credits or charges</span></label>
          </div>
        </details>;
      })}
    </div>
    <details className="settings-card provider-relay">
      <summary><span>NVIDIA & Cloudflare relay</span><span className="muted small">{draft.providerRelayUrl ? 'Your relay' : 'Built-in'}</span><ChevronDown size={16} aria-hidden="true"/></summary>
      <div className="provider-connection-body">
        <p className="muted small">Your key and prompt pass through this app’s relay to NVIDIA or Cloudflare. The relay stores neither. Leave the URL blank to use it, or enter a relay you control.</p>
        <label className="provider-field"><span>Custom relay URL (optional)</span><input type="url" aria-label="Provider relay URL" placeholder={DEFAULT_PROVIDER_RELAY_URL} autoCapitalize="none" spellCheck={false} value={draft.providerRelayUrl || ''} onChange={e => setDraft({ ...draft, providerRelayUrl: e.target.value })}/></label>
        <a className="link-btn small inline" href="https://github.com/Seifonyx/Model-Router/blob/main/server/provider-relay/README.md" target="_blank" rel="noopener noreferrer">Relay setup <ExternalLink size={12}/></a>
      </div>
    </details>
    <p className="muted small provider-retired">GitHub Models was retired on July 30, 2026; your GitHub coding connection still works. <a className="link-btn small inline" href="https://docs.github.com/en/github-models" target="_blank" rel="noopener noreferrer">Notice <ExternalLink size={12}/></a></p>
  </section>;
}
