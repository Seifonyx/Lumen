# Dynamic Model Picker implementation plan

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



Authoritative scope: [MASTER_REQUIREMENTS.md](MASTER_REQUIREMENTS.md), preserved verbatim from the user's upload. Operational state: [AI_HANDOFF.md](AI_HANDOFF.md). Existing behavior: PRODUCT.md; visual rules: DESIGN.md.

Status vocabulary: **Not started**, **In progress**, **Implemented but unverified**, **Verified**, **Blocked**, **Deferred with justification**. Visiting a phase does not complete it. All requirements remain in scope unless an explicit, documented architectural applicability decision explains otherwise.

## Permanent amendment: Project Continuum and progress baseline v1

PROJECT_CONTINUUM.md records the user's permanent Version2.0 continuation protocol approved2026-10-19. Read and follow it alongside the complete original MASTER_REQUIREMENTS.md and progressive deployment policy. This amendment adds stable evidence-based tracking; approved Model Picker feature scope is unchanged.

No prior numerical percentage/weighting baseline was present in this plan or handoff. Do not invent a previous percentage. Baseline v1 below uses the existing24 stable phase/task IDs; future agents must reuse it unless an approved scope change or demonstrated calculation defect justifies a versioned amendment. Complexity, integration, testing and credential/operational risk determine weights. P11 owns final cross-project regression/release/docs work; implementation weights cover distinct features, not repeated credit for the same shared module.

**Calculation:** overall completion =100 × Σ(weight × earned fraction) / Σ(weights). Total scope100; earned82; approximately82% complete, **medium confidence**. Remaining weighted work18. This is a defined-scope engineering estimate, not an answer-quality/perfection claim. Prior checkpoint: no weighted estimate; first baseline83% fell within the disclosed80–85% range; current82% follows the evidenced reopening of P02-B below. Historical 'Verified' statements apply to their recorded revisions; this ledger conservatively gates changed integrated paths on current CI.

**Partial credit (apply consistently):**0 not started/no evidence;0.25 accepted, demonstrably completed sub-deliverable;0.5 integrated implementation with partial verification;0.75 feature-specific local tests/integration and review passed but current full CI/integration acceptance still pending;1 all applicable acceptance and required verification pass for the integrated revision. Unintegrated modules cannot earn full feature credit. Blocked/deferred tasks retain only evidenced credit; required unfinished work is never silently excluded. Architectural not-applicable decisions require explicit justification. Final production verification is separately weighted in P11-B, so local/CI/main are never called deployed.

For P11-A,0.5 reflects source/architecture mapping and local checks with full CI failures still blocking;1 requires final full current CI/regression acceptance. For P11-B,0.25 reflects the verified foundation release and coherent source checkpoints;0.5 requires remaining runtime integrated normally into main;0.75 requires latest runtime deployed and live-verified;1 additionally requires final synchronized committed/pushed/merged documentation and exact production ledger. Mandatory unfinished gates prohibit100%.

| Stable task | Weight | Earned fraction | Earned weighted work |
|---|---:|---:|---:|
| P00-A | 3 | 1 | 3 |
| P00-B | 2 | 1 | 2 |
| P00-C | 1 | 1 | 1 |
| P01-A | 6 | 1 | 6 |
| P01-B | 6 | 1 | 6 |
| P01-C | 5 | 1 | 5 |
| P01-D | 4 | 0.75 | 3 |
| P02-A | 5 | 1 | 5 |
| P02-B | 4 | 0.75 | 3 |
| P03-A | 6 | 0.75 | 4.5 |
| P03-B | 6 | 1 | 6 |
| P04-A | 5 | 0.75 | 3.75 |
| P04-B | 4 | 0.75 | 3 |
| P05-A | 7 | 0.75 | 5.25 |
| P05-B | 4 | 0.75 | 3 |
| P06-A | 3 | 1 | 3 |
| P06-B | 4 | 0.75 | 3 |
| P07-A | 6 | 0.75 | 4.5 |
| P08-A | 5 | 0.75 | 3.75 |
| P09-A | 3 | 0.75 | 2.25 |
| P10-A | 3 | 0.75 | 2.25 |
| P10-B | 2 | 0.75 | 1.5 |
| P11-A | 3 | 0.5 | 1.5 |
| P11-B | 3 | 0.25 | 0.75 |
| **Total** | **100** | | **82** |

