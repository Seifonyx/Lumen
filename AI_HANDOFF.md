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

Progress checkpoint: previous numerical estimate unavailable (no prior weighted baseline); first disclosed range80–85%; first baseline v1 **83%**; current **88% (medium confidence)**, earned88/100 and remaining12 weighted work after the evidenced P02-B reopening below. Approved feature scope unchanged; this is a methodology addition, not new feature scope or fabricated historical progress. Current phase: P11 exact-head CI, independent final architecture review and progressive production releases of PR22/23/24. Evidence/credit rules are in the plan. Report previous/current progress, change, confidence, phase, verified work, remaining work, Git/main/production states and exact next milestone at session start/end. Recalculate using unchanged weights after meaningful evidence changes.

## Read first

Read MASTER_REQUIREMENTS.md, IMPLEMENTATION_PLAN.md, this file, Git status/log, then inspect the relevant source. This file supersedes the stale task-status paragraphs in HANDOFF.md for this overhaul; retain its user preferences and environment guidance.

## Current state — 2026-10-19

The overhaul remains in progress:82%/medium,18weighted work remaining. Current source checkpoints are committed/pushed and clean; this subsequent operational ledger update is local documentation until the final synchronization commit. Historical paragraphs below describe earlier checkpoints and do not override this table or the latest appended evidence.

| State | Exact revision / evidence |
|---|---|
| Latest verified production runtime | `02c322da48368d6277e5eb8b599edfead7f92e0e`; Deploy39157498252 success, hosted assets plus4 Chromium/2 WebKit suites passed |
| Latest merged main | `3be7307cb960b50d3c5bed90613608337b34405d`; PR20/21 documentation only |
| Runtime candidate | `8ade00b03a295d97d3f42ad920c7c7559496dcff`, feat/model-picker-recovery, PR22, pushed/exact remote verified; CI39197805965 unit/build +WebKit green, Chromium pending |
| Polish candidate/root branch | `84481f494c2583687ff3bd496ebe28c79f12d183`, feat/model-picker-polish, PR23, pushed/exact remote verified; CI39197921656 unit/build +WebKit green, Chromium pending |
| Key-save candidate/current local source | `8f4a02ce3380a6dca6034cd769314dd2777d1447`, feat/model-picker-key-save in /workspace/Lumen-policy-release, PR24, pushed/exact remote verified; CI39198665763 pending, type/build/unit green |
| Isolation | Runtime in /workspace/Lumen-runtime-release; polish in /workspace/Lumen; key source in /workspace/Lumen-policy-release. No unfinished source is included in another candidate. Two named owned stashes are backups of already recovered ledger/WIP, not hidden implementation. |

## Exact next actions

1. Wait for full exact-head CI on PR22, inspect complete results (including retries), normally merge with matching-head guard, serialize Deploy on main, verify workflow SHA and hosted assets/core flows. Do not treat two green jobs as full CI or postpone this safe release for PR24.
2. Integrate/release PR23 after PR22 and all its exact-head checks pass. Confirm its diff contains only intended polish plus tested runtime ancestry. Verify actual production separately.
3. PR24 repairs stalled key activation/reload/re-auth/denial and quota lifecycle; require all72unit/full Chromium +required WebKit CI, ordinary main integration, actual Deploy and hosted tests. Optional authenticated WebKit emulator CORS failures remain honestly documented below.
4. Finish P11 architecture/requirements review and final regression/deployment ledger; recalculate using unchanged v1 weights. Update this table with exact main/production/source states and commit/push/merge final docs. No100% before mandatory gates pass. No paid inference or physical-device claim.

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


## Active isolated key-save task (2026-10-19)

Current branch feat/model-picker-key-save in /workspace/Lumen-policy-release, advanced from production-equivalent3be7307 to latest integrated source42fbbf6237ec23c086d03b0037f007867a74580a after reproducing the preexisting defect. Root PR23 remains42fbbf6, PR22 remains9b17458; neither newly merged/deployed. Weighted baseline82%/medium remains unchanged, P02-B reopened,18remaining. Test-only key-save-resilience.cjs is currently local/uncommitted. No source implementation yet.

