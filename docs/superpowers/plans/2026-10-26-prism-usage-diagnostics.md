# Prism Usage & Diagnostics CP2 Implementation Plan

**Spec:** `docs/superpowers/specs/2026-10-26-prism-usage-diagnostics-design.md`

**Base:** `5979d5adb6781a93037f131c6597791a6be6a995`

## Global constraints

- No schema, telemetry, provider transport, credential, authentication, routing-algorithm, or ordinary-presentation changes.
- Synthetic-only QA and zero incremental spending.
- New draft PR only; no merge or deployment.
- Preserve Prism navigation, account isolation, drafts, Back/Forward, and lazy Canvas isolation.

## Task 1 — Make saved-chat evidence classification truthful

**Files:** `tests/unit/chat-records.test.ts`, `src/lib/chat-records.ts`

1. Add failing tests proving stopped requests are not completed answers; failed, stopped, completed, rerouted, streaming, temporary, empty, and separate-account inputs retain distinct semantics.
2. Extend the daily history result to expose stopped outcomes without mutating saved messages. Keep top-model counts limited to completed answers.
3. Add a pure latest-record helper that includes in-progress evidence while preserving the existing completed-history request log contract.
4. Run the focused unit tests and full unit suite.

**Expected:** focused tests fail before implementation and pass after; existing consumers remain type-safe.

## Task 2 — Create explicit Usage evidence presentation

**Files:** `tests/unit/usage-presentation.test.ts`, `src/lib/usage-presentation.ts`, `src/components/UsageTab.tsx`

1. Add failing pure tests for unavailable counters, unknown allowances/reset times, known provider allowances, and temporary blocks.
2. Implement a presentation adapter over `UsageView`; do not duplicate usage state.
3. Redesign `UsageTab` hierarchy and labels so app counters, saved-chat history, provider evidence, temporary blocks, and Firebase scope cannot be confused.
4. Preserve the Settings use of `UsageTab` and add a scoped Prism presentation prop only where hierarchy differs.
5. Run focused tests, typecheck, and component regressions.

**Expected:** missing evidence is never presented as zero, available balance, verified connection, or guaranteed reset.

## Task 3 — Redesign Diagnostics around recorded outcomes

**Files:** `tests/unit/chat-records.test.ts`, `src/components/RoutingExtras.tsx`, `src/components/RoutingCenter.tsx`, `src/styles/canvas-routing.css`

1. Add failing assertions for latest answered/rerouted/stopped/failed/in-progress/missing evidence.
2. Replace duplicate recent-answer presentation with a compact latest-outcome panel and improve the request ledger hierarchy.
3. Keep titles hidden by default and show only safe diagnostic categories.
4. Update the 14-day visualization to represent completed, failed, and stopped outcomes separately with truthful source copy.
5. Add responsive, accessible Canvas-scoped styling and verify 320 px containment.

**Expected:** each visible outcome follows saved evidence; no prompt, body, or title appears by default.

## Task 4 — Browser regression and curated evidence

**Files:** `tests/e2e/prism-usage-diagnostics.cjs`, CI suite lists, review artifact under `docs/blackout/reviews/`

1. Add synthetic Usage/Diagnostics fixtures and failing browser assertions for provenance, unknown values, outcomes, title privacy, keyboard focus, navigation, dense/empty states, and 320 px overflow.
2. Run Chromium and WebKit at 320×568, 390×844, 430×932, and 1440×960 in Light and Dark.
3. Capture and inspect a concise before/after set with source commit, engine, viewport, theme, and timestamp provenance.
4. Run typecheck, builds, budgets, isolation, and proportionate regression suites.

**Expected:** no horizontal clipping or competing bottom navigation; screenshots match the tested exact source.

## Task 5 — Review, documentation, CI, and draft PR

**Files:** `IMPLEMENTATION_PLAN.md`, `AI_HANDOFF.md`, public-safe `docs/lumen-context/CURRENT_STATUS.md` on its own branch, PR body

1. Review the complete diff against the spec and security boundaries; fix Important or Critical findings test-first.
2. Update coding-branch handoff and plan with factual verification and exact Git state.
3. Commit and push the feature branch, open a draft PR, and run fresh exact-head CI.
4. Update `docs/lumen-live-context` conflict-safely with public-safe facts and verify remote readback.
5. Report exact commit, screenshots, checks, limitations, and physical-device gaps; stop.

**Expected:** draft PR only, CI evidence belongs to exact HEAD, live checkpoint readback matches its remote branch.

## Review focus

- Any wording that implies provider connectivity or remaining allowance without evidence.
- Stopped/failed/in-progress requests accidentally counted as completed answers.
- Leakage of chat titles, prompts, bodies, account-crossing data, or credentials.
- Canvas bundle/isolation regressions and narrow-phone overflow.
- Duplicate state ownership or hidden changes to routing/provider behavior.