Evidence: PR19 full CI39136235729 and verified production02c322 establish foundation/manual/Auto work. PR22 feature-specific matrices/review/68unit/type/build passed, but full CI39160504107 failed6/98 browser suites and current fixes still need clean rerun/full CI. PR23 ca9d50c polish is pushed with local69unit/type/build/Chromium/WebKit/a11y/performance/parity evidence; its CI39161870338 was cancelled because it inherited PR22 failures. P11 source/requirements/independent review passed; final current CI, integration, deployment/live checks and synchronized ledger remain. Exact current operations/files/logs are in AI_HANDOFF.md. Update this table and checkpoint history only when evidence changes; never reset weights when agents change.

## Architectural approach

Extend the existing browser-side provider adapters and shared request runtime. Keep stable provider-prefixed IDs and existing saved settings/layout schemas wherever possible. Discovery must publish one coherent credential-scoped registry; selection and execution consume it. Preserve user choices separately from transient availability. Unknown specifications stay unknown; inferred rankings are not measured answer quality. Browser refresh runs only while the app can execute.

Use a working branch for incomplete milestones. Main updates require the relevant repository checks and protections. No force pushes. Each verified milestone includes updated documents, focused tests, a reviewed commit, and verified remote synchronization. Main pushes deploy through the existing workflow; verify hosted behavior when released.

## Requirement coverage and phases

