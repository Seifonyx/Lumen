// Reviewed against provider notices on 2026-10-11. Live model lists remain authoritative.
// https://ai.google.dev/gemini-api/docs/deprecations
// https://console.groq.com/docs/deprecations
const retired = {
  gemini: new Set([
    'gemini-3-pro-preview', 'gemini-3.1-flash-lite-preview',
    'gemini-2.5-pro-preview-03-25', 'gemini-2.5-pro-preview-05-06', 'gemini-2.5-pro-preview-06-05',
    'gemini-2.5-flash-preview-05-20', 'gemini-2.5-flash-preview-09-25', 'gemini-2.5-flash-lite-preview-09-2025',
  ]),
  groq: new Set([
    'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'qwen/qwen3.6-27b', 'qwen/qwen3-32b',
    'meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct',
    'moonshotai/kimi-k2-instruct', 'moonshotai/kimi-k2-instruct-0905', 'gemma2-9b-it',
    'llama3-70b-8192', 'llama3-8b-8192', 'mistral-saba-24b', 'qwen-qwq-32b',
    'llama-3.2-1b-preview', 'llama-3.2-3b-preview', 'llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview',
    'qwen-2.5-32b', 'qwen-2.5-coder-32b', 'llama-3.3-70b-specdec',
    'mixtral-8x7b-32768', 'llama-3.1-70b-versatile', 'llama-3.1-70b-specdec',
    'llama3-groq-8b-8192-tool-use-preview', 'llama3-groq-70b-8192-tool-use-preview',
  ]),
  // These former shared models are absent from Cerebras' current shared/free catalogue.
  // https://inference-docs.cerebras.ai/models/overview
  cerebras: new Set(['llama3.1-8b', 'llama-3.3-70b', 'llama-4-scout-17b-16e-instruct', 'qwen-3-32b', 'qwen-3-235b-a22b', 'qwen-3-235b-a22b-instruct-2507', 'zai-glm-4.6', 'zai-glm-4.7']),
};

export function isRetiredModel(id) {
  const separator = id.indexOf(':');
  const provider = id.slice(0, separator);
  const name = id.slice(separator + 1);
  return retired[provider]?.has(name) || (provider === 'gemini' && /^gemini-(?:1\.|2\.0)/.test(name));
}

// API catalogue membership does not imply free-tier access. Reviewed against Google pricing.
// https://ai.google.dev/gemini-api/docs/pricing
export function isExcludedModel(id) {
  return isRetiredModel(id) || /^gemini:(?:gemini-3\.1-pro-preview(?:-|$)|gemini-pro-latest$)/.test(id);
}

/** Only explicit model-level failures qualify, never key errors, overload or ordinary quota. */
export function isUnavailableFailure(status, message = '') {
  if (status === 404 && /model|no endpoints/i.test(message)) return true;
  if ([400, 403, 410].includes(status) && /model/i.test(message)
    && /decommissioned|retired|does not exist|not (?:found|available|accessible)|no longer (?:available|supported)|not supported for (?:your|this) (?:account|project|api key)|requires? (?:a )?paid/i.test(message)) return true;
  return status === 429 && /free.?tier/i.test(message) && /(?:limit|quota(?:value)?)\s*[:=]\s*0\b/i.test(message);
}

export function isActiveModel(model) {
  const expiry = model.expiration_date && Date.parse(`${model.expiration_date}T00:00:00Z`);
  return model.active !== false && model.disabled !== true && !['disabled', 'retired', 'deprecated', 'unavailable'].includes(model.status)
    && (!expiry || expiry > Date.now());
}

// An unavailable provider must not erase saved choices. A successful empty list must prune them.
export function keepModelChoice(id, catalog) {
  if (isExcludedModel(id)) return false;
  if (catalog.models.some((model) => model.id === id)) return true;
  const provider = id.split(':')[0];
  return Boolean(catalog.failedProviders?.includes(provider));
}
