# Drawer reference implementation plan

> Execute inline; the owner now requires a visual approval gate before broader implementation.

**Goal:** Match the owner-selected reference in one populated390px Light iPhone drawer.
**Base/branch:** main828a05c; existing `feat/drawer-composition-pass2` in Lumen-local.
**Spec:** `docs/superpowers/specs/2026-10-27-drawer-composition-design.md`.

## First visual gate

- [x] Inspect existing changes and the new primary reference; keep the current isolated branch.
- [x] Preserve the interrupted direction in ignored local recovery files; supersede its shared-panel composition.
- [x] Implement flat divided sections, restrained selection, real phone chat metadata and reference-like footer using canonical handlers.
- [x] Preserve desktop presentation and original chat accessibility names; no fake controls or duplicate chat entries.
- [x] Capture actual390x844 Light populated app; verify axe,44px targets, non-overlapping rows, menu focus and draft restoration.
- [x] Typecheck and existing navigation/seam unit checks.
- [ ] Owner visually approves the displayed actual capture.

## After explicit visual approval only

- [ ] Expand approved direction to remaining phone states/themes, larger text and desktop.
- [ ] Run proportionate full regressions, budgets/isolation and exact-head CI; independent review.
- [ ] Package genuine before/after screenshots, open new draft PR and synchronize status. No merge/deploy.

## Recovery ledger

- Main828a05c verified against GitHub. Previous branch and separate main worktree preserved.
- Earlier generated alternatives/full-state tests belong to the superseded interrupted direction, preserved under ignored `tests/e2e/out/drawer-pass2/pre-reference-working/`.
- First reference capture exposed overlap from inherited fixed-height row wrappers; row and button heights now agree, and a geometry regression prevents overlap.
- New metadata initially changed accessible button names; explicit original names plus descriptions preserve canonical navigation/tests.
- Only this first visual gate is ready. No approval, full regression certification, merge/deployment or overall completion percentage is claimed.
