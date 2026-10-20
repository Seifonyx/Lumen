# Gate1 flagship consolidation

20 October2026. [User scope](../GATE1_CONSOLIDATION_2026-10-20.md). Base `4ff2ad77cecbc37f4f52423f74877738497f45ea`; existing draft [PR #34](https://github.com/Seifonyx/Lumen/pull/34). **Gate1 NOT APPROVED. No production integration, merge or deployment.**

## Proposal and ownership

[Portable review](consolidation-review.html) embeds16 actual application frames: six desktop/phone states for the consolidated proposal plus four matched previous-flagship Workspace/expanded-editor comparisons. [Machine evidence](consolidation-evidence.json) retains cases, reading measurements and image hashes. Previous26-image review, provider review and original source directions remain intact.

Opt in with `?proposal=consolidated&fixture=1` on the existing localhost proof entry. The proposal uses one Index-derived shell; `direction=studio` cannot accidentally create a mixed shell when consolidation is selected. Previous `?direction=index|studio` entries still render the earlier alternatives for regression/comparison.

- **Reading:** phone title is compact and metadata removed from the visual flow. Your brief progressively reveals the actual original user message/actions; it does not insert a copy or alter stored messages. Disclosure is scoped to original message index0, so a different first visible row cannot be collapsed as virtualized history changes. On short phones the repeated document title is visually hidden but remains accessible. The response gets the default workspace; desktop retains useful outline/route/context intelligence.
- **Focus:** the same canonical textarea moves beside the response on desktop. Back to reading, the existing expand/collapse control and Escape in the editor reverse it. Response/editor scroll independently. Phone expansion remains a deliberate writing mode with visible actions. The real ComposerChrome hook, textarea node, persistence and tool ownership are preserved.
- **Navigation:** one wordmark-first shell. Desktop adds prominent New conversation and native-search entry, history, Projects, Routing Center and account-scoped recent shortcuts. Phone replaces competing top/bottom navigation with one toolbar: history drawer, New and Routing Center/context; the canonical drawer retains search/Projects/Library/Tools. Routing Center has an explicit phone Workspace return. No duplicate search/filter store.
- **Composer:** inherited form padding is removed in the consolidated variant; context/writing/action layers each own their padding. This fixes double padding, reduces phone height and aligns divider/text. Focus uses a bounded flex chain with one editor scroller and a disclaimer outside the form but inside the writing column. No copied editor or new draft state.
- **Context/usage:** the chip and canonical UsageMeter both show **conversation-only** estimated context. Focus's heading labels draft-text tokens separately; intelligence explains both and exclusions. Pending attachment payloads/full request overhead/provider-billed tokens are not implied. Known model allowance remains canonical `remaining`; unknown stays unknown in the existing usage/intelligence surfaces. The real picker, usage panel and drawer receive scoped material/type alignment.
- **Provider continuity:** ProviderBrowser/ProofModelAction, canonical credentials/permissions/settings/model registry/usage/routing/policies and earlier provider-review artifact are unchanged. No engineering reimplementation, gateway, health probe or new inference/backend.

Visual values belong solely to opt-in `consolidated.css`; production DESIGN.md/tokens/CSS and application entries are untouched. Current typography and motion are provisional, not an approved identity. This proof's DOM portals/observations remain exploration scaffolding requiring an approved canonical-component migration later.

## Verification method and changed assertions

Raw evidence is outside Git in `/workspace/.lumen-verification/consolidation-2026-10-20/`. Final browser runs use a localhost Vite server on5195 with `hmr:false,watch:null`, so changing unrelated review/docs cannot interrupt overlays. Original user preview5193 is preserved. The existing strict transport fixture continues to intercept synthetic provider responses and deny unhandled external traffic.

The original11-case `flagship-check.cjs` matrix is retained with unchanged behavioral assertions. Its sole harness change is an optional `BLACKOUT_PORT` (default5193). Reports go to `retained/`; original194-state axe coverage is preserved. Main cases: Index/Studio × Chromium/Linux WebKit ×1440×960/390×844; Studio320×844 WebKit, Index320×480 Chromium, Studio390×480 Chromium.

The new `consolidation-check.cjs` reuses the same synthetic fixtures/contracts and preserves the full model/tool/attachment/policy/settings/SendStop flow. Proposal matrix: Chromium/WebKit1440×960 and390×844, WebKit320×844, Chromium320×480 and390×480. Architecture-specific assertions change explicitly:

1. The phone navigation element is attached but visually absent; history uses the actual drawer. One toolbar replaces competing navigation rows.
2. At initial scroll position, the first full response paragraph must end above the composer; collapsed composer must occupy at most42% of the viewport, including320×480. The original brief is collapsed by default and can reveal/hide the original bubble.
3. Expanded desktop Index now keeps the response visible instead of hiding it. Focus and reading transition in both directions; editor/response scrolling is independent. Editor/footer/form bounds and original selection/focus checks remain.
4. Search/history/new-conversation roundtrips preserve the original chat's exact unsent draft; the separate new-chat draft does not overwrite it.
5. The composer estimate is conversation-only; numeric/unknown allowance assertions move to the intelligence dialog using the same canonical data, not fabricated footer telemetry.
6. A synthetic24px bottom inset checks safe-area padding. Resizing the writing viewport to480px must preserve selection/draft and visible footer/editor. This is simulated space, not physical keyboard/device verification.

Each main case permits exactly one explicit intercepted synthetic Send/Stop, zero real inference. WCAG-tagged axe scans cover the same17 desktop/18 phone states; no unhandled external traffic is sent. New navigation/data boundaries reuse canonical owners; model/provider permission checks remain in their existing owners.

Failure history: before corrections, the first-paragraph visibility assertion fails on the previous phone composition. At320×480, duplicate metadata and inherited form padding cause reading/height failures; short-height title disclosure and removal of double padding fix the causes without reducing text/control size or weakening the42% assertion. Early runs timed out after overlays/rows were detached during source hot reload; failed logs are retained in `attempts/`. Final verification freezes source and disables hot reload instead of adding sleeps, retries or weaker assertions. Hidden mobile navigation required attached-state readiness rather than a visible old tab bar. The baseline itself remains unchanged apart from port selection.

## Actual results

Final frozen-source verification passes **seven proposal cases /124 axe states** and the retained **11 cases /194 axe states**:18 workflow cases,318 state scans, zero reported WCAG-tagged violations, page errors or document overflow. Each main case has exactly one intercepted synthetic Send/Stop; no real inference. The11-case baseline assertions are unchanged apart from optional port selection. After final label/identity scoping, all seven proposal cases were rechecked from a fresh frozen server; no sleeps/retry loops or weakened assertions.

Measured Chromium390×844 default: first paragraph spans y256.375–335.125, before composer top668; composer height176px. Chromium320×480: paragraph y165.640625–244.390625, before composer top287; composer height193px (≤42%). These are viewport geometry observations, not device or performance benchmarks. Exact values and screenshot hashes are in the machine evidence.

Proof TypeScript passes. Production Vite build passes with the existing ineffective sync.ts dynamic-import warning. Strict audit exits1 on the same22 pre-existing production findings (7 noValidate,15 textarea/local-resize-evidence); no compliance claim. No dependencies or production source changed, and no separate full unit-suite rerun is claimed for this preview-only change.

Both offline-review engines pass:16 full-resolution images including four previous comparisons, all controls, saved HTML and actual PNG downloads, full-size dialog Escape/focus restoration, zero remote requests/page errors and four total desktop/phone axe scans. Managed file:// remains unsupported; exact saved bytes were rendered offline. Captures were self-reviewed as contact sheets and selected full-size frames. Only curated image payloads are committed; raw output stays outside Git.

Restart5195 after any future application/proof source edit: its frozen watcher intentionally does not load updates. Never test changed source against the previous cached test server. Keep the source frozen during a verification run.

## Reproduce

Use installed Node22 and browser preload as documented in README. Start the normal isolated Vite entry or the stable test server:

```sh
node --input-type=module -e 'import {createServer} from "vite"; const server=await createServer({server:{host:"0.0.0.0",port:5195,strictPort:true,hmr:false,watch:null}}); await server.listen(); server.printUrls();'
BLACKOUT_PORT=5195 BLACKOUT_WIDTH=390 node docs/blackout/workspace-proofs/consolidation-check.cjs
BLACKOUT_PORT=5195 BLACKOUT_WIDTH=1440 MR_WEBKIT=1 node docs/blackout/workspace-proofs/consolidation-check.cjs
BLACKOUT_PORT=5195 BLACKOUT_WIDTH=320 BLACKOUT_HEIGHT=480 BLACKOUT_OUTPUT=/workspace/.lumen-verification/consolidation-2026-10-20/short node docs/blackout/workspace-proofs/consolidation-check.cjs
BLACKOUT_PORT=5195 BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=390 BLACKOUT_OUTPUT=/workspace/.lumen-verification/consolidation-2026-10-20/retained node docs/blackout/workspace-proofs/flagship-check.cjs
node docs/blackout/workspace-proofs/build-consolidation-review.cjs
node docs/blackout/workspace-proofs/check-consolidation-review.cjs
MR_WEBKIT=1 node docs/blackout/workspace-proofs/check-consolidation-review.cjs
```

The builder requires all seven proposal and11 retained passed reports, not just these illustrative commands. It refuses failed/incomplete cases. The artifact embeds all images/scripts/styles; download the saved HTML for offline review. Managed cloud browsers cannot navigate file://; exact saved bytes are rendered offline with setContent, all images/controls/comparisons/downloads/dialog focus and two viewport accessibility/overflow checks per engine. This does not test operating-system file association.

## Manual checks and limits

Fresh isolated profile: `http://localhost:5195/docs/blackout/workspace-proofs/?proposal=consolidated&fixture=1`. Never use real credentials. Manual preview denies external inference; only the test harness supplies intercepted Send/Stop.

Read the default phone opening, reveal Your brief and close it. Select a phrase in a long draft, enter Focus and return: preserve exact text/selection. On desktop, scroll editor and response independently. Use Search conversations, history and New conversation, then return to the original unsent draft. Switch Auto/manual/Layout, open usage/intelligence and Routing Center, return. Toggle Search/Research and attach/remove a text file. Keyboard Enter/Escape/focus must remain usable. See the review's four manual sequences.

Known limits: physical iPhone keyboard/browser chrome/safe-area/touch feel are unverified; synthetic viewport/inset tests are distinct. Full themes, zoom/localization, very long virtualized history, streaming/Canvas/Compare/error/account states and complete final motion/identity remain outside this slice. Outline matching still targets rendered headings; no new production navigation owner. Canonical overlays retain much of their existing information design. The22 existing production strict-audit findings remain documented; no full compliance claim. No live providers, quota/billing/authentication or production verification.

Progress stays18.5→18.5%, Medium confidence,81.5 weighted points remain. This consolidates existing partial B02.1/B02.2; final identity/complex-state/device/approval groups are unfinished. No B03/B04 credit. **Stop at this exploratory proposal. Gate1 remains unapproved; no merge/deploy/automatic approval request.**
