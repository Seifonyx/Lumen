# Provider intelligence — focused proof checkpoint

**Historical slice note:** current provider UX, filters/defaults/subscriptions and visual evidence are superseded by [PROVIDER_UX_QUALITY.md](PROVIDER_UX_QUALITY.md). The portable review now contains12 presentation and4 keyboard-focus captures; the original results below describe their recorded earlier checkpoint.

20 October 2026, Africa/Cairo. Scope: the exact [execution packet](../PROVIDER_INTELLIGENCE_PACKET_2026-10-20.md), SHA256 `f71b15a549198aa7b83b34df2460683f3080ac4a016105913fee04d22274222d`. **Gate 1 remains unapproved. No production integration or deployment.**

## Open the visual review

[provider-review.html](provider-review.html) is a single portable HTML file with **eight embedded actual screenshots**: Index/Studio × 1440×960/390×844 × browsing/detail. Save/download that file and open it in a browser; no Node, font, dev server, reference cache or other file is needed. Its direction/state controls, full-size dialog, screenshot downloads and Save offline review link work from the embedded data. A running-cloud convenience URL is `http://localhost:5194/workspace-proofs/provider-review.html`; this is optional, not the deliverable's dependency. The source is also preserved in draft PR #34.

The exact saved HTML bytes passed offline document rendering in Chromium and Linux WebKit, with eight full-resolution images, every direction/state combination, download links, dialog Escape/focus restoration and narrow/desktop accessibility. Direct `file://` navigation was blocked by the managed Chromium policy and failed internally in the cloud WebKit wrapper; those specific launch paths were not verified. Normal browser file opening outside this managed environment remains a manual check. No claim of physical iPhone testing.

Older broad screenshots in `screens/` are preserved historical evidence, not updated provider detail captures. Their review board now points to this focused artifact. Raw captures stay outside Git; no second large PNG collection is committed.

## Actual implementation

- `ProviderBrowser.tsx` is shared by both directions. All32 supported AI provider definitions come from `AI_PROVIDERS`; current keys/permissions, registry metadata/models and usage come directly from the existing account-scoped store. Search, configured filtering and Back preserve local browsing state. GitHub remains the existing coding connection, not an invented AI provider.
- Desktop has a searchable, internally scrollable list beside a readable detail area. Index retains its side navigation; Studio retains its horizontal shell/section index. Phone replaces the list with a dedicated provider detail, retaining the product navigation and an explicit Back action. Existing proof typography/themes are reused; no final identity decision.
- Detail separates key presence, explicit provider opt-in, discovery ready/stale/error/not checked, and inference readiness. Discovery never claims a successful reply. Auth/network problems have safe explanatory copy; raw errors/credentials are not echoed.
- Actual local request/token observations are labeled as Lumen activity; the count explanation states that token counts may include estimates and provider billing may differ. Unknown usage/allowance remains unknown. Per-model allowances use the existing `remaining` owner; the OpenRouter free-model pool is described once as shared, never summed across free models. Observed limits for models outside the current catalog remain labeled historical. No invented spend, balances, health probes or inference history.
- The summary distinguishes selected-model allowance from a previous answer's allowance when Auto/Layout is active; numeric allowances no longer coexist with unconditional “unreported” copy.
- `ProofModelAction` is shared between provider detail and the existing proof inventory. Saved provider permission, key presence, enabled models, current catalog/denials/auth state and shared streaming compatibility gate the button. It rechecks the current account/configuration on activation, then calls canonical `setChatModel`. Actual attachment/context/task limits, manual choice and fallback policy still belong to existing send-time routing. No permission is changed automatically; disabled actions explain the correction.
- Manage connection opens the canonical Settings → API keys owner, expands/focuses the relevant provider and leaves the key masked. The routing surface stays mounted but hidden during Settings so selected detail/search survive return. Pending focus targeting is cancelled on close/account change. Existing save/revoke/auth/relay logic is untouched.

Proof-only local search/filter/detail state is intentionally transient rather than shareable URL state. It is keyed by Lumen account and not persisted across sign-ins or promoted into production. Provider/model data are never cached in a second store. The finite32-provider list is rendered fully inside its own list scroller; detail/model content uses the existing Routing Center content scroller.

## Verification and honest failures

Focused `provider-check.cjs`: Index and Studio at1440×960 and390×844 in Chromium and Linux WebKit. Eight final cases passed; **24 axe state scans**, no reported violations, page errors or document overflow. Scenarios include no-results/clear, keyboard filter and model selection, stale catalog, no key, opt-in off, auth error, empty inventory, unknown quota, numeric model quota, shared quota, masked settings roundtrip, draft/selection preservation and synthetic replacement with an empty account. All inference requests are rejected by the test; none were attempted.

