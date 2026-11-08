# Provider relay

This optional Cloudflare Worker forwards model catalogues and chat completions for providers that reject direct
browser requests. The default deployment is `https://model-router-provider-relay.model-router.workers.dev`.
The app supplies the user's provider credentials with each request; the relay stores no keys, prompts or responses.
Allowed routes and upstreams are defined in `worker.mjs`; client routing is in `src/lib/ai/provider-config.js`.

Deploy from this directory with `npx wrangler deploy`, or run **Deploy provider relay** in GitHub Actions.
The workflow uses repository secrets `CLOUDFLARE_API_TOKEN` (Edit Cloudflare Workers) and `CLOUDFLARE_ACCOUNT_ID`.
For a separate deployment, enter its HTTPS URL in the app's custom relay setting.

The Worker supports streaming/cancellation, rejects redirects and arbitrary upstreams, limits request bodies
and restricts CORS. Its `enable_request_signal` compatibility flag supports cancellation. CORS is not authentication:
each caller supplies a provider key. Provider access and billing depend on that caller's account.

Cloudflare image generation uses `POST /cloudflare/image` with `{ "prompt": "..." }`, the caller's Cloudflare
account/key and FLUX.1 schnell. Prompt limit: 2048 characters; steps: 1-8 (default 4).