| Phase/task | Requirements | Dependencies | Deliverable and acceptance evidence | Status |
|---|---|---|---|---|
| P00-A audit lifecycle | §§1–18, execution protocol | none | Trace adapters, credentials, registry, settings, picker, routing, layouts, comparison, streams, persistence and relay. Record concrete gaps and applicability. | Verified |
| P00-B baseline/environment | §§16–17 | none | Existing type/unit/build checks and representative browser flows execute; failures diagnosed, not hidden. Reuse Node22 and existing browser setup. | Verified |
| P00-C durable scope/checkpoints | execution protocol | none | Verbatim master directive, comprehensive roadmap, exact handoff committed; remote availability verified. | Verified |
| P01-A scoped registry | §§2,4,5,13,15 | P00 | Provider/endpoint identity, credential generation, normalized capabilities, provenance/freshness and availability; no stale credentials/account leakage. | Verified |
| P01-B adapter discovery | §§2,4,15 | P01-A | Actual supported list APIs, pagination/deduplication, dynamic new models; truthful documented declarations where no list API exists; no fabricated specs. | Verified |
| P01-C reconciliation | §§2,4,9 | P01-A/B | Last-known-good for transient errors only; definitive permission failure never revives old models; removals never erase fixed layouts or explicit choices. | Verified |
| P01-D user declarations | §§2,4,5,13,15–16 | P01/P03 | Add/remove declared models and fill unknown metadata for supported endpoints; API/documented facts outrank user assumptions, authentication failure cannot resurrect declarations, live propagation and private settings persistence verified. UI/raw-derived registry integrated; automatic probes excluded; unit/Chromium/WebKit verified, PR22 exact-head CI pending. | Verified locally; CI/release pending |
| P02-A refresh coordinator | §§2–3,14 | P01 | Configuration events, manual refresh, TTL, lifecycle/resume/online, active-runtime refresh, bounded concurrency/retries/backoff/jitter, in-flight dedupe and out-of-order protection. | Verified |
| P02-B persistence/sync | §§3–5,13 | P01/P02-A | Credential/account/endpoint-scoped cache, safe invalidation, metadata updates propagate without remounts or edit loss. Fake-clock and account/key-race tests. | Verified |
| P03-A shared eligibility | §§4–6,8–10,15 | P01/P02 | One capability/context/permission contract used by all applicable selection and request paths; strict requirements precede scoring; unknowns bounded. Chat/layout/comparison and helper callers integrated; PR22 local matrices and review passed. | Verified locally; CI/release pending |
| P03-B Auto policy/evidence | §§6,14,16 | P03-A | Quality/speed/cost/balanced preferences, ambiguity/mixed-task handling, unknown-model uncertainty, metadata-driven newcomers; deterministic task cases and honest ranking explanations. Actual answer benchmarks remain distinct from routing mocks. | Verified |
| P04-A layout lifecycle | §7 | P03 | Creation/edit/delete/duplicate/save/load, presets, fixed and Auto assignments, roles/preferences/fallbacks, registry updates and missing assignments; tested backward compatibility/migrations. | Verified locally; CI/release pending |
| P04-B layout execution design | §§7,10 | P04-A | Applicability documented in docs/MODEL_PICKER_ARCHITECTURE.md: preserve Auto/order sets, add saved constraints/priority/fallback scopes, use existing parallel comparison → conditional synthesis stage graph, and recover individual failed stages in P07. | Verified locally; CI/release pending |
| P05-A recovery contract | §§8,11,13–15 | P03 | Shared classified failures and mode-specific policy; cancellation/terminal failures do not reroute, strict manual/layout constraints respected; request/attempt deadlines and bounded spend. Credential scope cancellation/retry and helper-body isolation implemented; classified recovery and metadata invalidation now integrated locally; final review variants/tests remain. | Verified locally; CI/release pending |
| P05-B recovery/discovery integration | §§3,8 | P02/P05-A | Model/capability failure triggers bounded invalidation without refresh/retry recursion; provider health, cooldown/circuit state and ordered candidate selection tested. Local targeted expiry/throttle implemented; full checks remain. | Verified locally; CI/release pending |
| P06-A manual selection | §§5,9,12 | P03/P05 | Stable explicit selection through refresh/restart; compatibility/availability feedback; substitutions require existing explicit fallback authorization. PR19 full CI and live selection-policy checks verify this contract. | Verified |
| P06-B all execution callers | §§5,8,10 | P05 | Audit/fix chat, compare, synthesis, canvas, side chat, tasks, summaries and tools. Each mode uses appropriate shared metadata/policy. Shared helper pool/title/research integration verified locally and independently reviewed; PR22 CI/release pending. | Verified locally; CI/release pending |
| P07-A multi-model runtime | §§7,10 | P04/P05/P06 | Bounded concurrency, recover only failed stages, explicit roles/dependencies/context transfer, preserve partial successes, safe cancellation; no unexpected paid calls. Immutable stage retry/synthesis/UI verified in phone/desktop Chromium/WebKit; PR22 CI/release pending. | Verified locally; CI/release pending |
| P08-A streaming/state | §§8,10–11 | P05/P07 | Before/after-visible-output failure distinction, no duplicate output or seamless false continuations, no stale state/orphans; tool side effects never replayed blindly. Completion-marker/partial-output/cancellation fixes integrated; broad local matrices and review passed; full PR22 CI pending. | Verified locally; CI/release pending |
| P09-A shared selection UX | §§5,7,9,12 | P01–P08 | Search/group/filter/status/preference/layout workflows, stable open edits during refresh, phone/desktop keyboard/focus/touch/scroll/a11y. Existing style preserved; TTL/query/focus, canonical native/glass controls,44px fields/status announcements and axe matrix verified locally. | Verified locally; CI/release pending |
| P10-A security review | §§13,15–17 | continuous | Credential/logging/storage scope, relay SSRF/allowed hosts, permission/billing/privacy boundaries and custom endpoint declarations reviewed with negative tests. Credential/relay/account/budget boundaries and independent review passed. Final Gemini classifier follow-up and scope/budget/search regressions pass independent review; full exact-head CI/release gates remain. | Verified locally; CI/release pending |
| P10-B performance/cost | §§3,6,10,14 | continuous | Measure discovery requests/concurrency, registry/routing overhead and UI update cost where practical; no speculative complexity or hidden extra inference calls. Zero-network synthetic routing/helper/layout/snapshot benchmark and144+512 exact-decision parity cases; faster family/diversity scans without policy changes. | Verified locally; CI/release pending |
| P11-A regression/architecture review | §§1,16–18 | P01–P10 | Full type/unit/build; all relevant Chromium and Linux WebKit tests, security/compatibility review; unresolved failures investigated and actual hardware limits documented. Full master/mode evidence map in docs/MODEL_PICKER_VALIDATION.md; final exact-head CI/live gates remain. | In progress |
| P11-B release/sync/production | §§17–18, protocol | P11-A | Reviewed coherent commits on remote; required CI green; protected main integration; deployment and hosted asset/core-flow verification; final handoff and manual test steps. PR19 foundation deployed/verified; PR22 runtime and isolated P09/P10 polish release gates remain. | In progress |