WebKit attempted the existing Firebase redirect-resolver `/js/api.js` script twice per case, once per initial load/reload. `watchUser` calls `getRedirectResult` before selecting the preview user. The harness aborts that exact SDK resource locally and records each attempt separately; it does not download it, permit auth/provider traffic, suppress page errors, or change production authentication. All other unexpected external attempts must fail the test. Chromium made no such SDK attempts. `provider-evidence.json` preserves these distinctions.

The existing Index390 full workflow also passed after its accessible model-action locator was updated:18 state scans, attachment/read/removal, Search/Research, context, expanded input, Auto/manual/Layout, usage, model inventory, policy reorder/fallback permissions and persistence, masked settings, draft preservation and a deliberately intercepted Send/Stop. One synthetic intercepted inference request was expected in that separate regression; zero real inference calls. Its output is outside Git via the new `BLACKOUT_OUTPUT` option.

Initial failures are not green evidence: the RED test first failed because the provider browser did not exist; early integration revealed that unmounting Routing Center during Settings discarded selected detail, which was fixed at that boundary. The first WebKit network assertion identified the SDK initialization above. The broad regression's old “Use model” accessible-name locator failed after actions acquired specific model names; that locator was corrected. One running Studio phone test was interrupted by a source hot update and rerun from a stable page. No failure was hidden by a retry loop or a weakened product assertion.

Proof TypeScript and production Vite build passed. Build retains the existing ineffective `sync.ts` dynamic-import warning. Strict premium audit exited1 with the same22 pre-existing production-source findings (7 forms without explicit noValidate,15 textarea/local resize-evidence findings); it scans `src`, not proof files, and is not a compliance pass. Changed proof code was reviewed separately for semantic controls, account/permission handling, safe copy, focus and overflow. No expensive full unit/CI suite was repeated for this isolated docs-entry change.

## Reproduce

From the repo with installed Node22, Playwright, axe and browser engines:

```sh
node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5193 --strictPort
```

In another terminal:

```sh
export BLACKOUT_PROVIDER_OUTPUT=/tmp/lumen-provider-intelligence
BLACKOUT_DIRECTION=index BLACKOUT_WIDTH=1440 node docs/blackout/workspace-proofs/provider-check.cjs
BLACKOUT_DIRECTION=index BLACKOUT_WIDTH=390 node docs/blackout/workspace-proofs/provider-check.cjs
BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=1440 node docs/blackout/workspace-proofs/provider-check.cjs
BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=390 node docs/blackout/workspace-proofs/provider-check.cjs
# Repeat those four commands with MR_WEBKIT=1 for the WebKit engine.
node docs/blackout/workspace-proofs/build-provider-review.cjs
node docs/blackout/workspace-proofs/check-provider-review.cjs
MR_WEBKIT=1 node docs/blackout/workspace-proofs/check-provider-review.cjs
node node_modules/typescript/bin/tsc --noEmit -p docs/blackout/workspace-proofs/tsconfig.json
BLACKOUT_OUTPUT=/tmp/lumen-provider-workspace BLACKOUT_DIRECTION=index BLACKOUT_WIDTH=390 node docs/blackout/workspace-proofs/capture.cjs
```

This cloud environment needs Node22 prepended to PATH (`/workspace/.lumen-tools/node_modules/node/bin`) and `NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs` to select installed browsers. Raw evidence for this checkpoint: `/workspace/.lumen-verification/provider-intelligence-2026-10-20/`. Neither preload nor provider tests disable TLS verification.

## Manual review and slice boundary

Use the portable review's direction/state buttons; enlarge both phone details. Review whether the connection/discovery distinctions and model actions scan naturally. In the optional existing local synthetic preview, type a draft, visit Routing Center, search a provider, open/Back, inspect unknown allowance, open its masked connection editor and return to Workspace. Select an enabled model without sending; your draft should remain. Preview Send remains deliberately unavailable.

No assumptions changed the requested functional scope. Environment adaptations are the recorded blocked SDK initialization and offline document-render verification instead of unsupported cloud file navigation. Synthetic account-state replacement is a proof-local safety check, not a real-auth end-to-end test. Live provider/billing/quotas, physical iPhone/keyboard, expanded theme matrix and full brand/motion work remain outside this focused slice. Stop here; do not start unrelated Blackout phases automatically.
