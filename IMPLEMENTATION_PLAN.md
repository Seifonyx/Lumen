# Dynamic Model Picker implementation plan

Authoritative scope: [MASTER_REQUIREMENTS.md](MASTER_REQUIREMENTS.md), preserved verbatim from the user's upload. Operational state: [AI_HANDOFF.md](AI_HANDOFF.md). Existing behavior: PRODUCT.md; visual rules: DESIGN.md.

Status vocabulary: **Not started**, **In progress**, **Implemented but unverified**, **Verified**, **Blocked**, **Deferred with justification**. Visiting a phase does not complete it. All requirements remain in scope unless an explicit, documented architectural applicability decision explains otherwise.

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
| P01-D user declarations | §§2,4,5,13,15–16 | P01/P03 | Add/remove declared models and fill unknown metadata for supported endpoints; API/documented facts outrank user assumptions, authentication failure cannot resurrect declarations, live propagation and private settings persistence verified. Standalone normalization/merge and tests implemented; integration remains. | In progress |
| P02-A refresh coordinator | §§2–3,14 | P01 | Configuration events, manual refresh, TTL, lifecycle/resume/online, active-runtime refresh, bounded concurrency/retries/backoff/jitter, in-flight dedupe and out-of-order protection. | Verified |
| P02-B persistence/sync | §§3–5,13 | P01/P02-A | Credential/account/endpoint-scoped cache, safe invalidation, metadata updates propagate without remounts or edit loss. Fake-clock and account/key-race tests. | Verified |
| P03-A shared eligibility | §§4–6,8–10,15 | P01/P02 | One capability/context/permission contract used by all applicable selection and request paths; strict requirements precede scoring; unknowns bounded. Core chat/layout/comparison verified; remaining helper callers tracked in P06-B. | In progress |
| P03-B Auto policy/evidence | §§6,14,16 | P03-A | Quality/speed/cost/balanced preferences, ambiguity/mixed-task handling, unknown-model uncertainty, metadata-driven newcomers; deterministic task cases and honest ranking explanations. Actual answer benchmarks remain distinct from routing mocks. | Verified |
| P04-A layout lifecycle | §7 | P03 | Creation/edit/delete/duplicate/save/load, presets, fixed and Auto assignments, roles/preferences/fallbacks, registry updates and missing assignments; tested backward compatibility/migrations. | In progress |
| P04-B layout execution design | §§7,10 | P04-A | Applicability documented in docs/MODEL_PICKER_ARCHITECTURE.md: preserve Auto/order sets, add saved constraints/priority/fallback scopes, use existing parallel comparison → conditional synthesis stage graph, and recover individual failed stages in P07. | In progress |
| P05-A recovery contract | §§8,11,13–15 | P03 | Shared classified failures and mode-specific policy; cancellation/terminal failures do not reroute, strict manual/layout constraints respected; request/attempt deadlines and bounded spend. Credential scope cancellation/retry and helper-body isolation implemented; typed failures remain. | In progress |
| P05-B recovery/discovery integration | §§3,8 | P02/P05-A | Model/capability failure triggers bounded invalidation without refresh/retry recursion; provider health, cooldown/circuit state and ordered candidate selection tested. | Not started |
| P06-A manual selection | §§5,9,12 | P03/P05 | Stable explicit selection through refresh/restart; compatibility/availability feedback; substitutions require existing explicit fallback authorization. | Not started |
| P06-B all execution callers | §§5,8,10 | P05 | Audit/fix chat, compare, synthesis, canvas, side chat, tasks, summaries and tools. Each mode uses appropriate shared metadata/policy. | Not started |
| P07-A multi-model runtime | §§7,10 | P04/P05/P06 | Bounded concurrency, recover only failed stages, explicit roles/dependencies/context transfer, preserve partial successes, safe cancellation; no unexpected paid calls. | Not started |
| P08-A streaming/state | §§8,10–11 | P05/P07 | Before/after-visible-output failure distinction, no duplicate output or seamless false continuations, no stale state/orphans; tool side effects never replayed blindly. | Not started |
| P09-A shared selection UX | §§5,7,9,12 | P01–P08 | Search/group/filter/status/preference/layout workflows, stable open edits during refresh, phone/desktop keyboard/focus/touch/scroll/a11y. Preserve established styling. | Not started |
| P10-A security review | §§13,15–17 | continuous | Credential/logging/storage scope, relay SSRF/allowed hosts, permission/billing/privacy boundaries and custom endpoint declarations reviewed with negative tests. Credential-boundary and scoped health-record fixes tested; final review remains. | In progress |
| P10-B performance/cost | §§3,6,10,14 | continuous | Measure discovery requests/concurrency, registry/routing overhead and UI update cost where practical; no speculative complexity or hidden extra inference calls. | Not started |
| P11-A regression/architecture review | §§1,16–18 | P01–P10 | Full type/unit/build; all relevant Chromium and Linux WebKit tests, security/compatibility review; unresolved failures investigated and actual hardware limits documented. | Not started |
| P11-B release/sync/production | §§17–18, protocol | P11-A | Reviewed coherent commits on remote; required CI green; protected main integration; deployment and hosted asset/core-flow verification; final handoff and manual test steps. | Not started |

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
