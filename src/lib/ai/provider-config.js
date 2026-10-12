// Official endpoints checked 2026-10-12. Never accept an arbitrary upstream host.
export const EXTRA_PROVIDERS = {
  mistral: { label: 'Mistral', base: 'https://api.mistral.ai/v1', link: 'https://console.mistral.ai/api-keys', hint: 'Mistral chat and coding models. Access and billing depend on your plan.' },
  cohere: { label: 'Cohere', base: 'https://api.cohere.ai/compatibility/v1', link: 'https://dashboard.cohere.com/api-keys', hint: 'Command models. Evaluation keys have limited, non-production access.' },
  nvidia: { label: 'NVIDIA NIM', base: 'https://integrate.api.nvidia.com/v1', relay: true, link: 'https://build.nvidia.com', hint: 'Hosted NIM models. Requires your relay because NVIDIA blocks browser requests.' },
  huggingface: { label: 'Hugging Face', base: 'https://router.huggingface.co/v1', link: 'https://huggingface.co/settings/tokens', hint: 'Inference Providers gateway. Use a token with inference permission; credits are limited.' },
  deepseek: { label: 'DeepSeek', base: 'https://api.deepseek.com', link: 'https://platform.deepseek.com/api_keys', hint: 'DeepSeek chat and reasoning models. Calls use your account balance.' },
  alibaba: { label: 'Alibaba Cloud', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', link: 'https://modelstudio.console.alibabacloud.com', hint: 'Qwen through Model Studio. Match the endpoint to your key’s region/workspace.' },
  cloudflare: { label: 'Cloudflare Workers AI', relay: true, link: 'https://dash.cloudflare.com/profile/api-tokens', hint: 'Use an account-scoped Workers AI token, your account ID and your relay.' },
  aion: { label: 'Aion Labs', base: 'https://api.aionlabs.ai/v1', link: 'https://www.aionlabs.ai', hint: 'Aion chat and reasoning models. Check your dashboard for credits and billing.' },
};
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
