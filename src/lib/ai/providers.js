// Provider adapters discover live models and stream replies
// as a common sequence of events: { t: 'text' | 'think' | 'sources' | 'notice' | 'error', ... }.

import { parseLimit, readError, readSSE, upstreamError } from './http.js';
import { isActiveModel, isExcludedModel, isUnavailableFailure } from './model-status.js';
import { safeVideoUri, toolBlock } from './tool-inputs.js';
import { setHealthScope } from './health.js';
import { AI_PROVIDERS, DEFAULT_PROVIDER_RELAY_URL, EXTRA_PROVIDERS, normalizeKeys, providerEnabled, validAlibabaBase, validRelayUrl } from './provider-config.js';
import { createModelRegistry } from './registry.js';
import { waitFor } from './abort.js';

// API keys come from the user's settings (stored in their private Firebase document).
let keys = normalizeKeys();
let capabilities = new Map();
/** Metadata from the current connected catalogue; no credentials or request content. */
export const modelCapabilities = id => capabilities.get(id);
let keyGeneration = 0;
let credentialController = new AbortController();
export const keyVersion = () => keyGeneration;
/** Bind an entire operation, including retries, to the current credential scope. */
export function providerSignal(signal) {
  const combined=signal?AbortSignal.any([signal,credentialController.signal]):credentialController.signal;
  if(combined.aborted)throw Object.assign(new Error('Provider request stopped.'),{name:'AbortError'});
  return combined;
}
async function providerFetch(url,options={}) {
  const signal=providerSignal(options.signal || AbortSignal.timeout(20_000));
  const request=fetch(url,{...options,signal,credentials:'omit',redirect:'error'}).then(response=>{
    if(signal.aborted) {void response.body?.cancel().catch(()=>{});throw Object.assign(new Error('Provider request stopped.'),{name:'AbortError'});}
    return response;
  });
  const response=await waitFor(request,signal);
  // Uncooperative IO must not publish a response from an abandoned configuration.
  if(signal.aborted)throw Object.assign(new Error('Provider request stopped.'),{name:'AbortError'});
  return response;
}
export function setKeys(next) {
  const clean = normalizeKeys(next);
  const signature = value => { const {github:_,...config}=value;return JSON.stringify(config); };
  if (signature(clean) !== signature(keys)) {
    credentialController.abort();credentialController=new AbortController();
    registry?.invalidate(); registry = null; capabilities.clear(); setHealthScope(null); keyGeneration++;
  }
  keys = clean;
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// Groq and Cerebras speak the OpenAI format; both have free plans (no card needed).
const COMPAT = {
  groq: { base: 'https://api.groq.com/openai/v1', label: 'Groq' },
  cerebras: { base: 'https://api.cerebras.ai/v1', label: 'Cerebras' },
  ...EXTRA_PROVIDERS,
};
// Speech, safety classifiers and agent systems aren't chat models.
const COMPAT_SKIP = /(whisper|tts|playai|orpheus|guard|safeguard|distil|compound|embed|rerank)/i;
// NVIDIA's shared /models list also includes specialist endpoints that cannot chat.
// OpenAI's list includes speech, image, realtime and embedding models, and some that only work through its
// newer Responses API (pro, codex, deep research), which this app doesn't use.
const OPENAI_SKIP = /(?:realtime|audio|transcribe|tts|image|search-api|instruct|-pro\b|codex|deep-research|computer-use|moderation|embedding)/i;
const NVIDIA_SKIP = /(?:content-safety|video-detector|ising-calibration|nemotron-parse|nvclip|deplot|(?:^|\/)riva-|(?:^|[-/])reward(?:-|$))/i;

// Gemini models that aren't chat models (speech, images, video, music, embeddings, agents...).
const GEMINI_SKIP = /(tts|image|imagen|embedding|aqa|veo|lyria|robotics|computer-use|transcribe|antigravity|deep-research|live|audio|nano-banana|omni)/i;

export const isGemma = (name) => /gemma/i.test(name);
// Gemini 2.5 and newer (and the "-latest" aliases) can think and use Google Search.
const geminiThinks = (name) => /^gemini-(?:[3-9]|2\.5|flash|pro)/i.test(name);

export const hasGemini = () => Boolean(keys.gemini);
export const hasOpenRouter = () => Boolean(keys.openrouter);
/** A saved key is usable only when any required billing opt-in is also enabled. */
export const hasKey = (provider) => AI_PROVIDERS.includes(provider) && providerEnabled(provider, keys);

export function parseModelId(id) {
  const m = /^([a-z]+):(.+)$/.exec(id || '');
  if (!m) return null;
  const [, provider, name] = m;
  if (!AI_PROVIDERS.includes(provider)) return null;
  if (provider === 'gemini' && !/^[\w.\-]+$/.test(name)) return null;
  if (provider !== 'gemini' && (!/^[\w.@\-\/:~]+$/.test(name) || name.split('/').some(p => p === '..' || p === '.'))) return null;
  return { provider, name };
}

// ---------------------------------------------------------------- Catalog

function prettyGemini(m) {
  return m.displayName || m.name.replace(/^models\//, '');
}

async function geminiCatalog(configuration, signal) {
  const models = [];
  let pageToken = '';
  const seen = new Set();
  do {
    const res = await providerFetch(`${GEMINI_BASE}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { signal, headers: { 'x-goog-api-key': configuration.gemini } });
    if (!res.ok) throw await discoveryError('Google',res);
    const page = await res.json();
    if (!Array.isArray(page.models)) throw new Error('Google: invalid model catalogue');
    models.push(...page.models);
    pageToken = page.nextPageToken || '';
    if (pageToken && seen.has(pageToken)) throw new Error('Google: repeated catalogue page');
    seen.add(pageToken);
  } while (pageToken);
  return models
    .filter((m) => typeof m?.name==='string' && parseModelId(`gemini:${m.name.replace(/^models\//,'')}`) && Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => ({ ...m, short: m.name.replace(/^models\//, '') }))
    .filter((m) => !GEMINI_SKIP.test(m.short) && isActiveModel(m) && !isExcludedModel(`gemini:${m.short}`))
    .map((m) => ({
      id: `gemini:${m.short}`,
      provider: 'google',
      name: m.short,
      label: prettyGemini(m),
      context: m.inputTokenLimit || null,
      outputLimit: positive(m.outputTokenLimit),
      endpoint: GEMINI_BASE,
      metadata: {source:'api',fields:{context:m.inputTokenLimit?'api':'unknown',vision:'inferred',pdf:'inferred',thinking:'inferred',search:'inferred'}},
      vision: !/^gemma-?(?:2|3-(?:1b|270m)(?:-|$))/i.test(m.short),
      pdf: !isGemma(m.short),
      thinking: geminiThinks(m.short),
      search: !isGemma(m.short) && geminiThinks(m.short),
      preview: /preview|exp/i.test(m.short),
    }));
}

async function openRouterCatalog(configuration, signal) {
  const res = await providerFetch(`${OPENROUTER_BASE}/models`, { signal, headers: { authorization: `Bearer ${configuration.openrouter}` } });
  if (!res.ok) throw await discoveryError('OpenRouter',res);
  const { data } = await res.json();
  if (!Array.isArray(data)) throw new Error('OpenRouter: invalid model catalogue');
  return data
    .filter((m) => typeof m?.id==='string' && parseModelId(`openrouter:${m.id}`) && isActiveModel(m) && m.pricing?.prompt != null && m.pricing?.completion != null && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)
    .filter((m) => (m.architecture?.output_modalities || ['text']).includes('text'))
    .filter((m) => !/embed|guard|moderation|content-safety|tts|whisper/i.test(m.id))
    .map((m) => {
      const input = m.architecture?.input_modalities || ['text'];
      return {
        id: `openrouter:${m.id}`,
        provider: 'openrouter',
        name: m.id,
        label: (m.name || m.id).replace(/\s*\(free\)\s*$/i, ''),
        context: m.context_length || null,
        endpoint: OPENROUTER_BASE,
        outputLimit: positive(m.top_provider?.max_completion_tokens),
        modalities: {input:m.architecture?.input_modalities || null,output:m.architecture?.output_modalities || null},
        tools: Array.isArray(m.supported_parameters)?m.supported_parameters.includes('tools'):null,
        structuredOutput: Array.isArray(m.supported_parameters)?m.supported_parameters.includes('response_format'):null,
        pricing: {input:0,output:0,currency:'USD',unit:'token'},
        metadata: {source:'api',fields:{context:m.context_length?'api':'unknown',vision:m.architecture?.input_modalities?'api':'unknown',pdf:'documented',thinking:m.supported_parameters?'api':'unknown',search:'documented'}},
        vision: input.includes('image'),
        pdf: true, // OpenRouter turns PDFs into text for models that can't read them
        thinking: (m.supported_parameters || []).includes('reasoning'),
        search: false,
        created: m.created || 0,
      };
    })
    .sort((a, b) => b.created - a.created);
}

/** "meta-llama/llama-4-scout-17b-16e-instruct" → "Llama 4 Scout 17B 16E Instruct" */
export function prettyModelName(id) {
  const words = id.split('/').pop().replace(/[-_]+/g, ' ').trim().split(/\s+/);
  const special = { gpt: 'GPT', oss: 'OSS', qwq: 'QwQ', glm: 'GLM', ai: 'AI', it: 'IT' };
  return words
    .map((w) => {
      const lw = w.toLowerCase();
      if (special[lw]) return special[lw];
      if (/^\d+(\.\d+)?[bkm]$/i.test(w)) return w.toUpperCase();
      if (/^\d+e$/i.test(w)) return w.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ')
    .replace(/^GPT OSS/, 'GPT-OSS');
}

function modelContext(metadata) {
  const explicit = metadata.max_context_length || metadata.context_window || metadata.context_length;
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const limits = (metadata.providers || []).filter(p => p.status === 'live').map(p => p.context_length).filter(n => Number.isFinite(n) && n > 0);
  // Gateway backends differ: use the smallest advertised live window, not the largest.
  return limits.length ? Math.min(...limits) : null;
}

const positive = value => Number.isFinite(value) && value > 0 ? value : null;
async function discoveryError(label,res) {
  const retry=res.headers.get('retry-after');
  const retryAfterMs=retry ? (/^\d+(?:\.\d+)?$/.test(retry)?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now())) : 0;
  return Object.assign(new Error(`${label}: ${await upstreamError(res)}`),{status:res.status,retryAfterMs});
}

function modelVision(provider, name, metadata = {}) {
  if (metadata.input_modalities) return metadata.input_modalities.includes('image');
  if (metadata.capabilities?.vision != null) return metadata.capabilities.vision === true;
  if (metadata.architecture?.input_modalities) return metadata.architecture.input_modalities.includes('image');
  if (provider === 'groq') return /llama-4|vision|scout|maverick|qwen3\.[68]-27b/i.test(name);
  if (provider === 'cerebras' || provider === 'aion') return false;
  return /(?:vision|pixtral|qwen.*(?:vl|vision)|llama-(?:3\.2-(?:11b|90b)|4)|nemotron.*vl)/i.test(name);
}

async function compatFetch(provider, path, options = {}, catalogue = false, configuration = keys) {
  options={...options,signal:providerSignal(options.signal)};
  const config = COMPAT[provider];
  if (!config || !providerEnabled(provider,configuration)) throw new Error('This provider is not enabled.');
  let base = config.base;
  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${configuration[provider]}`);
  if (options.body) headers.set('content-type', 'application/json');
  if (provider === 'cohere' && catalogue) base = 'https://api.cohere.ai/v1';
  if (provider === 'alibaba') {
    base = configuration.alibabaBaseUrl || config.base;
    if (!validAlibabaBase(base)) throw new Error('Alibaba Cloud: choose an official Model Studio endpoint.');
  }
  // Claude takes the key in its own header too, and asks browser apps to say they're calling directly.
  if (provider === 'anthropic') {
    headers.set('x-api-key', configuration[provider]);
    headers.set('anthropic-version', '2023-06-01');
    headers.set('anthropic-dangerous-direct-browser-access', 'true');
  }
  const relayUrl = configuration.providerRelayUrl || DEFAULT_PROVIDER_RELAY_URL;
  if (config.relay) {
    if (!validRelayUrl(relayUrl)) throw new Error(`${config.label}: use a valid HTTPS relay in API keys settings.`);
    base = `${relayUrl}/${provider}`;
    if (provider === 'cloudflare') {
      if (!/^[a-f0-9]{32}$/i.test(configuration.cloudflareAccountId)) throw new Error('Cloudflare: enter the 32-character account ID.');
      headers.set('x-mr-account-id', configuration.cloudflareAccountId);
    }
  }
  const send = (url) => providerFetch(url, { ...options, headers: Object.fromEntries(headers), credentials: 'omit', referrerPolicy: 'no-referrer' });
  try {
    return await send(`${base}${path}`);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    // A provider that turns browser requests away (no CORS) is reached through the relay instead.
    if (config.fallback && validRelayUrl(relayUrl)) {
      try { return await send(`${relayUrl}/${provider}${path}`); } catch (again) { if (options.signal?.aborted) throw again; }
    }
    throw new Error(`${config.label}: connection failed. Check the key, endpoint and browser access${config.relay || config.fallback ? ' to your relay' : ''}.`);
  }
}

async function compatCatalog(provider, configuration, signal) {
  const { label, models: fixed } = COMPAT[provider];
  // A provider without a model list (Perplexity): its documented models, checked with the key on first use.
  if (fixed) return fixed.map(([name, title], i) => ({ id: `${provider}:${name}`, provider, name, label: title, context: 128_000, vision: false, pdf: false, thinking: /reason/.test(name), search: provider === 'perplexity', created: fixed.length - i,endpoint:COMPAT[provider].base,metadata:{source:'documented',fields:{context:'documented',vision:'documented',pdf:'documented',thinking:'documented',search:'documented'}} }));
  let data = [], pageToken = '', page = 1;
  const seen = new Set();
  do {
    const path = provider === 'cohere' ? `/models?endpoint=chat${pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : ''}`
      : provider === 'cloudflare' ? `/models?per_page=100&page=${page}`
      : provider === 'anthropic' ? `/models?limit=100${pageToken?`&after_id=${encodeURIComponent(pageToken)}`:''}` : '/models';
    const res = await compatFetch(provider, path, { signal }, true, configuration);
    if (!res.ok) throw await discoveryError(label,res);
    const json = await res.json();
    // (Together answers with a bare list.)
    const items = provider === 'cohere' ? json.models : provider === 'cloudflare' ? json.result : Array.isArray(json) ? json : json.data;
    if (!Array.isArray(items) || json.success === false) throw new Error(`${label}: invalid model catalogue`);
    data.push(...items);
    pageToken = json.next_page_token || '';
    if (provider === 'anthropic' && json.has_more) {
      const last=json.last_id || items.at(-1)?.id;
      if(!last) throw new Error(`${label}: invalid catalogue page`);
      pageToken=last;
    }
    if (pageToken && seen.has(pageToken)) throw new Error(`${label}: repeated catalogue page`);
    seen.add(pageToken);
    if (provider === 'cloudflare' && page < (json.result_info?.total_pages || 1)) { page++; continue; }
    if (!pageToken) break;
    page++;
  } while (page <= 100);
  if (page > 100) throw new Error(`${label}: catalogue exceeded page limit`);
  if (!Array.isArray(data)) throw new Error(`${label}: invalid model catalogue`);
  return data
    .map(m => ({ ...m, id: provider === 'cohere' || provider === 'cloudflare' ? m.name : m.id }))
    .filter((m) => typeof m.id === 'string' && m.id && parseModelId(`${provider}:${m.id}`) && isActiveModel(m) && !m.is_deprecated && !m.archived && !isExcludedModel(`${provider}:${m.id}`) && !COMPAT_SKIP.test(m.id))
    .filter(m => provider !== 'mistral' || m.capabilities?.completion_chat === true)
    .filter(m => provider !== 'nvidia' || !NVIDIA_SKIP.test(m.id))
    .filter(m => provider !== 'cohere' || m.endpoints?.includes('chat'))
    .filter(m => provider !== 'cloudflare' || /text generation/i.test(m.task?.name || ''))
    .filter(m => provider !== 'huggingface' || (!m.providers?.length || m.providers.some(p => p.status === 'live')))
    .filter(m => !m.type || /chat|text|language|llm|^model$/i.test(m.type))
    .filter(m => provider !== 'openai' || (/^(?:gpt-|o\d|chatgpt-)/.test(m.id) && !OPENAI_SKIP.test(m.id)))
    .filter(m => !m.architecture?.output_modalities || m.architecture.output_modalities.includes('text'))
    .map((m) => ({
      id: `${provider}:${m.id}`,
      provider,
      name: m.id,
      label: m.display_name || m.displayName || (provider === 'deepseek' || provider === 'aion' ? m.name : '') || prettyModelName(m.id),
      context: modelContext(m),
      outputLimit: positive(m.max_output_tokens || m.max_completion_tokens),
      endpoint: provider==='alibaba'?(configuration.alibabaBaseUrl || COMPAT[provider].base):COMPAT[provider].base || `${configuration.providerRelayUrl || DEFAULT_PROVIDER_RELAY_URL}/${provider}`,
      modalities: {input:m.input_modalities || m.architecture?.input_modalities || null,output:m.output_modalities || m.architecture?.output_modalities || null},
      tools: typeof m.capabilities?.function_calling==='boolean'?m.capabilities.function_calling:null,
      structuredOutput: typeof m.capabilities?.json_schema==='boolean'?m.capabilities.json_schema:null,
      metadata: {source:'api',fields:{context:modelContext(m)?'api':'unknown',vision:m.input_modalities || m.architecture?.input_modalities || m.capabilities?.vision!=null?'api':'inferred',pdf:'documented',thinking:m.reasoning!=null || m.reasoning_effort?.supported!=null?'api':'inferred',search:'documented'}},
      vision: modelVision(provider, m.id, m),
      pdf: false, // PDFs reach these models only as extracted text
      thinking: typeof m.reasoning==='boolean'?m.reasoning:typeof m.reasoning_effort?.supported==='boolean'?m.reasoning_effort.supported:/gpt-oss|qwen-?3|deepseek.*(?:r1|reasoner|v4|flash)|reason|think|qwq|magistral/i.test(m.id),
      search: false,
      created: m.created || (m.created_at ? Date.parse(m.created_at) / 1000 : 0),
    }))
    .sort((a, b) => b.created - a.created);
}

// Picks a sensible starting set when the user hasn't chosen models yet.
function pickDefaults(google, openrouter, groq = [], cerebras = []) {
  const g = google.filter((m) => !m.preview);
  const pick = (re) => g.find((m) => re.test(m.name))?.id;
  const ids = [pick(/^gemini-flash-latest$/) || pick(/^gemini-[\d.]+-flash$/), pick(/^gemini-flash-lite-latest$/) || pick(/flash-lite$/), pick(/^gemma-.*-it$/)];
  ids.push(...openrouter.slice(0, 2).map((m) => m.id));
  ids.push(...providerDefaults(groq), ...providerDefaults(cerebras));
  return ids.filter(Boolean);
}

/** Two good starting models for Groq or Cerebras: a strong general one and a fast one. */
function providerDefaults(list) {
  const pick = (re) => list.find((m) => re.test(m.name))?.id;
  const ids = [pick(/gpt-oss-120b/) || pick(/70b|120b|235b/) || list[0]?.id, pick(/gpt-oss-20b/) || pick(/qwen.*27b/)];
  return [...new Set(ids.filter(Boolean))];
}

let registry = null;
function currentRegistry() {
  if(registry) return registry;
  const configuration=keys;
  const names = { gemini:'Google Gemini',openrouter:'OpenRouter',groq:'Groq',cerebras:'Cerebras',...Object.fromEntries(Object.entries(EXTRA_PROVIDERS).map(([k,v])=>[k,v.label])) };
  registry=createModelRegistry({providers:AI_PROVIDERS,enabled:p=>providerEnabled(p,configuration),
    ttl:p=>COMPAT[p]?.models?24*3600_000:10*60_000,
    load:async(p,signal)=>{
      try {
        const models=await (p==='gemini'?geminiCatalog(configuration,signal):p==='openrouter'?openRouterCatalog(configuration,signal):compatCatalog(p,configuration,signal));
        return models.map(m=>({...m,metadata:{...m.metadata,refreshedAt:Date.now()}}));
      } catch(e) {
        let message=String(e?.message || e || 'Model discovery failed');
        for(const id of AI_PROVIDERS) if(configuration[id]) message=message.split(configuration[id]).join('[redacted]');
        if(e?.name==='TimeoutError' || e?.name==='AbortError') message=`${names[p]} didn't respond in time`;
        else if(!message.toLowerCase().startsWith(names[p].split(' ')[0].toLowerCase())) message=`${names[p]}: ${message}`;
        throw Object.assign(new Error(message),{name:e?.name || 'Error',status:e?.status,retryAfterMs:e?.retryAfterMs});
      }
    },
  });
  return registry;
}

/** Only seed from a cache already validated against the current account and credential scope. */
export function restoreCatalog(value) {
  const safe={...value,models:(value.models || []).filter(m=>parseModelId(m.id)&&hasKey(m.id.split(':')[0])&&!isExcludedModel(m.id))};
  currentRegistry().seed(safe);
  capabilities=new Map(currentRegistry().snapshot().models.map(m=>[m.id,m]));
}

export async function catalog({ refresh = false } = {}) {
  const version = keyGeneration;
  const result=await currentRegistry().read({refresh});
  if (version !== keyGeneration) throw new Error('Provider settings changed. Refresh models again.');
  const list=p=>result.models.filter(m=>m.id.startsWith(`${p}:`));
  const value = {
    ...result,
    providers: Object.fromEntries(AI_PROVIDERS.map(p => [p === 'gemini' ? 'google' : p, hasKey(p)])),
    defaults: [...pickDefaults(list('gemini'),list('openrouter'),list('groq'),list('cerebras')),...AI_PROVIDERS.slice(4).flatMap(p=>providerDefaults(list(p)))],
  };
  capabilities = new Map(value.models.map(m => [m.id, m]));
  return value;
}

// ---------------------------------------------------------------- Message conversion
// Messages arrive as { role, text, files: [{ kind: 'image' | 'pdf' | 'text', name, mime, data?, text? }] }.

const fileBlock = (f) => `<file name="${f.name}">\n${f.text}\n</file>`;

function toGemini(messages) {
  return messages.map((m) => {
    const parts = [];
    for (const f of m.files || []) {
      if (f.videoUri) parts.push({ fileData: { mimeType: 'video/mp4', fileUri: safeVideoUri(f.videoUri) } });
      else if (f.kind === 'text') parts.push({ text: fileBlock(f) });
      else parts.push({ inline_data: { mime_type: f.mime, data: f.data } });
    }
    if (m.text) parts.push({ text: m.text });
    if (parts.length === 0) parts.push({ text: ' ' });
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
}

function toOpenRouter(messages) {
  return messages.map((m) => {
    if (m.role === 'assistant') return { role: 'assistant', content: m.text || ' ' };
    if (!m.files?.length) return { role: 'user', content: m.text || ' ' };
    const content = [];
    for (const f of m.files) {
      if (f.kind === 'text') content.push({ type: 'text', text: fileBlock(f) });
      else if (f.kind === 'image') content.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${f.data}` } });
      else content.push({ type: 'file', file: { filename: f.name, file_data: `data:application/pdf;base64,${f.data}` } });
    }
    content.push({ type: 'text', text: m.text || ' ' });
    return { role: 'user', content };
  });
}

// Gemma models reject system instructions, so they get them inside the first user message.
function withInstructionsInFirstUser(messages, instructions) {
  const i = messages.findIndex((m) => m.role === 'user');
  if (i < 0) return messages;
  const copy = [...messages];
  copy[i] = { ...copy[i], text: `${instructions}\n\n---\n\n${copy[i].text || ''}` };
  return copy;
}

// ---------------------------------------------------------------- Streaming

// Opens a streaming request. searchEnabled reports tools retained in the request
// or a provider's native search, so the chat can explain degraded search honestly.
// Resolves to { ok: true, events, searchEnabled? } or { ok: false, status, message }.
export async function openStream({ provider, name }, messages, { instructions, metadata, search, requireSearch, codeExecution, quickReply, signal }) {
  signal=providerSignal(signal);
  if (!parseModelId(`${provider}:${name}`) || !hasKey(provider)) return { ok: false, status: 403, message: 'This provider is not enabled. Review API keys settings.' };
  if (provider === 'gemini') return openGemini(name, messages, instructions, search, signal, codeExecution, requireSearch, quickReply);
  if (COMPAT[provider]) return openCompat(provider, name, messages, instructions, signal, metadata);
  return openOpenRouter(name, messages, instructions, signal);
}

// Groq / Cerebras: OpenAI-style messages. They can't take PDFs, and Cerebras takes no images, so
// those become a short note (routing normally sends such messages to a model that can read them).
function toCompat(messages, vision) {
  return messages.map((m) => {
    if (m.role === 'assistant') return { role: 'assistant', content: m.text || ' ' };
    const files = m.files || [];
    if (!files.length) return { role: 'user', content: m.text || ' ' };
    const content = [];
    for (const f of files) {
      if (f.kind === 'text' || f.text) content.push({ type: 'text', text: fileBlock({ ...f, text: f.text || '' }) });
      else if (f.kind === 'image' && vision) content.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${f.data}` } });
      else content.push({ type: 'text', text: `[Attached ${f.kind === 'image' ? 'image' : 'PDF'} "${f.name}" — this model can't read it]` });
    }
    content.push({ type: 'text', text: m.text || ' ' });
    // Text-only models take plain strings.
    return { role: 'user', content: content.every((c) => c.type === 'text') ? content.map((c) => c.text).join('\n\n') : content };
  });
}

async function openCompat(provider, name, messages, instructions, signal, metadata) {
  const model = capabilities.get(`${provider}:${name}`) || metadata;
  const vision = model?.vision ?? modelVision(provider, name);
  const res = await compatFetch(provider, '/chat/completions', {
    method: 'POST',
    signal,
    body: JSON.stringify({ model: name, stream: true, messages: [{ role: 'system', content: instructions }, ...toCompat(messages, vision)], ...(provider === 'cloudflare' ? { options: { rejectIfBusy: true } } : {}), ...(provider === 'anthropic' ? { max_tokens: /claude-3-(?!7)/.test(name) ? 4096 : 16000 } : {}) }),
  });
  if (!res.ok) return { ok: false, status: res.status, ...(await readError(res)) };
  return { ok: true, searchEnabled: provider === 'perplexity', events: compatEvents(res.body) };
}

/** Splits streamed text into thinking and answer when a model writes <think>…</think> inline. */
function thinkSplitter() {
  let inThink = false;
  let buf = '';
  return (chunk, flush = false) => {
    buf += chunk;
    const out = [];
    for (;;) {
      const tag = inThink ? '</think>' : '<think>';
      const i = buf.indexOf(tag);
      if (i >= 0) {
        if (i) out.push({ t: inThink ? 'think' : 'text', text: buf.slice(0, i) });
        buf = buf.slice(i + tag.length);
        inThink = !inThink;
        if (!inThink) buf = buf.replace(/^\s+/, '');
        continue;
      }
      // Hold back what could be the start of a tag split across chunks.
      let keep = 0;
      if (!flush) for (let k = Math.min(tag.length - 1, buf.length); k > 0; k--) if (tag.startsWith(buf.slice(-k))) { keep = k; break; }
      const emit = buf.slice(0, buf.length - keep);
      if (emit) out.push({ t: inThink ? 'think' : 'text', text: emit });
      buf = buf.slice(buf.length - keep);
      return out;
    }
  };
}

async function* compatEvents(body) {
  const split = thinkSplitter();
  for await (const d of readSSE(body)) {
    if (d.error) {
      const text = d.error.message || 'The provider returned an error.';
      const code = Number(d.error.code) || (/rate|limit|quota/i.test(text) ? 429 : 500);
      yield { t: 'error', text, status: code, limit: code === 429 ? parseLimit(d.error, text) : null };
      return;
    }
    const usage = d.usage || d.x_groq?.usage;
    if (usage) yield { t: 'usage', input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 };
    const choice = d.choices?.[0];
    const delta = choice?.delta || {};
    if (delta.reasoning) yield { t: 'think', text: delta.reasoning };
    if (delta.reasoning_content) yield { t: 'think', text: delta.reasoning_content };
    if (delta.content) yield* split(delta.content);
    if (choice?.finish_reason === 'length') yield { t: 'notice', text: 'The reply hit the length limit. Say "continue" for the rest.' };
  }
  yield* split('', true);
}

async function openGemini(name, messages, instructions, search, signal, codeExecution = false, requireSearch = false, quickReply = false) {
  const credential=keys.gemini;
  const gemma = isGemma(name);
  if(requireSearch && (!search || gemma || !geminiThinks(name)))return {ok:false,status:400,message:'This model cannot search the web for this task.'};
  const body = gemma
    ? { contents: toGemini(withInstructionsInFirstUser(messages, instructions)) }
    : { systemInstruction: { parts: [{ text: instructions }] }, contents: toGemini(messages) };
  const extras = {};
  if (geminiThinks(name)) extras.generationConfig = { thinkingConfig: { includeThoughts: true } };
  // Only explicit 2.5 Flash IDs support a zero thinking budget. Keep defaults for
  // Pro, newer versions and moving aliases instead of sending unsupported options.
  if (quickReply && /^gemini-2\.5-flash(?:-|$)/i.test(name) && !search && !codeExecution) {
    extras.generationConfig = { thinkingConfig: { thinkingBudget: 0 } };
  }
  if (search && !gemma && geminiThinks(name)) extras.tools = [{ google_search: {} }];
  if (codeExecution) extras.tools = [...(extras.tools || []), { codeExecution: {} }];

  const send = (payload) =>
    providerFetch(`${GEMINI_BASE}/models/${encodeURIComponent(name)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': credential },
      body: JSON.stringify(payload),
    });

  let res = await send({ ...body, ...extras });
  // Retry unsupported thinking options once, retaining requested search tools.
  // Strict tool requests still fail rather than silently changing their options.
  if (res.status === 400 && extras.generationConfig && !codeExecution && !requireSearch) {
    await res.body?.cancel();
    const { generationConfig: _thinking, ...retained } = extras;
    res = await send({ ...body, ...retained });
  }
  if (!res.ok) return { ok: false, status: res.status, ...(await readError(res)) };
  return { ok: true, searchEnabled: Boolean(search && !gemma && geminiThinks(name)), events: geminiEvents(res.body) };
}

async function* geminiEvents(body) {
  const seen = new Set();
  let usage = null;
  for await (const d of readSSE(body)) {
    if (d.error) {
      const text = d.error.message || 'Google returned an error.';
      const code = Number(d.error.code) || 500;
      yield { t: 'error', text, status: code, limit: code === 429 ? parseLimit(d.error, text) : null };
      return;
    }
    if (d.usageMetadata) usage = d.usageMetadata;
    if (d.promptFeedback?.blockReason) yield { t: 'notice', text: `Google blocked this request (${d.promptFeedback.blockReason}).` };
    const cand = d.candidates?.[0];
    for (const p of cand?.content?.parts || []) {
      if (p.executableCode?.code) yield { t: 'text', text: '\n\n**Gemini executed Python**' + toolBlock('python', p.executableCode.code) };
      if (p.codeExecutionResult) yield { t: 'text', text: `\n\n**Execution result · ${p.codeExecutionResult.outcome || 'unknown'}**` + toolBlock('text', p.codeExecutionResult.output || '(No output)') };
      if (!p.text) continue;
      yield p.thought ? { t: 'think', text: p.text } : { t: 'text', text: p.text };
    }
    const chunks = cand?.groundingMetadata?.groundingChunks || [];
    const sources = chunks.map((c) => c.web).filter((w) => w?.uri && !seen.has(w.uri));
    if (sources.length) {
      sources.forEach((w) => seen.add(w.uri));
      yield { t: 'sources', items: sources.map((w) => ({ title: w.title || w.uri, url: w.uri })) };
    }
    const reason = cand?.finishReason;
    if (reason === 'MAX_TOKENS') yield { t: 'notice', text: 'The reply hit the length limit. Say "continue" for the rest.' };
    else if (reason && reason !== 'STOP') yield { t: 'notice', text: `Google stopped the reply (${reason}).` };
    // Google's final packet includes a finish reason and usage; don't wait on a lingering socket.
    if (reason && d.usageMetadata) break;
  }
  if (usage) yield { t: 'usage', input: usage.promptTokenCount || 0, output: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0) };
}

async function openOpenRouter(name, messages, instructions, signal) {
  const credential=keys.openrouter;
  const gemma = isGemma(name);
  const chat = gemma
    ? toOpenRouter(withInstructionsInFirstUser(messages, instructions))
    : [{ role: 'system', content: instructions }, ...toOpenRouter(messages)];
  const body = { model: name, stream: true, messages: chat, usage: { include: true } };
  // Free text extraction so PDFs never cost credits.
  if (messages.some((m) => (m.files || []).some((f) => f.kind === 'pdf'))) {
    body.plugins = [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }];
  }
  const res = await providerFetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${credential}`,
      'x-title': 'Lumen',
      'http-referer': location.origin,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, status: res.status, ...(await readError(res)) };
  return { ok: true, events: openRouterEvents(res.body) };
}

async function* openRouterEvents(body) {
  for await (const d of readSSE(body)) {
    if (d.error) {
      const text = d.error.message || 'OpenRouter returned an error.';
      const code = Number(d.error.code) || 500;
      yield { t: 'error', text, status: code, limit: code === 429 ? parseLimit(d.error, text) : null };
      return;
    }
    if (d.usage) yield { t: 'usage', input: d.usage.prompt_tokens || 0, output: d.usage.completion_tokens || 0 };
    const choice = d.choices?.[0];
    const delta = choice?.delta || {};
    if (delta.reasoning) yield { t: 'think', text: delta.reasoning };
    if (delta.content) yield { t: 'text', text: delta.content };
    if (choice?.finish_reason === 'length') yield { t: 'notice', text: 'The reply hit the length limit. Say "continue" for the rest.' };
  }
}

/** OpenRouter's daily allowance for free models: 50 requests, or 1000 once you've bought credits. */
export async function openRouterDailyLimit() {
  if (!keys.openrouter) return null;
  const signal=providerSignal(AbortSignal.timeout(15_000));
  try {
    const res = await providerFetch(`${OPENROUTER_BASE}/key`, { signal,headers: { authorization: `Bearer ${keys.openrouter}` } });
    if (!res.ok) return null;
    const { data } = await waitFor(res.json(),signal);
    return data?.is_free_tier === false ? 1000 : 50;
  } catch {
    return null;
  }
}

// One-shot, non-streaming completion (chat titles, summaries of long chats).
// Returns the text, or null on failure; `info` (if given) receives { status, input, output, limit }.
/**
 * Gemini text embeddings (free tier), for searching your chats by meaning. Returns one vector per text, or
 * throws with `status` set (429 = slow down).
 * @param {string[]} texts
 * @param {'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'} taskType
 * @param {AbortSignal} [signal]
 * @returns {Promise<number[][]>}
 */
export async function embed(texts, taskType, signal) {
  signal=providerSignal(signal || AbortSignal.timeout(30_000));
  if (!keys.gemini) throw Object.assign(new Error('Searching by meaning needs a Gemini key.'), { status: 403 });
  const model = 'models/gemini-embedding-001';
  const res = await providerFetch(`${GEMINI_BASE}/${model}:batchEmbedContents`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': keys.gemini },
    body: JSON.stringify({ requests: texts.map((text) => ({ model, content: { parts: [{ text }] }, taskType, outputDimensionality: 256 })) }),
  });
  if (!res.ok) throw Object.assign(new Error((await waitFor(readError(res),signal)).message || `Embedding failed (${res.status})`), { status: res.status });
  const d = await waitFor(res.json(),signal);
  return (d.embeddings || []).map((e) => e.values || []);
}

export async function complete({ provider, name }, prompt, { maxTokens = 256, signal, info } = {}) {
  const configuration=keys;
  signal=providerSignal(signal || AbortSignal.timeout(30_000));
  if (!parseModelId(`${provider}:${name}`) || !hasKey(provider)) {
    if (info) Object.assign(info, { status: 403, message: 'This provider is not enabled.' });
    return null;
  }
  if (provider === 'gemini') {
    const res = await providerFetch(`${GEMINI_BASE}/models/${encodeURIComponent(name)}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': configuration.gemini },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens } }),
    });
    if (!res.ok) {
      if (info) Object.assign(info, { status: res.status, ...(await waitFor(readError(res),signal)) });
      return null;
    }
    const d = await waitFor(res.json(),signal);
    if (info) info.status = 200;
    if (info && d.usageMetadata) Object.assign(info, { input: d.usageMetadata.promptTokenCount || 0, output: (d.usageMetadata.candidatesTokenCount || 0) + (d.usageMetadata.thoughtsTokenCount || 0) });
    return (d.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text).join('');
  }
  const compat = COMPAT[provider];
  const send = compat ? options => compatFetch(provider, '/chat/completions', options,false,configuration) : options => providerFetch(`${OPENROUTER_BASE}/chat/completions`, options);
  const res = await send({
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${compat ? configuration[provider] : configuration.openrouter}` },
    body: JSON.stringify({ model: name, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    if (info) Object.assign(info, { status: res.status, ...(await waitFor(readError(res),signal)) });
    return null;
  }
  const d = await waitFor(res.json(),signal);
  if (info) info.status = 200;
  if (info && d.usage) Object.assign(info, { input: d.usage.prompt_tokens || 0, output: d.usage.completion_tokens || 0 });
  // Some models write their thinking inline; only the answer is wanted here.
  return (d.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim() || null;
}

/**
 * One tiny, context-free request ("Reply with OK") to a model. Reports what happened; the model check
 * (lib/ai/model-check.ts) decides what it means. Returns { status, message, text, ms, limit, input, output };
 * status 0 means no answer (network error or timeout).
 */
export async function probeModel(id, signal, { maxTokens = 48, timeoutMs = 25_000 } = {}) {
  const target = parseModelId(id);
  if (!target || !hasKey(target.provider) || isExcludedModel(id)) return { status: -1, message: 'Not connected', text: '', ms: 0 };
  const attempt = new AbortController();
  const abort = () => attempt.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; attempt.abort(); }, timeoutMs);
  const info = {};
  const started = Date.now();
  try {
    const text = await complete(target, 'Reply with the single word OK.', { maxTokens, signal: attempt.signal, info });
    return { ...info, status: info.status ?? 0, text: text || '', ms: Date.now() - started };
  } catch (e) {
    return { status: 0, message: timedOut ? 'No answer within 25 seconds' : signal.aborted ? 'Stopped' : (e && e.message) || 'Network error', text: '', ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    attempt.abort();
  }
}

// ---------------------------------------------------------------- Key safety

/**
 * Is the Gemini key locked to this website? A request sent without the site's address must be
 * refused, while the app's normal requests still work.
 * Returns { state: 'locked' | 'open' | 'wrong-site' | 'invalid' | 'error', message? }.
 */
export async function geminiKeyLock() {
  if (!keys.gemini) return null;
  const key=keys.gemini, signal=providerSignal(AbortSignal.timeout(20_000));
  const probe = (referrerPolicy) =>
    providerFetch(`${GEMINI_BASE}/models?pageSize=1`, { signal, headers: { 'x-goog-api-key': key }, referrerPolicy, cache: 'no-store' });
  try {
    const [bare, normal] = await Promise.all([probe('no-referrer'), probe('strict-origin-when-cross-origin')]);
    const bareErr = bare.ok ? null : await waitFor(readError(bare),signal);
    const normalErr = normal.ok ? null : await waitFor(readError(normal),signal);
    if (normal.ok && bare.ok) return { state: 'open' };
    if (normal.ok && /refer/i.test(bareErr?.message || '')) return { state: 'locked' };
    if (/refer/i.test(normalErr?.message || '')) return { state: 'wrong-site', message: normalErr.message };
    if (normal.status === 400 || normal.status === 401) return { state: 'invalid', message: normalErr?.message };
    return { state: 'error', message: (normalErr || bareErr)?.message };
  } catch {
    if(signal.aborted)return null;
    return { state: 'error', message: "Couldn't reach Google." };
  }
}

/** OpenRouter key details: spending limit (0 = free models only), credits used, free tier. */
export async function openRouterKeyInfo() {
  if (!keys.openrouter) return null;
  const key=keys.openrouter,signal=providerSignal(AbortSignal.timeout(20_000));
  try {
    const res = await providerFetch(`${OPENROUTER_BASE}/key`, { signal, headers: { authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (!res.ok) return { state: 'error', message: (await waitFor(readError(res),signal)).message };
    const { data = {} } = await waitFor(res.json(),signal);
    const limit = data.limit === undefined ? null : data.limit;
    if (limit === 0) return { state: 'capped' };
    if (limit === null) return { state: data.is_free_tier ? 'free' : 'open' };
    return { state: 'limit', limit, used: data.usage ?? 0 };
  } catch {
    if(signal.aborted)return null;
    return { state: 'error', message: "Couldn't reach OpenRouter." };
  }
}