Clean blocked-write Chromium red proof on3be7307: key-save-clean-red.log fails only the model-availability wait while Firestore Write/channel is deliberately held; the new key is already present in its own local account cache and provider networking is mocked available. Earlier first diagnostic had a missed request-wait fixture and is not the clean proof. Fire-and-forget alone is insufficient: stale remote reads/reload can overwrite a pending local credential. Implement a small per-account pending revision within existing account cache, immutable normalized key snapshots, ordered SDK enqueue independent of ack, matching-revision-only ack cleanup, fresh-local overlay over stale reads, current-auth-only deduped replay on auth/online/reload, and permission-denied before cached fallback. Preserve UID/save-generation/credential removal and post-discovery guards; distinguish local storage failure from durable save in UX. Test stalled write, replacement/late ack, stale read/reload, removal, account switch, reconnect dedupe and authorization denial. No generic job framework or unrelated settings migration.

Before implementation, runtime PR22 newWebKitCI failed ask-chats/study due preview accounts still starting shared cloud quota reads. That separate release-blocker is being fixed on isolated runtime-release, then integrated into PR23; do not include local key-save WIP in either release. Continue full CI and progressive deployments after all gates pass. Actual latest production02c322da48368d6277e5eb8b599edfead7f92e0e and main3be7307cb960b50d3c5bed90613608337b34405d remain separate.


## Verified isolated P02-B recovery checkpoint — 2026-10-19

Branch feat/model-picker-key-save, base84481f494c2583687ff3bd496ebe28c79f12d183 (latest pushed PR23). This coherent milestone is locally verified and ready for commit/push/new PR; it is NOT part of PR22/23 or deployed. Full original master hash45abb59dc9cf8c3d06d8ce16370a732b2170f248 equals origin/main verbatim. Baseline v1 remains82%/medium,18remaining; P02-B earns0.75 until complete exact-head integration verification.

Implementation: src/lib/account-key-persistence.ts separates synchronous durable normalized/immutable account-key snapshots from SDK acknowledgement; SDK receives writes in invocation order, without a blocking global queue. Cache-only revision/pending markers protect replacements/removals/late acknowledgements and stale reads, including acknowledgement/read races. Matching UID/auth-session/revision guards prevent late denials from revoking a new session. Auth/online/transient-read recovery resumes pending latest writes once; SDK owns transport retries. Permission denial precedes cache fallback, clears the account cache, blocks replay and cancels/clears active credentials. Only server-confirmed reads restore denied access. readAccount now includes auth session in deduplication: independent integration test reproduced an old same-UID rejection leaking into a new session. Local storage failure remains an explicit failed save. No server schema/rules migration or new dependency; revision fields never leave device storage.

src/store.ts activates the saved immutable keys without awaiting cloud ACK, guards publication after discovery, and no longer blocks account transitions on quota.flush. src/lib/quota.ts guards asynchronous reads/startup/flush by lifecycle generation/day/ref: stopped accounts cannot revive timers or publish stale totals; same-day shared project costs remain retained internally, previous-day failures cannot pollute reset counters. SettingsModal text distinguishes local durability from later cloud sync. New tests: account-key-persistence.test.ts (15), account-key-integration.test.mjs (6), quota-lifecycle.test.mjs (8), key-save-resilience.cjs.

Evidence: key-save-clean-red.log reproduced the original activation stall on production-equivalent3be7307; key-save-switch-clean-red.log reproduced account-switch quota ACK stall after first local-save fix. Pure permission-denial and same-UID cache tests were red before source changes; quota initial6 failures and additional same-day-cost red are fixed. Current key-save-final-unit.log typecheck/all72unit files passed; key-save-final-build.log production build passed; key-save-final-chromium.log5 suites (key-save-resilience, usage, coding, catalog-lifecycle, model-declarations) passed clean40s; key-save-final-webkit-guest.log3 actual WebKit suites (catalog-lifecycle, model-declarations, accessibility) passed clean35s. Independent review accepts final source/persistence/quota/session boundaries and independently passed focused tests.

The optional authenticated WebKit blocked-write run completed save/replacement/reload/account-switch/reconnect/removal functionality but FAILED strict pageerror=[] on Firebase emulator WebChannel CORS errors (key-save-expanded-webkit.log). It is not a green run, physical iPhone proof, or a reason to suppress errors. Required real-auth Chromium coverage and required guest WebKit remain unchanged. Early expanded fixture lacked emulator-admin authorization on its independent REST assertion; corrected to the repository's existing Bearer owner emulator-only pattern, with exact persisted-value assertion unchanged. One attempted suite name catalog-settings did not exist; runner rejected it before tests; corrected final5-suite run above is the evidence.