## Initial audit evidence (2026-10-18)

- Product is a React/Zustand browser app with Firebase account settings; no application inference backend. `src/lib/ai/providers.js` owns official provider adapters; `relay/` forwards only supported endpoints. Do not invent server scheduling for a static hosting runtime.
- `providers.js` has live discovery for most providers and a documented Perplexity list. It caches all providers together for ten minutes, launches every connected provider at once, does not deduplicate concurrent direct callers, and reads mutable global keys during paginated discovery.
- `src/store.ts::loadCatalog` already guards publication by account/key generation and deduplicates store callers. It forces discovery on every invocation, merges old models for every failed provider (including changed credentials), and persists an unscoped global `mr.catalog`. These are credential-isolation and stale-metadata defects to address first.
- Startup, key saves, manual refresh and online-after-error trigger discovery. No TTL-driven active/resume refresh currently exists.
- `ModelInfo` carries IDs and a few capabilities but no provenance/freshness/output/tool/pricing metadata. Different providers already use prefixed IDs. Extend this contract additively.
- Auto uses `work-intent.ts`, `routing.ts`, `model-profile.ts`; custom task layouts use `layout-builder.ts`. Existing scoring is inferred family knowledge, not an answer benchmark.
- Saved layouts are model sets with `auto` or ordered fallback mode. Comparisons run two or three parallel requests and support synthesis; they are not a general execution DAG. Stage extensions require an explicit, compatible design in P04/P07.
- `chat.js` already bounds attempts/deadlines, provider-spreads fallback queues, handles context/capability checks, skips bad credentials, and preserves partial text without switching mid-answer. Do not replace this stable runtime wholesale.
- Manual picker, settings browsing, layout slots and comparisons read Zustand catalog but implement some independent filtering. Refresh currently prunes removed enabled IDs and can silently reset default choices.
- Arbitrary custom upstream hosts/models are not an existing feature in this checkout; official Alibaba regional endpoint and user-owned relay configuration are. Assess safe declarations/configuration in P01/P10 rather than assuming unknown protocols work.

## Verification policy

Architectural applicability and execution-mode boundaries are recorded in [docs/MODEL_PICKER_ARCHITECTURE.md](docs/MODEL_PICKER_ARCHITECTURE.md), including existing Auto/order layout semantics, parallel comparison and dependent synthesis stages, metadata precedence and the separate user-declaration task.

Use failing behavioral tests for defects and meaningful regression coverage. Controlled responses verify decisions and recovery, not model answer quality. Do not send user prompts or credentials to benchmark services. No paid broad-provider evaluation without a defined authorized budget/workload. Use existing repository scripts; no separate linter is configured.

For each implementation milestone record exact commands/results in AI_HANDOFF.md. Each feature needs concrete manual steps with expected behavior. Preserve known-good tests; investigate flakes rather than hiding failures with retries. Linux WebKit does not prove native iPhone rendering or physical touch behavior.

## Milestone history

