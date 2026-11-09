# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- Branch `codex/phase1-ready`; owner authorized fixing all Phase1 defects and shipping the native IPA.
  PR146 (`feat/phase1-connected-chat`) now points to repaired head `b2a7524`. Main is still Phase0
  `14bf502`. Do not merge until final Native iOS CI and screenshot inspection pass.
- Both fresh Firebase iOS apps are verified in `the-model-router`: `io.github.seifonyx.lumen` and
  `io.github.seifonyx.lumen.M2WDSAZ2A5`. Nickname Lumen is valid. Public config is bundled. Real Google/
  Firebase SDK auth replaces the preview login; Firebase owns tokens/refresh/Keychain. Rules/data unchanged.
- Native Phase1 now has account-isolated protected cache/outbox, live web history, merge-safe transactional
  sync, Groq/Gemini/OpenAI/Anthropic transports, bounded SSE parsing, Keychain keys and model discovery.
  Send accepts only after saving, Stop keeps partial text, and account/chat switches reject late stream data.
- Fresh final review of e310139 found3 Important issues, repaired in one pass: stale refreshes removing
  acknowledged turns; same-ID web edits not refreshing; deletion retaining remote messages/originals.
  Opaque mutation/session tickets, remote revisions and durable deletion cleanup cover these, with new
  failing-then-passing tests. No minors or second review required. Later phases/physical checks remain scoped
  as recorded in ios/README.md and release notes.
- Follow-ups preserve an unuploaded local chat when server metadata is absent (only tombstones delete),
  bound deletion reads to50 docs per batch, and prevent untyped legacy keys autofilling other providers.
  Phase0 draft migration is covered and already worked. Local43 Swift tests and12 packaging/Git checks pass.
- Local emulator smoke passes Google-credential identity, current rules, own-history read, cross-account
  denial and HTTP fixture. Exact current rules are staged under ignored build/emulators, never deployed.
- Mac dev run42534088538 finished/canceled at50m: compact shell4 journeys passed, real Google SDK emulator
  sign-in and cloud status worked, but all3 connected cases lacked the discovered Groq model (line137).
  Root cause still being traced; safe DEBUG counters now record cloud key presence/import and Keychain OS
  status only. The iOS-unneeded DataProtectionKeychain selector was removed for compatibility; do not yet
  claim that fixed model loading. Keychain save errors now clearly say Keychain (new RED→GREEN test).
- Rejected-key UI test reached expected401. Its back taps incorrectly hit underlying main nav bar;
  now scoped to Groq/Models & providers/Settings bars. Regular simulator then timed out launching;
  profiles now run on separate Mac runners with warm launch and bounded tests, avoiding retained-first-
  simulator resource pressure. This is a pipeline change, pending CI.16 Python checks verify artifact pairing,
  hashes, source/version agreement and both connected results before the new verify/publish jobs.
- App and Release archive at4494dba succeeded; its IPA independently passed hash/version/iOS26/both
  Google callback/client checks and contained linked auth SDKs with no DEBUG identity. Latest official
  run42536499740 atb2a7524 will be superseded by these runtime/test/pipeline fixes. Do not merge/publish yet.
- Temporary development workflow and Firebase inspector are removed in this update. Version0.2.0 and
  current release notes are ready. Next: official PR CI, fix any runtime/UI failures, merge, verify main IPA
  publication and public SideStore source. Actual Google chooser/SideStore signing need the owner's phone.
- Local Swift6.2.3: `/workspace/scratch/swift-6.2/usr/bin/swift`. No local Xcode. Old6.0.3 toolchain was
  removed (upstream Linux Observation linker bug). Use GitHub macOS26/Xcode26.6 for native checks.
- Review/fix evidence and plan are under `/workspace/scratch/lumen-final-review`,
  `/workspace/scratch/lumen-phase1-fix-plan.md`, and test logs. Preserve actual pass/fail limits.

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
