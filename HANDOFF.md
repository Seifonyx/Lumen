# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- Fix and publish native Lumen 0.3.4 from draft [PR #147](https://github.com/Seifonyx/Lumen/pull/147) once release checks pass. The release combines protected per-chat drafts, memory-only temporary chats, attachments and long-chat recovery.
- Reply context is prepared before accepting a send or edit. Oversized turns leave the draft and outbox intact. Historical file omissions preserve the surrounding text and do not consume the image budget. Revisions preserve the parent's cloud file references even if an older original is unavailable.
- History refresh keeps cached pages, makes gaps loadable and blocks incomplete revisions. Previously loaded instructions are refreshed from authoritative records. Reselecting an interrupted reply preserves its stopped state.
- Individual chat deletion clears chat content and operation markers. Both clients retain cloud originals because another conversation may share them. Full account deletion removes originals. Native CI checks a surviving reference and its original bytes. Simulator reuse checks the live device model, runtime, boot state and availability.
- Local verification passed 107 Swift tests, 20 Python packaging checks, web typecheck and web unit tests. New Swift and simulator cases reproduced the regressions before their fixes.
- Next action is exact-head PR native CI on both iPhone profiles, artifact verification and web CI. After merge, deploy and verify the Canvas web retention fix before publishing native. Then verify the native publish job, public SideStore feed and IPA checksum. Physical sign-in, SideStore signing and live providers require an iPhone.

## Next

The owner requested a fresh SwiftUI iOS 26 app in `ios/`, with GitHub macOS builds, simulator screenshots,
unsigned IPA downloads and SideStore installation. Phases 0 and 1 are published; the next code phase is everyday chat. The owner performs the physical sign-in/install check.

Layout proposal: the conversation and composer are the main screen. A sidebar opens history, search,
projects and Library; the model control opens model/provider options; the composer opens attachments/tools;
settings live in the sidebar/profile. Use native navigation, sheets and system materials; no bottom tab bar.

Proposed build sequence:
0. Published; physical install/open check pending. Fresh `ios/` SwiftUI iOS 26 shell: chat/composer/sidebar, native controls, Light/Dark and keyboard layout.
   GitHub builds, simulator screenshots, versioned unsigned IPA and SideStore installation work end to end.
1. Published0.2.0; automated checks pass. Native Google/Firebase sign-in, existing account data, provider
   connections, streaming/Stop, saved messages and reopening the same chat. Physical SideStore check remains.
2. Complete everyday chat: history/search, editing/retry, attachments, incognito, drafts, long chats and restoration.
3. Router: provider/key setup, model discovery, manual/Auto selection, fallbacks, layouts, comparisons and usage.
4. Workspace: projects, instructions, memory, Library/files, search and account-scoped offline/sync behavior.
5. Documents/knowledge and AI tools: editing/import/export, citations, research, images, Study and assistants.
6. Analysis and coding: sandboxed Python/JavaScript, charts/downloads, GitHub browsing/diffs/commits/PRs/reverts.
7. Native finish and full parity: voice, settings, accessibility, supported iPhone integrations, performance,
   reliability and native-app cutover. The owner confirmed: new features go into native iOS; the web app gets fixes only.

Check document editing/export and the code-execution runtime early to settle feasibility. Background/scheduled
agents need their own execution and delivery design because iOS can suspend the app.

Earlier ideas remain backlog: $0 background agents (free quotas/storage/delivery need investigation), save
reply excerpts into projects (synced size undecided), unified search and native haptics/keyboard improvements.

## Open

- Legacy IPA work is in draft [PR #141](https://github.com/Seifonyx/Lumen/pull/141), branch
  `experiment/ios-sideload`. It is superseded by the fresh native foundation in PR #145. Its physical sign-in/sync results are not established here.

- Older web/PWA parity checks remain on physical iPhone: status-bar/launch color, quiet updates,
  touch feedback, drawer/nested navigation, draft/attachment restoration, keyboard, VoiceOver and Dynamic Type.
- Earlier reported web timing issues were not reproduced by the current green main CI.

## Decisions

- 2026-11-08: owner confirmed native development takes priority. Add new features to native iOS;
  maintain the web app with fixes only.
- Phase 0 is authorized. Fresh native bundle: `io.github.seifonyx.lumen`; legacy `.demo` stays separate.
  New releases use `native-ios-v…` and `ios/sidestore-source.json`. No credentials or account integration in Phase 0.
- 2026-11-08: the owner liked Setpoint's Swift/GitHub/SideStore development and delivery workflow, and rejected
  copying its bottom-tab navigation into Lumen. Design for an AI chat app; detailed navigation is still a proposal.
- 2026-11-08: the owner requested minimal project documentation and an automatically maintained handoff,
  replacing the previous detailed agent workflow and design rules.
- Canvas (`LUMEN_CANVAS=1`) is the production presentation; the ordinary build is the existing fallback.
  Web deployment is separate from native releases.
- Root `sidestore-source.json` and `ios-v…` releases belong to the legacy `.demo` app; see
  [legacy release guide](docs/ios/SIDESTORE_RELEASES.md). Use `ios/README.md` for the fresh native app.
- `npm run handoff` reports current branch, PR and deployment facts. Earlier shipped work and deleted
  documents remain available in git history.