- P00 verified: Node22 type checking, all 44 original unit files, production build and baseline Auto/layout-builder/context-recovery Chromium browser suites passed. Initial documents committed and pushed at `bb2cc3d5a075526d9b9957cdebbd218e6c439d0d`; remote branch hash explicitly matched.
- Foundation milestone verified locally: all 48 unit files and type check, production build, six Chromium suites (72s) and four Linux WebKit suites (108s) passed without retries. Logs are listed in AI_HANDOFF.md. This verifies P01-A/B and P02-A/B, not the entire project; P01-C remains unfinished.
- Test diagnosis: the stale-capacity browser case previously forced every provider on a synthetic online event. It now installs a browser clock before app startup and expires the cache before reconnect; all original save-rejection assertions remain. An overlapping local-server WebKit run was discarded, followed by the successful sequential matrix above.
- P01-C/P03 selection milestone: shared capability/context eligibility, explicit fallback authorization, hard Auto exclusions, fixed/default preservation, shared UI/execution selection, four routing priorities, prompt precedence, unknown-price handling and cost-aware runtime queues implemented. Concision does not mean lower latency; writing about cheap models does not request cheap routing. Unknown context is bounded in planning and execution.
- Verification: all 50 unit files and type check passed; production builds passed. Eleven Chromium suites (114s) and eight WebKit suites (179s) passed without retries after the draft-race fix. Final resolver follow-ups: three Chromium suites (43s), two WebKit suites (92s), and four focused decision/layout unit suites passed. Settings priority screenshots were visually inspected on phone and desktop. Current source is being checkpointed; no main push/deployment yet.
- Foundation CI exposed a first-message draft race and a synthetic scroll measurement flake. Composer draft restoration now runs before input can be accepted; tests select Send explicitly and seed account/keys in one init script. The scroll assertion waits for actual scrollable geometry. Required full CI must pass on the new head before release.
- Selection checkpoint `9e98d4e3a0759ba713712fd30dea51d2a9b1cf7d` committed, pushed and remote hash verified. P04 code is now in local verification: saved layout requirements/priority, explicit fallback scopes, fixed-order runtime recovery, constraint-aware picker/editor status and shared canvas planning. No release yet.

- P04/P05/P10 continuation: independent reviews reproduced and fixed cross-key summary retries, old diagnostic-body publication, suspended old stream deltas, iterator cleanup, and cross-account/config reliability history. Another review found runtime layout requirements could be dropped after a metadata downgrade; the saved requirements now reach every chat/canvas attempt and share the planner’s checker. New final verification is in `layout-final-*`; no main/live release.
- P01-D pure declaration normalization/merge (12 focused tests) and P07 reusable comparison-stage result/cancellation helper (11 focused tests) are ready but not integrated. Their existence does not complete either phase. P08 protocol-completion review found missing termination-marker enforcement; patch and red tests are outside tracked source until integration.

- Layout/credential milestone locally verified: four focused Chromium suites passed cleanly (102s); three WebKit suites passed with a navigation retry, whose optional stylesheet-loader failure was reproduced and fixed. Final full workspace type/58-unit/build check passed; one Chromium formatting-recovery suite and two WebKit suites (formatting recovery + navigation matrix,44s) passed cleanly. Four new pure modules remain unintegrated and are excluded from this milestone’s claim of completed product behavior. Review accepted the runtime constraint fix. See AI_HANDOFF.md for exact logs and remaining integration steps.

## Progressive release ledger (authoritative latest state)

| Item | Exact revision/state | Evidence / next action |
|---|---|---|
| Latest verified production | `02c322da48368d6277e5eb8b599edfead7f92e0e` | Deploy39157498252 success; live assets +4 Chromium/2 WebKit suites clean |
| Latest merged main | `3be7307cb960b50d3c5bed90613608337b34405d` | PR19 runtime plus policy/verification-only PR20/21; app runtime identical02c322 |
| Latest pushed runtime source | `9b174584bd21a00af2ee78c2811193e18d71f9fa`, PR22 feat/model-picker-recovery | Exact remote SHA verified; fresh full CI39196403013 pending; prior39160504107 failed and is superseded |
| Latest polish source | `ca9d50c4951814857b1e55a7bb56bdf89957e1b6`, feat/model-picker-polish, PR23 | Pushed/exact remote verified; full CI39161870338 pending browser jobs. Only later ledger notes remain local; no polish source in PR22 |

