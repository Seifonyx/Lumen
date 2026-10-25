# Phase4 Slice3 CP1 — Auto routing & Layouts

## Authority / baseline

Owner authorizes this checkpoint only: develop, test, push and open a new draft PR from main05d2647e37919e7548ed397118cb28592a67a737. Slice2 is shipped; automatic main CI40196168605 also passed. No merge/deploy, CP2 Usage/Diagnostics, new Gate, spend, real inference or protected routing/auth/network work. Preserve existing policies, IDs, assignments, global switching/permission semantics, composer and account boundaries.

## Product decisions

Keep five Prism sections. Current-route Details in Models separates current mode/preferences from the last completed answer and its recorded recovery/reasons/alternatives. No predicted next-model list or invented explanation. Use the current chat's existing Message metadata only, with explicit missing-evidence states and browser-local dates. Link to canonical routing Settings rather than adding another set of controls. Recognize recommended Layouts through findLayout, not custom settings only.

Replace Prism's mixed “policy” terminology with Layouts. A concise list describes mode, all saved assignments and effective fallback (including app switching off). The existing LayoutEditor remains the single draft/save owner. Improve its hierarchy, searchable add-model discovery, model-order controls and live pre-save explanation. Retain missing IDs with explicit warnings. Optional appearance/requirements/instructions stay discoverable. No destructive normalization or implicit model replacement.

Use canonical screen-history/back-layer helpers for editor Back/Forward and successful completion. Navigation Back preserves the unsaved draft in the in-session restore callback; explicit Cancel discards. Save keeps the ID/semantics and cannot reopen a completed editor on Forward. Use layout follows existing picker selection semantics and preserves the current chat/draft/attachments.

Alternatives rejected: a sixth Auto destination or rebuilt Overview would duplicate navigation and hurt320px reading; a simulated routing preview would invent future outcomes. A separate Canvas editor/state system would duplicate canonical ownership. Reuse the shared editor with scoped presentation and optional draft/completion callbacks.

## Implementation plan

- [x] **Evidence presentation:** write failing tests for current versus historical modes, done-only answer selection, missing reasons, recorded alternatives, fallback and legacy effective policy. Implement pure presentation helpers using existing findLayout/layoutPolicy and saved Message fields. Wire compact current disclosure and honest recorded details. No planner/inference calls.
- [x] **Layouts workflow:** browser red tests pin Layout terminology, preview and Back preservation. Implement lazy PrismLayouts using canonical editor/store/history; typed optional draft/result callbacks. Preserve order, unknown IDs and save validation; explain blockers without silently dropping them. Focus/keyboard/Escape/account guards and empty states.
- [ ] **Verification/review:** actual baseline captures exist at320/390/1440. Run full320/390/430/1440 Light/Dark Chromium/WebKit matrix, creation/editing/order/unknown/disabled states, current-vs-recorded evidence, Back/Forward, Save/Cancel, draft/file selection, account isolation and axe. Preserve CP3 first model row and CP2 provider containment suites. Type/unit/build/isolation/budget checks; independent review; curated exact-source before/after captures and fresh exact-head CI. Update source handoff/plan and separate live context, then STOP for owner/planner review.

## Files / ownership

`src/lib/routing-presentation.ts`: read-only effective mode/fallback and recorded-answer facts; no new stored fields. `src/components/RoutingInsight.tsx`: lazy current-vs-recorded details. `src/components/PrismLayouts.tsx`: Layout index, existing editor, canonical local back layer. `src/components/LayoutsTab.tsx`: original canonical editor/save hooks with additive callbacks and scoped UI improvements. `RoutingCenter.tsx`: compose these sections. `RouteWhy.tsx`: truthful historical alternatives wording in both presentations; neutral source labeling in Canvas. Scoped lazy `canvas-routing-experience.css`; audit declarations and a measured source-CSS budget amendment if necessary (no hidden uncounted stylesheet). Startup budgets and routing algorithms stay protected.

## Review focus / acceptance

1. Saved unknown/disabled IDs stay in cards, editor and persisted assignments after reorder/save.
2. Global switching off overrides a Layout's stored fallback; undefined legacy fallback means enabled models, as layoutPolicy already specifies.
3. Last completed answer ignores newer failed/stopped/streaming entries; routeDetail alternatives are historical, never promised next requests.
4. Cancel/Save/Back/Forward and account changes cannot overwrite another Layout/account or lose the chat draft/attachment.
5.320px default Models still exposes a complete usable row/action above contextual Search. Editor controls/text fit, all fields remain keyboard-accessible and long catalogs stay bounded.

Physical iPhone/PWA/VoiceOver/OS keyboard/dictation/IME remain device checks; simulated browsers do not establish them. No overall program percentage defined; historical ledgers remain unchanged.
