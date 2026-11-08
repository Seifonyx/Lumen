# Lumen checkpoint

Updated: 2026-11-08. This is the current continuation point; agent update guidance is in [AGENTS.md](AGENTS.md).

## Now

- **Branch:** `codex/review-native-phase1`. Review completed for [PR #146](https://github.com/Seifonyx/Lumen/pull/146)
  at `85e4222`, against Phase 0 `14bf502`. **Verdict: needs changes; Phase 1 is not ready for release.**
  The original PR is unchanged and unmerged. This branch adds review tests/workflow and this checkpoint only.
- **Original verification:** [native CI](https://github.com/Seifonyx/Lumen/actions/runs/42522817455) passed
  9 core tests and the 4 existing shell UI journeys on each iPhone profile. Its screenshots were inspected.
  The auth tests exercise preview identity; no live Google/account sync/provider conversation was verified.
- **New verification:** [isolated Mac probes](https://github.com/Seifonyx/Lumen/actions/runs/42525884673)
  reran the original 9 core tests successfully and reproduced 3 failures: OpenAI selection requests Groq,
  submitted chat is absent from persisted state while streaming, and New Chat during streaming traps
  with `Fatal error: Index out of range` (`ChatEngine.swift:98`). Probe failures are intentional review evidence.
  The 11 Python packaging/Git checks also pass locally.
- **Phase 1 gaps:** Google button calls `signInPreview()` and fabricates a local profile (`SettingsView:53`,
  `AuthEngine:75`); no real auth flow invokes Firebase. Conversation storage is a global UserDefaults blob,
  with no existing web account data/sync (`ChatEngine:135` versus web `modelRouter/{uid}/chats/...`).
  `AIProvider:37` routes all selected models/keys to Groq, despite offering Gemini/OpenAI/Anthropic.
- **Other improvements:** provider key uses plain AppStorage (`SettingsView:10`); use Keychain. Stream state
  needs conversation/message ownership and cancellation guards; persist the submitted turn before networking.
- **Release blocker:** marketing version is still 0.1.0, already released. The actual publish guard was
  exercised against the downloaded PR artifact and existing tag metadata; it rejects the changed source.
  Bump the version and update foundation-only release notes before publishing the repaired Phase 1.
- **Next action:** repair real Google/Firebase auth and account-compatible storage, validate one provider,
  fix the reproduced streaming/persistence bugs and credential storage, then test the connected flows and
  build a new version for SideStore. No application fixes or Phase 1 release were made during this review.
- **Local evidence:** `/workspace/scratch/lumen-phase1-qa` and `/workspace/scratch/lumen-phase1-review-probes.log`.


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