Evaluate PR22 for normal merge/deploy immediately after every current required check passes; no unfinished polish dependency. Verify actual deployment/core flows, then continue remaining phases. Exact next tasks, files, logs, rollback and manual tests are in AI_HANDOFF.md. Older chronological entries below are historical and do not override this ledger.

## PR19 production verification (2026-10-18)

- Runtime source07efe214ef6c94aad2ddd7e29354eb3a4d9b1734 merged in PR19 at02c322da48368d6277e5eb8b599edfead7f92e0e. Deploy39157498252 completed successfully for that exact merge commit.
- https://lumen-chat.web.app/ served fresh assets. SHA256 evidence: store-BGs2kXdx.js `0866c1cc1ef81bd577dd1af9dc2d7406ad32e83a61fdcc6623a1f7e5932ab16a`; sync-b7Jnwgqx.js `93feb462277dfa7a565c247abed3e2d175f1364176bf979782fd4edba4e7190b`. Registry mr.catalog.v2 and health mr.modelRecord.v2 markers present. Full asset evidence is pr19-live-assets.json outside repo.
- Hosted Chromium: selection-policy, routing-priorities, layout-policies, catalog-lifecycle all passed without retries (37s). Hosted Linux WebKit: selection-policy and layout-policies passed without retries (62s). Tests use synthetic local guest accounts and mocked provider responses with actual live app assets; no paid inference or model-quality benchmark claim.
- PR20 merged the permanent deployment policy into main at4406c338be50528f1d516488d767e708d38e1664. It changed only AI_HANDOFF.md and IMPLEMENTATION_PLAN.md; no application redeployment is needed for that documentation-only commit. Source/master spec preserved.
- Deployed features: scoped registry/cache/lifecycle discovery, shared eligibility/manual intent, quality/speed/cost/balanced priorities, saved layout constraints/fallbacks, credential/request/health isolation, phone first-input race and optional formatting resilience. Undeployed: subsequent local declarations, typed recovery/expiry, helper rework, comparison-stage retry/synthesis and semantic stream-completion changes.
- Continue on feat/model-picker-recovery. This release does not complete the overall overhaul. Preserve all remaining phases and exact local blockers above.

## Recovery/comparison/declaration checkpoint in verification

Local only, feat/model-picker-recovery at3be7307 (2026-10-18): user declarations/API denial persistence, classified recovery and bounded discovery invalidation, shared helper routing, same-model comparison-slot retry/Stop and selected-source synthesis, semantic stream completion/output budgets. Full65 unit files/type and build passed before final review fixes; final unit/type/build also passed. Initial Chromium found declaration focus/Escape and an incomplete-research-note status defect; regressions were added and fixes are under final browser verification. Summary/title registry-removal regression passed red→green. P09/P10/P11 remain unfinished. See AI_HANDOFF.md and recovery-final-* logs for exact next steps; no release claim yet.

Documentation-only PR21 is merged at3be7307cb960b50d3c5bed90613608337b34405d and records verified PR19 live tests; runtime source remains the deployed02c322 revision. MASTER_REQUIREMENTS.md is unchanged.

Independent review extended this checkpoint with real red→green tests for final-deadline stream completion, direct-adapter error-body cancellation and pre-truncation redaction, per-attempt helper layout constraints, sticky API denial tombstones, native cumulative usage and truncated one-shot helpers. Full68 workspace unit files/type and build pass in recovery-reviewed-*. Seven Chromium/four WebKit suites are running sequentially. PR19 production remains02c322; the new source is still local/uncommitted pending final current checks and review.

## Runtime release candidate (current local checkpoint)

