# Phase 5 Slice 1 implementation plan

**Goal:** premium, truthful Library discovery and predictable whole-feature Exit.
**Architecture:** canonical screen-history traversal plus a lazy Canvas Library presentation, using existing chat, FileCard, Canvas and Knowledge owners.
**Spec:** [design](../../design/PHASE5_LIBRARY_EXPERIENCE.md). Execute inline under the owner's explicit implementation/delivery sequence; stop at draft planner review.

## Constraints and review focus

No storage/auth/provider/routing/infrastructure changes; synthetic-only, private isolation, $0 spend; ordinary compatibility and Canvas isolation. Preserve account boundaries, original files, citations, edits and composer drafts. Review direct entry without ancestors, repeated visits after Back, deep preview chat selection, failed/pending saves and same-ID attachments across distinct chats.

## Tasks

- [x] P5S1-1 Recover live context, current main, worktrees, source/contract ownership and existing PRs. Record design/plan; start fresh branch and draft PR. No weighted percentage baseline added.
- [x] P5S1-2 Add failing real-browser Exit regression (Prism provider, Library document, Tools editor); implement `exitFeature` in screen-history and wire leading headers without altering sequential swipe/Back. Test origin/drafts/files/account reset and edits safeguard.
- [x] P5S1-3 Add library adapter tests for category, duplicate exclusion, recorded metadata, scoped search/sort. Implement Canvas workspace, file detail/reuse and Knowledge separation with responsive accessible controls.
- [x] P5S1-4 Capture identical-fixture before/after views; run Chromium/WebKit phone/desktop Light/Dark, axe/focus/touch/overflow/reduced-motion/high-contrast and loading/empty/error checks. Review screenshots and fix defects. Migrate obsolete chevron expectations while keeping browser-history assertions.
- [x] P5S1-5 candidate preparation: Run type/unit/both builds, isolation/budgets, complete diff/security review and exact-head CI. Record actual failures/limitations. Update root plan/handoff, PR source/evidence, live status with current blob SHA/readback. Push verified branch; STOP for planner. No merge/deploy/Slice 2.

Tests: `tests/e2e/feature-exit.cjs`, `tests/e2e/library-experience.cjs`, `tests/unit/library-items.test.ts`, existing phone/glass/Prism/Canvas contracts. CI wiring extends the existing free standard runner matrix; no paid service or permission changes.

Operational finalization is recorded against the exact delivered HEAD in PR58 and the live checkpoint: full exact-head CI, remote SHA readback, conflict-safe status update and STOP for planner review. This file records the prepared source/evidence; it does not claim an unobserved CI success or owner acceptance.