Current separate states: main3be7307cb960b50d3c5bed90613608337b34405d; latest verified production02c322da48368d6277e5eb8b599edfead7f92e0e /Deploy39157498252. Runtime PR22 head8ade00b03a295d97d3f42ad920c7c7559496dcff CI39197805965: unit/build and WebKit green, full Chromium pending at this checkpoint. Polish PR23 head84481f4 CI39197921656 pending. Never infer deployment from these local checks or pushed heads. Rollback: ordinary reviewed merge revert + known-good Deploy; no destructive migration. Next: commit/push this verified milestone and open PR; require fresh full CI, release22/23 independently as each clears gates, serialize deployments and verify actual live assets/core flows, then release this key-save milestone and finish P11/ledger.

Manual tests after release:
1. Settings → API keys: disconnect network, change/save a key. It should save on this device without an endless spinner; reconnect and verify model discovery uses the new key and another signed-in device receives it.
2. Replace a key again before sync completes, then reload. The latest value must remain; an older cloud response must not restore the old key. Use only your own account and avoid exposing keys in recordings.
3. Remove a connected key and save. Its models must stop being eligible immediately and remain removed after reconnect/reload.
4. With account sync unavailable, sign out/switch accounts. Login must remain usable and another account must never inherit the pending key.
5. Existing custom-model/comparison/layout/recovery/accessibility test steps remain active. Actual permission revocation and stalled-write races are covered by controlled SDK/emulator tests, not manufactured provider failures on production.


### Additional P11 account regression evidence

Source8f4a02ce3380a6dca6034cd769314dd2777d1447 remains pushed/exact remote verified; subsequent changes are documentation only. key-save-auth-regression.log:7 Chromium files passed clean152s (account-isolation, account-sync, attachment-sync, quota, delete-account, privacy, tasks-sync), including quota batching/paused operation/Pacific reset, cross-device attachments, deletion, privacy masking and scheduled-task isolation. No retries. The phone390px actual WebKit save-feedback screenshot was inspected: hint wraps without overflow, save control remains visible, no page errors (key-save-webkit-phone.png). Source not changed after these checks. Fresh PR24 full CI39198665763 type/build/72unit green, browser jobs pending at this checkpoint. PR22/23 full Chromium also pending; neither new candidate merged/deployed. Keep82%/medium until current integration evidence changes credit. Permanent policy/protocol/master remain intact.


## Final provider-accounting fixture checkpoint — 2026-10-19

PR22 exact8ade00b fullCI39197805965 completed: type/build/68unit and allrequired WebKit green;97/98 Chromium files passed, providers.cjs failed both attempts (1030s total). No merge/deploy. The provider fixture returned SSE to a nonstream title request and still expected only the reply to be counted. Actual accounting correctly included the failed Groq title and its authorized Gemini fallback. Updated only tests/e2e/providers.cjs: real nonstream JSON title shape with12input/3output, assert exactlyoneGroq title (no unintended fallback), Groq2requests52input/7output and Cerebras1request30input/3output. Existing provider/key/discovery/thinking/reset/error assertions remain. Independent review approved stronger accounting/consent assertions. Clean red provider-accounting-clean-red.log; corrected providers+usage two Chromium suites clean26s in provider-accounting-green.log. No application source change. Commit/push and require complete new exact-head CI; propagate test correction toPR23/24 without including unfinished final recovery source.

Source22 remains independently release-ready pending that gate, with main3be7307 and verified production02c322 unchanged. New ROOT feat/model-picker-final-recovery based8f4a02c holds separate uncommitted final P02-B settings durability and P06-B Canvas/helper caller repairs; do not include them in22/23/24. Weighted baseline remains82%/medium/18remaining; no arbitrary rescoring. Preserve master/protocol/policy.


