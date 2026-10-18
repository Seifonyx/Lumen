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

## Current state — 2026-10-18

The overhaul remains **in progress**. The permanent policy above and complete MASTER_REQUIREMENTS.md remain active. Historical intermediate states are archived in [docs/history/MODEL_PICKER_2026-10-18.md](docs/history/MODEL_PICKER_2026-10-18.md); they do not override this ledger.

| State | Exact revision / evidence |
|---|---|
| Latest verified production runtime | `02c322da48368d6277e5eb8b599edfead7f92e0e`; Deploy39157498252 success, hosted assets plus4 Chromium/2 WebKit suites passed |
| Latest merged main | `3be7307cb960b50d3c5bed90613608337b34405d`; later PR20/21 changes are documentation only |
| Latest pushed runtime feature | `1c73895346f3c3ca72b8085a3ba88d6f78bbd10d`, feat/model-picker-recovery, PR22; remote SHA explicitly verified |
| Current root working branch | feat/model-picker-polish, HEAD1c73895; P09/P10 source/docs changes remain local, not in PR22 |
| Isolated runtime release worktree | `/workspace/Lumen-runtime-release`, feat/model-picker-recovery; no local polish source included |

## Exact next actions

1. Check full CI39160504107 on PR22 exact head1c73895. Type/build/unit and actual WebKit are green; full Chromium/Firebase is pending at this checkpoint. When every job passes, review the complete PR, normally merge with exact-head guard, dispatch Deploy on main, verify workflow SHA and hosted assets/core flows. Do not wait for unrelated polish.
2. P09/P10 final local checks and independent review are complete. Commit/push the coherent feat/model-picker-polish milestone, verify remote SHA, open its PR and require full CI on its own exact head. Do not rebuild dist under an active browser runner. The includeThoughts classification finding is fixed and approved.
3. Finish P11 requirement/mode/security/architecture validation using docs/MODEL_PICKER_VALIDATION.md. Release the independently safe polish milestone through the same workflow and verify actual production. Synchronize exact source/main/production hashes and manual steps. Do not claim overall completion before these gates pass.

## Implemented and released

PR19 https://github.com/Seifonyx/Lumen/pull/19 source07efe214ef6c94aad2ddd7e29354eb3a4d9b1734 passed full exact-head CI39136235729, then merged normally at02c322. No admin bypass/force push. Protection API inspection was403; ordinary GitHub merge enforcement remained enabled.

Released registry/selection/layout foundation:

- Account/key/endpoint scoped registry/cache, generation guards, native discovery/pagination, bounded concurrency4/attempt15s, retry/backoff/jitter/TTL/resume/online refresh and truthful metadata provenance/negatives.
- Shared eligibility/manual fallback consent, strict Auto exclusions, stable fixed/default choices, bounded unknown context8192, quality/speed/cost/balanced priorities, prompt overrides and honest unknown prices/family hints.
- Saved layout requirements/priority/fallback none/layout/enabled, global consent bound, fixed-order recovery and per-attempt chat/canvas requirement checks.
- Credential-scope cancellation across retries/helpers/embeddings/diagnostics; scoped health history, first-input/sidebar race fix, optional Markdown loading resilience.

Deploy39157498252 verified https://lumen-chat.web.app/ with fresh asset hashes/registry markers and hosted selection-policy, routing-priorities, layout-policies, catalog-lifecycle Chromium; selection-policy/layout-policies WebKit. Synthetic guest accounts and mocked providers use actual live app assets. Policy PR20 merged4406c338be50528f1d516488d767e708d38e1664; verification docs PR21 merged3be7307. Neither changes application runtime.

## PR22 runtime candidate — committed/pushed, not yet deployed

https://github.com/Seifonyx/Lumen/pull/22, commitsf0f7daf11a9160f0d2932e15c67933aafc62a388 and1c73895346f3c3ca72b8085a3ba88d6f78bbd10d:

- Scoped user-declared models, live add/edit/remove/validation/provenance, API/documented precedence, adapter ceilings, sticky API-denial tombstones, raw discovery separate from derived settings. Saving never probes; weekly automatic checks skip declarations, while explicit diagnostics/user inference remain available.
- Classified bounded recovery, terminal input/cancel stop, provider auth/billing/quota sibling skip, throttled metadata invalidation, fresh registry membership and saved layout requirements on every helper/chat fallback.
- Shared helper model pool and bounded title/summary/research budgets; no hardcoded disabled model injection. Research uses two search workers and excludes failed partial search notes/sources from final reports.
- Comparison2–3 frozen source slots, same-model failed/stopped retry only, successful cards preserved; synthesis uses only completed selected sources and respects fallback consent/snapshot privacy.
- Semantic stream finish vs interrupted EOF,100ms bounded trailing usage drain, no replacement after visible output, no late/buffered old-key adapter deltas. Error bodies remain cancellation-bound and redact before truncation. Native cumulative usage counted once; truncated helpers fail rather than become compaction context, while tiny diagnostic retry semantics remain intact.

