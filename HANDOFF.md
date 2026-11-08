# Lumen checkpoint

Updated: 2026-11-08. This is the current continuation point; agent update guidance is in [AGENTS.md](AGENTS.md).

## Now

- **Branch:** `codex/ios-native-foundation`, based on `main` at `9a09a34`.
- **Goal:** Phase 0: fresh SwiftUI iOS 26 chat-first shell, GitHub simulator checks/screenshots,
  unsigned IPA packaging and SideStore delivery.
- **Done:** shell/sidebar/native sheets, persistent draft and appearance settings; project generation,
  core/UI tests, device-IPA validation and independent native build/release workflow implemented.
- **Verification:** 11 local packaging/Git checks pass; Mac core tests, compilation, device archive and IPA
  validation passed (0.1.0, arm64, minimum iOS 26). All four compact journeys and three regular journeys
  passed, including keyboard geometry, restoration and explicit Cancel/Discard. Regular capture exposed
  a missed Projects row tap: actual video/hierarchy showed the drawer stayed open. Replaced the plain
  Label with an explicit full-width row button style and pressed feedback; UI coverage taps its trailing
  empty area. Both-phone rerun pending. The reviewed feed-push race has real-Git regression coverage.
- **Next action:** rerun both profiles, inspect regular-phone Light/Dark captures, then publish.
  [PR #145](https://github.com/Seifonyx/Lumen/pull/145); artifacts `/workspace/scratch/lumen-native-keyboard-qa`.

## Next

The owner requested a fresh SwiftUI iOS 26 app in `ios/`, with GitHub macOS builds, simulator screenshots,
unsigned IPA downloads and SideStore installation. Phase 0 is authorized and in progress; account and provider integration begins in Phase 1.

Layout proposal: the conversation and composer are the main screen. A sidebar opens history, search,
projects and Library; the model control opens model/provider options; the composer opens attachments/tools;
settings live in the sidebar/profile. Use native navigation, sheets and system materials; no bottom tab bar.

Proposed build sequence:
0. Fresh `ios/` SwiftUI iOS 26 shell: chat/composer/sidebar, native controls, Light/Dark and keyboard layout.
   GitHub builds, simulator screenshots, versioned unsigned IPA and SideStore installation work end to end.
1. A real connected conversation: native Google/Firebase sign-in, existing account data, one working provider,
   streaming/Stop, saved messages and reopening the same chat. Verify the SideStore-installed app.
2. Complete everyday chat: history/search, editing/retry, attachments, incognito, drafts, long chats and restoration.
3. Router: provider/key setup, model discovery, manual/Auto selection, fallbacks, layouts, comparisons and usage.
4. Workspace: projects, instructions, memory, Library/files, search and account-scoped offline/sync behavior.
5. Documents/knowledge and AI tools: editing/import/export, citations, research, images, Study and assistants.
6. Analysis and coding: sandboxed Python/JavaScript, charts/downloads, GitHub browsing/diffs/commits/PRs/reverts.
7. Native finish and full parity: voice, settings, accessibility, supported iPhone integrations, performance,
   reliability and native-app cutover. Keeping the web app stable with fixes is a recommendation, not a confirmed choice.

Check document editing/export and the code-execution runtime early to settle feasibility. Background/scheduled
agents need their own execution and delivery design because iOS can suspend the app.

Earlier ideas remain backlog: $0 background agents (free quotas/storage/delivery need investigation), save
reply excerpts into projects (synced size undecided), unified search and native haptics/keyboard improvements.

## Open

- Legacy IPA work is in draft [PR #141](https://github.com/Seifonyx/Lumen/pull/141), branch
  `experiment/ios-sideload`. The owner now wants a fresh native implementation; this cleanup does not
  merge or continue that experiment. Its physical sign-in/sync results are not established here.

- Older web/PWA parity checks remain on physical iPhone: status-bar/launch color, quiet updates,
  touch feedback, drawer/nested navigation, draft/attachment restoration, keyboard, VoiceOver and Dynamic Type.
- Earlier notes report `canvas-integration.cjs` timing out on main and a load-sensitive `streaming.cjs`
  check on Windows. Reproduce before treating either as a new regression.

## Decisions

- Phase 0 is authorized. Fresh native bundle: `io.github.seifonyx.lumen`; legacy `.demo` stays separate.
  New releases use `native-ios-v…` and `ios/sidestore-source.json`. No credentials or account integration in Phase 0.
- 2026-11-08: the owner liked Setpoint's Swift/GitHub/SideStore development and delivery workflow, and rejected
  copying its bottom-tab navigation into Lumen. Design for an AI chat app; detailed navigation is still a proposal.
- 2026-11-08: the owner requested minimal project documentation and an automatically maintained handoff,
  replacing the previous detailed agent workflow and design rules.
- Canvas (`LUMEN_CANVAS=1`) is the production presentation; the ordinary build is the existing fallback.
  This documentation cleanup does not need an application deployment.
- `sidestore-source.json` lists native iOS 1.1.0 (2026-11-08). Its release process is documented in
  [SideStore releases](docs/ios/SIDESTORE_RELEASES.md); the IPA was not tested during this cleanup.
- `npm run handoff` reports current branch, PR and deployment facts. Earlier shipped work and deleted
  documents remain available in git history.
