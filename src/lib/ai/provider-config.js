// Official endpoints checked 2026-10-12. Never accept an arbitrary upstream host.
export const DEFAULT_PROVIDER_RELAY_URL = 'https://model-router-provider-relay.model-router.workers.dev';
export const EXTRA_PROVIDERS = {
  mistral: { label: 'Mistral', base: 'https://api.mistral.ai/v1', link: 'https://console.mistral.ai/api-keys', hint: 'Mistral chat and coding models. Access and billing depend on your plan.' },
  cohere: { label: 'Cohere', base: 'https://api.cohere.ai/compatibility/v1', link: 'https://dashboard.cohere.com/api-keys', hint: 'Command models. Evaluation keys have limited, non-production access.' },
  nvidia: { label: 'NVIDIA NIM', base: 'https://integrate.api.nvidia.com/v1', relay: true, link: 'https://build.nvidia.com', hint: 'Hosted NIM models. Uses this app’s relay to connect from your browser.' },
  huggingface: { label: 'Hugging Face', base: 'https://router.huggingface.co/v1', link: 'https://huggingface.co/settings/tokens', hint: 'Inference Providers gateway. Use a token with inference permission; credits are limited.' },
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com', link: 'https://platform.deepseek.com/api_keys', hint: 'DeepSeek chat and reasoning models. Calls use your account balance.' },
  alibaba: { label: 'Alibaba Cloud', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', link: 'https://modelstudio.console.alibabacloud.com', hint: 'Qwen through Model Studio. Match the endpoint to your key’s region/workspace.' },
  cloudflare: { label: 'Cloudflare Workers AI', relay: true, link: 'https://dash.cloudflare.com/profile/api-tokens', hint: 'Use an account-scoped Workers AI token and its account ID. Connects through this app’s relay.' },
  aion: { label: 'Aion Labs', base: 'https://api.aionlabs.ai/v1', link: 'https://www.aionlabs.ai', hint: 'Aion chat and reasoning models. Check your dashboard for credits and billing.' },
  // 2.6: every other provider with an OpenAI-style API and its own keys. Each connects straight from the
  // browser; one that turns browser requests away is reached through the relay instead (`fallback`).
  // `free`: has a free tier or free models (shown in Settings → API keys → Free).
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', link: 'https://platform.openai.com/api-keys', hint: 'GPT and o-series models. Paid per use; set a monthly limit in your OpenAI billing settings.' },
  anthropic: { label: 'Anthropic (Claude)', base: 'https://api.anthropic.com/v1', link: 'https://console.anthropic.com/settings/keys', hint: 'Claude models. Paid per use; set a spend limit in the Claude Console.' },
  xai: { label: 'xAI (Grok)', base: 'https://api.x.ai/v1', fallback: true, link: 'https://console.x.ai', hint: 'Grok models. Paid per use; check your credits in the xAI console.' },
  perplexity: { label: 'Perplexity', base: 'https://api.perplexity.ai', fallback: true, link: 'https://www.perplexity.ai/account/api/keys', hint: 'Sonar models that search the web for every answer. Paid per use.',
    models: [['sonar', 'Sonar'], ['sonar-pro', 'Sonar Pro'], ['sonar-reasoning-pro', 'Sonar Reasoning Pro']] },
  together: { label: 'Together AI', base: 'https://api.together.xyz/v1', fallback: true, link: 'https://api.together.xyz/settings/api-keys', hint: 'Open models (Llama, Qwen, DeepSeek and more). Uses your account credits.' },
  fireworks: { label: 'Fireworks AI', base: 'https://api.fireworks.ai/inference/v1', fallback: true, link: 'https://fireworks.ai/account/api-keys', hint: 'Fast open models. Uses your account credits.' },
  deepinfra: { label: 'DeepInfra', base: 'https://api.deepinfra.com/v1/openai', fallback: true, link: 'https://deepinfra.com/dash/api_keys', hint: 'Open models at low prices. Uses your account balance.' },
  sambanova: { label: 'SambaNova', base: 'https://api.sambanova.ai/v1', fallback: true, free: true, link: 'https://cloud.sambanova.ai/apis', hint: 'Very fast Llama, DeepSeek and Qwen models. Free tier with rate limits.' },
  novita: { label: 'Novita AI', base: 'https://api.novita.ai/v3/openai', fallback: true, link: 'https://novita.ai/settings/key-management', hint: 'Open models. Uses your account credits.' },
  hyperbolic: { label: 'Hyperbolic', base: 'https://api.hyperbolic.xyz/v1', fallback: true, link: 'https://app.hyperbolic.xyz/settings', hint: 'Open models. Uses your account credits.' },
  nebius: { label: 'Nebius AI Studio', base: 'https://api.studio.nebius.com/v1', fallback: true, link: 'https://studio.nebius.com/settings/api-keys', hint: 'Open models. Uses your account credits.' },
  scaleway: { label: 'Scaleway', base: 'https://api.scaleway.ai/v1', fallback: true, free: true, link: 'https://console.scaleway.com/iam/api-keys', hint: 'European-hosted open models. Includes a free allowance of tokens.' },
  ovh: { label: 'OVHcloud AI Endpoints', base: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', fallback: true, free: true, link: 'https://endpoints.ai.cloud.ovh.net', hint: 'European-hosted open models. Free with rate limits during the beta.' },
  siliconflow: { label: 'SiliconFlow', base: 'https://api.siliconflow.com/v1', fallback: true, free: true, link: 'https://cloud.siliconflow.com/account/ak', hint: 'Qwen, DeepSeek, GLM and more; some models are free.' },
  chutes: { label: 'Chutes', base: 'https://llm.chutes.ai/v1', fallback: true, link: 'https://chutes.ai/app/api', hint: 'Open models on a decentralized network. Uses your account balance.' },
  featherless: { label: 'Featherless', base: 'https://api.featherless.ai/v1', fallback: true, link: 'https://featherless.ai/account/api-keys', hint: 'Thousands of open models on Hugging Face. Subscription based.' },
  zai: { label: 'Z.ai (GLM)', base: 'https://api.z.ai/api/paas/v4', fallback: true, free: true, link: 'https://z.ai/manage-apikey/apikey-list', hint: 'GLM models; the Flash models are free.' },
  moonshot: { label: 'Moonshot (Kimi)', base: 'https://api.moonshot.ai/v1', fallback: true, link: 'https://platform.moonshot.ai/console/api-keys', hint: 'Kimi models with long context. Uses your account balance.' },
  venice: { label: 'Venice AI', base: 'https://api.venice.ai/api/v1', fallback: true, link: 'https://venice.ai/settings/api', hint: 'Private, uncensored open models. Uses your account credits.' },
  baseten: { label: 'Baseten', base: 'https://inference.baseten.co/v1', fallback: true, link: 'https://app.baseten.co/settings/api_keys', hint: 'Open models through Baseten Model APIs. Uses your account credits.' },
};
/** Providers the relay forwards to (relay-only ones, and those it stands in for when a browser request is refused). */
export const RELAY_BASES = Object.fromEntries(Object.entries(EXTRA_PROVIDERS).filter(([, v]) => v.fallback && v.base).map(([k, v]) => [k, v.base]));
export const AI_PROVIDERS = ['gemini', 'openrouter', 'groq', 'cerebras', ...Object.keys(EXTRA_PROVIDERS)];
export const ALL_KEY_IDS = [...AI_PROVIDERS, 'github'];

export function validAlibabaBase(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash &&
      u.port === '' && u.pathname.replace(/\/$/, '') === '/compatible-mode/v1' &&
      (/^dashscope(?:-intl|-us)?\.aliyuncs\.com$/.test(u.hostname) || /^[a-z0-9-]+\.(?:ap-southeast-1|us-east-1|cn-beijing|cn-hongkong|ap-northeast-1)\.maas\.aliyuncs\.com$/.test(u.hostname));
  } catch { return false; }
}
export function validRelayUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash;
  } catch { return false; }
}
export function normalizeKeys(input = {}) {
  return {
    ...Object.fromEntries(ALL_KEY_IDS.map(id => [id, typeof input[id] === 'string' ? input[id].trim() : ''])),
    providerAccess: Object.fromEntries(Object.keys(EXTRA_PROVIDERS).map(id => [id, input.providerAccess?.[id] === true])),
    cloudflareAccountId: typeof input.cloudflareAccountId === 'string' ? input.cloudflareAccountId.trim() : '',
    alibabaBaseUrl: typeof input.alibabaBaseUrl === 'string' ? input.alibabaBaseUrl.trim().replace(/\/$/, '') : '',
    providerRelayUrl: typeof input.providerRelayUrl === 'string' ? input.providerRelayUrl.trim().replace(/\/$/, '') : '',
  };
}

export function providerEnabled(provider, config) {
  return Boolean(config[provider] && (!EXTRA_PROVIDERS[provider] || config.providerAccess?.[provider] === true));
}
