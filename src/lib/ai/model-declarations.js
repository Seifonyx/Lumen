import { AI_PROVIDERS, DEFAULT_PROVIDER_RELAY_URL, EXTRA_PROVIDERS, providerEnabled, validAlibabaBase, validRelayUrl } from './provider-config.js';

const BASES = {
  gemini:'https://generativelanguage.googleapis.com/v1beta',
  openrouter:'https://openrouter.ai/api/v1',
  groq:'https://api.groq.com/openai/v1',
  cerebras:'https://api.cerebras.ai/v1',
};
const BOOLEANS = ['vision','pdf','thinking','search','tools','structuredOutput','streaming'];
const VALUES = ['context','outputLimit',...BOOLEANS];
const KEYS = new Set(['id','provider','endpoint','accountId','name','label',...VALUES]);
const MODEL_NAME = /^[\w.@\-/:~]+$/;
const own = (value, key) => Object.hasOwn(value,key);
const trimmed = value => typeof value === 'string' ? value.trim() : '';
const canonicalEndpoint = value => {
  if (typeof value !== 'string' || value.length > 2048 || !validRelayUrl(value)) return null;
  return value.trim().replace(/\/$/,'');
};

/** The adapter's model-identity endpoint, never a key, account ID or arbitrary upstream. */
export function modelDeclarationEndpoint(provider, configuration = {}) {
  if (!AI_PROVIDERS.includes(provider)) return null;
  if (provider === 'alibaba') {
    const value = configuration.alibabaBaseUrl || EXTRA_PROVIDERS.alibaba.base;
    return validAlibabaBase(value) ? canonicalEndpoint(value) : null;
  }
  if (provider === 'cloudflare') {
    const relay = canonicalEndpoint(configuration.providerRelayUrl || DEFAULT_PROVIDER_RELAY_URL);
    return relay ? `${relay}/cloudflare` : null;
  }
  return BASES[provider] || EXTRA_PROVIDERS[provider]?.base || null;
}

function supportedEndpoint(provider, value) {
  if (provider === 'alibaba') return validAlibabaBase(value);
  // The only custom host the current adapters support is a user-owned relay.
  if (provider === 'cloudflare') return value.endsWith('/cloudflare') && validRelayUrl(value.slice(0,-11));
  return value === modelDeclarationEndpoint(provider);
}

/**
 * Validate private-settings data and return a small serializable whitelist.
 * Throws without echoing user values. No configuration or credentials are retained.
 * Endpoint scope is mandatory; changing regions never silently rebinds a declaration.
 * Cloudflare also requires its non-secret accountId, which scopes its model namespace.
 */
export function normalizeModelDeclarations(value = []) {
  if (!Array.isArray(value)) throw new TypeError('Model declarations must be a list.');
  if (value.length > 100) throw new RangeError('At most 100 model declarations are allowed.');
  for (let index=0;index<value.length;index++) {
    if (!own(value,index)) throw new TypeError('Invalid model declaration list.');
  }
  const identities = new Set();
  return value.map(entry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) ||
      ![Object.prototype,null].includes(Object.getPrototypeOf(entry))) throw new TypeError('Invalid model declaration.');
    for (const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(entry))) {
      if (!KEYS.has(key) || !own(descriptor,'value')) throw new TypeError('Unsupported model declaration field. Credentials are not allowed.');
    }
    const provider = trimmed(entry.provider), name = trimmed(entry.name), endpoint = canonicalEndpoint(entry.endpoint);
    if (!AI_PROVIDERS.includes(provider)) throw new TypeError('Unsupported model declaration provider.');
    if (!name || name.length > 256 || !MODEL_NAME.test(name) || name.split('/').some(part => part === '.' || part === '..') ||
      (provider === 'gemini' && !/^[\w.\-]+$/.test(name))) throw new TypeError('Invalid model declaration name.');
    if (!endpoint || !supportedEndpoint(provider,endpoint)) throw new TypeError('Unsupported model declaration endpoint.');
    const id = `${provider}:${name}`;
    if (own(entry,'id') && entry.id !== id) throw new TypeError('Model declaration identity does not match.');
    const accountId = provider === 'cloudflare' ? trimmed(entry.accountId).toLowerCase() : '';
    if ((provider === 'cloudflare' && !/^[a-f0-9]{32}$/.test(accountId)) ||
      (provider !== 'cloudflare' && own(entry,'accountId'))) throw new TypeError('Invalid model declaration account scope.');
    const identity = `${id}\n${endpoint}\n${accountId}`;
    if (identities.has(identity)) throw new TypeError('Duplicate model declaration.');
    identities.add(identity);
    const clean = {id,provider,endpoint,name};
    if (provider === 'cloudflare') clean.accountId = accountId;
    if (own(entry,'label')) {
      const label = trimmed(entry.label);
      if (!label || label.length > 160 || /[\u0000-\u001f\u007f]/.test(label)) throw new TypeError('Invalid model declaration label.');
      clean.label = label;
    }
    for (const field of ['context','outputLimit']) {
      if (!own(entry,field)) continue;
      const limit = field === 'context' ? 100_000_000 : 10_000_000;
      if (!Number.isSafeInteger(entry[field]) || entry[field] <= 0 || entry[field] > limit) throw new RangeError('Invalid model declaration token limit.');
      clean[field] = entry[field];
    }
    for (const field of BOOLEANS) {
      if (!own(entry,field)) continue;
      if (typeof entry[field] !== 'boolean') throw new TypeError('Model declaration capabilities must be boolean.');
      clean[field] = entry[field];
    }
    return clean;
  });
}

