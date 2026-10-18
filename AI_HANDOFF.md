# Dynamic Model Picker operational handoff

## Permanent amendment: Progressive Verified Deployment Policy

Added by the user on 2026-10-18. This execution-policy amendment supplements MASTER_REQUIREMENTS.md without replacing or weakening it. It remains active for every future agent and session unless the user explicitly changes it.

Every completed, independently production-ready milestone must be evaluated for immediate integration into main and production deployment. Do not wait for the entire overhaul merely because unrelated phases remain unfinished. Never merge incomplete, unverified, unsafe, or dependency-breaking work to accelerate release.

For each milestone:

1. Determine independent releasability and unfinished dependencies.
2. Verify relevant tests, type checks, builds, and required CI checks.
3. Review security, privacy, compatibility, and regression risks.
4. Confirm no unresolved dependency on unfinished work.
5. Understand deployment and rollback procedures.
6. Merge through the authorized GitHub workflow, respecting branch protections.
7. Verify the actual production deployment.
8. Test that the live application remains functional.
9. Record the merge commit, deployment status, verification evidence, and outstanding work.
10. Continue the next phase without restarting the project.

Keep unfinished work isolated. Where practical, use reviewable commits or a dedicated release branch to release only a verified subset. A pushed branch, successful local build, or green subset of tests is not production-readiness proof. Never bypass protections, force-push, disable checks, or overwrite unrelated changes.

Future agents must track committed, pushed, merged, and deployed states separately; record the exact latest verified production commit separately from the latest feature-branch commit; document specific release blockers when a milestone is not ready; and continue remaining phases after each deployment. Before handoff, update this file and the companion plan/handoff, preserve the full master requirements and this policy, synchronize coherent verified commits safely, and record uncommitted/unverified work and the exact next task.



## Read first

Read MASTER_REQUIREMENTS.md, IMPLEMENTATION_PLAN.md, this file, Git status/log, then inspect the relevant source. This file supersedes the stale task-status paragraphs in HANDOFF.md for this overhaul; retain its user preferences and environment guidance.

## Current state

- Overall: **In progress; overhaul is not complete**. New permanent progressive-release policy above is authoritative.
- Latest feature/base commit: `3be7307cb960b50d3c5bed90613608337b34405d`, continuation branch `feat/model-picker-recovery`. This includes documentation-only PR20/21 after the PR19 runtime merge; subsequent development is local/uncommitted and must not be merged until verified.
- Latest verified milestone source: `07efe214ef6c94aad2ddd7e29354eb3a4d9b1734`, safely merged through PR19 at `02c322da48368d6277e5eb8b599edfead7f92e0e` on 2026-10-18. Remote head was explicitly verified before merging with `--match-head-commit`.
- PR19: **MERGED** https://github.com/Seifonyx/Lumen/pull/19. Exact-head CI run `39136235729` passed all three jobs: type/build/unit, full Chromium + Firebase emulators, and WebKit. No unfinished local declarations/recovery/comparison code was included. Branch-protection inspection endpoint returned HTTP403 for this integration token; normal GitHub merge enforcement was used, with no admin bypass or disabled check.
- Production runtime: latest verified production commit is `02c322da48368d6277e5eb8b599edfead7f92e0e`. Successful deployment run: https://github.com/Seifonyx/Lumen/actions/runs/39157498252, pinned to merge commit `02c322da48368d6277e5eb8b599edfead7f92e0e`; manually dispatched Deploy workflow. Workflow success, fresh hosted asset hashes/markers and six live suites were verified. Main also contains the documentation-only policy merge `4406c338be50528f1d516488d767e708d38e1664`; its application code matches this deployed revision.
- Current implementation: P01-D declarations, P05 classified recovery/metadata invalidation, P06 helpers, P07 comparison recovery, and P08 completion-marker handling are implemented and locally verified. The next runtime commit must pass its own complete CI and normal merge/deployment verification; PR19 CI does not validate it.
- Exact next task: PR19 is deployed/live verified and policy PR20 is merged. Local checks and independent review are complete. Commit/push this coherent runtime milestone, open a PR, verify all three exact-head CI jobs, then merge/deploy if green. After live verification continue P09/P10/P11; the overall overhaul remains in progress. See latest continuation section below.
- Required source documents are intact. MASTER_REQUIREMENTS.md remains the exact original complete upload; this policy is a separate permanent amendment in the two operational docs.
- Older progress paragraphs below are historical evidence and can describe superseded implementation states; this Current state and latest continuation section control resumption.

