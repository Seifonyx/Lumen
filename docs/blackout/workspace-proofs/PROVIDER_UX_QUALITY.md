# Provider UX quality closure

20 October 2026, Africa/Cairo. Continuation of PR #34 from `a2cff7b38025981650c58da3f86fc5d67e602904`; worktree was clean and remote/main inspected before editing. Governing [quality-closure brief](../PROVIDER_UX_QUALITY_CLOSURE_2026-10-20.md), SHA256 `5935725c1e04b2945d335150b2e8b27f62bb5bd1e58ff0fbd23b96def5fb12ab`. **Gate1 remains unapproved; no production integration, merge or deployment.** This note supersedes the earlier provider-intelligence slice's current-state UI descriptions and eight-capture evidence. That older note remains historical evidence.

## Changes mapped to the review

| Finding | Implemented correction / ownership |
|---|---|
| Q01 Mobile overview | Allowance gets a full-width primary row; catalog/policy counts sit below. Explanatory paragraphs use13px and captions12px. A phone Browse providers action opens the existing browser without placing a long provider list below overview statistics. Desktop retains its distinct shell and existing list/detail composition. |
| Q02 Navigation | All six sections, including the explicit Providers view, are visible in a two-column phone arrangement with wrapping labels and44px controls. Desktop retains horizontal Index / vertical Studio navigation. Section changes reset the Routing Center content scroll before paint, avoiding retained/anchored positions that hid Studio's heading. |
| Q03 Detail hierarchy | Concise connection and discovery facts, an inference uncertainty sentence, then allowance and model actions. Secondary usage counters and provenance live in an accessible disclosure after inventory. Actual limits, shared-pool/unknown states and token-estimate explanations are retained. |
| Q04 Back | Back is exposed on phone only. Desktop keeps its provider list beside detail and has no redundant Back control. |
| Q05 Filters | All providers; Saved connections (saved keys, including permission off); Enabled providers (existing `providerEnabled` contract). Counts/labels agree with those states. Filtering/searching away the selected provider clears that selection; detail always derives from visible results. Search/filter clearing does not resurrect a hidden choice. |
| Q06 Default | Initial detail follows the selected/last-answer provider supplied by the existing conversation state. With no grounded provider, desktop deliberately says Choose a provider; phone starts with the list. Alphabetical sorting never chooses a default. |
| Q07 Performance | `ProofModelAction` subscribes only to owner ID and its primitive eligibility result, with memoized rendering and a stable selection callback. Weak caches index immutable model/identifier arrays for constant-time membership; no credential snapshot is cached. Canonical account/permission checks still rerun on activation. Provider grouping is memoized and model pages render at most24 rows with search/Previous/Next. |
| Q08 Locale | Discovery timestamps use default browser `Intl.DateTimeFormat` locale/timezone and semantic `time` elements. No hardcoded Cairo formatting or suffix remains in provider UI. Test context deliberately uses en-GB/Pacific-Honolulu. Document/checkpoint dates remain Africa/Cairo. |
| Q09 Evidence | The portable review embeds12 ordinary presentation captures plus4 explicitly separated keyboard-focus captures, covering both directions and1440×960/390×844. Pointer position and blur are controlled only in the capture harness; accessible runtime focus styles are preserved. Raw additional320px/large-catalog evidence stays outside Git. |

The same proof-only ProviderBrowser, canonical FilterMenu, current registry/configuration/usage and canonical masked Settings owner serve both directions. Model selection still calls `setChatModel`; task compatibility and fallback policy remain send-time responsibilities. No production owner, dependency, backend, logo/type system, authentication or credential persistence was changed. No fabricated quota, successful inference, health or billing data.

Search/filter/detail state remains transient/account-keyed as documented for the original proof. Settings roundtrips retain the selected provider and draft. Large catalogs use explicit24-row paging and local search; filtering resets/clamps paging and a non-empty query keeps its clear control even if refreshed catalog size drops below24. Browser state rather than a second provider store owns the UI.

## Verification

The focused matrix includes eight Index/Studio × Chromium/Linux WebKit ×1440×960/390×844 cases, plus Index320 WebKit and Studio320 Chromium: **10 passed cases,60 axe state scans, zero reported violations, page errors or document overflow.** `provider-evidence.json` records individual cases and capture hashes. Tests cover:

