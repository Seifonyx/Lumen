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



## Permanent amendment: Project Continuum Version2.0

Read PROJECT_CONTINUUM.md at every continuation. It is the permanent user-approved continuation protocol (2026-10-19), supplementing the original full master and progressive deployment policy. Reuse IMPLEMENTATION_PLAN.md progress baseline v1 and its24 task weights; do not substitute a new agent's scoring.

Progress checkpoint: previous numerical estimate unavailable (no prior weighted baseline); first disclosed range80–85%; first baseline v1 **83%**; current **82% (medium confidence)**, earned82/100 and remaining18 weighted work after the evidenced P02-B reopening below. Approved feature scope unchanged; this is a methodology addition, not new feature scope or fabricated historical progress. Current phase: PR22 full-CI helper/title regression repair, then isolated PR23 polish/current CI and P11 release/production synchronization. Evidence/credit rules are in the plan. Report previous/current progress, change, confidence, phase, verified work, remaining work, Git/main/production states and exact next milestone at session start/end. Recalculate using unchanged weights after meaningful evidence changes.

## Read first

Read MASTER_REQUIREMENTS.md, IMPLEMENTATION_PLAN.md, this file, Git status/log, then inspect the relevant source. This file supersedes the stale task-status paragraphs in HANDOFF.md for this overhaul; retain its user preferences and environment guidance.

## Current state — 2026-10-18

The overhaul remains **in progress**. The permanent policy above and complete MASTER_REQUIREMENTS.md remain active. Historical intermediate states are archived in [docs/history/MODEL_PICKER_2026-10-18.md](docs/history/MODEL_PICKER_2026-10-18.md); they do not override this ledger.

| State | Exact revision / evidence |
|---|---|
| Latest verified production runtime | `02c322da48368d6277e5eb8b599edfead7f92e0e`; Deploy39157498252 success, hosted assets plus4 Chromium/2 WebKit suites passed |
| Latest merged main | `3be7307cb960b50d3c5bed90613608337b34405d`; later PR20/21 changes are documentation only |
| Latest pushed runtime feature | `9b174584bd21a00af2ee78c2811193e18d71f9fa`, feat/model-picker-recovery, PR22; remote SHA explicitly verified, fresh full CI39196403013 pending |
| Latest polish source / root working branch | `ca9d50c4951814857b1e55a7bb56bdf89957e1b6`, feat/model-picker-polish, PR23; pushed and exact remote SHA verified. Only subsequent ledger updates are local. Not in PR22. |
| Isolated runtime release worktree | `/workspace/Lumen-runtime-release`, feat/model-picker-recovery; no local polish source included |

## Exact next actions

1. Check fresh full CI39196403013 on PR22 exact head9b174584bd21a00af2ee78c2811193e18d71f9fa; earlier39160504107 failed6/98 Chromium suites and is superseded. When every job passes, review the complete PR, normally merge with exact-head guard, dispatch Deploy on main, verify workflow SHA and hosted assets/core flows. Do not wait for unrelated polish.
2. P09/P10 source committed/pushed atca9d50c4951814857b1e55a7bb56bdf89957e1b6, exact remote SHA verified, PR23 https://github.com/Seifonyx/Lumen/pull/23. Require full CI39161870338 on that exact head; type/build/unit green, both browser jobs pending. Only ledger notes are now local. Do not rebuild dist under an active browser runner. The includeThoughts classification finding is fixed and approved.
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

## P09/P10 isolated polish milestone — committed/pushed, PR23 CI pending

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

All applicable MASTER_REQUIREMENTS.md sections1–18 and browser execution modes are mapped in docs/MODEL_PICKER_VALIDATION.md. Source trace confirms Auto/manual/assistant/side-chat/tasks/canvas use shared streamChat→runChat; comparison/synthesis use immutable stage boundaries; helpers/research use scopedSummary/title plus shared selection/classification. Image generation, web reading, knowledge storage and GitHub calls are separate typed product operations and must not be rerouted as interchangeable chat models. Existing side-effect/approval controls remain authoritative. Optional settings preserve legacy layouts; no Firestore/relay/server schema deployment is required. No new foundational gap identified in this review. P11 remains incomplete until exact-head full CI, ordinary integration, production verification and final ledger synchronization. Final independent requirements/applicability review accepted: source matches documented manual/layout/helper/comparison/research/partial-output/side-effect boundaries; five focused recovery/helper/provider/stream/declaration suites reran successfully. This is source-review evidence, not CI/production or real-provider quality evidence. PR23 sourceca9d50c is pushed; subsequent ledger-only notes remain local to avoid cancelling an unchanged-source CI run, and will be synchronized through a documentation-only PR after release.

