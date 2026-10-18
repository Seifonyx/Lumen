# Dynamic Model Picker operational handoff

## Read first

Read MASTER_REQUIREMENTS.md, IMPLEMENTATION_PLAN.md, this file, Git status/log, then inspect the relevant source. This file supersedes the stale task-status paragraphs in HANDOFF.md for this overhaul; retain its user preferences and environment guidance.

## Current state

- Overall: **In progress; overhaul is not complete**.
- Current phase: P04 layout policies and P05/P10 credential-boundary hardening locally verified; checkpoint push next. P01-D user declarations and P07 comparison stages have standalone modules/tests but are not integrated yet.
- Exact current task: save/push verified layout/credential work, then integrate declarations and comparison-stage recovery. Do not include a deliberately red stream regression in this checkpoint.
- Branch: `feat/dynamic-model-picker`, based on main `7fbdde2246a546a980744e63b7d88655dad6d8de` (PR18 already live).
- Latest verified implementation commit: `9e98d4e3a0759ba713712fd30dea51d2a9b1cf7d` (selection and routing priorities).
- Remote: selection checkpoint pushed; `git ls-remote` matched that exact branch hash. Layout-policy changes remain local/uncommitted and are not released. Full CI on the new head must be checked; foundation failure is historical diagnostic evidence, not a final result.
- Working PR: https://github.com/Seifonyx/Lumen/pull/19 (draft). Foundation CI run `39122176355`: type/unit/build and WebKit passed; Chromium failed in Auto's first send (no model request or error; likely draft/send race). Regression scroll simulation retried once and passed. Failure log: `foundation-ci-failed.log`. The artifact attachment tool returned “No handler registered”; the PR exists on GitHub.
- Production: prior release remains live at https://lumen-chat.web.app/. No overhaul deployment performed.

## Completed / in progress / remaining

- Completed: P00 plus P01-A/B and P02-A/B. Scoped registry/cache, bounded deduplicated provider discovery/retries, per-provider freshness/backoff, active/resume refresh, native Anthropic pagination, explicit metadata negatives and secret-redacted discovery diagnostics.
- Completed locally: P01-C/P03 core chat/layout/comparison eligibility, manual fallback authorization, strict exclusions, preserved defaults, bounded unknown context, authoritative reasoning negatives, quality/speed/cost/balanced preferences and cost-aware recovery. UI and execution now use `model-selection.ts`; Composer draft restoration is synchronous before paint.
- In progress: P04 shared `layout-policy.ts`, persisted builder requirements/priority, per-layout fallback and requirement editor, fixed-order runtime queue, constraint-aware visibility, and canvas integration implemented. Saved constraints now travel into chat/canvas requests and are checked again on every fallback attempt after refreshed metadata. A review reproduced a downgrade race red, then confirmed the fix with focused tests. Expanded browser verification still running. P01-D declarations and P05 onward remain unfinished.
- In progress: P05/P10 scoped cancellation covers streaming/retries, summaries, one-shot helpers, embeddings and key diagnostics; suspended stream deltas are suppressed and early iterator closure cleans up requests/timers. Health history is account/config scoped and ignores unscoped legacy records. Independent review findings were reproduced and fixed.
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
- Uncommitted layout changes: `layout-policy.ts`, `layouts.ts`, `layout-builder.ts`, `LayoutBuilder.tsx`, `LayoutsTab.tsx`, `ModelPicker.tsx`, `routing.ts`, `chat.js`, `store.ts`, scoped editor CSS, new `layout-policy.test.ts` and `layout-policies.cjs`, CI WebKit coverage.

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
- Selection CI `39124554541` WebKit: all routing/selection/priority cases passed; message-navigation failed because its 1,000-message fixture used no context limit and unknown capacity is now bounded. The shared UI fixture now declares a 1M context; dedicated unknown-capacity cases remain explicit and unchanged. Chromium CI was still pending at last observation.
- P04 first unit/type/build passed. Six actual Chromium suites passed (93s): layout-policies, layout-builder, selection-policy, Auto intelligence, context-recovery and canvas. The requested name `layouts` did not exist and was previously ignored by the runner; the runner now rejects unknown names/zero suites (verified exit 2), preventing misleading verification claims.
- P04 WebKit run encountered an unrelated Google public auth-config CORS dependency in the sandbox fixture. Shared preview fixtures now mock that public configuration endpoint rather than relying on the network; a clean follow-up is required. No real user/provider credentials are used in these tests.
- **Historical red evidence, now fixed in local source:** `/workspace/.lumen-verification/dynamic-picker-2026-10-18/credential-boundary-red.mjs` reproduces two Gemini requests when the first is pending, keys change, then a 400 arrives. The old adapter retry reads the replacement key. Scoped cancellation and immutable snapshots are implemented with committed-intent regressions in `credential-boundary.test.mjs`, including summary fallback, key diagnostic/embedding bodies, suspended event delivery and early iterator return. The external original reproducer now passes.

## Risks and known gaps

- P01-D declarations remain unintegrated; do not claim add/remove UI or live propagation is complete.
- P07 comparison-stage helper is tested independently, but store retry closures and synthesis integration remain unfinished.
- P08 review confirmed clean transport EOF without provider completion markers can incorrectly mark partial output successful; an implementation patch and red tests are being prepared outside tracked source.
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

