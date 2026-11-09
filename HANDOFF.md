# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- Current request: prepare an **unmerged, unpublished Phase 2 completion PR** for owner testing. Do not merge to main, deploy the web app, or publish an iOS SideStore release without subsequent owner approval.
- Work branch: `codex/phase2-completion-review`, built from the preserved `codex/phase2-recovery` backup. Parts 2.3 (durable per-chat drafts/temporary chats), 2.4 (protected images/files and cleanup), and 2.5 (paged history, bounded context, interrupted-reply restoration and independent retries) are present.
- Live production source still lists 0.3.1 (Parts 2.1 and 2.2); proposed native version is 0.3.4 **for review only**. Prior 77/86/93 Swift and 16/16/19 Python core-test counts were recorded before the backup; these are **not** new CI results.
- Review fixes added: preserve local `inheritedMessageIDs` and hydrated system messages across Firestore metadata refreshes; independently load authoritative old system messages for provider context without inserting them into the visible 60-message page. Added `Phase2CompletionTests.swift` for deleted-parent fork prevention after restart and old-instruction provider context after paging/restart.
- Web CI blocker addressed on the review branch: the QA-only Firebase adapter now exports the `limit` query constraint used by account deletion.
- The three recovery-only evidence files were removed from the *review* branch to keep the PR focused; they remain preserved on `codex/phase2-recovery`.
- Check pending: run PR Native iOS CI on compact/regular iPhones (including real Firebase SDK emulator paths and artifacts) and web CI. The physical Google chooser, SideStore signing, native picker UX, and real provider inference require owner phone testing.
- Next: open draft PR to `main`, inspect CI and review outcomes, fix any failures, then give the owner the unsigned IPA artifact for manual installation. Do **not** release until owner explicitly approves.

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
