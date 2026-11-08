> Existing-account release update2026-11-08: the same guarded free-only OpenRouter path is available in the
> owner-approved account-connected package. Consent is project-scoped and does not transfer from test accounts.
> No paid provider activation, live agent inference or production account QA is implied. See ACCOUNT_RELEASE.md.

# Native release candidate: user-configured free AI

The iPhone app reuses canonical Router/catalogue/model selection, private per-account Firebase credentials,
streaming, Send/Stop and error handling. No separate inference service or built-in API key.

## Setup in the installed app

Sign into the authorized Firebase test account. In Router > Providers > OpenRouter, enter a dedicated free key,
set its OpenRouter credit limit to $0, confirm the no-BYOK/text-processing disclosure and choose Save and enable
free AI. This verifies metadata before saving the existing openrouterKey field to the account's private Firestore
document. No developer approval JSON, test UID file, fingerprint secret or replacement build is needed per key.
The key link opens only the official OpenRouter keys page in Safari; it does not sign in inside WKWebView.

No request occurs just by entering a key or checking consent. Save performs metadata/catalogue requests, not
inference. Explicit Send or an existing explicit model-check action starts inference. An actual provider credential
is still necessary; none is invented, embedded or supplied by this project. No live response is claimed from mocks.

## Boundaries retained

- Explicit :free model variants and wholly zero-known-price catalogue entries only. Request caps enforce prompt,
  completion, request and image max_price0. No paid fallback, paid plugins, online variants, image/PDF inference.
  Text-file content locally converted to plain text remains usable. Native model capabilities reflect this restriction.
- Require a free account, key limit0 and zero BYOK usage, rechecked before every chat. User confirms that no BYOK
  provider keys are linked. Unknown/missing metadata fails closed; no top-up or billing activation.
- Reject alternate origins/paths, redirects and credential-bearing URLs; raw API key bound by SHA256 to current
  account consent. Only metadata/catalogue/chat endpoints pass the native fetch guard. Other network facilities
  stay denied. Native WebKit/CSP allow the host as a capability, not as an authorization bypass.
- Raw keys remain in RAM and the existing private per-account Firestore field, never localStorage, bundles or logs.
  Consent/fingerprint is device-local and account-scoped. Logout/account switching clears active permission.
  Disable or uncheck consent stops AI immediately while retaining the private account key for other devices.
- Provider cancellation has its own controller, preserving cloud sync. Stop, backgrounding, account changes and
  key/permission changes abort requests and discard late output. Canonical errors preserve partial text and redact keys.
- Native lifecycle enables Firestore only after a real pause. Redundant initial enableNetwork caused a reproduced
  SDK ca9 assertion during connected setup; removing that transition allows the full save/chat flow to pass.

## Evidence and limits

Focused Node checks cover cost/consent/account/key boundaries and cancellation. Actual connected React/Canvas
browser contracts run Chromium/WebKit against local Auth/Firestore emulators and mocked OpenRouter: masked key
entry, explicit consent, private account save, no key on disk, model listing, Use-to-Chat, mocked streamed reply,
Stop, draft preservation and local disable retaining the cloud key. They do not verify native Google sign-in or
real provider capacity. The private fixture bypasses only native Google UI for emulator login; it never enters the IPA.

No real provider request or credential was used in this RC work. Model capacity and a free endpoint satisfying
no-data-collection may be unavailable; report that error and stop, never relax prices or fund an account.
Physical Google callback/Keychain, signing, keyboard and VoiceOver remain unverified, with no prelaunch checklist.

Sources: [free variants](https://openrouter.ai/collections/free-models),
[price ceilings](https://openrouter.ai/docs/guides/routing/provider-selection#max-price),
[streaming](https://openrouter.ai/docs/api-reference/streaming),
[rate limits](https://openrouter.ai/docs/api-reference/limits),
[BYOK](https://openrouter.ai/docs/guides/overview/auth/byok).

Keep PR141 draft/unmerged; production untouched, no billing/paid services/public ports, $0 incremental spend.
Private IPA delivery reuses RSA-OAEP/AES-GCM artifacts and the local decryption key. Preserve the same installed
bundle and Apple account when overwriting via Sideloadly; do not uninstall or reset existing app data.
