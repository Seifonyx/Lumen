# Native real AI: implemented, not activated

The isolated app now routes eligible OpenRouter requests through the existing canonical provider catalogue,
`openStream`, SSE parsing, usage/error classification and key-generation cancellation. Native-only transport adds
account/lifecycle leases and an owner-approval/cost boundary. No production app code, Firebase configuration,
schema or delivered connected IPA changed. No real provider request, key or account used in this milestone.

## Verified documented $0 path

OpenRouter explicitly documents `:free` model variants requiring no credit purchase. The native boundary accepts
only those exact variants, and catalogue rows only when every supplied price is explicitly zero. Every chat adds
`provider.max_price` prompt/completion/request/image ceilings of0, disables provider fallback and denies data
collection. Paid/unknown models, plugins (including PDF parsing), online variants, alternate URLs, tools and
image/file requests are refused before IO. Text-file content already converted locally to plain text remains usable.
Canonical routing may choose another eligible free model; it can never send a paid fallback through this boundary.

Sources: [free variants](https://openrouter.ai/collections/free-models),
[price ceilings](https://openrouter.ai/docs/guides/routing/provider-selection#max-price),
[streaming](https://openrouter.ai/docs/api-reference/streaming),
[rate limits](https://openrouter.ai/docs/api-reference/limits),
[BYOK behavior](https://openrouter.ai/docs/guides/overview/auth/byok).

These verify the provider's documented free-only contract, not a live account's access or availability. Free capacity,
quota and a zero-price endpoint accepting the no-data-collection preference are not yet verified. A failure stops;
never top up, enable billing, use BYOK or substitute a paid endpoint to make it work.

## Approval and credential boundary

Current approval is absent. Saving a key, opening Router or sending a message cannot activate provider networking.
JS transport refuses before IO; the OpenRouter host is absent from default CSP and native WebKit rules.

A future explicit owner approval may provide a private `LUMEN_NATIVE_AI_APPROVAL` build input (or encrypted-input
workflow's protected `LUMEN_IOS_AI_APPROVAL` secret). It must specify approved=true, provider=openrouter,
projectId=lumen-ios-test, policy=free-variants-only, the approved test UID, noByok=true and the exact dedicated key's
SHA256 fingerprint. No such file or secret was created here. Approval contains no raw provider credential.

Before activation, a dedicated unfunded/free OpenRouter account without upstream BYOK keys and a dedicated test
API key are required. That key must be bound to the approved test Firebase account through its existing private
account-key mechanism; native UI key saving remains disabled. No raw key belongs in source, IPA or this document.
Runtime reuses existing in-memory canonical account keys and refuses a key whose hash differs. Never reuse the
Firebase SDK key, Google administrative credentials or production provider keys. No new key storage/schema added.

After separate approval only: verify key/account metadata and actual eligible catalogue first; then a single bounded
synthetic streamed request can establish real inference. No actual model response is claimed from mocked SSE.
Provider approval is not granted by this implementation and must not be inferred from the earlier Google consent.

## Focused evidence

14 focused automated checks cover canonical SSE text/partial errors,401/429/503, redaction, zero-cost and account
boundaries, Stop/background/account changes, stalled IO and late bodies, and approval-controlled native plist state.
Native typecheck and connected web-assets build pass. Build without approval has no OpenRouter CSP destination;
delivered Firebase IPA SHA256 remains cefef3dab6887f12ae8e01d3467a7de20944e596583bce37e97706c3187b1440.

Physical native callback/Keychain/provider networking remain unverified. No manual iPhone QA or replacement IPA
requested for this dormant milestone. Keep PR141 draft/unmerged and production untouched; $0 incremental spending.
