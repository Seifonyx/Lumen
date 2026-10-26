# Conversations & Projects Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline and one fresh whole-branch review. Track steps below; preserve this record across continuation.

**Goal:** Improve the visual hierarchy of the existing conversation tree, project collection and overview without replacing navigation or data owners.
**Architecture:** Restyle Canvas-only selectors and minimally adapt canonical markup, using the existing ChatRow, project actions, search and history. No dependencies or new persistence.
**Tech Stack:** React19, TypeScript, Zustand, CSS, Playwright/axe.
**Spec:** `docs/superpowers/specs/2026-10-26-conversations-projects-design.md`.

## Global constraints

Released base `1e93777`; use existing Lumen-local only. Synthetic/private/$0/no inference. No merge/deploy/Tools/Slice3/protected auth/network/schema changes. Keep weights historical; no overall completion percentage.

## Review focus

Long names and text scaling must not overlap menus; closed folders must remain inert; menu and disclosure focus must stay visible; search must not hide archived/draft state; account switches must not retain previous account content. Existing navigation/privacy suites exercise canonical owners; add geometry and visual audits for the changed presentation.

### Task1: Baseline and tests

Files: `tests/e2e/conversations-projects.cjs`, `.github/workflows/tests.yml`.
Interfaces: consumes synthetic preview-profile/seed; produces repeatable screenshot/results fixtures for both source revisions.
- [ ] Capture baseline at1e93777 with both engines and all widths/themes.
- [ ] Add failing assertions for recognizable folder markup, compact overview and project list feedback/phone sorting. Run against baseline and preserve expected failure.

### Task2: Tree, collection and overview

Files: `SidebarCanvas.tsx`, `ProjectsPage.tsx`, Canvas shell/screen CSS; minimal `ProjectWorkspace.tsx` markup only if necessary.
Interfaces: consumes unchanged ChatRow and store navigation/actions; no changes to store or transport.
- [ ] Implement folder tree hierarchy and compact overview entry.
- [ ] Replace Canvas project cards with responsive ledger, search reset/results and sort on phones.
- [ ] Improve overview/context layout and actions with Canvas CSS.
- [ ] Run focused e2e RED→GREEN, inspect actual captures and correct defects.
- [ ] Run existing project/navigation/featureExit checks; commit coherent source.

### Task3: Verification and review

- [ ] Run npm test, both builds, budgets and isolation. No test weakening or raised caps.
- [ ] Chromium/WebKit eight viewport/theme cases each, axe, screenshot geometry, synthetic network/privacy; existing canonical regressions.
- [ ] Fresh whole-branch reviewer; resolve important findings with evidence.
- [ ] Commit screenshots/provenance and handoff/plan; push isolated branch, open draft PR, verify exact-head CI.
- [ ] Conflict-safe live checkpoint update/readback. STOP for planner review.

## Execution ledger

- Recovery: clean existing Library worktree; remote main and supplied SHA agree; former feature branch preserved; new branch `feat/conversations-projects-experience`. Separate Lumen main worktree untouched.
- Scope: async owner explicitly chose Conversations & Projects first. Tools authorization is deferred by this clarification.
- Baseline: npm.cmd test passed all unit files and typecheck. npm.ps1 is blocked by machine signing policy; use npm.cmd without changing policy.
