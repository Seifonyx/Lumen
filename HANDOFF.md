# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- 2026-11-09 owner explicitly authorized: **fix current failure and publish latest 0.3.4 to SideStore**, but *only after* the updated draft PR passes all required web/native CI and exact-commit IPA verification. On passing checks, mark PR ready and merge to main; main native CI alone publishes the version. Never bypass failed checks.
- Diagnosis: native run 42700477434 failed ONLY the compact/sync UI test `testHistoryRenamePinArchiveAndSearchCachedMessages` at line 427. Its captured accessibility hierarchy shows `Loading conversation…` still on screen (metadata loaded, message not yet). Regular sync and both feature shards, core, release archive and web passed.
- Fix candidate: for a full one-page chat, don't issue a separate Firestore system-instruction query (the page already includes every system message). For a paginated chat, retain separate authoritative instruction hydration. Raise UI wait from 15s to 60s; xcodebuild retries failed UI methods once, not the whole suite, retaining hard failure on repeat. The new code must pass CI before publishing.

- Owner request: make PR #147 native CI as fast as reasonably possible **without reducing release verification**. Keep `codex/phase2-completion-review` as an unmerged draft. Do not publish to SideStore or deploy web.
- Baseline: successful Native iOS run 42690244621 at commit `3cb7b6c` lasted ~35 min. On both iPhone sizes, XCTest's 14 serial UI journeys alone took 12–13 min; fresh simulator preparation reported 8m50s on regular. Core Swift 107 tests and web tests had passed.
- New workflow is designed for the standard GitHub-hosted **five simultaneous macOS job** limit: 4 independent, balanced UI/Firebase shards (compact + regular x sync + features), plus 1 separate concurrent unsigned device IPA archive. A required Ubuntu job runs all Python packaging/CI checks and all 107+ Swift core tests. Each size still executes **every one of the 14 UI tests**, with independently seeded real Firebase Auth/Firestore emulators.
- `ios/scripts/test_simulators.py` uses explicit `-only-testing` method sets (6 sync and 8 features), checks each test's actual XCTest pass line so a zero-test run cannot pass, and records exact method names and count. `native_test_server.py` divides its original full verification into independently enforceable sync/feature assertions with `all` still supporting local full-suite runs.
- `collect_artifacts.py` refuses any missing UI shard, lost Firebase assertion, omitted XCTest method count, screenshot/provenance mismatch, duplicate simulator UUID, or incorrect SHA-256, source SHA, app ID, OS or architecture. Only the fifth runner's independently packaged device IPA can be selected for release after both phones pass. The publishing job is still restricted to `main`.
- On ephemeral GitHub CI runners only, `prepare_simulator.py` prefers a matching available preinstalled iPhone simulator (booted first) over fresh-device creation; it never reuses local developer simulators. Fallback remains a new dedicated simulator.
- Tests added/updated to cover exact UI method partition, hosted reuse safety, every new artifact gate, and the existing packaging/security checks.
- **Status: new workflow has not yet been run on GitHub; optimizations are candidates pending CI and measured wall-time.** Fix failures without dropping tests. Do not merge or publish before owner reviews simulator screenshots or device IPA.
- Next: trigger PR checks, verify all four iPhone shards + archive + Ubuntu core + web CI, measure wall time versus the 35-minute baseline, and make any safe follow-up optimizations based on actual results.

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