P01-D/P03-A/P04/P05/P06/P07/P08 have component/browser/review evidence for their applicable contracts; this does not mark P09/P10/P11 complete. Final type/all68unit/build pass, broad seven Chromium/four WebKit suites clean, final adapter follow-up two Chromium/one WebKit clean. Exact evidence and review defects/fixes are in AI_HANDOFF.md. Next: commit/push feat/model-picker-recovery, open PR, require all3 full CI jobs on its exact head and evaluate immediate release. No unfinished runtime dependencies are known. P09 UX/ownership and P10 performance/remaining hardening are a separate next milestone, followed by P11 final validation. Production stays02c322 until actual deployment is verified. MASTER_REQUIREMENTS.md unchanged.

## Declaration automatic-probe follow-up

A clock-driven browser regression showed the existing weekly diagnostics would also probe newly enabled unchecked custom declarations. Automatic health checks now exclude declared IDs; explicit Check models and user-selected inference remain available. This honors the declaration metadata boundary without disabling existing API-discovered weekly checks. Red browser evidence declared-background-red.log; full68unit/type/build passed; Chromium declared-background + model-declarations passed (18s); actual WebKit declared-background passed. Added declared-background to required WebKit CI. This coherent follow-up is isolated on feat/model-picker-recovery in /workspace/Lumen-runtime-release; no local feat/model-picker-polish performance/UX work is included. Push it to PR22 and require fresh complete exact-head CI before release. Original MASTER_REQUIREMENTS.md unchanged; production02c322 remains the rollback/live reference.

Manual test: save a custom model, leave the app open through the weekly-check timer or reload. No automatic probe should be sent to that declaration. Open Check models and explicitly start a check: the declared model can then be tested using the existing small diagnostic request.

## Authoritative P09/P10 continuation after PR22 source checkpoint

PR22 runtime head1c73895346f3c3ca72b8085a3ba88d6f78bbd10d is pushed/exactly verified; require full CI39160504107 before merge/deploy. Latest main3be7307 and deployed runtime02c322 are separate. Working branch feat/model-picker-polish starts at1c73895; local UX/routing performance work is isolated. Synthetic1000-model Auto median135.0ms→7.76ms with144 complete-decision parity cases, no inference calls. Chromium new accessibility matrix4cases passed clean19s. WebKit, full checks, helper output-budget revalidation, review, P11 mapping remain. Canonical ownership document resolves11 unspecified native owners;22 inherited form/textarea static findings are explicitly unclaimed. See latest AI_HANDOFF section for exact source files, logs and next tasks. Full original master and permanent deployment policy remain active.

## P09/P10 current verification checkpoint

Shared UI ownership/accessibility and routing CPU optimization are implemented on isolated feat/model-picker-polish. Final pre-parameter checks: all68unit/type/build,6 Chromium suites77s,3 WebKit suites72s clean without retries;16 rendered axe surface scans, phone/desktop light/dark and screenshots inspected. New69th unit file narrows Gemini parameter recovery. Final polish-reviewed logs: typecheck/all69unit/build pass; provider Chromium11s/WebKit11s clean. Independent final review approved classifier/scope/budget/tool preservation; no blocker remains in this local milestone. Require its own full exact-head CI before release. Explicit reply allowances now share eligibility and revalidate fresh fallback metadata. Exact144 root/512 independent decision parity cases and synthetic zero-network benchmarks support CPU-only claims. P11 requirement/mode map is docs/MODEL_PICKER_VALIDATION.md. No paid inference benchmark or physical-iPhone claim. Keep PR22 and this local milestone separate until each passes its own CI/deployment gates.

P11 source/architecture review now traces every applicable execution mode and sections1–18 in the validation map; no unresolved runtime dependency or known foundational blocker found. Non-chat image/knowledge/GitHub operations retain their own permissions/side-effect boundaries rather than being rerouted as chat models. Overall completion still requires each pending milestone's exact-head full CI, merge/deployment/live checks and final synchronized ledger.