- readable overview copy; full section labels without horizontal discovery; navigation scroll reset;
- saved-versus-enabled counts, search and filter selection consistency, unknown-route intentional selection;
- stale/auth/no-key/permission-off/empty/long-provider states; numeric, shared-pool and unknown allowance;
- actual keyboard heading focus, ordinary captures without keyboard/hover presentation, browser-local timestamps;
- masked settings, model selection and unsent draft preservation, and synthetic replacement with an empty account.

The1000-model case exercises24-row paging, long-name search, clear/page reset and a React Profiler workbench with1000 actually mounted model-action components. Ten unrelated store updates produce **0 action commits**; removing the provider key causes **1000 relevant commits and1000 disabled actions**. This is render/subscription regression evidence. Its frame-scheduled elapsed time is not a CPU/inference/answer-quality benchmark and has no hardware-sensitive pass threshold. `provider-performance.tsx` is a test-only import and is not loaded by the app/proof entry.

The existing Index390 workspace regression passed18 states, including attachment/context controls, Auto/manual/Layout, usage, policy order/fallback scope persistence, masked credentials and a deliberately intercepted Send/Stop. No real provider call is made. Focused provider cases attempt no inference. Existing WebKit Firebase redirect-resolver script attempts are locally blocked and recorded separately; unexpected external requests remain test failures. Synthetic account-state replacement does not claim real sign-in/account-isolation end-to-end acceptance.

Proof TypeScript and production build pass; the build keeps the existing ineffective `sync.ts` dynamic-import warning. Strict premium audit still exits1 with22 pre-existing `src` findings (7 explicit validation-owner and15 textarea/local resize-evidence findings). It is not a compliance pass and does not replace proof runtime checks. Full expensive unit/CI suites were not repeated for this docs-entry-only slice.

Initial failures and fixes are retained honestly: the RED check reproduced clipped/horizontally hidden sections; an early semantic `dl` timestamp grouping failed axe and was corrected; the Profiler harness initially sampled before concurrent mount and now uses an explicit synchronous test boundary plus a1000-mounted assertion; concurrent startup exposed a fixture catalog-readiness race, fixed with a condition wait. A temporary exec-server disconnect was recovered by inspecting files/logs rather than assuming lost sessions passed. Visual inspection then found retained section scroll/hover evidence, which was corrected and reverified. No retry loop or weakened product assertion hides a failing flow.

## Review and reproduce

[provider-review.html](provider-review.html) is the portable artifact. It contains every screenshot and supports direction/state switching, full-size viewing, image downloads and Save offline review. It needs no font, CDN, Node server or reference cache. Exact saved bytes passed offline rendering/download/control/dialog-focus/accessibility checks in both engines. Direct cloud browser file navigation remains unsupported as documented in the original slice; no physical iPhone or real-provider claim is made.

Use the original reproduction commands in [PROVIDER_INTELLIGENCE.md](PROVIDER_INTELLIGENCE.md), with `BLACKOUT_PROVIDER_OUTPUT=/tmp/lumen-provider-quality`. Run all four standard direction/width combinations in each engine, plus `MR_WEBKIT=1 BLACKOUT_DIRECTION=index BLACKOUT_WIDTH=320` and `BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=320`. Set `BLACKOUT_LARGE=1` on the Index1440 Chromium case. Then run `build-provider-review.cjs`, `check-provider-review.cjs` in both engines, proof tsconfig and the existing workspace regression with `BLACKOUT_OUTPUT` outside Git. Cloud Node22/browser selector preload requirements are unchanged. Raw session evidence: `/workspace/.lumen-verification/provider-quality-2026-10-20/`.

Manual checks:

1. Compare Overview, Providers and Detail in each direction. On phone, all labels should be readable and the first model action visible without paging through explanations. Back returns to the list; desktop has no Back.
2. Search/filter between Saved connections and Enabled providers. A saved key with permission off belongs only in Saved connections; hiding the current provider must remove its detail. A conversation's known provider is relevant by default; a new Auto conversation invites a choice.
3. Type a distinctive draft, inspect a masked connection, select an enabled model and return to Workspace. Preserve the draft. Open Usage & provenance for actual counts, shared-pool and estimate explanations. Change browser locale/timezone and reload to inspect local discovery time.

## Stop boundary / progress

This is a verified isolated quality-closure slice, not final Blackout acceptance. **18.5→18.5%, Medium confidence**, unchanged baseline weights/fractions. Brand/motion, full complex-state/theme matrix, physical iPhone and explicit visual approval remain outside this slice. No scope assumptions were changed. Stop at the synchronized PR #34 checkpoint; do not start identity or unrelated work automatically. Gate1 remains unapproved and the visual branch must stay unmerged/undeployed.