## Completed / in progress / remaining

- Completed: P00 plus P01-A/B and P02-A/B. Scoped registry/cache, bounded deduplicated provider discovery/retries, per-provider freshness/backoff, active/resume refresh, native Anthropic pagination, explicit metadata negatives and secret-redacted discovery diagnostics.
- Completed locally: P01-C/P03 core chat/layout/comparison eligibility, manual fallback authorization, strict exclusions, preserved defaults, bounded unknown context, authoritative reasoning negatives, quality/speed/cost/balanced preferences and cost-aware recovery. UI and execution now use `model-selection.ts`; Composer draft restoration is synchronous before paint.
- In progress: P04 shared `layout-policy.ts`, persisted builder requirements/priority, per-layout fallback and requirement editor, fixed-order runtime queue, constraint-aware visibility, and canvas integration implemented. Saved constraints now travel into chat/canvas requests and are checked again on every fallback attempt after refreshed metadata. A review reproduced a downgrade race red, then confirmed the fix with focused tests. Expanded browser verification still running. P01-D declarations and P05 onward remain unfinished.
- In progress: P05/P10 scoped cancellation covers streaming/retries, summaries, one-shot helpers, embeddings and key diagnostics; suspended stream deltas are suppressed and early iterator closure cleans up requests/timers. Health history is account/config scoped and ignores unscoped legacy records. Independent review findings were reproduced and fixed.
- Not started: remaining implementation/verification tasks in IMPLEMENTATION_PLAN.md; none may be assumed done merely because existing code approximates them.
- Blocked: none confirmed. Check existing GitHub credentials with a read-only operation before diagnosing a missing credential.

## Architecture and decisions

- Extend existing browser adapters/Zustand registry and bounded streaming runtime; preserve provider-prefixed IDs and saved layouts.
- First repair: no global cross-account catalog reuse, no old-key metadata fallback, no out-of-order capability publication, bounded/deduplicated discovery. Preserve transient last-known-good only inside the same credential scope.
- Browser lifecycle refresh is possible while active; no continuous background execution or server cron in static hosting.
- User explicitly authorizes autonomous implementation, routine engineering decisions and verified main pushes. Do not stop at planning or repeatedly ask approval. Existing controls, billing opt-ins, privacy boundaries and fixed choices remain authoritative.
- Do not claim measured answer quality from deterministic mocks or model-family heuristics.

## Files changed

- MASTER_REQUIREMENTS.md: exact complete original uploaded text (including execution protocol).
- IMPLEMENTATION_PLAN.md: requirement mapping, stable task IDs, dependencies, criteria, risks and audit evidence.
- AI_HANDOFF.md: operational state and continuation contract.
- Foundation source: `src/lib/ai/registry.js`, `catalog-cache.js`, `catalog-refresh.js` (new); provider discovery/adapters, `src/store.ts`, additive metadata in `src/types.ts`.
- Tests: new model-registry, catalog-scope, catalog-refresh, discovery-integration unit files and `tests/e2e/catalog-lifecycle.cjs`.
- Selection additions: `eligibility.js`, `preferences.js`, `model-selection.ts`; routing/profile/layout eligibility, chat runtime, store, Composer/ChatView/picker settings/comparison/Why UI; selection/priorities unit/browser tests and source-aware fixture setup. Architecture design in `docs/MODEL_PICKER_ARCHITECTURE.md`.
- Uncommitted layout changes: `layout-policy.ts`, `layouts.ts`, `layout-builder.ts`, `LayoutBuilder.tsx`, `LayoutsTab.tsx`, `ModelPicker.tsx`, `routing.ts`, `chat.js`, `store.ts`, scoped editor CSS, new `layout-policy.test.ts` and `layout-policies.cjs`, CI WebKit coverage.

## Verification evidence