PR23 https://github.com/Seifonyx/Lumen/pull/23 now contains the verified local polish milestone atca9d50c4951814857b1e55a7bb56bdf89957e1b6. Exact remote SHA matched. Type/build/unit CI green; full Chromium/WebKit pending. Do not restart unchanged-source CI for ledger-only updates; synchronize those through a documentation-only PR after runtime releases.

Final independent P11 architecture/applicability review accepted the requirements map and actual mode boundaries; five focused recovery/helper/provider-error/stream/declaration suites passed independently. No additional source blocker found. Full CI and actual production verification remain mandatory before overall completion.

## Authoritative runtime follow-up integration

PR22 source9b174584bd21a00af2ee78c2811193e18d71f9fa is committed/pushed/exact remote verified; current full CI39196403013 is running. Old1c73895 CI39160504107 failed6/98 Chromium suites. PR23 ca9d50c4951814857b1e55a7bb56bdf89957e1b6 CI39161870338 was cancelled due inherited failures. Root feat/model-picker-polish is integrating9b17458 now; both source intents and permanent protocol/baseline are retained, with new combined checks/CI required. No new runtime has merged/deployed; main3be7307 and verified production02c322 remain distinct.

Fixes: titles snapshot first input/consent and survive automatic file continuations; first-input/deletion/privacy/routing/model/assistant/project/memory/autoTitle and account/key changes still invalidate. Failed/completed title attempts and real tokens report once; same-key Stop counts, old-key publication remains suppressed. Original credential assertions unchanged. Four successful-helper fixtures supply128k context; unknown8192/output-budget guards remain strict. Usage counts2 OpenRouter replies plus1 enabled title in pool3/50 with47remaining; manual Gemini1 and actual tokens. Preview-guest IDs/no emulator query remove accidental shared-emulator listeners. SelectionTools now checks an existing selection on lazy mount; held-chunk browser regression proves oldsource missed it.

Runtime local evidence: pr22-followup-unit/build all68/type/build pass; affected Chromium6suites clean32s; final fresh-page writing fixture Chromium passed and four actual WebKit guest suites clean17s (pr22-selection-final-*). Independent review accepted source/scope/accounting/selection/guest fixtures and24task/100weight/83earned baseline; progress checker executes in CI. Optional real-auth WebKit coding/usage emulator expansion failed models loading after key save and needs diagnosis while CI runs; not claimed verified. SaveApiKeys awaiting Firestore acknowledgement and emulator cross-origin errors are diagnostic leads, not a proven production regression.

Next: finish merge resolution, verify combined69unit/type/build/targeted Chromium+WebKit, commit/push PR23 and exact remote verify; require fresh full CI. Diagnose optional emulator failure independently, then normal merge/Deploy/hosted verification for each safe milestone. Preserve original master, Project Continuum, weighted83% baseline and permanent progressive-release policy. No speculation or skipped mandatory failures.

## Merged local verification and evidenced progress correction

Runtime9b17458 and polishca9d50c are combined, preserving explicit output-budget revalidation, performance/UI work and all required WebKit suites. `polish-merged-unit.log`: typecheck/all69unit files passed; build passed. Eight Chromium suites clean38s and3 actual WebKit suites clean63s (accessibility/comparison/writing) verify the resolved merge without retries. Next commit/push this merge to PR23 and require fresh full exact-head CI; PR22 current CI39196403013 continues independently.

Previous weighted estimate83% → current82% (medium), same baseline v1/100weights/scope. Newly inspected saveApiKeys→keySaveQueue→saveKeys awaits Firestore backend acknowledgement before local credential activation/catalog discovery. Installed Firebase SDK documents that this promise can remain unresolved offline; independent review confirms the path predates PR22 and can also block later/account saves. P02-B is reopened from1 to0.75, losing exactly1 earned weight; remaining18. This is evidence-based defect discovery, not arbitrary rescoring or scope expansion. Behavioral blocked-write proof and an isolated fix are next while CI runs. It is not an introduced PR22 dependency or a claim of a production WebKit regression. Preserve the milestone releases and finish the fix before overall completion.


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
