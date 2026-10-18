# Dynamic Model Picker operational handoff

## Read first

Read MASTER_REQUIREMENTS.md, IMPLEMENTATION_PLAN.md, this file, Git status/log, then inspect the relevant source. This file supersedes the stale task-status paragraphs in HANDOFF.md for this overhaul; retain its user preferences and environment guidance.

## Current state

- Overall: **In progress; overhaul is not complete**.
- Current phase: P00 audit/baseline; next implementation is P01/P02 registry isolation and refresh.
- Exact current task: persist complete requirements/roadmap, trace registry lifecycle, run baseline checks; then add behavioral regression cases for credential isolation, concurrency and refresh reconciliation.
- Branch: `feat/dynamic-model-picker`, based on main `7fbdde2246a546a980744e63b7d88655dad6d8de` (PR18 already live).
- Latest implementation commit: none for this overhaul. Initial documents pending commit.
- Remote: initial milestone not pushed yet. Never infer remote synchronization from a local commit.
- Production: prior release remains live at https://lumen-chat.web.app/. No overhaul deployment performed.

## Completed / in progress / remaining

- Completed: read complete user directive; inspect provider discovery, provider configuration, catalog/store publication, model schema, picker/settings, saved layout semantics, CI and existing recovery tests.
- In progress: P00 baseline type/unit checks and architectural audit. Log: `/workspace/.lumen-verification/dynamic-picker-2026-10-18/baseline-tests.log`.
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
- Application source: none yet.

## Verification evidence

- Git initially clean on main at `7fbdde2`.
- Existing baseline `npm test` launched with Node22; outcome pending. Do not describe it as passing until inspected.
- Build/browser checks not yet run for this task.
- Existing source has 44 unit-test files and full Chromium/WebKit workflows. Recount after adding tests.

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

Inspect baseline output and remaining runtime/persistence paths. Commit the initial documents, verify remote branch access/push, then implement P01/P02 with deterministic discovery/scope-race tests first. Update both progress documents after each verified milestone; record the actual remote commit separately from local working state.