- Git initially clean on main at `7fbdde2`.
- Baseline `npm test`: passed all 44 original files and type check. Baseline build passed. Three baseline Chromium suites passed without retries.
- Focused registry unit checks: deduplication, bounded concurrency, per-provider TTL/retries/backoff, auth eviction, cancellation/deadlines, hydration, account/endpoint cache isolation, native pagination, authoritative negatives, redaction and lifecycle listener gating passed.
- Final foundation: `foundation-unit.log` — type check and all 48 unit files passed; `foundation-build.log` — production build passed.
- `foundation-chromium.log`: catalog-lifecycle, Auto intelligence, layout-builder, context-recovery, model-health, removed-models, all six passed (72s), no retries.
- `foundation-webkit.log`: catalog-lifecycle, Auto intelligence, layout-builder, context-recovery, all four passed (108s), no retries.
- Earlier `registry-*.log` runs are diagnostic, not final evidence: one test needed clock installation before app startup, and one WebKit run collided with an owned test server. Both were followed by successful sequential runs.
- P03 red test reproduced unauthorized manual substitution, then passed after implementation. Intermediate 49-file unit/type run passed. New selection-policy browser matrix passed ten Chromium phone/desktop cases; one legacy Unicode case expected the now-forbidden substitution and was updated to verify explicit model selection and subsequent follow-ups instead.
- Priority unit checks passed after using numeric tolerance for a floating-point cost estimate; missing prices stay unknown. Final combined unit/build/nine Chromium/seven WebKit checks are running in `selection-final-*.log` and must be inspected before claiming verification.
- `selection-final-unit.log` and build passed; all nine Chromium suites passed (115s); all seven WebKit suites passed but selection-policy retried after the first input disappeared. The subsequent draft/fixture fixes require their own clean rerun (`selection-checkpoint-*.log`); do not report the earlier WebKit run as retry-free.
- Architecture/applicability design: `docs/MODEL_PICKER_ARCHITECTURE.md`. User-declared model support is explicitly tracked as P01-D; it is not implemented by the existing documented Perplexity list.
- Clean follow-up after the draft fix: `selection-checkpoint-unit.log` — all 50 unit files/type check; build passed. Eleven Chromium suites (114s) and eight WebKit suites (179s) passed without retries. Final resolver checks: `selection-resolver-unit.log` all units/type passed, `resolver-typecheck/build` passed, three Chromium suites (43s) and two WebKit suites (92s) passed without retries. Four focused parser/selection/layout unit suites passed after the final intent clarification. `p03-final-unit/build.log` is the final pre-commit rerun; inspect completion before committing.
- Visually inspected phone WebKit and desktop Chromium priority Settings screenshots; shorter final hint retains the same existing row layout. Linux WebKit is not a physical iPhone test.
- Selection CI `39124554541` WebKit: all routing/selection/priority cases passed; message-navigation failed because its 1,000-message fixture used no context limit and unknown capacity is now bounded. The shared UI fixture now declares a 1M context; dedicated unknown-capacity cases remain explicit and unchanged. Chromium CI was still pending at last observation.
- P04 first unit/type/build passed. Six actual Chromium suites passed (93s): layout-policies, layout-builder, selection-policy, Auto intelligence, context-recovery and canvas. The requested name `layouts` did not exist and was previously ignored by the runner; the runner now rejects unknown names/zero suites (verified exit 2), preventing misleading verification claims.
- P04 WebKit run encountered an unrelated Google public auth-config CORS dependency in the sandbox fixture. Shared preview fixtures now mock that public configuration endpoint rather than relying on the network; a clean follow-up is required. No real user/provider credentials are used in these tests.
- **Historical red evidence, now fixed in local source:** `/workspace/.lumen-verification/dynamic-picker-2026-10-18/credential-boundary-red.mjs` reproduces two Gemini requests when the first is pending, keys change, then a 400 arrives. The old adapter retry reads the replacement key. Scoped cancellation and immutable snapshots are implemented with committed-intent regressions in `credential-boundary.test.mjs`, including summary fallback, key diagnostic/embedding bodies, suspended event delivery and early iterator return. The external original reproducer now passes.

## Risks and known gaps

- P01-D declarations remain unintegrated; do not claim add/remove UI or live propagation is complete.
- P07 comparison-stage helper is tested independently, but store retry closures and synthesis integration remain unfinished.
- P08 review confirmed clean transport EOF without provider completion markers can incorrectly mark partial output successful; an implementation patch and red tests are being prepared outside tracked source.
- Discovery/API compatibility metadata is incomplete. Missing data must remain unknown, distinct from explicit false.
- Existing provider billing/relay constraints must survive improvements. Do not implement arbitrary server proxy URLs.
- General stage/DAG workflows are not implemented; saved layouts currently mean Auto/order model sets.
- Real-model answer-quality evaluation and physical iPhone testing have not been performed.

