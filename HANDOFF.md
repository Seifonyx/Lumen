# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- Latest update: web Tests run 42687314660 failed on both Chromium E2E shard 3/6 variants because `tests/e2e/attachment-sync.cjs` still expected per-chat deletion to remove its cloud original. The application correctly retains shared originals for surviving forks. Updated the E2E to create an actual Firestore fork with the same image ID, delete the parent, and assert the parent tombstone, surviving fork reference, and unchanged original bytes. Native iOS run 42687314624 was still in progress during diagnosis. Rerun both checks after commit; do not merge or release.

- Request: fix last PR #147 native CI failure and shorten the ~30–36 min iPhone jobs, **without merging or publishing**. Work on draft branch `codex/phase2-completion-review` (previous head `6c9f7b0ca0b6`).
- Diagnosed artifact logs from Native iOS run 42679208498: both iPhone sizes compiled successfully and ran 14 UI tests with 13 passes / 1 failure. The identical failure is `testLongHistoryLoadsOlderAndSendsOnlyBoundedRecentContext` at `LumenUITests.swift:276`: expected `60 of 180` but received `0 of 180` immediately after selecting a chat. The Firestore metadata (180 IDs) had arrived before the first 60 message documents. This was a UI/readiness test race.
- Fix: don't display 'Load earlier messages' until the latest page is loaded; wait explicitly for the first 60 messages before asserting. Rename the long-chat UI test to sort first, so any recurrence fails early rather than after 10+ other iPhone journeys.
- Speed: run 107+ native core Swift unit tests in an independent **required Ubuntu CI job** concurrently with iPhone jobs (instead of recompiling them on both macOS runners). Build a single signed-off release IPA on the regular macOS runner, overlapping archive/package with its simulator UI journey; compact still executes all the UI and Firebase checks. Verification requires both complete simulator journeys, core tests, SHA-256 of exact-commit regular IPA and both profiles' screenshots/provenance. Python packaging coverage tests updated.
- Observed old critical path: 6m Swift core + 6m simulator build + 5m device archive + 14m UI journeys. The revised workflow is **not yet timed or verified**; CI must establish actual savings and correctness. Parallel archive could affect simulator responsiveness, so inspect both profiles carefully.
- Previous web workflow 42679208413 passed at the old SHA. Rerun web and native CI on new head. `main` and live SideStore (0.3.1) must remain untouched; physical iPhone approval is still required.
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
