# Lumen checkpoint

Updated: 2026-11-10.

## Current work

- The owner installed native 0.3.4 and authorized **Phase 2.1 visual foundation** implementation, requesting *actual simulator screenshots viewable on an iPhone* before any release.
- Branch `codex/phase2-visual-polish-plan`, draft [PR #148](https://github.com/Seifonyx/Lumen/pull/148). This is an unpublished implementation, not an approved design or a published SideStore update.
- Added `ios/Lumen/Views/LumenDesignSystem.swift` with dynamic Light/Dark palette (graphite/off-white, cool-silver-blue accent), shared typography, radii, spacing, card surface and reduced-motion-aware button/row styles.
- Applied semantic styling to app tint, root/sidebar overlay, logo header, selected history row, account footer, empty chat, composer, model/send controls, error notice, user messages, code blocks, attachment chips, settings/provider forms, model picker and search/history. Existing actions, accessibility IDs and data behavior are retained.
- Required next verification: web checks, Swift core, four iOS simulator Firebase/UI shards, IPA packaging and exact-commit artifact verification. The existing `testNativeScreensInLightAndDark` captures chat, models, sidebar, projects and settings on iPhone in both appearances. **Collect screenshots from the new commit before showing a result.** No fabricated screenshots.
- **Next step:** inspect CI, fix failures without bypassing tests; collect actual PNG screenshots (Dark/Light, compact/regular) in phone-viewable form and send to owner. Keep PR draft and unmerged until owner reviews. Do not publish to SideStore.

## Roadmap / design contract

- Phase 2.1: design foundation (implemented, awaiting CI screenshots and owner review).
- Phase 2.2: sidebar/navigation deep polish; 2.3: chat/messages; 2.4: composer/attachments; 2.5: history/drafts/temporary/editing; 2.6: settings/provider forms/accessibility and complete consistency.
- Phase 3 (router) starts **only after** existing UI polish is approved. Every future feature must include full visual and interaction polish.
- Maintain familiar AI-chat characteristics and Lumen's light-inspired, restrained identity. Native features only; web fixes only.
- Live iOS bundle `io.github.seifonyx.lumen`, SideStore source `ios/sidestore-source.json`. Publish only verified changes from main after required CI and owner approval.
- Detailed acceptance requirements: `docs/ios/NATIVE_VISUAL_POLISH.md`. Keep this checkpoint concise and current.
