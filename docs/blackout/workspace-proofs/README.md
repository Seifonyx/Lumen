# Blackout Workspace + Routing Center architectural proofs

20 October 2026, Africa/Cairo. **Gate 1 remains NOT APPROVED.** [Course correction](../ROUTING_CENTER_COURSE_CORRECTION_2026-10-20.md) governs. These are actual local Lumen component renders with labelled synthetic accounts, not generated artwork or a production redesign.

**Latest:** [Two directions after the owner's rejection of the consolidation](proposals/PROPOSALS.md) — A Canvas and B Desk, [offline review](proposals/review.html). No direction selected; Gate1 unapproved.

**Previous:** [Gate1 final verification](FINAL_VERIFICATION.md) — Chromium + WebKit matrix at `1d1e0f7`, rebuilt [portable review](consolidation-review.html), physical-iPhone checklist. Gate1 remains unapproved.

**Previous:** [Gate1 quality pass](QUALITY_PASS.md) — typography, intelligence rail, mode identity and honest usage share on the consolidated preview, with before/after captures. Gate1 remains unapproved.

**Previous:** [Gate1 flagship consolidation](CONSOLIDATION.md), [portable16-image review](consolidation-review.html), [machine evidence](consolidation-evidence.json). One Workspace plus optional Focus writing, in an opt-in isolated preview. Gate1 remains unapproved; no merge/deployment or automatic migration.

**Preserved flagship exploration:** [Flagship Workspace & Composer](FLAGSHIP_WORKSPACE.md), [portable offline flagship review](workspace-review.html), [machine evidence](workspace-evidence.json). This is a bounded proposal after provider quality; Gate1 is unapproved and work stops here. The board embeds26 actual images, including original-app comparisons, with no external assets.

**Preserved provider slice:** [Provider UX quality closure](PROVIDER_UX_QUALITY.md), [portable offline review](provider-review.html). Twelve ordinary and four separate keyboard-focus captures supersede the previous provider presentation. The sections below retain earlier architectural-checkpoint evidence.

Open [review.html](review.html) for ten matched workflow views and [the actual 9Router board](../reference-board.html) for individually sourced reference images. [INFORMATION_ARCHITECTURE.md](../INFORMATION_ARCHITECTURE.md) explains how research changes the product. The original Aperture/Relay/Fold studies are retired.

## What is implemented here

Two isolated entries reuse the real App/store, Composer, ModelPicker, UsageMeter, LayoutEditor, RouteWhy and provider/settings owners. Index uses a workspace index, editorial conversation, intelligence margin and bottom phone navigation. Studio uses horizontal navigation, a persistent drafting station beside the conversation, a management section index, and a dedicated expanded phone-writing state.

Both connect Workspace ↔ Routing Center, with catalog inventory, existing connection editor, Layout policy/fallback controls, usage and diagnostics. Context/token values are estimates computed from the synthetic conversation; absent quota remains unknown. Provider readiness is discovery state, not a claim of successful inference or an SLA. New gateway/CLI endpoints, account token vaults, persistent request history, external compression, cost reporting and OAuth integrations are not implemented.

Proof-only React portals and CSS are exploration scaffolding, not the production design-system architecture. No product entry imports these files. Before any promotion, implement the selected structure through shared component/token owners and the approved design system; preserve all existing phone keyboard/draft/gesture/security contracts.

## Earlier architectural-checkpoint verification

Final matrix: **10 passed cases, 176 captured-state axe scans, zero reported violations; zero page errors or document overflow.** Machine reports and screenshots are in `screens/`.

| Each direction | Browser / viewport / theme |
|---|---|
| Index and Studio | Chromium 1440×960 dark and light |
| Index and Studio | Chromium 390×844 dark and true black |
| Index and Studio | Linux WebKit 320×844 dark |

Both ordinary App baselines passed at 1440×960 and 390×844, with identical synthetic chat/route fixtures. The baseline includes the independently tested usage-button functional fix but no experimental visual CSS. The Routing Center baseline uses current API-key management because the original app has no first-class equivalent.

The harness exercises attachment selection/removal, Search and Research state, Add Context menu, expanded input, Auto/manual/Layout changes, inventory Use model, context/usage, dedicated Usage and Diagnostics, route explanation, ordered policy/fallback-scope edits, masked provider fields, view roundtrips, draft/selection preservation, explicit Send/Stop, and policy persistence after reload. Each case sends **one locally intercepted synthetic request** solely to inspect Stop; **zero real provider calls**. The existing weekly model-check timestamp is seeded to isolate these flows; this is not a claim that production has no scheduled probes.

Meaningful failures found and corrected:
- Initial CSS-only studies failed the user's design criteria and are retired, not counted as successful redesigns.
- Fold's historical light sidebar had a theme-boundary contrast failure; corrected in that retired study.
- Actual production UsageMeter controls default-submitted the composer. Independently reproduced red/green, fixed separately in PR #35, merged/deployed at677bc51; hosted Chromium/WebKit1440/390 regression and18 live asset hashes passed. No visual changes.
- Studio expanded phone composition had an implicit extra grid row because `.conversation-area` was the actual grid child. Removing that row's participation fixed the root cause. Assertions now check wrapper/form height and containment of input/footer. Independent reviewer measured wrapper714/form694/textarea532 at 390×844 and confirmed collapse restores the draft/conversation.
- Manual preview guard initially relied on a sign-in hint and missed direction-only transport setup. It now checks existing Firebase DB names/account namespaces and an owned-fixture marker before importing App. Fetch/XHR guards apply on every manual reopen. Independent rerun passed.

`check-review.cjs` passed: all ten actual reference images load, all 20 before/after board combinations resolve, review-board accessibility passes, manual synthetic initial/reopened views make zero external requests, fetch/XHR denial works, and foreign local/Firebase state is rejected intact. Proof tsconfig passed. Core `npm test` passed typecheck, 149 TAP tests in 17 groups and the remaining repository unit assertions; separate production build passed with the existing `sync.ts` dynamic-import warning. Ordinary design regression passed.

The premium static audit was run in strict mode: **exit1, 22 pre-existing source findings** (15 textareas lack local evidence of the global resize owner; seven forms lack noValidate). This is not an accessibility compliance pass. Resolve actual contract/validation issues in B03/B07 rather than silently skipping findings. No production CSS/design contract was changed here.

## Reproduce and inspect locally

Use the repository's supported Node22 and installed dependencies. In this cloud environment prepend `/workspace/.lumen-tools/node_modules/node/bin` to PATH and set `NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs` to select installed Chromium/WebKit. No TLS bypass is used by the proof harness.

Start Vite from the repository: `node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5193 --strictPort`.

Start artifact/reference review: `python3 docs/blackout/serve-review.py --reference-cache /workspace/.lumen-verification/blackout-2026-10-20/references --port 5194`. External pixels are private cached review copies; source links/hashes are preserved in the reference evidence. If a future environment lacks the cache, retrieve the exact HTTPS sources and visually inspect any changed image rather than marking it automatically reviewed.

Commands:

```sh
node node_modules/typescript/bin/tsc --noEmit -p docs/blackout/workspace-proofs/tsconfig.json
node docs/blackout/workspace-proofs/capture-baseline.cjs
BLACKOUT_DIRECTION=index BLACKOUT_WIDTH=1440 node docs/blackout/workspace-proofs/capture.cjs
BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=390 node docs/blackout/workspace-proofs/capture.cjs
BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=320 MR_WEBKIT=1 node docs/blackout/workspace-proofs/capture.cjs
node docs/blackout/workspace-proofs/build-review.cjs
node docs/blackout/workspace-proofs/check-review.cjs
```

`BLACKOUT_THEME=light|black` selects additional themes. `http://localhost:5194/workspace-proofs/review.html` opens the evidence board; `http://localhost:5193/docs/blackout/workspace-proofs/?direction=index&fixture=1` opens a guarded synthetic manual preview. Use a fresh browser profile; it refuses existing accounts. Manual Send intentionally returns preview unavailability, not a fake live answer. The test harness alone installs its explicit proof-only transport capability and intercepts provider requests.

## Things to try and remaining work

Type an identifiable draft. Open usage, change model/Auto/Layout, visit Routing Center and return: preserve draft/selection. Edit Launch writing, reorder models and change fallback scope, save/reload/reopen. Open provider credentials: stay masked. Expand Studio on phone: the form should fill the working area with input/footer contained, and collapse should restore the conversation.

Physical iPhone keyboard/gestures/refraction, complete light-phone/black-desktop matrix, live provider/auth/quota behavior, final logo/small-icon design, original motion language, provider-detail redesign, complete account/error/slow/streaming/Canvas/Compare states and full 200% zoom/localization remain unfinished. No final visual approval or whole-product completion claim is made. Do not request Gate 1 solely on test passes: refine these concrete product/identity gaps first.


## Reproduce the flagship proposal

Use the existing Node22/browser preload setup above. Keep new raw evidence outside Git:

```sh
BLACKOUT_OUTPUT=/workspace/.lumen-verification/flagship-2026-10-20/baseline node docs/blackout/workspace-proofs/capture-baseline.cjs
BLACKOUT_DIRECTION=index BLACKOUT_WIDTH=1440 node docs/blackout/workspace-proofs/flagship-check.cjs
BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=390 node docs/blackout/workspace-proofs/flagship-check.cjs
BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=320 MR_WEBKIT=1 node docs/blackout/workspace-proofs/flagship-check.cjs
BLACKOUT_DIRECTION=studio BLACKOUT_WIDTH=390 BLACKOUT_HEIGHT=480 BLACKOUT_OUTPUT=/workspace/.lumen-verification/flagship-2026-10-20/short node docs/blackout/workspace-proofs/flagship-check.cjs
BLACKOUT_DIRECTION=index BLACKOUT_WIDTH=390 MR_WEBKIT=1 node docs/blackout/workspace-proofs/flagship-interaction-check.cjs
node docs/blackout/workspace-proofs/build-workspace-review.cjs
node docs/blackout/workspace-proofs/check-workspace-review.cjs
MR_WEBKIT=1 node docs/blackout/workspace-proofs/check-workspace-review.cjs
```

The builder requires the complete11-case matrix and two focused reports recorded in FLAGSHIP_WORKSPACE.md; commands above illustrate individual cases, not the entire matrix. It refuses failed/incomplete reports. Default output is the external flagship evidence directory. Inspect `workspace-review.html` offline or at `http://localhost:5194/workspace-proofs/workspace-review.html`. Physical keyboard/device behavior is not simulated by screenshots.


## Consolidated proposal

Use a fresh isolated browser profile at `http://localhost:5195/docs/blackout/workspace-proofs/?proposal=consolidated&fixture=1`. The same opt-in query works on5193. Legacy direction URLs remain available. See CONSOLIDATION.md for the stable-server command, focused and retained matrix, changed assertions, manual checks and remaining weaknesses. `consolidation-review.html` is self-contained and also available at `http://localhost:5194/workspace-proofs/consolidation-review.html`. No production design-system integration.