## Commands/environment

Working directory `/workspace/Lumen`. Node22 activation: `PATH=/workspace/.lumen-tools/node_modules/node/bin:$PATH`.

```
npm test
npm run build
NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs npm run test:e2e -- auto-intelligence layout-builder context-recovery providers multi-provider
MR_WEBKIT=1 NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs npm run test:e2e -- auto-intelligence layout-builder context-recovery
```

Existing test browser preloads live outside the repository. Hosted tests require the hosted preload. Do not disable TLS verification in product code or setup downloads. Runtime configs/secrets must never be logged.

## Exact next action

Inspect final layout logs; commit/push the verified P04 + credential/health boundary milestone. User declarations: new `ai/model-declarations.js` has 12 focused tests; required Cloudflare `accountId` is part of declaration identity. New `ModelDeclarations.tsx` is being prepared by the declarations agent (new file only). Root must add types, raw-catalog/derived merge publication, updateSettings live propagation, Settings integration and browser tests (draft at `/tmp/lumen-declarations-test.cjs`). New `comparison-stage.ts` has 11 focused tests but needs store/UI integration with explicit failed-slot retry and shared synthesis routing. P08 streaming patch is being prepared by credential_review under `/tmp`, with red tests outside repo. Continue helper eligibility, typed recovery/discovery invalidation, metadata UX, performance/security review, full CI and release. Main/live remain unchanged.

## Manual tests for the implemented checkpoint (when preview is deployed)

1. Settings → Models → Routing priority: choose Quality, Speed, Cost in turn and send a short prompt in Auto. Open Why this model; choices reflect eligible available models and honest price/quality uncertainty. A request to use the cheapest model overrides a saved Quality priority.
2. Disable automatic switching, select a text-only model, then ask about an attached photo. Expect an actionable compatibility error and no replacement request. Select an image-capable model and resend; it should work.
3. Exclude every saved model from Auto. Expect a clear error with a Settings recovery path. Manually selecting an excluded compatible model still works.
4. Open a saved chat and immediately type; the first input must remain. Switching between chats must restore each chat's own draft.
5. While editing/browsing models, refresh. Search text, layout assignments and explicit default remain. A temporary provider failure keeps same-scope metadata; rejected credentials remove it until corrected.

## Current continuation evidence (2026-10-18)

- `contracts-unit.log`: all units/type checking passed; build passed. Eight Chromium suites passed with a multi-provider retry caused by clicking an auto-expiring toast while it exited. The fixture now waits for automatic dismissal. Six WebKit suites passed without retry.
- `checkpoint-unit.log`: 55 unit files/type and build passed. Five Chromium suites passed cleanly (106s). Three-suite WebKit run failed only navigation's localhost Firestore emulator request in a preview-only fixture (not a product exception); its unnecessary default `?emulator` was removed. Do not call that run green.
- Review found a real saved-requirements race: metadata downgraded an eligible backup after planning. `layout-runtime-requirements.test.ts` observed two requests before the fix, then only the compatible primary. Shared `modelRequirementsProblem` now checks saved constraints at planning and every attempt, including canvas; independent reviewer approved the fix after focused capability/context/reasoning downgrade cases.
- `layout-final-*` are the new full unit/build and Chromium/WebKit verification logs after the above fixes. Read their actual outcomes before making a completion/commit claim.
- Inspected phone WebKit layout-editor screenshot: requirements use the existing disclosure/fields, checkbox labels now fit and remain visible. No layout token or welcome/composer redesign.
- Premium static audit executed from downloaded installed skill script (`/tmp/lumen-premium-audit.py`) and saved `premium-audit.json` outside repo: 33 inherited app-wide findings (11 undocumented native-control ownership decisions and 22 form/textarea contract findings). This is unfinished P09 audit evidence, not a clean audit. Inspect actual findings; prioritize touched model flows and document established native-select ownership. No product UI compliance claim made.

Additional manual tests for this milestone:

