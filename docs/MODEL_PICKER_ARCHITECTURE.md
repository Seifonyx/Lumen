# Model Picker architecture and applicability

This document explains the design for MASTER_REQUIREMENTS.md. IMPLEMENTATION_PLAN.md and AI_HANDOFF.md distinguish implemented, verified and unfinished work. A design statement here does not mean its implementation is finished.

## Product boundary

Lumen is a browser application with Firebase account settings and an allowlisted provider relay. Inference uses the user's own provider credentials. There is no always-running application server that can refresh a catalog after the browser is suspended. A newly released model must work through an already-supported adapter; discovery cannot implement an unknown API protocol.

The existing execution modes are:

| Mode | Assignment | Execution/recovery boundary |
|---|---|---|
| Auto | Dynamic choice among enabled eligible models | Shared ranking and bounded recovery, subject to exclusions and switching policy |
| Manual | One explicitly selected model | Keep it; substitution requires the user's fallback authorization |
| Layout, best for each | Dynamic choice within a saved candidate pool | Same Auto intelligence, saved requirements, priority and permitted fallback scope |
| Layout, in order | Fixed ordered assignments | Respect order and constraints; move to another assignment only when authorized |
| Comparison | Two or three explicit model assignments | Bounded parallel independent stages; partial successes retained; retry a failed stage explicitly |
| Combined comparison | Synthesis dependent on at least two successful answers | One eligible synthesis model, recover only that stage within allowed candidates |
| Helpers/tools | Canvas, summaries, research, history, writing and tasks | Reuse appropriate metadata, eligibility, request budgets and recovery; retain privacy/tool consent |

Layouts currently mean a set of models for one kind of work. They are not executable workflow graphs. The directive's conditional/dependency/sequential/synthesis requirements apply to the existing comparison → optional synthesis workflow and research stages, where useful. Do not reinterpret saved layouts as a new general DAG language. Arbitrary workflow-graph editing would require a separate product design; this is an applicability decision under the directive's “where appropriate” and “respect original layout semantics” clauses, not permission to omit existing execution modes or stage recovery.

## Registry and identity

Keep existing provider-prefixed model IDs so chats and layouts remain readable. The active connection supplies endpoint/account/credential scope. Different providers never merge, and a changed key or endpoint cannot inherit a discovery cache from another scope. The current product supports one active connection per provider; simultaneous multiple connections would need an explicit connection identity before being added.

`ai/registry.js` owns concurrency, deduplication, expiry, retries and last-known-good reconciliation. Provider adapters own their actual list endpoints, pagination and protocol compatibility. `ai/catalog-cache.js` binds persisted metadata to an account and an SHA-256 fingerprint of provider configuration; it never persists raw credentials as a cache identifier. The unscoped legacy cache is discarded, not migrated across accounts.

Metadata sources are distinct:

- API: fields actually returned by the provider.
- Documented: known adapter/protocol behavior or a provider without model listing.
- User: an explicit declaration, shown as unverified and scoped to the supported endpoint.
- Inferred: bounded family/name hints, not benchmarks.
- Unknown: no specification is invented. Unknown context gets a conservative request allowance; missing prices are not zero.

For declarations, API facts must override conflicting user assumptions; documented transport constraints cannot be bypassed by a checkbox. A declaration may fill unknown or inferred metadata, but cannot make an unsupported adapter operation work. Authentication rejection must not be hidden by declared or cached models. This declaration layer remains a tracked implementation task until its tests and UI are verified.

## Refresh and synchronization

Check expiry every minute while active and online, on resume/focus/online, and after configuration changes. Explicit manual refresh bypasses ordinary TTL. The registry fetches only due providers, shares in-flight work and caps concurrent discovery at four. A provider attempt is bounded to fifteen seconds, with one jittered retry for network/server failures; authentication and rate-limit responses are not immediately retried. Failure cooldown honors Retry-After and increases with repeated failure.

Successful discovery reconciles additions, removals and metadata changes. Transient failures retain same-scope metadata with stale provenance. Authentication rejection evicts models. Account/key generation guards prevent old responses from publishing capabilities. Refresh must not erase explicit defaults, fixed layout assignments, open searches or unsaved edits. Model-not-found/capability invalidation must be throttled so request recovery cannot recursively refresh forever.

## Selection policy

`ai/eligibility.js` owns hard capability/context checks. Use them before ranking and again at execution because metadata can change. Raw attachments require native transport; extracted text does not. Optional web search may degrade with a notice; a tool stage explicitly requiring search cannot do so.

Ranking is deterministic for ordinary requests. Task/artifact interpretation, availability, task fit, explicit constraints, priorities and observed reliability/latency influence the choice. Report family hints honestly. Quality/speed/cost/balanced defaults can be overridden by an explicit request. A compatible manual selection remains authoritative. Cost uses reported token prices and an explicit answer allowance as an estimate, not a bill or guarantee. Readiness and required capabilities precede cost; fixed ordered layout assignments precede automatic cost/diversity reordering.

All-excluded Auto is an actionable error, not permission to use a forbidden model. Removed or rejected models remain distinguishable from completely unknown metadata. Enabling a new provider can seed sensible defaults; discovering a new model does not silently change a fixed assignment.

## Layout persistence

Preserve existing `auto` and `order` schemas. Add optional saved requirements, routing priority and fallback scope rather than rewriting model arrays. Missing optional fields preserve legacy semantics. Save task requirements from the builder so later capability/context changes cannot weaken them. Expose incompatible/missing assignments and recovery choices without silently rewriting the layout.

Fallback scope is limited by the global switching setting: none, within the layout, or the enabled-model pool. Outside backups must satisfy the same saved requirements. A fixed first assignment cannot be skipped when substitution is disabled. Creation, editing, duplication, deletion, presets, defaults and account synchronization remain supported.

## Execution and recovery

The streaming runtime already bounds attempts and deadlines and separates failure before useful answer text from failure after visible text. Keep that distinction. After partial output, preserve the text, show the failure and require an explicit retry; never splice a replacement model into an apparent continuation. Cancellation is terminal. Credential failures skip the affected provider without penalizing model answer quality.

Comparison stages need immutable request snapshots for explicit retries; a successful stage must not be rerun just because another fails. Invalidate old synthesis when its source answers change. Cross-account/key changes cancel or invalidate old stage executions. Research/tool stages retain strict capabilities, permissions and side-effect safeguards. No automatic replay of external commits, tool side effects or ambiguous billing writes.

## Security and verification

Credentials go only to supported official endpoints or the user's configured relay. The relay accepts fixed provider/path allowlists, never arbitrary upstream URLs, and does not forward redirects. Catalog diagnostics redact credentials. Cache and local performance records need correct account/configuration scope. Provider billing opt-ins and privacy masking remain authoritative for every caller.

Tests use deterministic provider responses for lifecycle, eligibility, ordering, recovery, streaming, cancellation and stage-state behavior. They do not measure answer quality. Actual comparative quality needs representative real answers, a defined evaluation rubric and authorized provider access/budget. Physical iPhone compositing/touch remains distinct from Linux WebKit verification.

Release requires relevant local checks, full repository CI, reviewed security/compatibility outcomes, protected main integration and hosted deployment verification. No claim of mathematical optimality or impossibility of future improvements is supported.