// These are adapter transport ceilings, not a claim that an unfamiliar model
// supports an operation. A declaration may narrow them, never expand them.
function transportAllows(provider, name, field) {
  if (field === 'pdf') return provider === 'openrouter' || (provider === 'gemini' && !/gemma/i.test(name));
  if (field === 'search') return provider === 'perplexity' ||
    (provider === 'gemini' && !/gemma/i.test(name) && /^gemini-(?:[3-9]|2\.5|flash|pro)/i.test(name));
  return true;
}

function unknownField(model, field) {
  if (model[field] == null) return true;
  const source = model.metadata?.fields?.[field];
  if (source) return ['unknown','inferred','user'].includes(source);
  // Adapters also expose explicit nullable fields (tools, outputLimit, etc.)
  // without per-field provenance. Non-null API/documented values still win.
  return !['api','documented'].includes(model.metadata?.source);
}

/**
 * Overlay declarations on RAW discovery rows. Re-run from those raw rows after
 * settings changes; do not feed this derived result back as discovery evidence.
 * Caller owns account/credential generations and availability error messages.
 * An OpenRouter declaration can only enrich an API-listed, confirmed free row.
 */
export function mergeModelDeclarations(models, declarations, {configuration = {}, providerStatus = {}, unavailableModels = []} = {}) {
  const clean = normalizeModelDeclarations(declarations);
  const result = [...models];
  const indexes = new Map(result.map((model,index) => [model.id,index]));
  const unavailable = new Set(unavailableModels);
  for (const declaration of clean) {
    const {id,provider,name,endpoint} = declaration;
    if (!providerEnabled(provider,configuration) || providerStatus[provider]?.errorKind === 'auth' || unavailable.has(id) ||
      endpoint !== modelDeclarationEndpoint(provider,configuration)) continue;
    // Its relay URL is shared across accounts; a valid but different account
    // must never inherit this namespace's model declarations or assumptions.
    if (provider === 'cloudflare' && declaration.accountId !== trimmed(configuration.cloudflareAccountId).toLowerCase()) continue;
    const index = indexes.get(id), existing = index === undefined ? null : result[index];
    if (existing && (canonicalEndpoint(existing.endpoint) !== endpoint || existing.name !== name ||
      existing.provider !== (provider === 'gemini' ? 'google' : provider))) continue;
    if (provider === 'openrouter' && (!existing || existing.metadata?.source !== 'api' ||
      existing.pricing?.input !== 0 || existing.pricing?.output !== 0)) continue;
    const model = existing ? {...existing,metadata:{...existing.metadata,fields:{...existing.metadata?.fields}}} : {
      id,provider:provider === 'gemini' ? 'google' : provider,name,endpoint,label:declaration.label || name,
      context:null,vision:false,pdf:false,thinking:false,search:false,
      metadata:{source:'user',fields:Object.fromEntries(VALUES.map(field => [field,'unknown']))},
    };
    const declaredFields = [];
    for (const field of VALUES) {
      if (!transportAllows(provider,name,field)) {
        model[field] = false;
        model.metadata.fields[field] = 'documented';
        continue;
      }
      if (!own(declaration,field) || (existing && !unknownField(existing,field))) continue;
      model[field] = declaration[field];
      model.metadata.fields[field] = 'user';
      declaredFields.push(field);
    }
    if (!existing || declaredFields.length) {
      model.metadata.verification = 'unchecked';
      model.metadata.declaredFields = declaredFields;
    }
    if (existing) result[index] = model;
    else { indexes.set(id,result.length); result.push(model); }
  }
  return result;
}
