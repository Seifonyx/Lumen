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

Read PROJECT_CONTINUUM.md at every continuation alongside the complete original MASTER_REQUIREMENTS.md and this file. Reuse IMPLEMENTATION_PLAN.md baseline v1, its24 stable task IDs and100weights. Initial baseline83%; evidenced P02-B reopening82%; current **88% (medium confidence)**, earned88/100,12remaining. No feature scope/weight change. PR22 complete CI/main/live acceptance earned4.75 in P01-D/P03-A/P05-B/P08-A; PR23 acceptance earned1.25 in P09-A/P10-B. All unfinished rows retain partial credit. Recalculate with `node scripts/project-progress.mjs`; never substitute another agent's scoring. Report previous/current percentage, change, confidence, phase, evidence, Git/production and precise next milestone at session start/end.

## Current operational state — 2026-10-19

The complete overhaul remains in progress. Historical intermediate checkpoints are archived in docs/history/MODEL_PICKER_2026-10-18.md and MODEL_PICKER_2026-10-19.md; they do not override this ledger.

| State | Exact revision / evidence |
|---|---|
| Latest verified production/main | `dab0fff854cc9657fd707b9e279c3bdb168bd64d`, PR23 normal merge, Deploy39243721175 success;18asset matches +hosted Chromium3/WebKit2 clean |
| Previous verified runtime/rollback | `3f48c6e02719b5f0c28be85e4c1e6e3cc2ef045b`, PR22 normal merge, Deploy39243260811 success;18asset matches +hosted Chromium4/WebKit2 clean |
| Earlier foundation | `02c322da48368d6277e5eb8b599edfead7f92e0e`, PR19 +Deploy39157498252 verified; later docs20/21 did not change runtime |
| Latest pushed key candidate | `b7049023aef4f23e82fd808364f311dd2c31c372`, feat/model-picker-key-save, PR24; exact remote verified, fullCI39245177533 pending |
| Current ROOT branch/base | `7cde3ea39a13408a266d16ae325b0e88357af387`, feat/model-picker-final-recovery in /workspace/Lumen, PR25; pushed/exact remote verified, fullCI39245877175 pending |
| Isolation | Runtime release worktree /workspace/Lumen-runtime-release at984b1a9; key release worktree /workspace/Lumen-policy-release atb704902. Neither includes ROOT final implementation. Four named stashes are recovered owned backups, not hidden unique source. Do not blindly pop. |

Never confuse pushed/merged/deployed/production-verified. Actual latest remote main must be rechecked before integration. No force push, protections bypass or unfinished-source release.

## Exact next actions

1. Evaluate PR25 exact7cde3ea fullCI39245877175. Source and handoff are committed/pushed/exact remote verified; no uncommitted implementation. It builds on PR24. Require all three exact-head CI jobs, including expanded actual WebKit research. Keep this source head stable; subsequent local changes are final ledger/validation documentation only.
2. In parallel evaluate PR24 fullCI39245177533 on exactb704902. It changes key-save reliability and corrected guest fixtures only; it has no dependency on ROOT final settings/routing repairs. Once all checks pass, normally merge with matching-head guard, dispatch Deploy onmain, verify workflow SHA and real hosted assets/core flows. Serialize deployments. Do not wait unnecessarily for final milestone.
3. Final milestone: required fullCI/independent review, normal merge after24, Deploy, verify assets/core workflows, update final requirement map/weights/status/ledger. Preserve original master and all permanent policies. No100% until every required gate and final synchronized documentation passes.
4. PR23 main CI39243719879 is separate from its successful exact-feature CI39199773200. A superseded cancelled run is not green evidence. Inspect any introduced failure rather than skipping or retry-hiding it.

## Released implementation

PR19 foundation: scoped registry/cache/lifecycle discovery, stable selection/defaults, eligibility/manual consent, quality/speed/cost/balanced priorities, saved layout requirements/fallbacks, credential cancellation and request/health isolation, phone first-input race and optional Markdown resilience. Source/master and phone welcome/compact composer preferences preserved.

