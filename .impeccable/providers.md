# Provider connection extension

MODE: Operate. Extend Settings → API keys and existing model/usage surfaces; no visual redesign in Task 1.

DIRECTION: Preserve Geist typography, design.css tokens, light/dark/black appearances, settings navigation, safe-area layouts and nested focus handling. Additional providers use collapsed rows; expose only credentials, explicit billing consent and necessary endpoint/account fields. Inputs and new row/label actions are at least 44px high; inputs use 16px type to avoid iPhone focus zoom. No autofocus.

PRODUCT TRUTH: User explicitly permitted paid APIs only after enabling a provider. All eight additional providers default off; saved credentials alone never authorize discovery or inference. Existing providers keep the free-model catalogue policy. GitHub Models is retired and explained rather than offering a broken connection. NVIDIA/Cloudflare require a user-controlled BYOK relay; no public CORS proxy.

QUALITY: Desktop, 320/390/430px phones and 844px landscape; light/dark/black. Check provider setup, keyboard/labels, no horizontal overflow, billing/reload/account isolation, eight streamed answers and per-provider usage. Chromium plus WebKit engine; no claim of physical-iPhone verification.

FORM: Existing-surface extension with compact native details rows and inherited controls. Code-led; no new visual world or shipping raster assets. Pre-existing DESIGN.md/design.json absence remains outside this task.

FINISH: Ship for Task 1. Fresh independent review found no material findings. This is an ordinary extension of the established settings surface; Task 2 redesign is separate.

INCUMBENT EVIDENCE: PRODUCT.md, src/components/ProviderConnections.tsx, its SettingsModal API-key draft/save integration, src/styles.css provider rules and src/design.css confirm inherited Geist typography, semantic surface/text/border tokens and existing settings structure. Additional connections use native details rows, labelled password fields and a labelled consent checkbox. Summary rows have a 48px minimum; new inputs, consent labels and dashboard/setup links have a 44px minimum; inputs use 16px type without autofocus. Existing settings responsive and nested focus handling remain the governing patterns.

SHIP EVIDENCE: Reviewer inspected settled UI with Mistral expanded, other providers collapsed and toasts dismissed in tests/e2e/out/multi-provider-1280-light.png, multi-provider-320-light.png, multi-provider-390-dark.png, multi-provider-430-black.png and multi-provider-844-dark.png. Chromium and WebKit feature workflows passed at these five widths, covering eight mocked streamed replies, billing gates, reload/account isolation, accessibility and horizontal overflow. Actual public NVIDIA, Hugging Face and Aion catalogues and provider CORS requirements were checked. Screenshots are QA evidence; no shipping raster assets were generated.

LIMITATIONS: No physical iPhone or real paid-key inference was tested. NVIDIA and Cloudflare require a user-controlled relay; implementation, configuration and setup instructions are included, with deployment awaiting the user's decision. Context/detector tooling was unavailable because its engine/cache was missing. Pre-existing DESIGN.md and .impeccable/design.json absence remains outside this extension's scope.

REVIEW NOTES: Non-blocking observations are the browser-native blue consent checkbox and the summary's draft “Enabled” status before Save keys. The latter describes the current draft; saved opt-in remains the authorization boundary for catalogue and inference requests.
