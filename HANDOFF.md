# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- Branch `codex/phase1-ready`; owner authorized fixing all Phase1 defects and shipping the native IPA.
  PR146 (`feat/phase1-connected-chat`) is open. Main remains Phase0 `14bf502`.
  Merge after final native CI and screenshot inspection; then verify public IPA and SideStore publication.
- Both fresh Firebase iOS apps are verified in `the-model-router`: `io.github.seifonyx.lumen` and
  `io.github.seifonyx.lumen.M2WDSAZ2A5`. Nickname Lumen is valid. Bundled public configuration and real
  Google/Firebase SDK auth replace preview identity. Production rules/data and web deployment are unchanged.
- Phase1 includes account-isolated protected cache/outbox, merge-safe live web history, provider-specific
  Groq/Gemini/OpenAI/Anthropic transports, bounded streaming/Stop, model discovery and account Keychain.
  Submitted turns save before acceptance; account/chat switches reject late stream and history results.
  Final review's3 Important findings are fixed: stale history overwrite, same-ID web edits and complete
  remote deletion of messages/originals. Later-phase features remain explicit in ios/README.md/release notes.
- Run42568526207 at6811df6: both isolated iPhone jobs failed the3 automatic cloud-key/history journeys.
  Compact passed6 journeys including real Firebase emulator login, manual valid-key Keychain save and
  streaming reply, keyboard/themes/restoration and rejected key. Missing imported model traced to Firestore
  gRPC error14, not model parsing or Keychain. Source inspection of pinned SDK13.1.1 proves `useEmulator`
  sets host but leaves TLS enabled. Current fix explicitly disables TLS only in DEBUG simulator fixtures;
  production retains TLS. Existing failed connected journeys are the regression test; Mac rerun pending.
- Local44 Swift tests and16 Python packaging/artifact checks pass after this change; actionlint and
  git diff --check also pass. The additional real ProviderCatalog + secure-store account-import test uses
  the exact HTTP fixture model/key.
  Emulator REST smoke passed Google-credential identity, root-key/history reads and cross-account denial
  against exact current rules. Production credentials and paid inference are never used by these tests.
- Version0.2.0 and release notes are ready; temporary diagnostic workflow/Firebase inspector removed.
  Release IPA previously passed independent hash/version/iOS26/both-client/callback/SDK checks and excludes
  DEBUG identity strings, but connected simulator QA must pass before shipping. Actual Google chooser,
  SideStore signing and live provider inference remain owner's physical-device checks.
- CI runs compact/regular on separate Mac runners, then verifies paired commit/version/hashes and both
  connected results before main can publish. Use `/workspace/scratch/actionlint` for workflow validation.
  Local Swift6.2.3: `/workspace/scratch/swift-6.2/usr/bin/swift`. No local Xcode; native runs use GitHub
  macOS26/Xcode26.6. Review evidence/plan: `/workspace/scratch/lumen-final-review` and
  `/workspace/scratch/lumen-phase1-fix-plan.md`.

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