PR22 source984b1a9 passed completeCI39199646064:68unit/type/build,98Chromium files clean904s, all required WebKit. Declared models support live add/edit/remove/provenance and sticky API denials; saving/weekly checks never automatically probe unchecked declarations. Classified finite recovery and throttled metadata expiry; helper/title/research policy/budgets; comparison slot retry/Stop/selected-source synthesis. Semantic stream completion vsEOF, partial-output safety,100ms usage drain, cancellation of buffered deltas, redaction before truncation, native cumulative usage once, truncated-helper refusal. Title snapshots survive later tool continuations while preserving first-input/privacy/account/key guards; actual title accounting; lazy SelectionTools initial-selection fix; preview quota stays local. PR22 hosted4Chromium49s/2WebKit66s clean; pr22-live-assets.json18matches.

PR23 source1793e4a passed completeCI39199773200:69unit/type/build,99Chromium files clean893s, required WebKit. Bounded family/diversity scans retain routing outputs; shared reply-budget revalidation, Gemini thinking-only parameter retry, canonical select labels/Escape/Tab, query/focus stability,44px metadata fields and comparison announcements. UX-CONTRACT.md and docs/MODEL_PICKER_VALIDATION.md map ownership/architecture/all modes. Synthetic1000-model CPU medians Auto135.0ms→7.76ms/helper128.3→7.60ms,144+512complete-output parity cases, zero provider requests; these are not inference latency/answer-quality benchmarks. PR23 hosted3Chromium35s/2WebKit67s clean;18assetmatches. Reproduce with scripts/benchmark-model-picker.mjs.

## PR24 candidate — pushed, full current CI pending

https://github.com/Seifonyx/Lumen/pull/24, latestb704902. Source8f4a02c +provider accounting correction and test guest-scope correction. Local durability activates immutable normalized keys/catalog without awaiting Firestore ACK. Ordered SDK enqueue and cache-only pending revisions protect replacements/removals/stale reads/reload; currentUID/auth-session/revision guards prevent stale denial and same-UID read-cache reuse. Explicit permission denial clears local cache/active credentials and blocks replay; only authoritative server reads restore access. Account switch does not await quota ACK; lifecycle/day guards prevent quota timer revival/stale totals/reset pollution. No remote schema/rules migration/new dependency. UI distinguishes local save from later sync.

Evidence:72unit/type/build; key-save-final-chromium5 suites clean40s; actual WebKit guest/a11y3 clean35s; additional authenticated account-isolation/sync/attachments/quota/delete/privacy/tasks7 clean152s; phone390px save-feedback screenshot inspected/nooverflow. Pure/integration29cases and meaningful blocked-write browser scenario. Optional authenticated WebKit emulator run passes save/replace/reload/switch/reconnect/removal functional assertions but FAILS strict pageerror checking on emulator WebChannel CORS; not claimed green and no error filtering.

Full CI on earlier8ade00b exposed providers.cjs expecting one reply while a malformed SSE title mock triggered fallback. Corrected nonstreamJSON mock +exacttitle/provider request/input/output assertions, independently reviewed, two focused suites green26s; full98/99 CI subsequently green. PR24 denial hardening exposed legacy test guests with nonguest logical IDs and emulator URLs. b704902 normalizes profile+seed IDs consistently, updates direct storage/manual helper refs, uses actual WebKit research with pointer-independent Add control. Real Firebase/invite/denial tests unchanged. Five affected suites pass against exactkey source30s, actual WebKit research8s. Earlier39243179620 is superseded/cancelled, not proof of readiness; fresh39245177533 must pass.

## Final milestone — committed/pushed PR25, not yet merged/deployed

P02-B/P04-A durability: new account-settings-persistence.ts stages full immutable JSON settings before existing800ms debounce, independent settings revisions/ACK/read/replay and permission/session guards, semantic no-op detection. Reconciliation captures BOTH snapshots before network, protects settings first then passes chosen settings to key reconciliation. Remote write replaces the whole settings field via mergeFields while preserving keys. Deletions cannot revive from recursively merged old maps. Storage failure is explicit. Genuine edits during cached-account startup stage before remote read completes; empty hydration cannot overwrite another device's newer settings. No premature SDK submission before readiness. Same-UID key replay dedupes per session and refuses old-session ACK.