Verified propagation: the provider fixture correction passed in the combined polish source (polish-provider-build.log and polish-provider-green.log). PR23 latest pushed1793e4ac23d823ffa2cd056617ca63717776f931. This key branch merge includes the same corrected fixture plus the unchanged verified8f4a02c key-save source; no ROOT final-recovery WIP is included. Require fresh complete CI on the resulting head. Earlier PR23/24 runs inherit the known providers.cjs failure and cannot establish readiness.


## Verified guest-fixture authorization alignment — 2026-10-19

This PR24 follow-up changes ONLY test fixtures/helpers +documentation, never product authorization. Legacy profile/seed callers used logical IDs such as deep-research with emulator URLs; these IDs were not real preview users and the corrected explicit-denial path appropriately refused them. Shared preview-profile now normalizes logical IDs to preview- idempotently for BOTH account bootstrap and IndexedDB seed. Direct storage references in images/import-history/layout-builder and six manual screenshot helpers match the actual UID. Deep research uses truepreview/noemulator, matching DB identity, accessible Add control for either pointer mode and actual MR_WEBKIT engine selection. Real authenticated Firebase, invite-only, account-isolation and denial assertions are unchanged. No error suppression or skipped assertions. Independent review checked every profile consumer and caught/fixed six manual helper references; helper scripts pass syntax checks.

Exact unchanged product source is5f455debf264f16090b1727bbb943a2e20e477b7 (key-save8f plus prior verified runtime/polish). key-guest-scope-chromium.log5affected files pass clean30s (research/images/import/layout-builder/archive); key-guest-scope-webkit.log actualresearch passes clean8s. ROOT newer final-recovery source separately passed the same5Chromium33s plus4actualWebKit47s; it is not included here. Current CI39243179620 is superseded by this verified fixture correction and is not proof of readiness; require fresh complete exact-head CI after push.

Release ledger: PR22 source984b1a9 passedfullCI39199646064,98Chromium files904s clean +allrequiredWebKit, normallymerged3f48c6e02719b5f0c28be85e4c1e6e3cc2ef045b, Deploy39243260811 success +18liveassetmatches +hostedChromium4/WebKit2 clean. PR23 source1793e4ac23d823ffa2cd056617ca63717776f931 passedfullCI39199773200,99Chromium893s clean +allrequiredWebKit, normallymergeddab0fff854cc9657fd707b9e279c3bdb168bd64d, Deploy39243721175 success +18liveassetmatches +hostedChromium3/WebKit2 clean. Latest verifiedproduction/main isdab0fff. Previous3f48c6e is rollbackreference; no server/rules migration. ROOTfeat/model-picker-final-recovery holds LOCAL/UNCOMMITTED settings/layoutdurability +Canvas/helper/research repairs, independent of this release.

Weighted baseline unchangedv1/100:82→88% (medium),12remaining. P01-D/P03-A/P05-B/P08-A now fullcredit after PR22 completeCI/main/live verification (+4.75); P09-A/P10-B after PR23 fullCI/main/live (+1.25). Remaining requirements/caller/settings/P11 gates receive no premature credit. MASTER_REQUIREMENTS.md untouched; permanent ProjectContinuum/progressive policy retained. Commit/push this coherent verified fixture follow-up, verifyremoteSHA, require fullCI, then normally merge/deploy/liveverify PR24 without waiting for unrelated ROOT WIP.


## Full-CI fixture follow-up — 2026-10-19

PR24 exactb704902 fullCI39245177533 passed type/build/72unit and required WebKit, but failed2/100Chromium files: answer-style used an explicitly privileged preview identity while expecting developer controls hidden; phone-windows seeded Study data under its former unprefixed account ID. No product failure or permission change. Corrected preview-role expectation and exact normalized Study key. New developer-options unit renders the actual AboutSection with actual developer list/isPreviewUser, preserving ordinary/missing-user negative coverage plus both developers/case normalization and preview positive. The current invite list contains only the two developer accounts; no invented nondeveloper authenticated access.

Evidence: key-fixture-role-phone-chromium.log2suites clean15s including390/320phone; key-role-phone-unit.log type/all73unitfiles pass; actual rendered2case matrix passes. Independent profile-consumer/permission review accepted coverage and found no other mismatches. Runtime/build tree remains identical tob704902, so prior reviewed production build is retained. Require fresh complete exact-head CI before normal merge/deploy; earlier failed run is not green evidence. Completion remains88%, pending final release gates.
