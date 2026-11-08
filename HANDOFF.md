# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- Branch `codex/phase1-ready`; owner authorized fixing Phase 1 completely and shipping the native IPA.
  PR146 remains open/unmerged; its original head is `85e4222`. Native first, web gets fixes only.
- Real Firebase registrations verified for `io.github.seifonyx.lumen` and `.M2WDSAZ2A5` in
  `the-model-router`. Nickname Lumen is valid. Public client configurations now bundled; no rules/data changed.
- Core generation ownership and immediate submitted-turn persistence repaired. Provider-specific streaming
  implemented for OpenAI, Groq, Gemini, Anthropic, with bounded fragmented SSE decoding.
  Regression run42530407507 passes all16 core tests. Mac app compile found nonexistent GoogleSignInSwiftUI
  product; removed. Firebase13.1.1/GoogleSignIn10.1.0 pinned. Version bumped0.2.0.
- Preview login removed. SDK-independent AuthEngine now restores/listens to actual platform sessions,
  rejects late sign-in after sign-out, and never trusts cached profiles. Five replacement auth tests pass
  locally after first observing the missing-interface failure. App Firebase/Google SDK adapter implemented,
  pending Mac compile and real SDK emulator verification. Actual phone Google login remains user testing.
- Remaining: protected account-scoped chat cache, compatible web Firestore history/sync, provider keys in
  Keychain and model discovery, connected UI/error states, meaningful connected-flow tests, final fresh
  whole-branch review, merge and publish0.2.0 to SideStore. Do not claim Phase1 ready yet.
- Local Swift6.2.3: `/workspace/scratch/swift-6.2/usr/bin/swift`. Linux6.0.3 had upstream Observation
  linker bug; do not use. No local Xcode. Use GitHub macOS26/Xcode26.6 for app/UI/IPA.
- Original review evidence: three Mac probes proved wrong provider endpoint, unsaved submitted turn, and
  new-chat streaming crash (run42525884673). Original Google login fabricated a profile, keys used prefs,
  storage was global UserDefaults and no cloud sync existed. Original0.1.0 cannot be republished with new source.
- Next: push auth work to compile in CI, then implement account cache/cloud boundary. Remove temporary
  development inspection workflow/helper before final PR. Never deploy web or modify Firebase rules.

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
