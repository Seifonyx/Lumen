# Dynamic Model Picker operational handoff

## Read first

Read MASTER_REQUIREMENTS.md, IMPLEMENTATION_PLAN.md, this file, Git status/log, then inspect the relevant source. This file supersedes the stale task-status paragraphs in HANDOFF.md for this overhaul; retain its user preferences and environment guidance.

## Current state

- Overall: **In progress; overhaul is not complete**.
- Current phase: P03 selection/priority checkpoint; next P04 layout policies and P01-D declarations.
- Exact current task: commit/push verified selection changes, then implement saved layout requirements, per-layout priority/fallback scope and fixed-order preservation. A later credential-boundary review must also test adapter retries after keys change.
- Branch: `feat/dynamic-model-picker`, based on main `7fbdde2246a546a980744e63b7d88655dad6d8de` (PR18 already live).
- Latest verified implementation commit: `28d339203cd0d13a3f456c7bc406efcb0c0cef69` (scoped registry/refresh foundation).
- Remote: foundation pushed; `git ls-remote` matched that exact branch hash. Later selection/priority changes remain local/uncommitted and are not released.
- Working PR: https://github.com/Seifonyx/Lumen/pull/19 (draft). Foundation CI run `39122176355`: type/unit/build and WebKit passed; Chromium failed in Auto's first send (no model request or error; likely draft/send race). Regression scroll simulation retried once and passed. Failure log: `foundation-ci-failed.log`. The artifact attachment tool returned “No handler registered”; the PR exists on GitHub.
- Production: prior release remains live at https://lumen-chat.web.app/. No overhaul deployment performed.

## Completed / in progress / remaining

- Completed: P00 plus P01-A/B and P02-A/B. Scoped registry/cache, bounded deduplicated provider discovery/retries, per-provider freshness/backoff, active/resume refresh, native Anthropic pagination, explicit metadata negatives and secret-redacted discovery diagnostics.
- Completed locally: P01-C/P03 core chat/layout/comparison eligibility, manual fallback authorization, strict exclusions, preserved defaults, bounded unknown context, authoritative reasoning negatives, quality/speed/cost/balanced preferences and cost-aware recovery. UI and execution now use `model-selection.ts`; Composer draft restoration is synchronous before paint.
- In progress: synchronizing this milestone. P03-A remaining helper integration is P06-B. P01-D user declarations and P04 onward are unfinished.
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
- Selection additions: `eligibility.js`, `preferences.js`, `model-selection.ts`; routing/profile/layout eligibility, chat runtime, store, Composer/ChatView/picker settings/comparison/Why UI; selection/priorities unit/browser tests and source-aware fixture setup. Architecture design in `docs/MODEL_PICKER_ARCHITECTURE.md`.

## Verification evidence

- Git initially clean on main at `7fbdde2`.
- Baseline `npm test`: passed all 44 original files and type check. Baseline build passed. Three baseline Chromium suites passed without retries.
- Focused registry unit checks: deduplication, bounded concurrency, per-provider TTL/retries/backoff, auth eviction, cancellation/deadlines, hydration, account/endpoint cache isolation, native pagination, authoritative negatives, redaction and lifecycle listener gating passed.
- Final foundation: `foundation-unit.log` — type check and all 48 unit files passed; `foundation-build.log` — production build passed.
- `foundation-chromium.log`: catalog-lifecycle, Auto intelligence, layout-builder, context-recovery, model-health, removed-models, all six passed (72s), no retries.
- `foundation-webkit.log`: catalog-lifecycle, Auto intelligence, layout-builder, context-recovery, all four passed (108s), no retries.
- Earlier `registry-*.log` runs are diagnostic, not final evidence: one test needed clock installation before app startup, and one WebKit run collided with an owned test server. Both were followed by successful sequential runs.
- P03 red test reproduced unauthorized manual substitution, then passed after implementation. Intermediate 49-file unit/type run passed. New selection-policy browser matrix passed ten Chromium phone/desktop cases; one legacy Unicode case expected the now-forbidden substitution and was updated to verify explicit model selection and subsequent follow-ups instead.
- Priority unit checks passed after using numeric tolerance for a floating-point cost estimate; missing prices stay unknown. Final combined unit/build/nine Chromium/seven WebKit checks are running in `selection-final-*.log` and must be inspected before claiming verification.
- `selection-final-unit.log` and build passed; all nine Chromium suites passed (115s); all seven WebKit suites passed but selection-policy retried after the first input disappeared. The subsequent draft/fixture fixes require their own clean rerun (`selection-checkpoint-*.log`); do not report the earlier WebKit run as retry-free.
- Architecture/applicability design: `docs/MODEL_PICKER_ARCHITECTURE.md`. User-declared model support is explicitly tracked as P01-D; it is not implemented by the existing documented Perplexity list.
- Clean follow-up after the draft fix: `selection-checkpoint-unit.log` — all 50 unit files/type check; build passed. Eleven Chromium suites (114s) and eight WebKit suites (179s) passed without retries. Final resolver checks: `selection-resolver-unit.log` all units/type passed, `resolver-typecheck/build` passed, three Chromium suites (43s) and two WebKit suites (92s) passed without retries. Four focused parser/selection/layout unit suites passed after the final intent clarification. `p03-final-unit/build.log` is the final pre-commit rerun; inspect completion before committing.
- Visually inspected phone WebKit and desktop Chromium priority Settings screenshots; shorter final hint retains the same existing row layout. Linux WebKit is not a physical iPhone test.

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

Confirm `p03-final-unit/build.log` completion, commit/push selection milestone and verify remote SHA. Then P04: add a shared layout policy planner, persist builder requirements, expose per-layout priority/fallback controls, preserve explicit order in runtime recovery, and test metadata changes after reload. Implement P01-D declarations, then shared caller/recovery and comparison-stage improvements. Full CI on the current head and production verification remain mandatory. No main push/deployment yet.

## Manual tests for the implemented checkpoint (when preview is deployed)

1. Settings → Models → Routing priority: choose Quality, Speed, Cost in turn and send a short prompt in Auto. Open Why this model; choices reflect eligible available models and honest price/quality uncertainty. A request to use the cheapest model overrides a saved Quality priority.
2. Disable automatic switching, select a text-only model, then ask about an attached photo. Expect an actionable compatibility error and no replacement request. Select an image-capable model and resend; it should work.
3. Exclude every saved model from Auto. Expect a clear error with a Settings recovery path. Manually selecting an excluded compatible model still works.
4. Open a saved chat and immediately type; the first input must remain. Switching between chats must restore each chat's own draft.
5. While editing/browsing models, refresh. Search text, layout assignments and explicit default remain. A temporary provider failure keeps same-scope metadata; rejected credentials remove it until corrected.
