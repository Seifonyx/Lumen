# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- Owner authorized the entire Phase2 in one continuous run, releasing each part to the existing source.
  Current branch `codex/phase2-message-controls`, starting from fb1ea81. Parts:2.1 controls0.3.0;
  2.2 history0.3.1;2.3 drafts/temporary0.3.2;2.4 attachments0.3.3;2.5 long chats/recovery0.3.4.
  Plan/ledger: `/workspace/scratch/lumen-phase2/{plan,progress}.md`. Baseline44 Swift+16 Python pass.
  Task1 implementation is ready for review: immutable selectable conversation versions for edit/regenerate/retry,
  native copy/share, version grouping and clone-safe cloud transactions.58 Swift tests+16 Python checks pass;
  fresh review found2 Important provenance/dependency issues, repaired with RED→GREEN tests; grouped
  deletion now removes all versions atomically. UI Swift parses. Native CI/publication still pending.
  Preserve originals and group versions as one history item. Do not stop after the first release.
  Develop later parts while CI runs, and publish sequentially after prior source update succeeds.

- Native Phase1 is shipped: **0.2.0, build26**, from main commit `732b4df1f543129242766d66e9e7257b9e5dca1c`.
  [PR146](https://github.com/Seifonyx/Lumen/pull/146) is merged. Local branch `codex/phase1-shipping`
  follows main; source-listing bot commit is `5fba2be`. Phase1 shipping is complete; Phase2 work is now active.
- Release: https://github.com/Seifonyx/Lumen/releases/tag/native-ios-v0.2.0
  SideStore: https://raw.githubusercontent.com/Seifonyx/Lumen/main/ios/sidestore-source.json
  Anonymous download and canonical JSON verified; newest version, size and URL match the release/manifest.
  IPA:6,477,724 bytes; SHA256 `d601591daa0dd8d5b8a4203a97419779d568119d3ad161540188afc7925292ba`.
- [Final CI42576882912](https://github.com/Seifonyx/Lumen/actions/runs/42576882912) is fully green:
  44 Swift tests,16 Python packaging/artifact checks,9 UI journeys on each of2 iPhone sizes (18 total).
  Real Firebase Auth/Firestore SDK emulator roundtrips, deletion cleanup, unknown metadata/message fields,
  web ordering and4 provider requests per phone pass. Paired IPA/source/version/hash verification and
  publishing pass. Inspected final compact keyboard/Stop and regular dark/web-history screenshots.
- Phase1 now uses real Google/Firebase auth; account-scoped protected cache, durable outbox and Keychain;
  safe web chat reads/appends/deletion; Groq/Gemini/OpenAI/Anthropic transports, discovered models,
  streamed replies and Stop. Chat is the main screen with sidebar navigation, no bottom tabs.
- Firebase project `the-model-router` has the correct clients for `io.github.seifonyx.lumen` and
  `io.github.seifonyx.lumen.M2WDSAZ2A5`; nickname Lumen is valid. Bundled configuration is public.
  Native sync reuses the existing web schema. Further workspace/router/tool parity remains later phases.
- Runtime details behind verified fixes: Firestore transaction callbacks are explicitly @Sendable because
  the SDK executes updates off the main actor. SDK13.1.1 emulator setup explicitly disables local TLS only
  in DEBUG simulator fixtures. CI waits for actual input readiness, targets the visible sidebar X and gives
  the long history/relaunch/sign-out journey180s. Release excludes all fixture identity/key markers.
- Next physical check: update through SideStore, sign in with the existing Lumen Google account, choose a
  connected model, send/Stop, then reopen a web chat. Google's real chooser, SideStore signing and live
  provider inference require the owner's iPhone; automation used local emulators/HTTP fixtures.
- Local Swift6.2.3 is `/workspace/scratch/swift-6.2/usr/bin/swift`; no local Xcode. Native checks use the
  committed `ios/scripts/build.sh` on GitHub macOS26/Xcode26.6. Current setup is in `ios/README.md`.

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