Evidence: recovery-commit-unit/build (all68unit/type/build); broad recovery-reviewed Chromium7files82s/WebKit4files137s; final adapter Chromium2files35s/WebKit1file53s; declaration-probe unit/type/build +Chromium2files18s and WebKit1file clean. Independent review defects were reproduced and fixed. Earlier f0 CI39159741089 was cancelled after a justified new commit; it is not full CI evidence. Required current CI is39160504107.

Release assessment: optional backward-compatible settings/types, no server/rules/schema migration, no unfinished P09 dependency, credential/privacy/compatibility review complete. Full exact-head CI and actual merge/deployment/live verification remain mandatory.

## P09/P10 isolated polish milestone — local only

Relevant files: routing.ts, eligibility.js, chat.js, helper-routing.ts, providers.js/recovery.js, glass-select.ts/focus-scope.ts, ModelDeclarations.tsx, ComparisonResultsModal.tsx, app.css; corresponding unit/browser tests; UX-CONTRACT.md, premium-ui.json, docs/MODEL_PICKER_VALIDATION.md and synthetic benchmark runner.

- Routing caches family metadata/counts and bounds provider-diversity scans. Selection/order/explanations remain identical in144 root and512 independently reviewed complete-output parity cases. Synthetic Node22 CPU1000-model median Auto135.0ms→7.76ms/helper128.3→7.60ms;20-model calls roughly0.25–0.3ms. These are local CPU measurements, not provider latency/answer-quality claims. Reproduce with `node scripts/benchmark-model-picker.mjs`; fetch is blocked/counted and no inference is made.
- Picker refresh preserves query/focus; native/glass selectors expose canonical field names and own Escape/Tab correctly. Numeric metadata fields use shared styles and coarse-pointer44px targets. Comparison completion/error states are announced. Original phone welcome/composer and motion are preserved.
- Explicit reply allowances share eligibility and are rechecked after metadata shrinks before a fallback; known output caps remain clamped. Red→green test rejects a32k-character prompt plus8192reply after backup shrinks128k→16k.
- Gemini thinking adjustment now retries only identified unsupported thinking/includeThoughts parameters. Context/JSON/unrelated400 errors no longer repeat the same invalid request. The retry retains output limits/search consent and immutable credential scope. Old search-runtime fixture is now explicitly thinking-specific; generic generation errors have a dedicated no-retry regression.

Verification before final Gemini-only follow-up: polish-final-unit/build all68files/type/build; Chromium6files77s (accessibility/comparison/layout/priorities/selection/fit), WebKit3files72s (accessibility/comparison/layout), all clean without retries. New accessibility test covers phone390/desktop1280 light/dark, actualTTL refresh, keyboard, validation, axe and geometry;16 surface scans across engines. Inspected current WebKit phone-dark and Chromium desktop-light screenshots; numeric controls now consistent. Final `polish-reviewed-unit.log`: typecheck/all69 unit files pass. `polish-reviewed-build.log`: production build passes (existing ineffective dynamic-import warning only). Provider browser follow-up passes Chromium11s/WebKit11s without retries. Independent reviewer approves final Gemini classifier, scope, output/search preservation and fixtures; prior performance512-case parity/P09/output-budget approval remains valid.

Canonical owner map resolves11 unspecified native-control owners;22 inherited static form/textarea findings remain explicitly unclaimed and justified in UX-CONTRACT.md. Do not redesign unrelated forms or add inline tokens simply to silence the scan.

## Architecture and limits

- Extend existing browser provider adapters, shared registry, deterministic routing and bounded runtime. Preserve stable IDs, explicit choices, supported endpoint/account scope, optional saved fields and existing model-set layout semantics.
- Existing comparison and research graphs implement useful parallel/sequential/conditional dependencies and recovery; an arbitrary DAG editor is a separate product feature. No mandatory replacement of stable Auto/order saved layouts.
- Browser refresh runs while its runtime can execute; static hosting has no background inference scheduler. Unsupported arbitrary provider protocols are not invented.
- No physical iPhone/device-service or real-model comparative answer-quality benchmark was performed. Linux WebKit is an engine test. Provider mocks/CPU tests do not establish comparative answer quality or real-provider availability. Unknown metadata stays unknown.
- No known unresolved runtime security blocker in the reviewed milestone. Required full CI/live gates and final documentation/release synchronization are concrete release blockers, not grounds to erase original requirements.

