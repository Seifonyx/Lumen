# Phase4 Slice3 CP1 — Auto Routing & Layouts verification

## Delivery and authority

Draft [PR56](https://github.com/Seifonyx/Lumen/pull/56), `feat/phase4-prism-auto-layouts`. The corrected capture runtime is **39d50a02ff8cfee852158e9604a6bbd8193ea0e7**, based on released Canvas/main **05d2647e37919e7548ed397118cb28592a67a737**; the current delivery HEAD is **6903bb5182b5d3b4d0191e961a3a6f10170048de**. Capture provenance retains each baseline/earlier source commit separately. The final delivery-head CI result is recorded below.

**CP1 only. Stop for owner/planner review. No merge, deployment, CP2 Usage/Diagnostics, paid inference, new infrastructure or Gate approval.**

## Recovered versus finished

The original cloud task and worktree were accessible. Existing uncommitted Auto/Layout implementation, tests and captures were preserved; no previous CP1 commits existed and no other worktree was reset. The core routing presentation, lazy Layout index/editor seams and initial regression matrix already existed.

Continuation completed the missing-evidence behavior; live-session synthetic alternatives test; editor/catalog-refresh/account/sign-out/axe coverage; review corrections for arbitrary `via` provenance, non-streaming advisories, and the exact saved preflight quota notice. The quota test failed before the presentation fix and passed afterward. Existing editor Add/save/route eligibility gates remain unchanged. Final committed-source browser checks, immutable gated QA, curated review and draft publication followed.

## Product changes

- Models → Details distinguishes current preference from last completed answer. Actual model/source/recovery/selection notes/alternatives use existing Message evidence. Failed/stopped/in-progress answers are excluded; missing reasons/alternatives remain unknown. Current policy is not a promised next model. Routing settings link opens the canonical owner.
- Layouts replaces the mixed “policy” terminology, exposes all saved assignments and their advisories, shows effective fallback including global switching off, and offers direct Use layout. Saved hidden recommendation-ID configurations remain visible; canonical hidden-selection rules still apply.
- The canonical editor adds a Prism-only presentation: name/mode/assignments first, accessible ordering, shared provider/word search, optional instructions/appearance, and Before you save with effective rules and attention count. Its ordinary/Settings field order remains intact. No new draft/save/state owner.
- Existing account-scoped screen memory/history retains an unsaved editor on navigation Back/Forward. Explicit Cancel discards and Save completes; Forward cannot reopen either form. Catalog refresh retains draft/order/missing IDs. Use layout returns to the same mounted composer/draft/file/selection/focus.

## Actual local verification

All checks below passed on the committed runtime source unless a prior-build preservation run is explicitly identified. Source remains unchanged in the evidence commit.

| Check | Actual result |
|---|---|
| `npm test` | TypeScript check and **96 unit files passed**; includes effective legacy/global/invalid fallback, actual completed evidence, advisory-only incompatibility and quota recovery. |
| Ordinary and `LUMEN_CANVAS=1` builds | Passed. Existing mixed static/dynamic-import warnings remain; no new build failure. |
| `prism-auto-layouts.cjs` | **8/8 per engine**, Chromium + Linux WebKit:320×568,390×844,430×932,1440×960, Light/Dark. Create/edit/reorder/validation/requirements/use/history, draft/file/backward selection/same input/focus, axe, no overflow and320px first full row above Search. |
| `prism-routing-states.cjs` | **4/4 per engine**:320/1440 Light/Dark. Comparison-source neutrality; no completed evidence; historical unknowns; one explicitly intercepted synthetic Send for actual session alternatives; legacy fallback; non-streaming/missing IDs; catalog refresh; sign-out and second-owner isolation; editor axe. |
| Gated `private-qa-routing-center.mjs` | **3/3 per engine**, desktop/390/320,10 checks each. Real local access gate, section/provider/settings/history/select/draft/a11y contracts; no external requests. |
| Gated `private-qa-canvas-composer.mjs` | **4/4 per engine**, includes390×480 simulated short keyboard height. Chromium15/17/17/17 checks; WebKit15/16/16/16. Draft/attachment/selection/undo/IME-safe Escape and synthetic Send/Stop. This is not physical keyboard testing. |
| Models preservation | Existing discovery suite **8/8 per engine** (Chromium earlier source-equivalent UI run; WebKit committed source). Final CI covers both again. |
| Provider Settings containment | **24/24 per engine** (Chromium earlier source-equivalent styles; WebKit committed source), including320px wrapping. No provider-editor source/style changes in CP1. |
| QA01 isolation | **8/8 audits**, including4 real planted builds and primitive/indirect-fetch negative controls. Explicit `QA01_ALLOW_NO_BASELINE=1`: shared editor/copy change ordinary hashes, so byte equality is not claimed. Graph/security controls still enforced. |
| CP01 ordinary graph | **2573 modules,174 artifact hashes,17 negative controls**, no Canvas/QA fixture/auth/transport graph leaks; byte equality explicitly not asserted. |
| Build budgets | Startup JS growth **12.2/12.25KB gz**, CSS **15.3/16**, lazy RoutingCenter **7.6/9**; Canvas CSS source **19.1/19.25**. Source-CSS cap18.5→19.25 explicitly includes new lazy editor/evidence styles. Startup caps unchanged; no performance-speed claim. |
| Independent source review | Three P2 presentation gaps found and corrected: source provenance, non-streaming advisory, and preflight quota recovery. Reviewer verified no changed Add/save/scoring gate; browser tests independently exercised history/account behavior. |

Committed QA build `bc5d447…-0-1`:175 files,2591 audited modules, manifest SHA256 `6425624a9da3f5ec246500e635c4852eba355b85499b8a1b8eff9b875c1da488`; private loopback gate only. No publication, port exposure, service purchase or real account/inference. Existing synthetic Google fixture returns intercepted catalogs and explicit SSE only. The supplemental test counts exactly one intended synthetic POST per case.

Prior runtime-source exact-head [Tests40213090412](https://github.com/Seifonyx/Lumen/actions/runs/40213090412) completed **23/23 jobs successfully**. Final delivery-head [Tests40216088014](https://github.com/Seifonyx/Lumen/actions/runs/40216088014) completed **21/23**: WebKit composer geometry failed at an existing `154 → 156` assertion, and the downstream isolation sentinel failed. No assertion or isolation check was weakened. CI uses the existing workflow/standard public-repository runners; no paid service was activated.

## Visual evidence

[Portable review](../reviews/prism-auto-layouts/review.html): **12 curated actual screenshots**, under1MB total, with [capture/build hashes](../reviews/prism-auto-layouts/provenance.json) and four machine-readable matrix results. Baseline captures use verified released05d2647; earlier after captures retain their original bc5d447 source; the corrected phone-preview capture uses39d50a. Comparable synthetic journeys, not identical message/model counts. No generated mockups. Both engines, Light/Dark, phone and desktop are represented. The entire matrix stays in CI artifacts rather than hundreds of committed images.

Self-review corrected duplicated explanations, overly verbose card summaries and phone evidence framing; editor-start and pre-save captures are separate. Clean screenshots remove keyboard focus solely for presentation. Focus and axe contracts are tested separately. The top section strip intentionally scrolls; later labels may be partially visible until scrolled, preserving the accepted navigation architecture.

## Known limitations and design review

1. Existing `db.ts` serialization omits detailed `routeDetail` metadata. Reloaded answers can retain short route/notices but lose recorded alternatives; the UI states this absence. No storage-schema change is authorized here. A future separately scoped persistence decision may be valuable.
2. Physical iPhone Safari, installed PWA, VoiceOver, OS Dynamic Type, dictation/IME and real keyboard behavior are **unverified**. Linux WebKit/viewport tests do not prove them.
3. Linux WebKit1.56.1 has a reproduced engine crash when reloading after branched Back/Forward history (also on a static page). Main Back/Forward journeys pass; cross-account coverage uses real sign-out and a fresh tab, without claiming this combined engine issue resolved.
4. This is a long editor on the smallest phone; secondary options are disclosed and it uses the existing single page scroller. Before you save and Save require scrolling. Review the writing/selection density on a physical iPhone before release.
5. Saved incompatible models are advisory-visible and retained. The unchanged canonical Add gate allows some known models with no requirements; request-time eligibility remains authoritative. The preview is not provider verification or a future routing simulation.
6. No routing outcome/latency/cost improvement, provider connectivity, physical accessibility pass or production deployment is claimed.

## Owner test steps (private build)

1. Open Prism → Models → Details. Compare Current preference with Last completed answer; absent evidence must say unknown rather than promise the next model.
2. Open Layouts. Inspect switching-off permission and retained missing-model warning. Edit/reorder/name a Layout, Back then Forward: draft/order should return. Cancel, Forward: the discarded editor must not return.
3. Create a Layout, add models and requirements, read Before you save, then Save. Reopen and verify order/ID/assignments. Missing catalog IDs must remain until explicitly removed.
4. Type a chat draft and attach a synthetic file. Use layout: return to the same chat with draft/file/cursor intact and selected Layout feedback.
5. At320×568, reopen Prism Models: a complete selectable row and Use model must fit above Search. Check provider-targeted Settings text still wraps.

Next authorized action after final CI/readback is **owner/planner CP1 review**. Do not start CP2 or release without separate instruction.