P06-B/P07-A caller reliability: Canvas passes current blockedModels so exhausted backups cannot consume all five attempts before a ready outside authorized backup. Fixed-order helper assignments bypass only Auto exclusions; dynamic Auto/outside exclusions, fixed order/consent, hard capabilities/context/readiness remain. Research refreshes quota readiness per query within its frozen authorized search pool, preserving strict search/4096budget and explicit first assignment. No unrestricted workflow editor/new product scope.

Relevant files: src/lib/account-settings-persistence.ts, account-key-persistence.ts, firebase.ts, store.ts; new account-settings persistence/integration/startup, Canvas/helper-layout/research-readiness integration tests; layout-save-resilience.cjs; required WebKit research list. Existing helper fixture corrections inherited fromb704902, not separate unverified source.

Evidence (directory /workspace/.lumen-verification/dynamic-picker-2026-10-18): final-recovery-current-unit.log all78unit/type pass; current-build production build passes (existing ineffective dynamic-import warning). Account settings16pure/7boundary cases; actual updateSettings startup7cases red→green; SDK option assertion locks complete-map replacement. Canvas2/helper-layout5/research1actual-caller cases red→green; research18bounded calls/no outside model/search+4096 preserved. Layout browser cleanred against prior runtime loses saved layout afterreload; current source key+layout2 suites clean12s, subsequent final7-file run6individual suites pass (key/layout/Canvas/writing/study/layout policies) but old deep-research fixture failed. Corrected guest fixtures then pass5Chromium33s (research/images/import/layout-builder/archive) and4actualWebKit47s (research/writing/study/layout). Do not call the failed7-file batch green. Independent review found startup gap, reproduced/fixed it and approved remaining source; guest helper consumers/direct storage refs independently reviewed, six manual refs fixed and syntax-checked. Full current CI is still mandatory.

## Architecture, limits and verification commands

Extend existing browser adapters/shared registry/deterministic router/bounded runtime; retain provider-prefixed stable IDs and one active connection per provider. API/documented capabilities outrank user assumptions; unknowns stay honest. Existing Auto/order layout semantics remain; comparison→conditional synthesis and research implement useful parallel/sequential/dependency/stage recovery. Arbitrary DAG editing is separate product scope, documented under master “where appropriate” clauses. Static hosting cannot refresh when browser execution is suspended. No invented arbitrary provider protocol or endpoint.

No paid real-provider benchmark, physical iPhone test or device-service account was available. Linux WebKit/mocks are explicitly narrower evidence. Generic premium scan still has22 inherited form/textarea findings explained in UX-CONTRACT.md; no claim of globally clean static scan. No new dependencies, rules/schema migration or credential destinations.

Use Node22 PATH=/workspace/.lumen-tools/node_modules/node/bin:$PATH; npm test; npm run build; npm run test:e2e -- selected-names. Local Firebase emulators9099/8080 must be active for authenticated tests; do not spawn competing emulators/preview servers. Browser preload NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs; actual WebKit adds MR_WEBKIT=1 only for suites that select it. Hosted preload hosted-browser-preload.cjs with MR_TEST_URL=https://lumen-chat.web.app/. Never rebuild a dist under its active runner. Compare live assets with /tmp/lumen-verify-live.py using exact reviewed dist/merge/deploymentSHA. Hosted tests use synthetic guest accounts/mockproviders, real live assets, no paid inference.

Normal integration: inspect fresh remote/diff/exact-head CI, gh pr merge --merge --match-head-commit FULL_SHA; gh workflow run deploy.yml --ref main; verify successful run SHA, assets and live workflows before another deployment. Rollback is ordinary reviewed merge revert +known-good deployment, never force/reset/protection bypass. PR attachment app tool is unavailable on this host; created PR URLs remain in GitHub/chat. Do not reveal credentials.

## Manual tests after each corresponding release

