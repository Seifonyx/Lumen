# Dynamic Model Picker operational handoff

## Read first

Read MASTER_REQUIREMENTS.md, IMPLEMENTATION_PLAN.md, this file, Git status/log, then inspect the relevant source. This file supersedes the stale task-status paragraphs in HANDOFF.md for this overhaul; retain its user preferences and environment guidance.

## Current state

- Overall: **In progress; overhaul is not complete**.
- Current phase: P01-C/P03 shared selection policy, following the verified discovery/refresh foundation.
- Exact current task: commit/push the verified foundation, then integrate shared eligibility and fix unauthorized manual substitution, hard exclusions, missing-model choice preservation and unknown-context bounds.
- Branch: `feat/dynamic-model-picker`, based on main `7fbdde2246a546a980744e63b7d88655dad6d8de` (PR18 already live).
- Latest checkpoint commit: `bb2cc3d5a075526d9b9957cdebbd218e6c439d0d` (requirements/roadmap/handoff).
- Remote: initial documents pushed; `git ls-remote` matched that exact branch hash. Application changes remain local/uncommitted and are not released.
- Production: prior release remains live at https://lumen-chat.web.app/. No overhaul deployment performed.

## Completed / in progress / remaining

- Completed: P00 plus P01-A/B and P02-A/B. Scoped registry/cache, bounded deduplicated provider discovery/retries, per-provider freshness/backoff, active/resume refresh, native Anthropic pagination, explicit metadata negatives and secret-redacted discovery diagnostics.
- In progress: P01-C/P03. New local `selection-policy.test.ts` reproduces manual fallback despite `allowFallback:false`; shared eligibility module is drafted but not integrated. Those two files are excluded from the foundation commit until implemented and verified.
- Not started: remaining implementation/verification tasks in IMPLEMENTATION_PLAN.md; none may be assumed done merely because existing code approximates them.
- Blocked: none confirmed. Check existing GitHub credentials with a read-only operation before diagnosing a missing credential.

## Architecture and decisions

- Extend existing browser adapters/Zustand registry and bounded streaming runtime; preserve provider-prefixed IDs and saved layouts.
- First repair: no global cross-account catalog reuse, no old-key metadata fallback, no out-of-order capability publication, bounded/deduplicated discovery. Preserve transient last-known-good only inside the same credential scope.
- Browser lifecycle refresh is possible while active; no continuous background execution or server cron in static hosting.
- User explicitly authorizes autonomous implementation, routine engineering decisions and verified main pushes. Do not stop at planning or repeatedly ask approval. Existing controls, billing opt-ins, privacy boundaries and fixed choices remain authoritative.
- Do not claim measured answer quality from deterministic mocks or model-family heuristics.

## Files changed

- MASTER_REQUIREMENTS.md: exact complete original uploaded text (including execution protocol).
- IMPLEMENTATION_PLAN.md: requirement mapping, stable task IDs, dependencies, criteria, risks and audit evidence.
- AI_HANDOFF.md: operational state and continuation contract.
- Foundation source: `src/lib/ai/registry.js`, `catalog-cache.js`, `catalog-refresh.js` (new); provider discovery/adapters, `src/store.ts`, additive metadata in `src/types.ts`.
- Tests: new model-registry, catalog-scope, catalog-refresh, discovery-integration unit files and `tests/e2e/catalog-lifecycle.cjs`.

## Verification evidence

- Git initially clean on main at `7fbdde2`.
- Baseline `npm test`: passed all 44 original files and type check. Baseline build passed. Three baseline Chromium suites passed without retries.
- Focused registry unit checks: deduplication, bounded concurrency, per-provider TTL/retries/backoff, auth eviction, cancellation/deadlines, hydration, account/endpoint cache isolation, native pagination, authoritative negatives, redaction and lifecycle listener gating passed.
- Final foundation: `foundation-unit.log` — type check and all 48 unit files passed; `foundation-build.log` — production build passed.
- `foundation-chromium.log`: catalog-lifecycle, Auto intelligence, layout-builder, context-recovery, model-health, removed-models, all six passed (72s), no retries.
- `foundation-webkit.log`: catalog-lifecycle, Auto intelligence, layout-builder, context-recovery, all four passed (108s), no retries.
- Earlier `registry-*.log` runs are diagnostic, not final evidence: one test needed clock installation before app startup, and one WebKit run collided with an owned test server. Both were followed by successful sequential runs.
- P03 red test: manual incompatible model returns a substitute despite fallback disabled; expected no model. Shared eligibility draft has not been tested/integrated yet.

## Risks and known gaps

- Global `mr.catalog` persistence and failed-provider merge can resurrect other credentials' metadata.
- Parallel paginated adapter calls read mutable keys and lack direct-call deduplication/concurrency bound.
- Discovery/API compatibility metadata is incomplete. Missing data must remain unknown, distinct from explicit false.
- Existing provider billing/relay constraints must survive improvements. Do not implement arbitrary server proxy URLs.
- General stage/DAG workflows are not implemented; saved layouts currently mean Auto/order model sets.
- Real-model answer-quality evaluation and physical iPhone testing have not been performed.

## Commands/environment

Working directory `/workspace/Lumen`. Node22 activation: `PATH=/workspace/.lumen-tools/node_modules/node/bin:$PATH`.

```
npm test
npm run build
NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs npm run test:e2e -- auto-intelligence layout-builder context-recovery providers multi-provider
MR_WEBKIT=1 NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs npm run test:e2e -- auto-intelligence layout-builder context-recovery
```

Existing test browser preloads live outside the repository. Hosted tests require the hosted preload. Do not disable TLS verification in product code or setup downloads. Runtime configs/secrets must never be logged.

## Exact next action

Commit/push only the verified foundation files (exclude new local `eligibility.js` and `selection-policy.test.ts`). Then integrate those drafts into routing, layouts, comparison and runtime; pass explicit fallback policy from store; preserve explicit choices through registry removal; add regression tests before the next checkpoint. P04 onward remains required. No main push or deployment yet; full CI/production validation must precede release.