## Authoritative runtime follow-up integration

PR22 source9b174584bd21a00af2ee78c2811193e18d71f9fa is committed/pushed/exact remote verified; current full CI39196403013 is running. Old1c73895 CI39160504107 failed6/98 Chromium suites. PR23 ca9d50c4951814857b1e55a7bb56bdf89957e1b6 CI39161870338 was cancelled due inherited failures. Root feat/model-picker-polish is integrating9b17458 now; both source intents and permanent protocol/baseline are retained, with new combined checks/CI required. No new runtime has merged/deployed; main3be7307 and verified production02c322 remain distinct.

Fixes: titles snapshot first input/consent and survive automatic file continuations; first-input/deletion/privacy/routing/model/assistant/project/memory/autoTitle and account/key changes still invalidate. Failed/completed title attempts and real tokens report once; same-key Stop counts, old-key publication remains suppressed. Original credential assertions unchanged. Four successful-helper fixtures supply128k context; unknown8192/output-budget guards remain strict. Usage counts2 OpenRouter replies plus1 enabled title in pool3/50 with47remaining; manual Gemini1 and actual tokens. Preview-guest IDs/no emulator query remove accidental shared-emulator listeners. SelectionTools now checks an existing selection on lazy mount; held-chunk browser regression proves oldsource missed it.

Runtime local evidence: pr22-followup-unit/build all68/type/build pass; affected Chromium6suites clean32s; final fresh-page writing fixture Chromium passed and four actual WebKit guest suites clean17s (pr22-selection-final-*). Independent review accepted source/scope/accounting/selection/guest fixtures and24task/100weight/83earned baseline; progress checker executes in CI. Optional real-auth WebKit coding/usage emulator expansion failed models loading after key save and needs diagnosis while CI runs; not claimed verified. SaveApiKeys awaiting Firestore acknowledgement and emulator cross-origin errors are diagnostic leads, not a proven production regression.

Next: finish merge resolution, verify combined69unit/type/build/targeted Chromium+WebKit, commit/push PR23 and exact remote verify; require fresh full CI. Diagnose optional emulator failure independently, then normal merge/Deploy/hosted verification for each safe milestone. Preserve original master, Project Continuum, weighted83% baseline and permanent progressive-release policy. No speculation or skipped mandatory failures.

## Current verification and next reliability task

Resolved source merge: runtime9b17458 +polishca9d50c, no discarded source or protocol. Combined69unit/type/build pass;8 Chromium suites clean38s and3 actual WebKit clean63s (polish-merged-*). Commit/push the resolved merge to PR23 now; require its fresh complete exact-head CI. PR22 exact9b174584bd21a00af2ee78c2811193e18d71f9fa current CI39196403013 remains running.

Previous83% → current82% (medium; unchanged weights/scope), remaining18. P02-B reopened from1 to0.75 due a newly identified preexisting unbounded Firestore-ack wait blocking local key activation/discovery and subsequent/account saves. SDK contract and independent source review confirm risk; actual WebKit emulator errors are a trigger candidate, not proof of a production-specific regression. Next: reproduce blocked Write/channel with provider network still available in Chromium, then separate local immutable save/ordered SDK submission from remote acknowledgement, preserving latest/account/credential/removal/order and honest sync feedback. Cover stalled save, rapid replacement, removal and account switch. Use the clean existing policy-release worktree on a separate feature branch; do not mutate PR22 release worktree or include this unverified task in releases. Keep PR22/23 progressive CI/merge/Deploy/hosted verification moving independently.


## Current verified preview-isolation checkpoint — 2026-10-19

