# Model Picker requirement validation

MASTER_REQUIREMENTS.md is the unchanged authoritative specification. This maps its requirements to the current application architecture and evidence; it does not replace the requirements or claim measured answer quality. AI_HANDOFF.md and IMPLEMENTATION_PLAN.md own exact commit/deployment state.

## Requirement map

| Master section | Implementation and architectural boundary | Verification evidence |
|---|---|---|
| 1 Audit | Browser adapters → scoped registry/cache → Zustand settings → selection/layouts → bounded runtime → persisted chat/usage; fixed-host relay and Firebase private account storage | Architecture document, source review, initial baseline and operational handoff |
| 2 Discovery | Native list APIs/pagination per supported adapter; documented Perplexity list; supported-endpoint user declarations; compatible new models publish without redeploy | model-registry, discovery-integration, declaration-registry/model-declarations; catalog-lifecycle/model-declarations browser flows |
| 3 Refresh | Scope generations, bounded discovery concurrency4/attempt15s, retry/backoff/jitter, provider TTL, active/resume/online refresh, throttled inference-triggered expiry | catalog-refresh, catalog-scope, metadata-invalidation, discovery-integration and lifecycle browser tests |
| 4 Registry | Stable provider/endpoint identity, API/documented/user/inferred/unknown provenance, optional capability/context/output/price data, same-scope last-known-good, sticky explicit denials | declaration-registry, model-declarations, runtime-registry-removal, runtime-capabilities, scope/metadata tests |
| 5 Picker | Shared eligibility and selectedModel resolution; context-specific picker/compare/layout/settings controls consume live registry, preserve explicit selections/open edits | selection-policy, routing-priorities, model-picker-accessibility, layout-policies and declarations browser suites |
| 6 Auto | Deterministic task/artifact/complexity analysis, hard checks before ranking, quality/speed/cost/balanced and prompt overrides, bounded reliability/latency/family hints, honest unknowns | routing/task/preference/health unit suites and auto-intelligence/selection-policy browser matrices; synthetic CPU benchmark, not an answer benchmark |
| 7 Layouts | Existing Auto or fixed-order model sets; create/edit/duplicate/delete/save/presets/defaults; persisted requirements/priority/fallback scope, missing assignment feedback | layout-builder, layout-policy, layout-runtime-requirements and layout-policies browser matrices; optional fields preserve legacy schemas |
| 8 Recovery | Shared classified failure/policy contract; finite authorized queues, chat max5 attempts/deadlines, helper max4 attempts/deadlines, auth/billing provider skip, bounded metadata expiry, partial-output/tool safety | recovery/recovery-integration, reroute, credential/provider-error boundaries, helper-policy/completion, context-recovery and runtime removal cases |
| 9 Manual | Explicit compatible choice remains first; substitution requires configured consent; disabled switching blocks incompatible substitution; removed defaults survive refresh/restart | selection-policy/model-selection unit and phone/desktop browser tests, live PR19 checks |
| 10 Orchestration | Comparison2–3 parallel source slots → optional dependent synthesis; retry failed/stopped slot only, retain successes, explicit Stop, original request snapshots; research plan → bounded2 search workers → report | comparison-stage/snapshot, comparison-recovery/combine, deep-research, helper policy, credential tests |
| 11 Streaming | Semantic provider finish vs EOF, partial failures stay visible, bounded trailing usage drain, no postfinish extra text, cancellation for every buffered adapter delta, no implicit replay of tool output | stream-completion, SSE, credential-boundary/provider-error-boundary, runner/reroute and comparison/context browser cases |
| 12 UX | Shared focus owner, local Escape, labelled native/glass controls, stable TTL refresh, inline errors, model/layout constraints/availability feedback, phone/desktop/light/dark/reduced-motion support | UX-CONTRACT.md, model-picker-accessibility axe/keyboard matrix, comparison-recovery, existing accessibility/fit/layout/motion suites; screenshot inspection |
| 13 Security | Account/key/config hashes for cache/health, generation-bound requests and error bodies, redact before truncation, no credential fields in declarations, official upstreams/relay allowlists and redirect refusal, provider billing opt-ins | catalog-scope, credential-boundary/provider-error-boundary, model-declarations, provider config/relay negative tests and independent review |
| 14 Performance/cost | TTL/deduped discovery, finite model calls, scoped helpers and output budgets, no automatic unchecked-declaration probes, selected-source synthesis only, no classifier inference, reduced routing scans | registry/concurrency tests; declared-background; output-budget/helper-policy/usage tests; reproducible benchmark runner with zero provider requests |
| 15 Extensibility | Additive metadata/settings, localized official adapter/config interface, dynamic compatible new models; no claim to infer unknown provider protocols | Discovery integration, declaration normalization, optional-schema backward compatibility and architecture review |
| 16 Testing | Deterministic provider mocks, meaningful red→green failure/credential/state cases; Node22 type/unit/build, Chromium+Firebase and actual Linux WebKit CI | Exact-head workflow checks and logs recorded in AI_HANDOFF.md; final CI is still required for each new head |
| 17 Production | Independent releasability/security/compatibility/dependency review, ordinary GitHub merge, clean CI checkout/deploy, hosted asset/live core-flow verification, reviewed rollback | Progressive deployment policy and release ledger; do not confuse pushed/merged/deployed |
| 18 Completion | All applicable contracts above plus final current CI, final production deployment and synchronized documentation | Overall completion remains pending until the current release gates and remaining plan rows pass |

