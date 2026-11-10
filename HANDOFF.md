# Lumen checkpoint

Updated: 2026-11-10. Read the user's current request before acting.

## Current goal

- **Phase 2 visual-polish gate before Phase 3.** Owner installed native 0.3.4 from SideStore and wants the entire existing app (Phase 0–2) visually/interactionally polished first. Every subsequent feature must ship with its polish rather than deferring appearance to a future phase.
- **Identity constraint:** unmistakably Lumen, calm/premium and light-inspired, while preserving familiar AI-chat patterns (conversation-first, bottom composer, sidebar/history, model selector, attachments, native gestures).
- Scope and exit criteria: [docs/ios/NATIVE_VISUAL_POLISH.md](docs/ios/NATIVE_VISUAL_POLISH.md).
- Current work branch: `codex/phase2-visual-polish-plan`. This branch records the acceptance brief; **no SwiftUI restyling, simulator screenshot verification or new release has happened on this branch yet**. Keep it as a draft review until visual choices and implementations are validated.
- **Next concrete action:** establish the actual visual direction from native screenshots and implement slice A (design tokens + sidebar) with before/after compact/regular Light/Dark screenshots; then proceed through conversation/composer, existing Phase 2 features, and settings. All functional CI and device UX gates remain required. Don't begin Phase 3 until this milestone is approved.

## Product roadmap

- Phases 0–2: fresh SwiftUI iPhone shell, account/provider chat and everyday chat (history/search, edits/retry, attachments, drafts, temporary chat, long chat/recovery); 0.3.4 was released and installed by the owner.
- **2.x visual polish gate (new priority):** finish every currently implemented screen and interaction before adding Phase 3.
- Phase 3: AI router, provider/model discovery, manual/Auto selection, fallbacks, layouts/comparisons, usage.
- Phase 4: projects, memory, Library, files and workspace/sync.
- Phase 5: documents/knowledge, research, images, Study and assistants.
- Phase 6: execution/analysis, charts, downloads, GitHub coding workflows.
- Phase 7: voice, deep reliability/performance, advanced accessibility and remaining native parity — not the first visual-design pass.

## Standing decisions and safety

- New functionality goes into the native app. The web app receives fixes only.
- The native bundle ID is `io.github.seifonyx.lumen`, iOS 26+; live SideStore source is `ios/sidestore-source.json`. Legacy `.demo` app and root source are separate.
- Keep familiar AI-chat navigation and protect existing actions, accessibility IDs, account-scoped data, key security and sync behavior. Review both compact and regular simulators; do not weaken test coverage for visual changes.
- Do not publish a draft, failing or unverified build; exact-commit iOS CI and verified IPA must pass before releasing, and owner device approval remains relevant.
- Working convention: update this handoff before committing/pausing, including branch, checks, blockers and next action; prior long history is preserved in Git history.