6. Build a layout requiring 200k context; edit its priority and choose “Only models in this layout.” Reopen it after refresh/reload: constraints and assignments must remain; an incompatible assignment is explained and cannot be used as a backup.
7. Choose “No automatic fallback” for an ordered layout. If its first model fails, expect an error; a working second model must not run. Re-enable layout-only fallback and verify the configured order.
8. While a reply or summary is pending, replace/remove provider keys. Expect the old operation to stop without retrying with the replacement key or adding old text. Send a fresh prompt afterward with the new connection.
9. On a phone, select a saved chat and immediately type. The first input must stay in that selected chat; the sidebar should still close smoothly.
10. Switching accounts or provider endpoints must start separate reliability/latency history. Returning to the original account restores only that account/configuration’s prior observations.

## Verified milestone result

- `layout-final-unit.log`: all 56 then-present workspace unit files/type checks passed; build passed. `layout-final-chromium.log`: four suites (layout-policies, Auto intelligence, multi-provider, message-navigation) passed without retries (102s). `layout-final-webkit.log`: three suites passed (196s), but navigation retried due an uncaught optional Markdown stylesheet preload failure; this result is not retry-free.
- Deterministic `markdown-recovery.cjs` reproduced that real optional-loader error before the fix. `loadMarkdownExtras` now catches optional import failures, keeps readable source/code, and allows a normal reload to restore formatting. No automatic reload or discarded reply.
- Final `milestone-final-unit.log`: all 58 workspace unit files/type check passed (includes four unintegrated modules and their tests: declarations, comparison-stage, helper-routing, recovery). `milestone-final-build.log`: production build passed. `milestone-final-chromium.log`: formatting-recovery suite passed (3s); `milestone-final-webkit.log`: formatting recovery + five-viewport navigation matrix passed without retries (44s). No source changes after these checks except docs/CI suite selection.
- New standalone `helper-routing.ts` and `recovery.js` have focused green tests, remain unintegrated. Agent completion reports are not end-to-end feature completion.
- P01-D integration must collect explicit API-denied model IDs before filtering and persist `Catalog.deniedModelIds` in scope-bound cache. Otherwise unlisted declarations can resurrect an API-disabled model after reload. Also reject explicit streaming:false for streaming calls while permitting one-shot helpers.
- P07 comparison regression suite is being prepared as a new file only. Public modal gets Stop plus per-card Retry this model; snapshot account/key/privacy/instruction validation gets unit tests rather than a test-only store backdoor.

## Latest continuation: local undeployed implementation and exact tasks

These changes exist in the working tree; they were NOT in merged PR19:

- New `ai/model-declarations.js`, ModelDeclaration types, `ModelDeclarations.tsx` in Settings, raw discovery vs derived publication, live add/edit/remove, endpoint/Cloudflare-account scope, explicit API denial tombstones persisted in scoped caches, provenance/unchecked labels, streaming:false guards. Chromium declaration+catalog lifecycle suites passed (18s) before later runtime/helper integration. Screenshot inspected at390px. New declaration-registry unit passes, including auth/denial/cache/removal and one-shot vs stream eligibility.
- New `ai/recovery.js` and classification/decision tests; runChat + summarize consume classified failures. Invalid local video input/HTTP422 stops,402 account credits skips sibling provider models without model-health penalty. Inference error messages redact actual key strings. Some older one-letter synthetic test keys were changed to realistic distinct strings because redaction correctly removed their ordinary letter occurrences.
- Scoped provider metadata invalidation: registry.expire(provider), max one invalidation/provider/minute, stale state/targeted refresh, no recursive inference. catalog-refresh lifecycle listens for mr:model-metadata-invalidated; store callback marks provider nextRefresh0. Focused metadata-invalidation unit passes.
- Live registry membership overrides old request snapshots: `isModelRegistered` blocks a model removed between planning and failover. Red→green runtime-registry-removal test passes. Request metadata still supports an uncatalogued short-text last resort only before a current catalog has been published.
- P08 semantic completion: strict provider completion markers, incomplete/malformed prefinish stream detection,100ms absolute trailing-usage drain, no replacement after visible text. Patch from `/tmp/lumen-stream-completion.patch` is APPLIED; regression copied into tests/unit/stream-completion.test.mjs. Focused stream, credential, reroute33 and search runtime checks pass. New optional maxTokens propagates/clamps to known outputLimit across adapters and survives Gemini thinking-parameter retry; complete clamps to reported output maximum. output-budget unit passes.
- New helper-routing.ts with11 focused tests, including nonstreaming one-shot allowance. RouteInput.streaming distinguishes streamed chat from one-shot helpers. Store summary/title/research/writing/study helpers now use shared current enabled/scoped routing instead of hardcoded Gemini IDs; this LAST integration has not been fully checked.
- P07 comparison-stage.ts and comparison-snapshot.ts + focused tests. `/tmp/lumen-comparison-integration.patch` is APPLIED. Store has immutable private request/restore closures, explicit failed/stopped-slot retry, independent source successes, derived synthesis invalidation, current metadata/context validation, bounded comparison2–3 parallel calls, shared helper-routed synthesis only over successful selected IDs, Stop and per-card Retry UI, and visible partial errors. Root added store policy subscription to abort active comparison/synthesis if privacy/instructions/context changes, preventing old-context fallbacks. New browser suite comparison-recovery.cjs has NOT run yet.

