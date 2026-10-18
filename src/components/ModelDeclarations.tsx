import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { modelDeclarationEndpoint, normalizeModelDeclarations } from '../lib/ai/model-declarations.js';
import { AI_PROVIDERS, providerEnabled } from '../lib/ai/provider-config.js';
import { keyVersion } from '../lib/ai/providers.js';
import { PROVIDER_NAMES, providerOfId } from '../lib/util';
import { useStore } from '../store';
import type { ModelDeclaration } from '../types';

const CAPABILITIES = [
  ['vision','Images'], ['pdf','PDF'], ['thinking','Reasoning'], ['search','Search'],
  ['tools','Tools'], ['structuredOutput','Structured output'], ['streaming','Streaming'],
] as const;
type Capability = typeof CAPABILITIES[number][0];
type Choice = '' | 'yes' | 'no';
type PrimaryField = 'provider' | 'name' | 'label' | 'context' | 'outputLimit';
type Draft = {
  owner: string;
  version: number;
  provider: ModelDeclaration['provider'];
  endpoint: string;
  accountId?: string;
  name: string;
  label: string;
  context: string;
  outputLimit: string;
  capabilities: Record<Capability,Choice>;
  original?: ModelDeclaration;
};
const identity = (model: ModelDeclaration) => JSON.stringify([model.id,model.endpoint,model.accountId || '']);
const providerName = (provider: string) => PROVIDER_NAMES[providerOfId(`${provider}:model`)];