PR22 head9b174584bd21a00af2ee78c2811193e18d71f9fa full CI39196403013 failed required WebKit: ask-chats/study functional assertions passed, but preview quota startup contacted Firestore and the deliberately isolated guest fixture correctly reported unhandled CORS errors. No merge/deploy occurred. A request-count regression reproduced2 unauthorized guest cloud requests (preview-quota-clean-red.log); startup now skips shared cloud quota for preview accounts. Authenticated quota behavior is unchanged. No error filters, skipped tests or weakened assertions.

Current exact-source local evidence: preview-quota-unit.log typecheck/all68unit files passed; preview-quota-build.log build passed; preview-quota-chromium.log ask-chats/study/usage3 suites passed clean17s; preview-quota-webkit.log ask-chats/study2 suites passed clean9s. Independent credential review accepted the guard and actual-request assertion. New source files: src/store.ts and tests/e2e/ask-chats.cjs. Commit/push this verified milestone and require fresh complete exact-head CI before normal merge/deploy/live verification. Rollback remains reviewed revert + deployment of02c322da48368d6277e5eb8b599edfead7f92e0e. Latest main3be7307cb960b50d3c5bed90613608337b34405d and latest verified production02c322 remain unchanged.

Progress baseline v1 remains100weights. Previous83% → current82% (medium confidence),18remaining: P02-B reopened from1 to0.75 after deterministic blocked-Firestore-write testing proved the preexisting saveKeys acknowledgement wait prevents local catalog activation. Isolated feat/model-picker-key-save work in /workspace/Lumen-policy-release owns that fix; it is not included here or a newly introduced PR22 dependency. Do not mark it complete until integration/recovery tests pass. Next: fresh PR22 CI, integrate this guard into PR23, finish isolated key-save recovery, then normally merge/deploy/live-verify independently green milestones. Preserve MASTER_REQUIREMENTS.md and permanent Project Continuum/deployment policies.

Manual test: open a local guest account, search saved chats or create Study cards, then reload. Both remain usable without a cloud-account request; normal signed-in usage counters must still synchronize. For key saves (fix pending), reproduce only with synthetic keys and a controlled blocked network; never log real credentials.


## Latest combined polish checkpoint — 2026-10-19

Integrates runtime8ade00b03a295d97d3f42ad920c7c7559496dcff into polish42fbbf6237ec23c086d03b0037f007867a74580a, preserving the82%/18remaining baseline and both implementation intents. Only handoff/plan conflicts required manual resolution; full original master is unchanged. Current combined typecheck/build pass (polish-preview-type/build.log); Chromium ask-chats/accessibility2 suites and actual WebKit ask-chats/accessibility2 suites pass without retries (polish-preview-chromium/webkit.log). Earlier PR23 CI39196739047 WebKit failed the same preview cloud request and is superseded, never counted as green. Push this merge and require fresh full exact-head CI. PR22 fresh CI39197805965 on8ade00b is pending; main3be7307 and verified runtime02c322 remain unchanged. New key-save WIP is isolated in feat/model-picker-key-save and not part of either release candidate.


## Final provider-accounting fixture checkpoint — 2026-10-19

PR22 exact8ade00b fullCI39197805965 completed: type/build/68unit and allrequired WebKit green;97/98 Chromium files passed, providers.cjs failed both attempts (1030s total). No merge/deploy. The provider fixture returned SSE to a nonstream title request and still expected only the reply to be counted. Actual accounting correctly included the failed Groq title and its authorized Gemini fallback. Updated only tests/e2e/providers.cjs: real nonstream JSON title shape with12input/3output, assert exactlyoneGroq title (no unintended fallback), Groq2requests52input/7output and Cerebras1request30input/3output. Existing provider/key/discovery/thinking/reset/error assertions remain. Independent review approved stronger accounting/consent assertions. Clean red provider-accounting-clean-red.log; corrected providers+usage two Chromium suites clean26s in provider-accounting-green.log. No application source change. Commit/push and require complete new exact-head CI; propagate test correction toPR23/24 without including unfinished final recovery source.

Source22 remains independently release-ready pending that gate, with main3be7307 and verified production02c322 unchanged. New ROOT feat/model-picker-final-recovery based8f4a02c holds separate uncommitted final P02-B settings durability and P06-B Canvas/helper caller repairs; do not include them in22/23/24. Weighted baseline remains82%/medium/18remaining; no arbitrary rescoring. Preserve master/protocol/policy.