## Execution-mode coverage

| Mode | Shared selection/recovery owner | Important guarantee |
|---|---|---|
| Auto/manual chat, assistants, side chat and scheduled tasks | selectedModel/planRoute/planLayout → performAssistant → runChat | Same hard checks and consent; tasks/tool stages retain strict capabilities and normal cancellation |
| Custom Auto/order layout | layout-policy + runChat saved modelRequirements | Fixed order and configured fallback scope remain authoritative after metadata changes |
| Canvas edits | shared layout/route planning + streamChat/runChat | Compatible request/context and saved requirements; existing document edit/apply controls retain their own side-effect safety |
| Comparison source | frozen explicitly selected slot → runComparisonStage → runChat with no outside fallback | Never automatically substitute another selected source; explicit retry affects only that slot |
| Synthesis | shared helper ranking within completed selected IDs → runComparisonStage/runChat | No outside provider, failed-source/synthesis contamination or restart of successful source calls |
| Summary/title/study/history/writing/memory | helperModels + scopedSummary/title guard + classified summarize | No hardcoded disabled model injection; originating policy/saved constraints/fresh membership and appropriate output budgets |
| Research | scoped helper planner → strict search runChat stages → report | Two workers, bounded queries, no incomplete search notes/sources treated as finished evidence |
| Model diagnostics | explicit probeModel/checkModels, separate existing weekly check | Tiny diagnostic truncation preserves512-token retry; unchecked declarations excluded from automatic probes |

## Applicability and practical limits

The saved-layout schema is an Auto/order model set, not an arbitrary execution DAG. Existing comparison and research graphs provide parallel/sequential/conditional stages, specialist purposes, dependencies, aggregation and per-stage recovery. A new general workflow language/editor would be a separate product feature, not a necessary replacement of stable saved layouts. Fixed custom assignments stay fixed; built-in dynamic recommendations remain dynamic until edited/saved.

A browser can refresh only while its runtime executes. Static Firebase Hosting has no inference scheduler; do not promise discovery while the browser is suspended. Unsupported arbitrary upstream protocols are not automatically invented. The configured user relay still resolves only supported server-side provider routes; endpoint/account changes do not silently retarget declarations.

Unknown metadata remains unknown. Declared capability assumptions are labelled unchecked; adapter ceilings and API denials outrank them. Family-based quality preferences and deterministic routing tests do not prove comparative real-answer quality. No paid benchmark workload or physical iPhone testing was performed. Linux WebKit, mocked provider responses and synthetic CPU measurements have those explicit limits.

The generic premium static scan still reports22 inherited form/textarea findings after control ownership is documented. They are not22 new Model Picker runtime defects; CSS-owned composer/comparison resizing and deliberate vertical editing variants are explained in UX-CONTRACT.md. New model flows use explicit labels, validation/focus and rendered axe checks. Do not claim a clean global static scan.

## Release gate

For every independently releasable milestone, inspect the complete diff and current tree, verify relevant local checks and all required exact-head CI, confirm no unfinished dependency, review risks and rollback, merge normally, deploy that merged revision, verify actual hosted assets/core flows, record the exact production commit separately, and continue remaining work. No bypasses, force pushes, accidental local WIP release or build-only readiness claims.


## Final reliability milestone coverage (PR25; full current CI/release pending)

| Requirement | Integrated behavior | Local evidence |
|---|---|---|
| §§3–5,7,13,16 | API keys and full settings/layout snapshots use independent cache-only revisions, immutable SDK submissions, stale-read/reload protection, current-UID/auth-session denial/replay guards and unchanged save debounce; settings-only field replacement preserves credentials and removes stale nested keys. | account-key-persistence/integration, account-settings-persistence/integration/startup, key-save-resilience and layout-save-resilience. Actual blocked-write layout loss and early cached-startup edit loss reproduced before fixes. |
| §§8,10,14,16 | Canvas/research transfer current quota readiness into bounded recovery within their original permitted pools; repeated exhausted backups cannot starve the ready authorized alternative. Research retains fixed first intent, strict search and4096allowance. | Canvas actual-caller2cases, research actual planner/UsageTracker/runtime6query case18bounded calls/no outside model; Canvas phone/desktop and research browser flows. |
| §§7–9,12,16 | Explicit fixed-order layout assignments bypass Auto-only exclusions for helper execution; dynamic Auto/outside exclusions and hard requirements/order/readiness/fallback consent remain. | helper-layout actual-caller5case matrix plus writing/study/layout browser regressions. |
| §§13,16 | Sandbox fixture IDs and IndexedDB seeds use the real preview- namespace; actual-account/invite/denial tests remain authenticated. | Shared profile/seed normalization and corrected direct storage references; affected5Chromium/actualWebKit research; final4actualWebKit research/writing/study/layout matrix. No error suppression. |

Local final source7cde3ea passes78unit/type/build and independent review. Complete exact-head CI39245877175, normal main merge and production deployment/live verification remain required; this table does not mark the overhaul finished. AI_HANDOFF.md owns the exact evolving source/main/production ledger and honest emulator/hardware/answer-quality limits.