/** User assumptions stay separate from discovery and never change saved assignments. */
export default function ModelDeclarations() {
  const owner = useStore(s => s.user?.uid || '');
  const keys = useStore(s => s.keys);
  const settings = useStore(s => s.settings);
  const catalog = useStore(s => s.catalog);
  const [draft,setDraft] = useState<Draft | null>(null);
  const [error,setError] = useState<{message:string;field:PrimaryField} | null>(null);
  const prefix = useId();
  const fields = useRef<Partial<Record<PrimaryField,HTMLInputElement | HTMLSelectElement | null>>>({});
  const addButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const declarations = settings.modelDeclarations || [];
  const currentDraft = draft?.owner === owner ? draft : null;
  const editorOpen = Boolean(currentDraft);
  const activeProviders = AI_PROVIDERS.filter(provider => providerEnabled(provider,keys));

  useEffect(() => { setDraft(null);setError(null); },[owner]);
  useEffect(() => { if (editorOpen) fields.current.name?.focus(); },[editorOpen]);
  useLayoutEffect(() => {
    if (!editorOpen && restoreFocus.current) {restoreFocus.current=false;addButton.current?.focus();}
  },[editorOpen]);
  useEffect(() => {
    if (draft && draft.owner === owner && draft.version !== keyVersion()) {
      setError({message:'Provider settings changed. Cancel and reopen the editor to use the new connection.',field:'provider'});
    }
  },[keys,draft,owner]);

  const fail = (field: PrimaryField,message: string) => {
    setError({field,message});
    fields.current[field]?.focus();
  };
  const close = () => { restoreFocus.current=true;setDraft(null);setError(null); };
  const begin = (model?: ModelDeclaration) => {
    const state = useStore.getState();
    if (!state.user?.uid) return;
    const provider = (model?.provider || activeProviders[0] || 'gemini') as ModelDeclaration['provider'];
    setError(null);
    setDraft({
      owner:state.user.uid,version:keyVersion(),provider,
      endpoint:model?.endpoint || modelDeclarationEndpoint(provider,state.keys) || '',
      ...(provider === 'cloudflare' ? {accountId:model?.accountId || state.keys.cloudflareAccountId?.trim().toLowerCase()} : {}),
      name:model?.name || '',label:model?.label || '',
      context:model?.context?.toString() || '',outputLimit:model?.outputLimit?.toString() || '',
      capabilities:Object.fromEntries(CAPABILITIES.map(([field]) => [field,model?.[field] === undefined ? '' : model[field] ? 'yes' : 'no'])) as Record<Capability,Choice>,
      original:model,
    });
  };
  const change = (field: PrimaryField,value: string) => {
    if (!currentDraft) return;
    setError(null);
    if (field === 'provider') {
      if (currentDraft.version !== keyVersion()) {
        fail('provider','Provider settings changed. Cancel and reopen the editor to use the new connection.');
        return;
      }
      setDraft({...currentDraft,provider:value as ModelDeclaration['provider'],
        endpoint:modelDeclarationEndpoint(value,keys) || '',
        accountId:value === 'cloudflare' ? keys.cloudflareAccountId?.trim().toLowerCase() : undefined});
    } else setDraft({...currentDraft,[field]:value});
  };
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!currentDraft) return;
    const latest = useStore.getState();
    if (latest.user?.uid !== currentDraft.owner || keyVersion() !== currentDraft.version) {
      fail('provider','Provider settings changed. Cancel and reopen the editor to use the new connection.');
      return;
    }
    const {provider,endpoint,accountId,name,label,context,outputLimit,original} = currentDraft;
    if (!providerEnabled(provider,latest.keys)) {
      fail('provider','Connect and enable this provider in API keys before saving a custom model.');
      return;
    }
    if (endpoint !== modelDeclarationEndpoint(provider,latest.keys) || (provider === 'cloudflare' && accountId !== latest.keys.cloudflareAccountId?.trim().toLowerCase())) {
      fail('provider','This model belongs to a different endpoint or Cloudflare account. Cancel and add it using the current connection.');
      return;
    }
    const saved = latest.settings.modelDeclarations || [];
    if (original && !saved.some(model => identity(model) === identity(original) && JSON.stringify(model) === JSON.stringify(original))) {
      fail('name','This custom model changed elsewhere. Cancel and edit its latest version.');
      return;
    }
    let candidate: ModelDeclaration;
    try {
      candidate = normalizeModelDeclarations([{provider,endpoint,name,...(provider === 'cloudflare' ? {accountId} : {}),...(label.trim() ? {label} : {})}])[0] as ModelDeclaration;
    } catch (cause) {
      const message = (cause as Error).message;
      fail(/label/i.test(message) ? 'label' : /name|identity/i.test(message) ? 'name' : 'provider',message);
      return;
    }
    for (const [field,text] of [['context',context],['outputLimit',outputLimit]] as const) {
      if (!text.trim()) continue;
      try {
        candidate = normalizeModelDeclarations([{...candidate,[field]:Number(text)}])[0] as ModelDeclaration;
      } catch {
        fail(field,`${field === 'context' ? 'Context' : 'Output'} limit must be a positive whole number of tokens within the supported range.`);
        return;
      }
    }
    for (const [field] of CAPABILITIES) {
      if (currentDraft.capabilities[field] !== '') candidate[field] = currentDraft.capabilities[field] === 'yes';
    }
    if (provider === 'openrouter' && !latest.catalog?.models.some(model => model.id === candidate.id && model.metadata?.source === 'api' && model.pricing?.input === 0 && model.pricing?.output === 0)) {
      fail('name','OpenRouter custom details can only be saved for a free model already listed by the connected provider.');
      return;
    }
    try {
      const next = normalizeModelDeclarations([...saved.filter(model => !original || identity(model) !== identity(original)),candidate]) as ModelDeclaration[];
      latest.updateSettings({modelDeclarations:next,
        enabledModels:latest.settings.enabledModels.includes(candidate.id) ? latest.settings.enabledModels : [...latest.settings.enabledModels,candidate.id]});
      latest.toast('Custom model saved. Its declared details are unchecked.','success');
      close();
    } catch (cause) { fail('name',(cause as Error).message); }
  };
  const remove = (model: ModelDeclaration) => {
    const latest = useStore.getState();
    if (latest.user?.uid !== owner) return;
    const version = keyVersion();
    latest.updateSettings({modelDeclarations:(latest.settings.modelDeclarations || []).filter(item => identity(item) !== identity(model))});
    if (currentDraft?.original && identity(currentDraft.original) === identity(model)) close();
    latest.toast('Custom model removed. Saved choices and layouts are kept.','info',{label:'Undo',run:() => {
      const state=useStore.getState();
      if (state.user?.uid !== owner || keyVersion() !== version) return;
      const current=state.settings.modelDeclarations || [];
      if (!current.some(item => identity(item) === identity(model))) {
        try { state.updateSettings({modelDeclarations:normalizeModelDeclarations([...current,model]) as ModelDeclaration[]}); }
        catch { state.toast('The custom model could not be restored. Check the current custom model limit.','error'); }
      }
    }});
  };

  return (
    <section className="settings-group custom-models" aria-labelledby={`${prefix}-title`}>
      <div className="settings-group-title">
        <span id={`${prefix}-title`}>Custom models</span>
        <button ref={addButton} type="button" className="link-btn small" onClick={() => begin()} disabled={Boolean(currentDraft)}><Plus size={14} aria-hidden="true" /> Add custom model</button>
      </div>
      <div className="settings-card pad-card">
        <p className="setting-hint">Add a model or fill in unknown details for a connected provider. Declared details are unchecked; provider facts take precedence.</p>
        {!declarations.length && !currentDraft && <p className="muted small">No custom models yet.</p>}
        {!activeProviders.length && <p className="setting-hint">Connect and enable a provider in API keys to add a custom model.</p>}
        {declarations.length > 0 && <ul className="declared-models">
          {declarations.map(model => {
            const sameScope=model.endpoint === modelDeclarationEndpoint(model.provider,keys) && (model.provider !== 'cloudflare' || model.accountId === keys.cloudflareAccountId?.trim().toLowerCase());
            const listed=catalog?.models.some(item => item.id === model.id && item.endpoint === model.endpoint);
            return <li key={identity(model)} className="declared-model-row">
              <div className="model-meta">
                <span className="model-title">{model.label || model.name}</span>
                <span className="model-sub">{providerName(model.provider)} · Declared · Unchecked</span>
                <span className="setting-hint">{!sameScope ? 'Saved for a different endpoint or account.' : !providerEnabled(model.provider,keys) ? 'Provider not connected or enabled.' : !listed ? 'Unavailable with the current connection.' : model.context ? `${model.context.toLocaleString()} tokens declared` : 'Context unknown'}</span>
              </div>
              <div className="declared-model-actions">
                <button type="button" className="icon-btn sm" aria-label={`Edit ${model.label || model.name}`} title="Edit" onClick={() => begin(model)} disabled={Boolean(currentDraft)}><Pencil size={15} /></button>
                <button type="button" className="icon-btn sm" aria-label={`Remove ${model.label || model.name}`} title="Remove" onClick={() => remove(model)}><Trash2 size={15} /></button>
              </div>
            </li>;
          })}
        </ul>}
        {currentDraft && <form className="declared-model-editor" noValidate data-local-escape onSubmit={save} aria-label={currentDraft.original ? 'Edit custom model' : 'Add custom model'} onKeyDown={event => {
          if (event.key === 'Escape' && !event.nativeEvent.isComposing) {event.stopPropagation();event.preventDefault();close();}
        }}>
          <label className="field-block" htmlFor={`${prefix}-provider`}><span className="setting-label" id={`${prefix}-provider-label`}>Provider</span>
            <select id={`${prefix}-provider`} aria-labelledby={`${prefix}-provider-label`} ref={node => {fields.current.provider=node;}} value={currentDraft.provider} onChange={event => change('provider',event.target.value)} aria-invalid={error?.field === 'provider'} aria-describedby={error?.field === 'provider' ? `${prefix}-error` : undefined}>
              {AI_PROVIDERS.map(provider => <option key={provider} value={provider} disabled={!providerEnabled(provider,keys)}>{providerName(provider)}{providerEnabled(provider,keys) ? '' : ' · not connected'}</option>)}
            </select>
          </label>
          <p className="setting-hint">Uses this provider’s endpoint from API keys settings.</p>
          {currentDraft.provider === 'openrouter' && <p className="setting-hint">OpenRouter declarations can only fill unknown details for free models already listed by the provider.</p>}
          {(['name','label','context','outputLimit'] as const).map(field => <label key={field} className="field-block" htmlFor={`${prefix}-${field}`}>
            <span className="setting-label">{field === 'name' ? 'Model ID' : field === 'label' ? 'Display name' : field === 'context' ? 'Context limit (tokens)' : 'Output limit (tokens)'}</span>
            <input id={`${prefix}-${field}`} ref={node => {fields.current[field]=node;}} type={field === 'context' || field === 'outputLimit' ? 'number' : 'text'}
              {...(field === 'context' || field === 'outputLimit' ? {min:1,step:1,inputMode:'numeric' as const} : {maxLength:field === 'name' ? 256 : 160})}
              value={currentDraft[field]} onChange={event => change(field,event.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder={field === 'label' ? 'Use model ID' : field === 'name' ? 'Provider model name' : 'Unknown'}
              aria-invalid={error?.field === field} aria-describedby={error?.field === field ? `${prefix}-error` : undefined} />
          </label>)}
          <details className="declared-model-capabilities"><summary>Capabilities (optional)</summary>
            <p className="setting-hint">Leave unknown details unset. Declaring support cannot add PDF or search features to a provider connection.</p>
            {CAPABILITIES.map(([field,label]) => <label key={field} className="field-block" htmlFor={`${prefix}-${field}`}>
              <span className="setting-label" id={`${prefix}-${field}-label`}>{label}</span>
              <select id={`${prefix}-${field}`} aria-labelledby={`${prefix}-${field}-label`} value={currentDraft.capabilities[field]} onChange={event => {setError(null);setDraft({...currentDraft,capabilities:{...currentDraft.capabilities,[field]:event.target.value as Choice}});}}>
                <option value="">Unknown</option><option value="yes">Yes</option><option value="no">No</option>
              </select>
            </label>)}
          </details>
          {error && <p id={`${prefix}-error`} className="error-text" role="alert">{error.message}</p>}
          <div className="settings-actions"><button type="button" className="btn" onClick={close}>Cancel</button><button type="submit" className="btn primary">Save model</button></div>
        </form>}
      </div>
    </section>
  );
}
