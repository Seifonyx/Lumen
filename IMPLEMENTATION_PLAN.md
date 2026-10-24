# Dynamic Model Picker implementation plan

## Current owner-directed iPhone navigation reset

The new explicit owner direction supersedes earlier small-adjustment scope. See `docs/design/IPHONE_NAVIGATION_RESET.md` and the active handoff.

| Milestone | Current evidence/status | Remaining acceptance |
|---|---|---|
| A — Shared navigation and Routing Center | Source implemented; focused Chromium journeys pass | Final browser/forward/swipe/account/accessibility and design review |
| B — Library and Tools | Source implemented; type/search/document/editor return journeys pass | Dense/empty/error/menu/physical phone review |
| C — Cross-app integration and finish | In progress; Settings/project/document headers integrated | Contract migration, exact-head CI, curated before/after, owner review |

No overall program percentage is defined; do not reuse the historical Blackout/Model Picker scope scores as Lumen-wide completion. Phases1–3 shipped; Phase4 Slices2–3 remain; this advance Library/Tools work does not finish Phase5. No merge, deployment or design Gate approval is authorized.


## Current design work — Phase 4, Slice 1

Owner-authorized workstream: `feat/phase4-routing-providers`, based on released `871bc1a647f36550e6f66e527b1252ac84437506` (Phase 3 / PR #49 / successful Deploy #68). Develop, test, commit, push and draft PR only. **No merge or deployment without separate owner approval.** This instruction overrides older release authorization recorded below for previous milestones.

| Task | Status | Acceptance / evidence |
|---|---|---|
| P4-S1 Routing Center & Providers | Review 2 (owner did not approve review 1) locally verified on `claude/lucid-dijkstra-541bbi`; earlier: redesign (design reassessment) on the same branch, built on Codex's `feat/phase4-routing-providers` work (PR #50, kept intact); owner visual review / exact-head CI gate | Redesign: overview as the map on phones (sections open as pages with Back), connection path in provider detail, one status vocabulary, consolidated CSS within budget; see the redesign section of `docs/testing/phase4-routing-providers.md`. Earlier evidence: | Canonical route overview, saved/enabled/discovery separation, safe recovery, responsive list/detail, Chromium/WebKit 8+8 new cases and 3+3 QA viewports, ordinary parity, isolation and budgets passed; exact-head PR CI is a separate gate. See `docs/testing/phase4-routing-providers.md`. |
| P4-S2 Model Discovery & Selection | Not started | Model inventory/picker/search/eligibility consistency; preserve canonical owners and drafts. |
| P4-S3 Auto, Policies, Usage & Diagnostics | Not started | Real decision evidence and provenance; preserve routing, fallback and policy semantics. |

Dependencies: S1 owner design review precedes any release; S2/S3 remain separate coherent slices. No icon detailing until all planned design phases are complete. **Seven-phase design/UX progress is recorded by phase, slice, tests, owner acceptance and release, with no approved overall weighted percentage.** Phases 1–3 shipped; Phase 4 S1 is in draft review, not accepted or deployed. Older Blackout weighted estimates and the separate, completed Model Picker v1 ledger below are **historical scope-specific records**, not estimates of current overall Lumen completion or remaining work. Preserve their underlying evidence; do not reuse their percentages or invent new weights.


## Independent usage-draft fix — 20 October 2026 (Africa/Cairo)

The fix-only branch `fix/usage-draft-no-submit-20261020` contains source checkpoint `8a328bb` (cherry-pick of reviewed `1736a92`). Five UsageMeter buttons explicitly avoid form submission; the new pointer/Enter regression checks draft/message/network/focus behavior at 1440/390 in Chromium and Linux WebKit. Red/green reproduction, independent reruns, typecheck, 149 unit tests and production build passed; normal design regression also passed. See `docs/testing/usage-draft-regression.md`.

Release verification: PR #35 head `d9422173f4d5d503164b15b54dd991265412abae` passed all three exact-head CI jobs in run39444721821 and merged normally to `677bc51f39fbf8fcf66bc91f846b71a4912bb306`. Deploy39447533639 succeeded on that exact SHA; this is the latest verified production runtime. All18 reviewed built assets match live over system-CA-validated HTTPS. Hosted synthetic usage-draft checks passed Chromium/WebKit1440/390. Chromium default cloud CA trust failed, so its test rerun narrowly pinned the existing environment proxy CA public key; WebKit passed with SSL_CERT_FILE pointing to the system CA bundle. No general TLS bypass or product trust change. This verifies the hosted UI fix, not live provider inference or physical iPhone. Model Picker's existing98.5% methodology remains unchanged.

The separate Blackout initiative continues in draft PR #34. Both latest user course corrections explicitly leave identity Gate 1 **NOT APPROVED**. Its full master/research and experimental Workspace/Routing Center proofs remain on that branch; no experimental UI is included here. Do not restart rejected visual directions or merge them with this fix.

Manual test: type an unsent draft; open and close Usage using pointer or Enter. The draft must remain, no message should be sent, and focus returns to Usage. Continue the separate Blackout task from its branch handoff. Rollback is a reviewed normal merge revert followed by deploying a known-good main revision; no force push/reset or branch-protection bypass.

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

**Current checkpoint — 2026-10-22 (hosted acceptance and final docs):** P11-B 0.5 → 1, overall **98.5 → 100/100 (+1.5, medium confidence)** under unchanged baseline v1 weights. The owner approved merging this documentation to main on 2026-10-22; the 0.75 → 1 step is earned by that normal merge (PR #37). The latest deployed runtime `677bc51` (includes all PR25 Model Picker work) was rebuilt and all 174 output files match `lumen-chat.web.app` byte for byte; the Model Picker and core chat browser suites ran against the live site with synthetic guest profiles: Chromium 18 suites/96 checks and WebKit 13 suites/80 checks passed (one Canvas page-load timeout passed on immediate rerun). See [docs/testing/hosted-model-picker-acceptance.md](docs/testing/hosted-model-picker-acceptance.md). The final documentation gate (0.75 → 1) is this synchronized documentation merged normally to main with the owner's approval. The paragraphs below are the earlier 98.5% checkpoint, kept as history.

**Calculation:** overall completion =100 × Σ(weight × earned fraction) / Σ(weights). Total scope100; earned98.5; approximately98.5% complete, **medium confidence**. Remaining weighted work1.5. Previous documented checkpoint88%. The 10.5-point increase is attributable to PR24 production acceptance and PR25 exact-source three-job CI plus normal merge with zero source-tree differences from tested head; the exact PR25 production deployment is now verified by GitHub Actions run 39257887973 (successful manual Deploy on main SHA 1966348, including Firebase live and preview steps); the user reports the live app is working. Independent published-asset parity and hosted Chromium/WebKit smoke tests are still NOT performed here, and final release documentation is still being synchronized. This is a defined-scope engineering estimate, not an answer-quality/perfection claim. Prior checkpoint: no weighted estimate; first baseline83% fell within the disclosed80–85% range; the evidenced P02-B reopening reduced it to82%, then verified PR22/PR23 releases earned the current88%. Historical 'Verified' statements apply to their recorded revisions; this ledger conservatively gates changed integrated paths on current CI.

**Partial credit (apply consistently):**0 not started/no evidence;0.25 accepted, demonstrably completed sub-deliverable;0.5 integrated implementation with partial verification;0.75 feature-specific local tests/integration and review passed but current full CI/integration acceptance still pending;1 all applicable acceptance and required verification pass for the integrated revision. Unintegrated modules cannot earn full feature credit. Blocked/deferred tasks retain only evidenced credit; required unfinished work is never silently excluded. Architectural not-applicable decisions require explicit justification. Final production verification is separately weighted in P11-B, so local/CI/main are never called deployed.

For P11-A, the historical 0.5 checkpoint reflected mapped architecture/local checks while CI was failing; current credit1 reflects PR25 exact-source full Chromium/WebKit/unit/type/build CI success and zero tree differences in merged main. Do not mistake this for live verification; P11-B owns the remaining release/docs gates. For P11-B,0.25 reflects the verified foundation release and coherent source checkpoints;0.5 requires remaining runtime integrated normally into main;0.75 requires latest runtime deployed and live-verified;1 additionally requires final synchronized committed/pushed/merged documentation and exact production ledger. Mandatory unfinished gates prohibit100%.

| Stable task | Weight | Earned fraction | Earned weighted work |
|---|---:|---:|---:|
| P00-A | 3 | 1 | 3 |
| P00-B | 2 | 1 | 2 |
| P00-C | 1 | 1 | 1 |
| P01-A | 6 | 1 | 6 |
| P01-B | 6 | 1 | 6 |
| P01-C | 5 | 1 | 5 |
| P01-D | 4 | 1 | 4 |
| P02-A | 5 | 1 | 5 |
| P02-B | 4 | 1 | 4 |
| P03-A | 6 | 1 | 6 |
| P03-B | 6 | 1 | 6 |
| P04-A | 5 | 1 | 5 |
| P04-B | 4 | 1 | 4 |
| P05-A | 7 | 1 | 7 |
| P05-B | 4 | 1 | 4 |
| P06-A | 3 | 1 | 3 |
| P06-B | 4 | 1 | 4 |
| P07-A | 6 | 1 | 6 |
| P08-A | 5 | 1 | 5 |
| P09-A | 3 | 1 | 3 |
| P10-A | 3 | 1 | 3 |
| P10-B | 2 | 1 | 2 |
| P11-A | 3 | 1 | 3 |
| P11-B | 3 | 1 | 3 |
| **Total** | **100** | | **100** |

Evidence: PR19 full CI39136235729 and verified production02c322 establish the foundation. PR22 exact-source CI39199646064 passed68unit/type/build,98Chromium files and required WebKit; merge3f48c6e/Deploy39243260811 and hosted18asset/Chromium4/WebKit2 verification earned4.75weights. PR23 exact-source CI39199773200 passed69unit/type/build,99Chromium files and required WebKit; mergedab0fff/Deploy39243721175 and hosted18asset/Chromium3/WebKit2 verification earned1.25weights. PR24 source2ce5c9a CI39247939607 passed all required jobs; merge6447a13 was production-verified by the earlier agent with Deploy39250100845, 18 asset matches, hosted Chromium3/WebKit2. PR25 source1ca29f0 CI39249464644 passed all three jobs (Chromium+Firebase, WebKit, unit/type/build). PR25 merged normally to1966348725a9cc6a3bfec0a283448a451aa9d6cd, with zero changed files when comparing tested PR head to resulting main tree. The provided Deploy URL was inspected directly through the GitHub connector: run39257887973 on main at exact commit1966348725a9cc6a3bfec0a283448a451aa9d6cd completed successfully, with npm ci, typecheck, build, Firebase production deploy and dev preview deploy all successful. User subsequently reported the live app is 'all good' (manual acceptance without specified scenario coverage). Independent hosted assets/core Chromium/WebKit smoke checks were not run; do not claim these tests. Superseded failed/cancelled runs remain historical diagnosis, not current release evidence. AI_HANDOFF.md owns exact ongoing operations. Reuse these weights and record each evidence-based change.

## Continuation checkpoint — 2026-10-19 (normal chat after PR25 merge)

**Previous earned work: 88/100 → current evidence-based earned work: 98.5/100 (medium confidence; +10.5).** This reuses baseline v1 and all 24 task weights. It credits the PR25 exact-source green full CI (run 39249464644: Chromium/Firebase, WebKit, type/build/unit) and ordinary merge to main at 1966348725a9cc6a3bfec0a283448a451aa9d6cd. GitHub comparison reports zero changed files between tested source 1ca29f0 and merged main: same code tree. PR24's separately documented hosted release is verified. P11-B advances only to 0.5 because final runtime is integrated into main, not because it was deployed.

**Outstanding 1.5 points:** Exact PR25 Deploy run39257887973 is verified successful and the user reports the app working, but independent reviewed live asset parity and hosted core Chromium/WebKit flows remain unexecuted. Keep P11-B at0.5 rather than grant its 0.75 live-acceptance gate without evidence. The historical ledger has been reconciled with the new current release documentation checkpoint; documentation changes only count toward final completion when committed/pushed/merged. Do not claim100% until required gates are satisfied.

**Next actions:** (1) Compare PR25's reviewed production build to currently hosted assets and run the hosted Chromium/WebKit core smoke matrix when a suitable environment is available; explicitly distinguish user manual acceptance from automated verification. (2) Preserve the historical PR24 release record from `docs/model-picker-release-ledger` in the current validation documentation without blindly merging the divergent old branch. (3) Finish final security/requirements/acceptance review, synchronize docs via reviewed PR and then recalculate P11-B credit strictly from verified evidence. No speculative additional refactor.

## GitHub deployment verification — 2026-10-19 (after PR26)

This checkpoint supersedes only the older `Deploy pending` statements above; all other milestone history remains intact. Run [39257887973](https://github.com/Seifonyx/Lumen/actions/runs/39257887973) was fetched from GitHub: event `workflow_dispatch`, branch `main`, head SHA `1966348725a9cc6a3bfec0a283448a451aa9d6cd`, status `completed`, conclusion `success`, attempt1. The single deploy job completed successfully, including `npm ci`, `npm run typecheck`, `npm run build`, `Deploy live` (Firebase project `the-model-router`, site `lumen-chat`), and dev preview deploy; job logs confirm `Production deploy succeeded` and `Deploy preview succeeded`. This deploy used the exact already-tested source tree. PR26 merged documentation-only updates at `2f9a0e3817b5c01834b2b72180378b3ce5b29c9c`, requiring no runtime redeployment.

User's manual acceptance response: **"its all good"**, indicating no issues noticed during use. The user did not specify which individual acceptance scenarios were exercised. This is useful manual feedback but **not** evidence that the full hosted test matrix, synthetic quota failures, authenticated offline/reconnect races, or asset-by-asset parity were executed. Public live-site fetches from this agent environment failed DNS/access and no hosted Chromium/WebKit suite was run. Preserve the P11-B 0.5 fraction / overall98.5 until its predefined full live-acceptance gate is actually verified. The stable task weights remain unchanged.

## Architectural approach

Extend the existing browser-side provider adapters and shared request runtime. Keep stable provider-prefixed IDs and existing saved settings/layout schemas wherever possible. Discovery must publish one coherent credential-scoped registry; selection and execution consume it. Preserve user choices separately from transient availability. Unknown specifications stay unknown; inferred rankings are not measured answer quality. Browser refresh runs only while the app can execute.

Use a working branch for incomplete milestones. Main updates require the relevant repository checks and protections. No force pushes. Each verified milestone includes updated documents, focused tests, a reviewed commit, and verified remote synchronization. Deploy merged main through the existing manually dispatched Deploy workflow; verify hosted behavior when released.

## Requirement coverage and phases

| Phase/task | Requirements | Dependencies | Deliverable and acceptance evidence | Status |
|---|---|---|---|---|
| P00-A audit lifecycle | §§1–18, execution protocol | none | Trace adapters, credentials, registry, settings, picker, routing, layouts, comparison, streams, persistence and relay. Record concrete gaps and applicability. | Verified |
| P00-B baseline/environment | §§16–17 | none | Existing type/unit/build checks and representative browser flows execute; failures diagnosed, not hidden. Reuse Node22 and existing browser setup. | Verified |
| P00-C durable scope/checkpoints | execution protocol | none | Verbatim master directive, comprehensive roadmap, exact handoff committed; remote availability verified. | Verified |
| P01-A scoped registry | §§2,4,5,13,15 | P00 | Provider/endpoint identity, credential generation, normalized capabilities, provenance/freshness and availability; no stale credentials/account leakage. | Verified |
| P01-B adapter discovery | §§2,4,15 | P01-A | Actual supported list APIs, pagination/deduplication, dynamic new models; truthful documented declarations where no list API exists; no fabricated specs. | Verified |
| P01-C reconciliation | §§2,4,9 | P01-A/B | Last-known-good for transient errors only; definitive permission failure never revives old models; removals never erase fixed layouts or explicit choices. | Verified |
| P01-D user declarations | §§2,4,5,13,15–16 | P01/P03 | Add/remove declared models and fill unknown metadata for supported endpoints; API/documented facts outrank user assumptions, authentication failure cannot resurrect declarations, live propagation and private settings persistence verified. UI/raw-derived registry and diagnostic policy verified by PR22 full CI/main/hosted Chromium/WebKit. | Verified |
| P02-A refresh coordinator | §§2–3,14 | P01 | Configuration events, manual refresh, TTL, lifecycle/resume/online, active-runtime refresh, bounded concurrency/retries/backoff/jitter, in-flight dedupe and out-of-order protection. | Verified |
| P02-B persistence/sync | §§3–5,13 | P01/P02-A | Credential/account/endpoint-scoped cache, safe invalidation, metadata updates propagate without remounts or edit loss. Fake-clock and account/key-race tests; stalled-write/reload/re-auth/denial repair verified locally, new full CI required. | Verified in PR25 full CI and merged main; live release gate tracked by P11-B |
| P03-A shared eligibility | §§4–6,8–10,15 | P01/P02 | One capability/context/permission contract used by all applicable selection and request paths; strict requirements precede scoring; unknowns bounded. Shared contract verified by PR22 full CI/main/live; caller-specific readiness repairs remain in P06-B. | Verified |
| P03-B Auto policy/evidence | §§6,14,16 | P03-A | Quality/speed/cost/balanced preferences, ambiguity/mixed-task handling, unknown-model uncertainty, metadata-driven newcomers; deterministic task cases and honest ranking explanations. Actual answer benchmarks remain distinct from routing mocks. | Verified |
| P04-A layout lifecycle | §7 | P03 | Creation/edit/delete/duplicate/save/load, presets, fixed and Auto assignments, roles/preferences/fallbacks, registry updates and missing assignments; tested backward compatibility/migrations. | Verified in PR25 full CI and merged main; live release gate tracked by P11-B |
| P04-B layout execution design | §§7,10 | P04-A | Applicability documented in docs/MODEL_PICKER_ARCHITECTURE.md: preserve Auto/order sets, add saved constraints/priority/fallback scopes, use existing parallel comparison → conditional synthesis stage graph, and recover individual failed stages in P07. | Verified in PR25 full CI and merged main; live release gate tracked by P11-B |
| P05-A recovery contract | §§8,11,13–15 | P03 | Shared classified failures and mode-specific policy; cancellation/terminal failures do not reroute, strict manual/layout constraints respected; request/attempt deadlines and bounded spend. Credential scope cancellation/retry and helper-body isolation implemented; classified recovery and metadata invalidation now integrated locally; final review variants/tests remain. | Verified in PR25 full CI and merged main; live release gate tracked by P11-B |
| P05-B recovery/discovery integration | §§3,8 | P02/P05-A | Model/capability failure triggers bounded invalidation without refresh/retry recursion; provider health, cooldown/circuit state and ordered candidate selection tested. Targeted expiry/throttle verified by full PR22 CI and hosted production checks. | Verified |
| P06-A manual selection | §§5,9,12 | P03/P05 | Stable explicit selection through refresh/restart; compatibility/availability feedback; substitutions require existing explicit fallback authorization. PR19 full CI and live selection-policy checks verify this contract. | Verified |
| P06-B all execution callers | §§5,8,10 | P05 | Audit/fix chat, compare, synthesis, canvas, side chat, tasks, summaries and tools. Each mode uses appropriate shared metadata/policy. Shared helper pool/title/research integration verified locally and independently reviewed; PR22 CI/release pending. | Verified in PR25 full CI and merged main; live release gate tracked by P11-B |
| P07-A multi-model runtime | §§7,10 | P04/P05/P06 | Bounded concurrency, recover only failed stages, explicit roles/dependencies/context transfer, preserve partial successes, safe cancellation; no unexpected paid calls. Immutable stage retry/synthesis/UI verified in phone/desktop Chromium/WebKit; PR22 CI/release pending. | Verified in PR25 full CI and merged main; live release gate tracked by P11-B |
| P08-A streaming/state | §§8,10–11 | P05/P07 | Before/after-visible-output failure distinction, no duplicate output or seamless false continuations, no stale state/orphans; tool side effects never replayed blindly. Completion/partial-output/cancellation contracts verified by full PR22 CI and hosted production checks. | Verified |
| P09-A shared selection UX | §§5,7,9,12 | P01–P08 | Search/group/filter/status/preference/layout workflows, stable open edits during refresh, phone/desktop keyboard/focus/touch/scroll/a11y. Existing style preserved; TTL/query/focus, canonical controls,44px fields/announcements and axe matrix verified by full PR23 CI/main/live. | Verified |
| P10-A security review | §§13,15–17 | continuous | Credential/logging/storage scope, relay SSRF/allowed hosts, permission/billing/privacy boundaries and custom endpoint declarations reviewed with negative tests. Credential/relay/account/budget boundaries and independent review passed. Final Gemini classifier follow-up and scope/budget/search regressions pass independent review; full exact-head CI/release gates remain. | Verified in PR25 full CI and merged main; live release gate tracked by P11-B |
| P10-B performance/cost | §§3,6,10,14 | continuous | Measure discovery requests/concurrency, registry/routing overhead and UI update cost where practical; no speculative complexity or hidden extra inference calls. Zero-network synthetic routing/helper/layout/snapshot benchmark and144+512 exact-decision parity cases; faster family/diversity scans without policy changes. | Verified |
| P11-A regression/architecture review | §§1,16–18 | P01–P10 | Full type/unit/build; all relevant Chromium and Linux WebKit tests, security/compatibility review; unresolved failures investigated and actual hardware limits documented. Full master/mode evidence map in docs/MODEL_PICKER_VALIDATION.md; PR25 exact-head CI green, tested tree matches merged main. Physical iPhone/paid answer-quality benchmarks explicitly out of scope. | Verified in source CI and merged main |
| P11-B release/sync/production | §§17–18, protocol | P11-A | Reviewed coherent commits on remote; required CI green; protected main integration; deployment and hosted asset/core-flow verification; final handoff and manual test steps. PR19/22/23/24 deployed and live-verified per recorded prior agent evidence; PR25 exact-source CI passed, main merged and Deploy run39257887973 confirmed successful on exact main commit1966348. User reports live app working; automated hosted parity/Chromium/WebKit matrix remains unverified by this chat. Final synchronized release documentation is being reconciled. | In progress |

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


## Active continuation checkpoint — 2026-10-19 11:18UTC

Current ROOT branch feat/model-picker-final-recovery based8f4a02ce3380a6dca6034cd769314dd2777d1447; final-recovery implementation is LOCAL/UNCOMMITTED and must not accidentally enter an earlier release. User repeated Project Continuum; same scope/weights/protocol, no restart. Weighted baseline remains82%/medium until current acceptance/integration gates close. No perfection/real-provider/physical-iPhone claim.

Release ledger (supersedes stale historical paragraphs): PR22 head984b1a9f9fd897e3aac40eeb6ae287a77f266424 passed complete CI39199646064, all3 jobs,68unit/build/type,98Chromium files clean904s, required WebKit green. Normally merged3f48c6e02719b5f0c28be85e4c1e6e3cc2ef045b and Deploy39243260811 succeeded. pr22-live-assets.json matches18 actual hosted assets to reviewed runtime build. Hosted Chromium declarations/comparison/selection/layout4 suites passed clean49s; hosted WebKit declarations/comparison2 suites still running at this checkpoint. Latest main3f48c6e; latest deployment3f48c6e; previous completely hosted-verified rollback02c322 remains until current WebKit completes. PR23 head1793e4ac23d823ffa2cd056617ca63717776f931 passed fullCI39199773200, all3jobs,69unit/build/type,99Chromium files clean893s, requiredWebKit green. Next release once22liveverification finishes; no unfinished dependency. PR24 latest pushed/exactremote5f455debf264f16090b1727bbb943a2e20e477b7, CI39243179620 pending; contains key-save8f source plus corrected provider fixture/ledger, not final-recoveryWIP. Source/runtime worktree /workspace/Lumen-runtime-release remains984; policy-release currently keybranch5f; ROOT no longer checks out polish179.

Final-recovery implementation (existing P02-B/P06-B, not new scope): new account-settings-persistence.ts stages immutable fullsettings snapshots locally before existing800ms debounce, independent settings revisions/ACK/replay/read protection, semantic no-op detection, currentUID/session/denial guards. Firebase read captures both snapshots, reconciles settings first then passes chosen settings into key reconciliation; settings remote writes replace the whole settings field with mergeFields, preserving key fields. No unconditional startup writes or generic job framework. Five actual Firebase-boundary red cases (pending/predebounce layout, concurrentread edit, independent key/settings, write-denial) now pass7/7. Pure settings16/16; source units77files/type passed in final-recovery-unit.log. Settings-storage failures receive honest feedback; existing debounced behavior remains. Key coordinator now dedupes replay by UID/session/revision and refuses stale-session ACK; deterministic sameUID re-auth resume red→green proves old stalled promise cannot suppress current recovery.

Canvas omitted current blockedModels, consuming retry budget on exhausted assigned backups; actual extracted Canvas planning/buildChatBody/runChat regression red→green2cases. summaryModels treated explicitly fixed-order layout IDs as Auto-excluded, unlike normal manual/layout chat; caller now exempts only explicitly assigned fixed IDs while retaining Auto/outside exclusions and hard readiness/context/requirements. Actual extracted-caller5cases red→green. Research laterqueries used stale quota readiness; per-query blockedModels now travels to existing runtime within frozen permitted pool. Actual planner/search/UsageTracker test red→green,18bounded calls, no outside layout, strict search+4096 retained. Relevant tests: canvas-routing-integration, helper-layout-integration, research-readiness-integration, account-settings-integration/persistence, expanded account-key-persistence.

Pending: layout-save-resilience.cjs browser proof. First diagnostic timed out waiting a non-default Pro row; corrected fixture includes a default Flash row and awaits actual enabled row rather than assuming display-label behavior. That first run is NOT evidence of layout loss. Unit integration already proves the loss. Run browser test against reviewed runtime dist (MR_TEST_DIST=/workspace/Lumen-runtime-release/dist) after hosted runner releases5190, get valid red; build ROOT current source, run green/newlayout +key-save +broaderaccount/regression/WebKitguest. Review final complete diff, update docs, commit/push coherent final milestone and PR/fullCI, release earlier22/23/24 when independently green, then final milestone. No overlapping preview runners/rebuilds under active server. MASTER_REQUIREMENTS.md unchanged; persistent policy/protocol preserved.

Current local WIP: firebase.ts, account-key-persistence.ts, store.ts, providers.cjs copied verified fixture, new account-settings module and6newunit/browser files. docs here intentionally track partial verified state; commit only after current relevant checks and independent review. Preserve three owned named stash backups (already recovered source/ledger); do not blindly pop. Exact next action: complete22 hostedWebKit, merge/Deploy23 and liveverify serially; run corrected layout browserred/green while24CI runs. Original release rollback normal reviewed revert/deploy, no protections bypass.


### Verified progressive release and weighted checkpoint

Previous82% → current86.75% (approximately87%, medium confidence), unchanged baseline v1/100weights. P01-D declarations, P03-A shared eligibility, P05-B bounded discovery invalidation and P08-A streaming/state now earn1 instead of0.75 after complete exact-head CI39199646064, normal PR22 main integration3f48c6e, successful Deploy39243260811,18matchingliveassets, four hostedChromium suites49s and two actualhostedWebKit suites66s, all clean without retries. Their distinct implementation acceptance is verified; ongoing layout/settings/caller work remains credited only in P02-B/P04/P06/P07 as appropriate. Remaining13.25weighted work includes those final repairs, polish acceptance and P11finalcross-project integration/release/docs. This is evidence-driven earned credit, not a scope/weight change or perfection claim. PR23 passed all3required CI39199773200,99Chromium files893s clean, and is now entering its separate normal merge/Deploy/live verification. No sourceWIP is included.


### PR23 verified production checkpoint

PR23 normally merged dab0fff854cc9657fd707b9e279c3bdb168bd64d, Deploy39243721175 success;18liveassets match exact reviewedpolish source (pr23-live-assets.json). Hosted Chromium accessibility/priorities/layout3 suites passed35s; hostedactualWebKit accessibility/layout2 passed67s, no retries. Source1793e4a fullCI39199773200 all3jobs green,99Chromium files893s clean. Latest fully verified production is nowdab0fff; previous3f48c6e is the next rollback reference. OriginalMASTERunchanged. P09-A andP10-B nowearn1 after their complete currentCI/main/production acceptance:86.75→88%, same100weights/v1/medium,12remaining. No credit yet for unfinished final settings/caller/P11 work. PR24 head5f455de fullCI39243179620 unit/build andWebKitgreen, Chromiumstillpending.

Final localproofs: final-recovery-current-unit.log all78unit/type pass; currentbuildpasses; final-recovery-persistence-chromium.log key+layout2suites clean12s before the startupguard; newactualupdateSettings startup7case red→green covers early cached-account edits without emptyhydration overwrites or prematurecloudwrites. Fresh current7Chromium/3WebKit regression matrix is running after finalguard. New deep-research fixture follow-up nowuses truepreview UID/noemulator andactually selectsMR_WEBKIT engine; run focusedboth after currentrunnerfinishes, add torequiredWebKit oncegreen. Do not suppress emulatorerrors or claimChrome runasWebKit. SourceWIP remains separate fromalreadydeployed22/23 andpending24.


## Current final-recovery acceptance checkpoint

88%/medium,12remaining using unchangedv1 weights. Latest verified main/productiondab0fff (PR23/Deploy39243721175 +18assets/hostedChromium3+WebKit2), previous3f48c6e verified(PR22). PR24 pushedb704902/fullCI39245177533pending; isolatedkeysource has no dependency on this ROOT milestone. ROOT feat/model-picker-final-recovery basedb704902 now integrates all verified fixture corrections before its own commit. Handoff current ledger supersedes archived history.

Final remaining implementation is locally verified, not yet fullCI/released: P02-B/P04-A settings/layout pending-revision durability and startup edit race, sameUID key replay; P06-B/P07-A Canvas/currentsearch readiness and explicit fixed-layout helper exclusions. Relevant source/newtests/evidence/nextcommands/manual steps are in AI_HANDOFF.md. All78unit/type/build pass; actual browser key/layoutred→green; correctedfiveChromium/fouractualWebKit matrix green; independent review startupfinding red→green7 and source approval. Full new101file Chromium/expandedrequiredWebKit CI, main merge, actual Deploy/live verification and final synchronized documentation are still required. No100% or perfection claim. MASTER_REQUIREMENTS.md preserved verbatim.


Final coherent checkpoint verification before commit: final-checkpoint-unit.log all78unit/type pass, final-checkpoint-build.log build passes after integration ofb704902 ancestry and all source review fixes. Product tree was not changed afterward. Four actual WebKit suites pass47s and five corrected guest Chromium suites33s; key/layout current browserproofs and individualCanvas/writing/study/layout passes are detailed above. Required newCI will run101Chromium files and include actualWebKit deep research. Source snapshots and docs are coherent; commit/push now, verify exactremoteSHA, open PR, waitfullcurrentCI before release. No production claim for this final milestone.


Final runtime checkpoint committed/pushed/exact remote verified:7cde3ea39a13408a266d16ae325b0e88357af387, feat/model-picker-final-recovery, PR25, CI39245877175 pending. PR24 b704902/CI39245177533 remains independent. Current weighted88%/medium/12remaining unchanged until these acceptance/release gates pass. Local subsequent edits are documentation-only final ledger/requirements mapping, not hidden runtime work.


## Full-CI fixture follow-up — 2026-10-19

PR24 exactb704902 fullCI39245177533 passed type/build/72unit and required WebKit, but failed2/100Chromium files: answer-style used an explicitly privileged preview identity while expecting developer controls hidden; phone-windows seeded Study data under its former unprefixed account ID. No product failure or permission change. Corrected preview-role expectation and exact normalized Study key. New developer-options unit renders the actual AboutSection with actual developer list/isPreviewUser, preserving ordinary/missing-user negative coverage plus both developers/case normalization and preview positive. The current invite list contains only the two developer accounts; no invented nondeveloper authenticated access.

Evidence: key-fixture-role-phone-chromium.log2suites clean15s including390/320phone; key-role-phone-unit.log type/all73unitfiles pass; actual rendered2case matrix passes. Independent profile-consumer/permission review accepted coverage and found no other mismatches. Runtime/build tree remains identical tob704902, so prior reviewed production build is retained. Require fresh complete exact-head CI before normal merge/deploy; earlier failed run is not green evidence. Completion remains88%, pending final release gates.

Integrated final fixture evidence: final-role-phone-unit.log type/all79unitfiles pass; final-role-phone-chromium.log2suites clean9s. Product/workflow tree matches7cde3ea exactly; reviewed final dist remains valid. PR24 updated exact2ce5c9a fullCI39247939607 is running. Commit/push this fixture-only merge and require fresh complete PR25 CI; no runtime release is claimed.


## Tools interaction root-cause repair — 2026-10-19

Current key/final replacement WebKit jobs118044358442/118044968193 succeed but are NOT retry-free: hub-actions desktop second comparison open retried in PR24; Study opening retried in PR25. Logs pr24-role-green-webkit.log/pr25-role-green-webkit.log preserve first failures. Investigation found ToolsPage declares Card inside its render function: React changes the component type and replaces tool buttons whenever parent search/connection/scroll-observer state updates. A release can therefore lose its original pointer target. This predates all current key/settings work; deterministic browser reproduction establishes the defect, not an unsupported claim that historical logs captured its exact triggering event.

The new tool-card-stability regression holds Study/Compare while changing only trailing search whitespace (identical filtering/position), asserts the original DOM node survives, then releases and checks the actual page/dialog. Old d9cf8db build fails isConnected=false on both runner attempts (tool-card-stability-red.log). Module-scope ToolCard preserves identical markup/actions with stable component identity; no memoization, permissions, animation or model-policy change. Local79unit/type/build pass; Chromium3suites tool-card-stability/hub-actions/study pass. Actual WebKit3suites and independent final diff review pending. The new regression is also added to required WebKit CI.

This small UI recovery repair belongs to final PR25; PR24 remains application-source unchanged and independent. Require fresh full PR25 CI after this source change, not only old d9cf8db CI. PR24 current fullCI39247939607 continues and can release independently once all checks and diagnosed retry evidence are accepted. Production remainsdab0fff. No increased progress credit until release acceptance.

Tool-card final local verification: tool-card-stability-unit.log type/all79unitfiles pass; build passes; targeted Chromium3suites clean27s and actual WebKit3suites clean45s (tool-card-stability-chromium/webkit.log). Independent actual source/test review finds no blocker. Source/root head will include this coherent repair; require a fresh exact-head complete PR25 CI after push. No application code in key-release branch2ce5c9a changes.
