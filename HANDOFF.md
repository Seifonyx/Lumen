# Lumen checkpoint

Updated: 2026-11-10. Owner requested complete Phase 2 native visual polish, specific navigation changes and SideStore publication once verified.

## Current work

- Branch `codex/phase2-visual-polish-plan`, draft PR #148. Phase 2.1 visual foundation is already implemented; this update completes Phase 2.2–2.6 polishing for sidebar, chat, composer, message actions, attachments, search/history and settings.
- Navigation: sidebar header Search replaces X; sidebar rows no longer contain Search, Archived chats or Temporary chat. Edge swipe/handle opens, swipe left or outside tap closes. Archived chats available in Search → Archived and Settings → Chats & data. Temporary chat resides beside New chat in the top-right chat toolbar. Models & providers renamed Router.
- All 14 XCTest journeys remain; update old button paths, maintain fixtures, archive search, temporary privacy and screenshot assertions.
- 0.3.5 is the planned native version. Release not yet published.
- Early CI gate: Linux core job runs packaging/regression tests and Swift source syntax check before expensive iPhone jobs. If one simulator job transiently fails, retry only that job AFTER workflow completes. Source fixes create new SHA and necessarily require full required CI rerun.
- **Next concrete actions:** check PR head's core/Linux, all four real UI Firebase shards, macOS IPA, exact-commit artifact verification, web checks. Diagnose failure, fix/retry without dropping assertions. Once all pass, mark PR ready and merge to main; main CI must pass again to publish SideStore 0.3.5. Confirm release asset and source feed. Do not claim publication before verification.
- Actual simulator screenshot artifacts from the new version should be made viewable on phone for owner.

## Standing decisions

- Native iOS features only; web receives fixes. Preserve conventional AI chat workflow plus a distinct restrained light-inspired Lumen appearance.
- From Phase 3 onward every feature must ship with complete visual polish, dark/light and accessibility states. Phase 7 is not a deferred UI cleanup.
- Bundle `io.github.seifonyx.lumen`, native SideStore feed `ios/sidestore-source.json`; legacy demo release remains separate.
- Acceptance document `docs/ios/NATIVE_VISUAL_POLISH.md`. No release from a failing/draft/unverified build.
