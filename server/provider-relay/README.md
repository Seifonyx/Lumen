# NVIDIA / Cloudflare provider relay

The app runs on static Firebase Hosting. NVIDIA NIM and Cloudflare's account API do not permit direct browser requests (preflight checked 2026-10-12). This optional Cloudflare Worker forwards only their model catalogues and chat completions. All other integrations connect directly to official APIs.

## Deploy to your own Cloudflare account

The app's relay is deployed at `https://model-router-provider-relay.model-router.workers.dev`. Leave the custom relay URL blank to use it. You still supply your own NVIDIA/Cloudflare credentials and explicitly enable the provider; the relay has no stored provider keys. For a different relay, deploy the Worker below and enter its URL in settings.

From this directory, run `npx wrangler deploy`. Wrangler asks you to sign in to your Cloudflare account. Review the Workers plan and quotas first; a paid Workers account can incur usage charges. No provider keys or Firebase service credentials belong in Wrangler configuration.

Copy the resulting HTTPS Worker URL into **Settings → API keys → NVIDIA & Cloudflare relay → Custom relay URL** to override the app default. Add your provider key, and for Cloudflare, your 32-character account ID. Use a Cloudflare API token scoped to Workers AI on that account. Enable that provider's credit/charge checkbox and save keys. Models load from its live catalogue; model membership does not guarantee your account has inference access.

Keep `enable_request_signal` in Wrangler's compatibility flags: forwarding uses the incoming request's abort signal. Upstream requests use manual redirect handling and explicitly reject 3xx responses, preventing credentials from following another host. Verify actual Workers runtime forwarding after deployment; a Node mock or dry run alone cannot establish it.

## Data and security

The relay receives your provider key and prompt, forwards them to the named official upstream and streams the response. Use only a relay you control. It stores no secrets, prompts or responses; request observability is disabled. CORS allows only the live app, preview and localhost:5190. It rejects arbitrary hosts/routes, redirects, missing keys, malformed account IDs and bodies over 24 MiB. This is BYOK, not a server-held shared key: anyone calling it must supply their own key. CORS is a browser policy, not authentication; configure Cloudflare rate limits if exposing it widely.

Never replace this with a public CORS proxy or store user keys in logs. Configure account spending caps with NVIDIA/Cloudflare; the app cannot distinguish trial credits from paid credit balances. Turning the provider off stops new calls, including Auto/fallbacks, titles, comparisons and tasks. Existing provider billing remains your responsibility.

## Other providers

- Mistral: `https://api.mistral.ai/v1`; catalogue capabilities determine chat/vision support.
- Cohere: native `/v1/models?endpoint=chat` catalogue (paginated), `/compatibility/v1/chat/completions` for generation. Evaluation keys are limited and unsuitable for production.
- Hugging Face: `https://router.huggingface.co/v1`; use inference permission, live provider metadata and monthly credits/account caps.
- DeepSeek: `https://api.deepseek.com`; live model discovery, no hardcoded retired model list.
- Alibaba: paste your official regional/workspace `/compatible-mode/v1` base URL; key region must match. Only documented Alibaba hosts are accepted. Enable Free Quota Only in the provider console if desired.
- Aion: `https://api.aionlabs.ai/v1`; live model discovery and OpenAI-compatible streaming.
- GitHub Models: [retired July 30, 2026](https://docs.github.com/en/github-models); no working inference endpoint remains. GitHub repository coding remains separate.

All eight new connections are disabled by default because an API key alone does not prove zero-cost access. Explicit opt-in permits that provider to consume credits or incur charges. The original four providers retain the existing free-model policy.