Current verification and remaining work (supersedes older pending statements above):

1. Full `recovery-full-unit.log` and build passed, including all 65 workspace unit files. Gemini token-count errors and model-specific403 variants now classify correctly. Two unused TypeScript declarations were removed.
2. First Chromium integration run passed comparison-recovery (all8 phone/desktop scenarios), context-recovery, providers and deep-research; combine failed because its fixture omitted a context limit while demanding an8192-token synthesis allowance. The fixture now explicitly supplies128k; unknown-context guards remain strict.
3. Declaration focus regression reproduced Save focusing a disabled Add button and Escape closing Settings. Postcommit focus restoration and ancestor-aware local Escape ownership fix both. Current browser rerun must pass before release.
4. Added red→green runtime registry regression: summaries and titles could call a backup removed during the primary request. Both now recheck current membership; summaries recheck context/streaming:false eligibility. Titles use shared classified one-shot recovery, bounded256 output and10s total deadline instead of bypassing the recovery classifier.
5. Added real browser red regression: an interrupted deep-research search with partial notes was marked done and included in the report. Search stages now mark errors/interruption failed, omit incomplete notes/sources, and reportBrief/numberSources independently require completed stages. Final rerun pending.
6. `recovery-final-unit.log` and build pass after these fixes. Exec89916 completed: six Chromium suites (55s) and four actual WebKit suites (118s) passed without retries. Subsequent independent-review fixes require the newer recovery-reviewed-* rerun (exec35726, seven Chromium then four WebKit suites). Firebase emulators remain available.
7. P09 shared UX/keyboard/accessibility review and ownership documentation, P10 final security/performance review, P11 full regression/CI/architecture mapping remain. No physical-iPhone or real-model quality benchmark has been performed.
8. Source changes remain local/uncommitted on feat/model-picker-recovery, HEAD3be7307. Progressive-release policy is merged and production remains02c322. Next after green checks: review complete source diff, update these docs, commit/push coherent source milestone, open PR, require full current CI and evaluate immediate release. Do not wait for unrelated final audit work when this milestone is independently ready.

Local Firebase emulator setup recovered without changing HOME or disabling TLS:

`PATH=/workspace/.lumen-tools/node_modules/node/bin:$PATH XDG_CONFIG_HOME=/workspace/.config FIREBASE_EMULATORS_PATH=/workspace/.cache/firebase/emulators CI=1 node_modules/.bin/firebase emulators:start --only auth,firestore --project the-model-router`

Active exec session64273 owns auth9099/firestore8080/hub4400; log firebase-emulators-local.log shows ready. First attempt failed only unwritable default /home/agent cache/config; use the above vars in future. Never run concurrent browser runners on5190. Last browser runner95072 completed; no browser runner active at this handoff update. New tests are uncommitted and full CI will discover them only after future source is verified/committed.

Progressive release evaluation: PR19 independently ready (complete green exact-head CI, scoped backward-compatible fixes, no dependency on local new modules, review accepted). Merged normally; deployment and live verification succeeded (see release verification below). Rollback: revert the PR19 merge via reviewed revert and deploy the last verified production revision, or redeploy the prior known-good main revision through the existing manual deployment workflow; never reset/force-push main. Deployment workflow builds a clean GitHub checkout and does not include local WIP.

