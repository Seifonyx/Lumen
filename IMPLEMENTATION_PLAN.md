# Dynamic Model Picker implementation plan

Authoritative scope: [MASTER_REQUIREMENTS.md](MASTER_REQUIREMENTS.md), preserved verbatim from the user's upload. Operational state: [AI_HANDOFF.md](AI_HANDOFF.md). Existing behavior: PRODUCT.md; visual rules: DESIGN.md.

Status vocabulary: **Not started**, **In progress**, **Implemented but unverified**, **Verified**, **Blocked**, **Deferred with justification**. Visiting a phase does not complete it. All requirements remain in scope unless an explicit, documented architectural applicability decision explains otherwise.

## Architectural approach

Extend the existing browser-side provider adapters and shared request runtime. Keep stable provider-prefixed IDs and existing saved settings/layout schemas wherever possible. Discovery must publish one coherent credential-scoped registry; selection and execution consume it. Preserve user choices separately from transient availability. Unknown specifications stay unknown; inferred rankings are not measured answer quality. Browser refresh runs only while the app can execute.

Use a working branch for incomplete milestones. Main updates require the relevant repository checks and protections. No force pushes. Each verified milestone includes updated documents, focused tests, a reviewed commit, and verified remote synchronization. Main pushes deploy through the existing workflow; verify hosted behavior when released.

## Requirement coverage and phases

| Phase/task | Requirements | Dependencies | Deliverable and acceptance evidence | Status |
|---|---|---|---|---|
| P00-A audit lifecycle | §§1–18, execution protocol | none | Trace adapters, credentials, registry, settings, picker, routing, layouts, comparison, streams, persistence and relay. Record concrete gaps and applicability. | In progress |
| P00-B baseline/environment | §§16–17 | none | Existing type/unit/build checks and representative browser flows execute; failures diagnosed, not hidden. Reuse Node22 and existing browser setup. | In progress |
| P00-C durable scope/checkpoints | execution protocol | none | Verbatim master directive, comprehensive roadmap, exact handoff committed; remote availability verified. | In progress |
| P01-A scoped registry | §§2,4,5,13,15 | P00 | Provider/endpoint identity, credential generation, normalized capabilities, provenance/freshness and availability; no stale credentials/account leakage. | Not started |
| P01-B adapter discovery | §§2,4,15 | P01-A | Actual supported list APIs, pagination/deduplication, dynamic new models; truthful documented declarations where no list API exists; no fabricated specs. | Not started |
| P01-C reconciliation | §§2,4,9 | P01-A/B | Last-known-good for transient errors only; definitive permission failure never revives old models; removals never erase fixed layouts or explicit choices. | Not started |
| P02-A refresh coordinator | §§2–3,14 | P01 | Configuration events, manual refresh, TTL, lifecycle/resume/online, active-runtime refresh, bounded concurrency/retries/backoff/jitter, in-flight dedupe and out-of-order protection. | Not started |
| P02-B persistence/sync | §§3–5,13 | P01/P02-A | Credential/account/endpoint-scoped cache, safe invalidation, metadata updates propagate without remounts or edit loss. Fake-clock and account/key-race tests. | Not started |
| P03-A shared eligibility | §§4–6,8–10,15 | P01/P02 | One capability/context/permission contract used by all applicable selection and request paths; strict requirements precede scoring; unknowns bounded. | Not started |
| P03-B Auto policy/evidence | §§6,14,16 | P03-A | Quality/speed/cost/balanced preferences, ambiguity/mixed-task handling, unknown-model uncertainty, metadata-driven newcomers; deterministic task cases and honest ranking explanations. Actual answer benchmarks remain distinct from routing mocks. | Not started |
| P04-A layout lifecycle | §7 | P03 | Creation/edit/delete/duplicate/save/load, presets, fixed and Auto assignments, roles/preferences/fallbacks, registry updates and missing assignments; tested backward compatibility/migrations. | Not started |
| P04-B layout execution design | §§7,10 | P04-A | Explicit applicability assessment for sequential/parallel/conditional/dependent/synthesis stages against this app's existing Auto/order layouts and comparison. Implement useful stage features without changing fixed semantics or forcing extra calls. | Not started |
| P05-A recovery contract | §§8,11,13–15 | P03 | Shared classified failures and mode-specific policy; cancellation/terminal failures do not reroute, strict manual/layout constraints respected; request/attempt deadlines and bounded spend. | Not started |
| P05-B recovery/discovery integration | §§3,8 | P02/P05-A | Model/capability failure triggers bounded invalidation without refresh/retry recursion; provider health, cooldown/circuit state and ordered candidate selection tested. | Not started |
| P06-A manual selection | §§5,9,12 | P03/P05 | Stable explicit selection through refresh/restart; compatibility/availability feedback; substitutions require existing explicit fallback authorization. | Not started |
| P06-B all execution callers | §§5,8,10 | P05 | Audit/fix chat, compare, synthesis, canvas, side chat, tasks, summaries and tools. Each mode uses appropriate shared metadata/policy. | Not started |
| P07-A multi-model runtime | §§7,10 | P04/P05/P06 | Bounded concurrency, recover only failed stages, explicit roles/dependencies/context transfer, preserve partial successes, safe cancellation; no unexpected paid calls. | Not started |
| P08-A streaming/state | §§8,10–11 | P05/P07 | Before/after-visible-output failure distinction, no duplicate output or seamless false continuations, no stale state/orphans; tool side effects never replayed blindly. | Not started |
| P09-A shared selection UX | §§5,7,9,12 | P01–P08 | Search/group/filter/status/preference/layout workflows, stable open edits during refresh, phone/desktop keyboard/focus/touch/scroll/a11y. Preserve established styling. | Not started |
| P10-A security review | §§13,15–17 | continuous | Credential/logging/storage scope, relay SSRF/allowed hosts, permission/billing/privacy boundaries and custom endpoint declarations reviewed with negative tests. | Not started |
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

Use failing behavioral tests for defects and meaningful regression coverage. Controlled responses verify decisions and recovery, not model answer quality. Do not send user prompts or credentials to benchmark services. No paid broad-provider evaluation without a defined authorized budget/workload. Use existing repository scripts; no separate linter is configured.

For each implementation milestone record exact commands/results in AI_HANDOFF.md. Each feature needs concrete manual steps with expected behavior. Preserve known-good tests; investigate flakes rather than hiding failures with retries. Linux WebKit does not prove native iPhone rendering or physical touch behavior.

## Milestone history

- Initial roadmap created from the complete uploaded directive; baseline execution and audit in progress. No implementation milestone is yet verified.