Inspect final layout logs; commit/push the verified P04 + credential/health boundary milestone. User declarations: new `ai/model-declarations.js` has 12 focused tests; required Cloudflare `accountId` is part of declaration identity. New `ModelDeclarations.tsx` is being prepared by the declarations agent (new file only). Root must add types, raw-catalog/derived merge publication, updateSettings live propagation, Settings integration and browser tests (draft at `/tmp/lumen-declarations-test.cjs`). New `comparison-stage.ts` has 11 focused tests but needs store/UI integration with explicit failed-slot retry and shared synthesis routing. P08 streaming patch is being prepared by credential_review under `/tmp`, with red tests outside repo. Continue helper eligibility, typed recovery/discovery invalidation, metadata UX, performance/security review, full CI and release. Main/live remain unchanged.

## Manual tests for the implemented checkpoint (when preview is deployed)

1. Settings → Models → Routing priority: choose Quality, Speed, Cost in turn and send a short prompt in Auto. Open Why this model; choices reflect eligible available models and honest price/quality uncertainty. A request to use the cheapest model overrides a saved Quality priority.
2. Disable automatic switching, select a text-only model, then ask about an attached photo. Expect an actionable compatibility error and no replacement request. Select an image-capable model and resend; it should work.
3. Exclude every saved model from Auto. Expect a clear error with a Settings recovery path. Manually selecting an excluded compatible model still works.
4. Open a saved chat and immediately type; the first input must remain. Switching between chats must restore each chat's own draft.
5. While editing/browsing models, refresh. Search text, layout assignments and explicit default remain. A temporary provider failure keeps same-scope metadata; rejected credentials remove it until corrected.

## Current continuation evidence (2026-10-18)

- `contracts-unit.log`: all units/type checking passed; build passed. Eight Chromium suites passed with a multi-provider retry caused by clicking an auto-expiring toast while it exited. The fixture now waits for automatic dismissal. Six WebKit suites passed without retry.
- `checkpoint-unit.log`: 55 unit files/type and build passed. Five Chromium suites passed cleanly (106s). Three-suite WebKit run failed only navigation's localhost Firestore emulator request in a preview-only fixture (not a product exception); its unnecessary default `?emulator` was removed. Do not call that run green.
- Review found a real saved-requirements race: metadata downgraded an eligible backup after planning. `layout-runtime-requirements.test.ts` observed two requests before the fix, then only the compatible primary. Shared `modelRequirementsProblem` now checks saved constraints at planning and every attempt, including canvas; independent reviewer approved the fix after focused capability/context/reasoning downgrade cases.
- `layout-final-*` are the new full unit/build and Chromium/WebKit verification logs after the above fixes. Read their actual outcomes before making a completion/commit claim.
- Inspected phone WebKit layout-editor screenshot: requirements use the existing disclosure/fields, checkbox labels now fit and remain visible. No layout token or welcome/composer redesign.
- Premium static audit executed from downloaded installed skill script (`/tmp/lumen-premium-audit.py`) and saved `premium-audit.json` outside repo: 33 inherited app-wide findings (11 undocumented native-control ownership decisions and 22 form/textarea contract findings). This is unfinished P09 audit evidence, not a clean audit. Inspect actual findings; prioritize touched model flows and document established native-select ownership. No product UI compliance claim made.

Additional manual tests for this milestone:

6. Build a layout requiring 200k context; edit its priority and choose “Only models in this layout.” Reopen it after refresh/reload: constraints and assignments must remain; an incompatible assignment is explained and cannot be used as a backup.
7. Choose “No automatic fallback” for an ordered layout. If its first model fails, expect an error; a working second model must not run. Re-enable layout-only fallback and verify the configured order.
8. While a reply or summary is pending, replace/remove provider keys. Expect the old operation to stop without retrying with the replacement key or adding old text. Send a fresh prompt afterward with the new connection.
9. On a phone, select a saved chat and immediately type. The first input must stay in that selected chat; the sidebar should still close smoothly.
10. Switching accounts or provider endpoints must start separate reliability/latency history. Returning to the original account restores only that account/configuration’s prior observations.

## Verified milestone result

- `layout-final-unit.log`: all 56 then-present workspace unit files/type checks passed; build passed. `layout-final-chromium.log`: four suites (layout-policies, Auto intelligence, multi-provider, message-navigation) passed without retries (102s). `layout-final-webkit.log`: three suites passed (196s), but navigation retried due an uncaught optional Markdown stylesheet preload failure; this result is not retry-free.
- Deterministic `markdown-recovery.cjs` reproduced that real optional-loader error before the fix. `loadMarkdownExtras` now catches optional import failures, keeps readable source/code, and allows a normal reload to restore formatting. No automatic reload or discarded reply.
- Final `milestone-final-unit.log`: all 58 workspace unit files/type check passed (includes four unintegrated modules and their tests: declarations, comparison-stage, helper-routing, recovery). `milestone-final-build.log`: production build passed. `milestone-final-chromium.log`: formatting-recovery suite passed (3s); `milestone-final-webkit.log`: formatting recovery + five-viewport navigation matrix passed without retries (44s). No source changes after these checks except docs/CI suite selection.
- New standalone `helper-routing.ts` and `recovery.js` have focused green tests, remain unintegrated. Agent completion reports are not end-to-end feature completion.
- P01-D integration must collect explicit API-denied model IDs before filtering and persist `Catalog.deniedModelIds` in scope-bound cache. Otherwise unlisted declarations can resurrect an API-disabled model after reload. Also reject explicit streaming:false for streaming calls while permitting one-shot helpers.
- P07 comparison regression suite is being prepared as a new file only. Public modal gets Stop plus per-card Retry this model; snapshot account/key/privacy/instruction validation gets unit tests rather than a test-only store backdoor.
