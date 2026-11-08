# Lumen checkpoint

Updated: 2026-11-08. This is the current continuation point; agent update guidance is in [AGENTS.md](AGENTS.md).

## Now

- **Branch:** `main`. Phase 0 is published: [Lumen native 0.1.0, build 7](https://github.com/Seifonyx/Lumen/releases/tag/native-ios-v0.1.0).
  Implementation merged in [PR #145](https://github.com/Seifonyx/Lumen/pull/145), source commit `5ae3029`.
- **Shipped:** fresh SwiftUI iOS 26 chat/composer/sidebar, native sheets and Liquid Glass controls,
  icon, persistent unsent draft and appearance settings. Bundle `io.github.seifonyx.lumen`.
  Account sign-in, AI connections and real workspace data begin in Phase 1.
- **Verified:** [main build and publication](https://github.com/Seifonyx/Lumen/actions/runs/42511043876) passed
  all 34 checks: native build/publication and 32 web checks. Native coverage includes 11 packaging/Git checks,
  3 Swift core tests and all 4 UI journeys on each of two iPhone profiles. Light/Dark captures inspected.
  Public IPA, manifest, screenshots and source downloaded anonymously; device binary, identity and digest verified.
- **Install:** [Lumen.ipa](https://github.com/Seifonyx/Lumen/releases/download/native-ios-v0.1.0/Lumen.ipa) in SideStore,
  or add [the native source](https://raw.githubusercontent.com/Seifonyx/Lumen/main/ios/sidestore-source.json).
  Actual installation/opening on the owner's iPhone remains the final physical-device check.
- **Device follow-up:** owner confirmed the SideStore source now works. No feed change was needed.
  The earlier import error is resolved; actual installation and launch of Lumen have not yet been reported.
- **Next implementation:** Phase 1: existing account/sign-in, one provider, streaming/Stop, saved chats and reopening.
  Phase 1 has not started. Bump `MARKETING_VERSION` for the next native release; setup is in `ios/README.md`.
- **Local evidence:** `/workspace/scratch/lumen-native-release-0.1.0` (published IPA, metadata and screenshots).

## Next

The owner requested a fresh SwiftUI iOS 26 app in `ios/`, with GitHub macOS builds, simulator screenshots,
unsigned IPA downloads and SideStore installation. Phase 0 is published; account and provider integration begins in Phase 1.

Layout proposal: the conversation and composer are the main screen. A sidebar opens history, search,
projects and Library; the model control opens model/provider options; the composer opens attachments/tools;
settings live in the sidebar/profile. Use native navigation, sheets and system materials; no bottom tab bar.

Proposed build sequence:
0. Published; physical install/open check pending. Fresh `ios/` SwiftUI iOS 26 shell: chat/composer/sidebar, native controls, Light/Dark and keyboard layout.
   GitHub builds, simulator screenshots, versioned unsigned IPA and SideStore installation work end to end.
1. A real connected conversation: native Google/Firebase sign-in, existing account data, one working provider,
   streaming/Stop, saved messages and reopening the same chat. Verify the SideStore-installed app.
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