- Custom models: add valid supported ID/details, save unchecked without paid probe; edit/remove/reload. Explicit Check models may probe. Invalid limits stay inline; Escape/focus behave consistently.
- Auto/layout: choose fixed order/fallback scope, mark assigned model Not in Auto, use Study or rewrite; explicit assignments remain while outside Auto exclusions stay enforced. Change metadata/availability and verify no unauthorized provider is used.
- Compare two models: Stop retains finished answer; retry only failed slot; combine only completed selected answers. Interrupted visible streams remain partial/error without silent model splice.
- Keys: disconnect and save/replace, reload, reconnect; latest key persists/syncs. Remove and verify model eligibility disappears. Switch accounts during stalled sync: no credential inheritance/endless spinner.
- Layout durability (final milestone): build/edit while sync is unavailable, reload, reconnect; latest layout and requirements persist, removed layout stays removed, keys remain unchanged. Make a settings edit immediately after opening cached account; refresh must preserve it.
- Canvas/research (final milestone): with controlled quota-limited backups, a permitted ready alternative can recover without retry starvation; research retains earlier successes/search restrictions and never uses outside fixed-layout pool.
- Picker UX: keep search open across refresh; arrows/Escape/Tab; phone provider field label and44px metadata inputs; light/dark/nooverflow. Original phone welcome/composer/motion preferences preserved.


Final coherent checkpoint verification before commit: final-checkpoint-unit.log all78unit/type pass, final-checkpoint-build.log build passes after integration ofb704902 ancestry and all source review fixes. Product tree was not changed afterward. Four actual WebKit suites pass47s and five corrected guest Chromium suites33s; key/layout current browserproofs and individualCanvas/writing/study/layout passes are detailed above. Required newCI will run101Chromium files and include actualWebKit deep research. Source snapshots and docs are coherent; commit/push now, verify exactremoteSHA, open PR, waitfullcurrentCI before release. No production claim for this final milestone.


Latest operational checkpoint: root source7cde3ea39a13408a266d16ae325b0e88357af387 is pushed/exact remote verified, https://github.com/Seifonyx/Lumen/pull/25, fullCI39245877175 pending. Subsequent changes in this worktree are documentation only, intentionally held for final source/main/live synchronization rather than superseding a running source CI with ledger-only edits. Preserve source head while24/25checksrun; continue normal progressive releases when green.


## Full-CI fixture follow-up — 2026-10-19

PR24 exactb704902 fullCI39245177533 passed type/build/72unit and required WebKit, but failed2/100Chromium files: answer-style used an explicitly privileged preview identity while expecting developer controls hidden; phone-windows seeded Study data under its former unprefixed account ID. No product failure or permission change. Corrected preview-role expectation and exact normalized Study key. New developer-options unit renders the actual AboutSection with actual developer list/isPreviewUser, preserving ordinary/missing-user negative coverage plus both developers/case normalization and preview positive. The current invite list contains only the two developer accounts; no invented nondeveloper authenticated access.

Evidence: key-fixture-role-phone-chromium.log2suites clean15s including390/320phone; key-role-phone-unit.log type/all73unitfiles pass; actual rendered2case matrix passes. Independent profile-consumer/permission review accepted coverage and found no other mismatches. Runtime/build tree remains identical tob704902, so prior reviewed production build is retained. Require fresh complete exact-head CI before normal merge/deploy; earlier failed run is not green evidence. Completion remains88%, pending final release gates.


Current integration checkpoint: merges key fixture source2ce5c9a886219f5dfb2e73e11c4036c66ea00dc1 into final source7cde3ea. Both runtime application trees are unchanged; only fixture/component-render coverage and accurate documentation change. PR24 b704902 CI39245177533 failed the two fixture cases above; PR25 7cde3ea CI39245877175 inherits them and must be superseded. Commit/push the reviewed integration, verify the exact remote revision and require fresh full CI for PR24 and PR25. No new production deployment. Owned final-ledger stash recovered into this checkpoint; do not blindly pop old backups.

Integrated final fixture evidence: final-role-phone-unit.log type/all79unitfiles pass; final-role-phone-chromium.log2suites clean9s. Product/workflow tree matches7cde3ea exactly; reviewed final dist remains valid. PR24 updated exact2ce5c9a fullCI39247939607 is running. Commit/push this fixture-only merge and require fresh complete PR25 CI; no runtime release is claimed.