## Commands, worktrees and verification artifacts

Use Node22: `PATH=/workspace/.lumen-tools/node_modules/node/bin:$PATH`. Run shell via workdir `/workspace` plus `cd /workspace/Lumen` if direct repository cwd transport fails. Logs/screenshots/benchmarks: `/workspace/.lumen-verification/dynamic-picker-2026-10-18/` and tests/e2e/out (generated, not committed).

```
npm test
npm run build
NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs npm run test:e2e -- model-picker-accessibility comparison-recovery layout-policies
MR_WEBKIT=1 NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs npm run test:e2e -- model-picker-accessibility comparison-recovery
node scripts/benchmark-model-picker.mjs
```

Never overlap browser runners on5190 or rebuild their active dist. Firebase emulators currently own9099/8080/hub4400 (session64273); use `npm run test:e2e` rather than emulator-spawning :ci while active. Setup: XDG_CONFIG_HOME=/workspace/.config and FIREBASE_EMULATORS_PATH=/workspace/.cache/firebase/emulators; do not repurpose HOME. Hosted tests use hosted-browser-preload.cjs plus MR_TEST_URL=https://lumen-chat.web.app/ and otherwise the same built-app test runner. Use runtime-release worktree's fixtures when verifying PR22, not later polish-only assertions.

Origin fetch refspec tracks main only; pushed feature refs may be absent locally. Use local branch refs or explicit fetch. Verify pushes using `git ls-remote`. After a failed dependent shell step stop; never let subsequent reset/restore discard dirty notes. An earlier documentation sync mistake was corrected and source/master preserved. GitHub artifact attach capability currently returns no handler; PRs exist and links above are authoritative. REST PATCH can update PR bodies if GraphQL edit is unavailable.

Normal release: all required exact-head checks → `gh pr merge N --merge --match-head-commit SHA` → Deploy workflow on main → verify run headSHA/success/live assets/core flows. Rollback via ordinary reviewed merge revert and known-good deployment; no force/reset/protection bypass. Runtime and documentation-only releases must stay distinguishable.

## Manual tests after release

1. Settings → Models → Add custom model on a connected provider. Save known metadata: expect Declared · unchecked and immediate picker availability. Edit/remove; saved fixed choices stay intact. Saving/reloading/weekly timer must not send an automatic diagnostic to a declaration; explicit Check models can test it.
2. Enter context0: expect a linked inline error and focus on the field. Phone inputs should be comfortably sized. Open Provider: its popup is named Provider; Escape closes only the dropdown, Tab continues to the next field. Cancel/Escape returns to Add while Settings stays open.
3. Open model picker, search and wait for/trigger catalog refresh: query/focus stay intact; arrows/Enter select, Escape returns to trigger. Repeat phone/desktop/light/dark.
4. Compare2models. Stop with one pending: finished answers remain. Retry only the failed/stopped slot. Combine uses completed selected sources; failed/stopped synthesis retains sources and can be retried independently. Status/error feedback remains available to assistive technology.
5. Disable automatic switching and select a manual model/fixed layout. Incompatible failures must not silently use unrelated providers. Layout-only fallback stays inside assigned candidates. Key replacement/model removal during pending work must stop old-scope calls/fallbacks.
6. A connection failure before text may use an authorized eligible backup; failure after partial text keeps partial output with an error/explicit retry, never a seamless replacement. Deep research excludes failed partial search notes. Context-shrink and precise provider400 paths have deterministic controlled-response tests; do not expose production keys to logs/fixtures.

No overall-completion claim until P11/fullCI/production gates and final synchronized ledger pass.

## Final local P09/P10/P11 source review

All applicable MASTER_REQUIREMENTS.md sections1–18 and browser execution modes are mapped in docs/MODEL_PICKER_VALIDATION.md. Source trace confirms Auto/manual/assistant/side-chat/tasks/canvas use shared streamChat→runChat; comparison/synthesis use immutable stage boundaries; helpers/research use scopedSummary/title plus shared selection/classification. Image generation, web reading, knowledge storage and GitHub calls are separate typed product operations and must not be rerouted as interchangeable chat models. Existing side-effect/approval controls remain authoritative. Optional settings preserve legacy layouts; no Firestore/relay/server schema deployment is required. No new foundational gap identified in this review. P11 remains incomplete until exact-head full CI, ordinary integration, production verification and final ledger synchronization.