## PR19 production verification (2026-10-18)

- Runtime source07efe214ef6c94aad2ddd7e29354eb3a4d9b1734 merged in PR19 at02c322da48368d6277e5eb8b599edfead7f92e0e. Deploy39157498252 completed successfully for that exact merge commit.
- https://lumen-chat.web.app/ served fresh assets. SHA256 evidence: store-BGs2kXdx.js `0866c1cc1ef81bd577dd1af9dc2d7406ad32e83a61fdcc6623a1f7e5932ab16a`; sync-b7Jnwgqx.js `93feb462277dfa7a565c247abed3e2d175f1364176bf979782fd4edba4e7190b`. Registry mr.catalog.v2 and health mr.modelRecord.v2 markers present. Full asset evidence is pr19-live-assets.json outside repo.
- Hosted Chromium: selection-policy, routing-priorities, layout-policies, catalog-lifecycle all passed without retries (37s). Hosted Linux WebKit: selection-policy and layout-policies passed without retries (62s). Tests use synthetic local guest accounts and mocked provider responses with actual live app assets; no paid inference or model-quality benchmark claim.
- PR20 merged the permanent deployment policy into main at4406c338be50528f1d516488d767e708d38e1664. It changed only AI_HANDOFF.md and IMPLEMENTATION_PLAN.md; no application redeployment is needed for that documentation-only commit. Source/master spec preserved.
- Deployed features: scoped registry/cache/lifecycle discovery, shared eligibility/manual intent, quality/speed/cost/balanced priorities, saved layout constraints/fallbacks, credential/request/health isolation, phone first-input race and optional formatting resilience. Undeployed: subsequent local declarations, typed recovery/expiry, helper rework, comparison-stage retry/synthesis and semantic stream-completion changes.
- Continue on feat/model-picker-recovery. This release does not complete the overall overhaul. Preserve all remaining phases and exact local blockers above.

## Recovery milestone manual test checklist

After its release (currently local only):

1. Settings → Models → Custom models → Add custom model. Add a valid model ID on a connected provider, supply only details you know, save. Expect Declared · unchecked, immediate picker availability, and no paid background probe. Reopen/edit/remove; saved fixed choices stay intact. Invalid limits show an inline error; Cancel/Escape returns focus to Add while Settings stays open.
2. Compare two enabled models. Stop while one is pending: finished answers stay readable. Retry this model resends only the stopped/failed slot; it must not restart successful cards. Combine uses completed selected models; Stop/failed synthesis retains sources, and another Combine retries only synthesis.
3. With automatic switching disabled, select a fixed model or ordered layout. Helpers must stay in that permitted pool; an incompatible/failed request must not silently use an unrelated provider. Re-enable layout-only fallback to permit only assigned backups.
4. Send a chat with a connection failure before output, then one interrupted during output. Before output an authorized eligible backup may answer; after partial output keep the partial answer with an error and an explicit retry. It must never silently splice another model's answer.
5. Run Deep research. If one search fails, completed searches still feed the report while failed partial notes/sources do not appear as completed research. Stop cancels remaining work.
6. Refresh/remove a model or replace a provider key while a request is pending. Old-key work must stop; models absent from the refreshed catalog must not receive fallback requests. Provider-wide invalid-key/credit errors should skip sibling models, without retry loops.

Mocks verify these failure paths deterministically; real provider failures require a controlled test connection. Never paste a production key into logs or test fixtures. Physical iPhone glass/touch behavior and comparative answer quality are not established by these tests.

## Independent review fixes (current source, not deployed)

Read-only review identified six further real edges, all reproduced before fixes:

- Logical finish arriving within the final100ms could become a false outer timeout during trailing usage drain. Adapters now notify the runner at semantic completion; answer/idle/total timers stop, while caller/key cancellation remains active. New final-deadline regression passes.
- Helpers checked layout requirements only when planned. `modelRequirements` now travels to summarize and is rechecked against fresh metadata on every attempt. Store scopedSummary/title guards preserve originating privacy/routing/context consent and reject old results after policy changes. Research requests carry the saved requirements. Three downgrade variants (context/vision/noReasoning) pass.
- Direct openStream error bodies were not cancellation-bound and errors were redacted after400-character truncation. Error-body reads now race the immutable scoped signal, redact using request configuration before truncation, and discovery/helper errors use the same boundary. Both deterministic direct-adapter regressions pass.
- An API-denied declared model could revive when a later list simply omitted it. Same-scope negative IDs now persist until an affirmative compatible API row clears them. Omission/restoration/cache/auth regression passes.
- Native Anthropic cumulative usage was double-counted; Cohere delta.usage.tokens was omitted. Compatibility adapters emit only positive cumulative deltas and include native Cohere counters. Native fixtures now count12input/5output exactly once.
- One-shot MAX_TOKENS/length output was accepted as completed summary context. It now reports output-limit, retains usage, and only tries authorized compatible backups with the same output budget. Both Gemini and compat regressions pass.

`recovery-reviewed-unit.log`: all68 workspace files and type check passed. `recovery-reviewed-build.log`: build passed. The latest added snapshot-policy assertions will run again in full CI. Current browser verification is recovery-reviewed-chromium.log / recovery-reviewed-webkit.log; inspect completion before committing/releasing. No inference quality/physical-device claim.

## Runtime checkpoint ready for GitHub CI

- Current branch feat/model-picker-recovery, base3be7307cb960b50d3c5bed90613608337b34405d. All implementation in this checkpoint is one coherent local milestone; no unrelated source WIP is included. Commit/push is the next operation. Latest merged main3be7307; latest actually deployed runtime02c322da48368d6277e5eb8b599edfead7f92e0e remains separate.
- Final `recovery-commit-unit.log`: typecheck and all68 unit files passed. Build passed. After the final adapter delivery guard, two Chromium suites (comparison recovery + context recovery,35s) and one WebKit suite (comparison recovery,53s) passed cleanly. An additional null-API-row guard passed declaration-registry afterward; full CI must cover exact committed source.
- Broader `recovery-reviewed-*`: seven Chromium suites passed without retries (82s), four actual WebKit suites passed without retries (137s). New adapter/probe tests then reproduced and fixed direct buffered delivery after key change and tiny-probe truncation; full68unit/build/focused browser rerun above covers those changes. Latest expanded snapshot/provider-boundary assertions also pass focused.
- Independent reviewer approved application paths after eight focused regression files; its remaining direct-buffer edge was reproduced/fixed too. No known blocking security/compatibility regression remains in this runtime milestone. Review did not run full/browser tests; those are root/CI evidence.
- Probe diagnostics retain numeric HTTP200+empty text on tiny-output truncation so the existing explicit512-token retry still runs. Helpers retain output-limit failure semantics and never store truncated compaction context. Native cumulative usage is counted once.
- Release evaluation: independently ready for CI review, backward-compatible optional settings/types and no server/rules/schema deployment. No dependency on unfinished P09 ownership/a11y/performance documentation. Required gates: full current GitHub CI, ordinary merge, Deploy workflow, hosted asset + core-flow checks. Rollback: reviewed merge revert and deploy last verified runtime02c322; no force/reset or branch-protection bypass.
- Remaining: P09 focused picker/layout/declaration/comparison accessibility/keyboard audit and durable control ownership; P10 measured performance/operational review (including output-budget revalidation after metadata shrink); P11 final requirement mapping, complete regressions and production validation. Real-model quality and physical iPhone remain explicitly unmeasured.

## Declaration automatic-probe follow-up

A clock-driven browser regression showed the existing weekly diagnostics would also probe newly enabled unchecked custom declarations. Automatic health checks now exclude declared IDs; explicit Check models and user-selected inference remain available. This honors the declaration metadata boundary without disabling existing API-discovered weekly checks. Red browser evidence declared-background-red.log; full68unit/type/build passed; Chromium declared-background + model-declarations passed (18s); actual WebKit declared-background passed. Added declared-background to required WebKit CI. This coherent follow-up is isolated on feat/model-picker-recovery in /workspace/Lumen-runtime-release; no local feat/model-picker-polish performance/UX work is included. Push it to PR22 and require fresh complete exact-head CI before release. Original MASTER_REQUIREMENTS.md unchanged; production02c322 remains the rollback/live reference.

Manual test: save a custom model, leave the app open through the weekly-check timer or reload. No automatic probe should be sent to that declaration. Open Check models and explicitly start a check: the declared model can then be tested using the existing small diagnostic request.
