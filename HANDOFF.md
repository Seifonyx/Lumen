# Lumen checkpoint

Updated: 2026-11-10. Owner requested complete Phase 2 native visual polish, specific navigation changes and SideStore publication once verified.

## Current work

- Branch `codex/phase2-visual-polish-plan`, draft PR #148. Phase 2.1 visual foundation is already implemented; this update completes Phase 2.2–2.6 polishing for sidebar, chat, composer, message actions, attachments, search/history and settings.
- Navigation: sidebar header Search replaces X; sidebar rows no longer contain Search, Archived chats or Temporary chat. Edge swipe/handle opens, swipe left or outside tap closes. Archived chats available in Search → Archived and Settings → Chats & data. Temporary chat resides beside New chat in the top-right chat toolbar. Models & providers renamed Router.
- All 14 XCTest journeys remain; update old button paths, maintain fixtures, archive search, temporary privacy and screenshot assertions.
- 0.3.5 is the planned native version. Release not yet published.
- Early CI gate: Linux core job runs packaging/regression tests and Swift source syntax check before expensive iPhone jobs. If one simulator job transiently fails, retry only that job AFTER workflow completes. Source fixes create new SHA and necessarily require full required CI rerun.
- 2026-11-10 CI triage: run #42805393513 on bbfef3 fails 3 iPhone shards (both compact + regular sync) in XCTest helper `closeSidebarBySwiping` at line 49; **same root cause**: the actual sidebar ScrollView didn't recognize the outer ZStack's horizontal close gesture. Fix attaches a simultaneous horizontal drag handler to the panel itself and makes XCTest drag explicitly inside `sidebarPanel`, still asserting the sidebar closes. No coverage removed. Verify next commit before release.
- **Next concrete actions:** check PR head's core/Linux, all four real UI Firebase shards, macOS IPA, exact-commit artifact verification, web checks. Diagnose failure, fix/retry without dropping assertions. Once all pass, mark PR ready and merge to main; main CI must pass again to publish SideStore 0.3.5. Confirm release asset and source feed. Do not claim publication before verification.
- Actual simulator screenshot artifacts from the new version should be made viewable on phone for owner.

## Standing decisions

- Native iOS features only; web receives fixes. Preserve conventional AI chat workflow plus a distinct restrained light-inspired Lumen appearance.
- From Phase 3 onward every feature must ship with complete visual polish, dark/light and accessibility states. Phase 7 is not a deferred UI cleanup.
- Bundle `io.github.seifonyx.lumen`, native SideStore feed `ios/sidestore-source.json`; legacy demo release remains separate.
- Acceptance document `docs/ios/NATIVE_VISUAL_POLISH.md`. No release from a failing/draft/unverified build.

## 2026-11-10 latest sidebar regression follow-up

Run #42809180573 on `40b945702f76ea50c81eda61be013b156c83c668` failed all four UI shards at the *same* assertion in `closeSidebarBySwiping` (line 54). UIKit/SwiftUI nested scrolling still intercepts free-form drag. Next fix adds a visible and accessible trailing-edge drag/tap control that receives a high-priority leftward swipe, retains generic swipe-on-sidebar as a secondary option, and separates the UX swipe assertion inside the existing two-theme UI journey. All other journeys use the existing tap-outside/backdrop close mechanism, so a gesture failure is isolated to the feature shard; no UI tests are removed. Required exact-commit CI and owner review remain release gates. Do not publish until verified.

## 2026-11-10 exact diagnosis of run #42815884967

Latest commit `129a194f596892784348a4ee1a75ed61f9613d1f` on PR #148 failed all four iPhone UI shards at `LumenUITests.swift:53` after the backdrop test tapped `closeSidebar`. At that point `openSettings` still existed. The screen-wide backdrop was rendered as an invisible Text in a Button and its visual rectangle was only a `background`, which does not reliably expand the plain Button's hit-test area. Fix: use a filled Rectangle as the Button **label** so the entire scrim receives taps; tap the middle of the exposed region instead of the outer system edge; wait for the real sidebar-dismiss handle to *disappear* before treating navigation as complete. The existing separate swipe check also waits for handle disappearance. No tests or features removed; this must pass full new iPhone CI before merge/SideStore publication.

## 2026-11-10 hosted simulator launch diagnosis (run #42819472343, attempt 2)

- SHA `9efcbd85473f59828cffc89031e1804b59269b62` had five of six substantive jobs pass (core, archive, compact sync, regular sync, regular features). Compact/features failed before XCTest. First attempt: `simctl launch` returned FBSOpenApplicationServiceErrorDomain; second (single-job retry) timed out after **300 seconds** at the *same optional pre-XCTest simctl launch*. The script never reached `xcodebuild test-without-building`.
- Fix in `ios/scripts/test_simulators.py`: **remove optional pre-XCTest `simctl launch` and termination altogether**. Still install the app before XCTest and run every selected XCTest method, validate each pass, Firebase roundtrip, screenshot artifacts and IPA as hard release requirements. Regression test verifies staging performs exactly one install and never a warm-up launch, and that installation errors still fail.
- Fresh SHA requires all mandatory CI jobs to rerun; do not claim an unverified green result or publish to SideStore. No test coverage removed.
