# Lumen handoff

Updated 2026-11-25. Supersedes every earlier checkpoint in this file.

## What Lumen is

Lumen is the owner's private AI workspace.

- **Web app:** https://lumen-chat.web.app. Invite-only; Firebase project `the-model-router`. React + TypeScript + Vite in `src/`. Chat with free and bring-your-own-key models, documents, knowledge, GitHub coding. **Fixes only; new features go to the iPhone app.**
- **Native iPhone app:** SwiftUI, iOS 26+, in `ios/`. Bundle `io.github.seifonyx.lumen`. Unsigned IPA installed by the owner through **SideStore**. This is where active work happens.

Both share the same Google/Firebase account and Firestore data. The native app writes chats in the web's schema, keeping web-only fields.

## Current state

- **Latest native release: 0.6.2.** Merged in #163; main `4b71e009`, with the feed update in `c8007ba7`. Published to both SideStore feeds as GitHub prerelease `native-ios-v0.6.2`.
  - **0.6.1 (#162):**
    - Voice dictation (on-device speech) and Read aloud.
    - Siri and Shortcuts: Ask Lumen, New Lumen chat, Talk to Lumen.
    - `lumen://new?prompt=` links fill the composer and never send.
    - Replies keep going after you leave the app, then post a local notification (can be turned off in Settings).
    - The keyboard hides on send, and the sent question pins to the top while the reply writes below.
    - It also includes 0.6.0, which was never published on its own.
  - **0.6.2 (#163):**
    - Home Screen widget "Ask Lumen" (small and medium), Lumen Lock Screen widgets.
    - Control Center, Lock Screen and Action-button controls: "New Lumen Chat" and "Talk to Lumen".
- **Earlier:**
  - Phase 0 and 1: shell, account, streaming, sidebar, Markdown, glass composer.
  - Phase 2, 0.5.0–0.5.3: Projects, Auto routing, Library, Memory, Export.
- **Nothing from 0.4 onward has been confirmed on the owner's physical iPhone.** Every check so far ran in CI simulators.
- **Web production** was last deployed 2026-11-07 (`223b47c`). Since then, main has small web changes in `src/lib/sync.ts`, `src/lib/delete-account.ts` and a few CSS files that have **not** been deployed. Run `npm run handoff` to see the live state.
- **No open PRs.**

## The phased plan (owner's)

Plan artifact: https://claude.ai/artifact/GRPpkuK6yMvdAaeFsCpom9

| Phase | What | Status |
|---|---|---|
| 0 | one app, honest state | done |
| 1 | iOS 26 shell | done (0.4.x) |
| 2 | daily-driver parity | done (0.5.x) |
| 3 | iPhone-only features | voice, Siri, notifications and widgets done (0.6.x). **Share extension not started.** Handoff to the web was deferred because the web can't open a chat from a link. |
| 4 | proposed: iPhone feedback round, then speed, offline and sync reliability; hands-free voice conversation; faster releases | not started (CI release reuse already done) |

## Next steps, in priority order

1. **Owner tests 0.6.2 on the iPhone.** Fix whatever they report first.
   - Mic dictation and Read aloud.
   - "Ask Lumen" via Siri.
   - Widgets and controls.
   - Leave the app mid-reply, then **tap the notification**. It should open that chat. CI could not test this tap: the simulator relaunched Lumen blank, and the test now returns the ordinary way. If Lumen opens blank on a real phone, the bug is in `ReplyNotifier.userNotificationCenter(_:didReceive:)` → `LumenRequests.openChat` → `RootView.openNotifiedChat()`.
2. **Phase 3, "Send to Lumen" share extension.** Share text, links and images into a new chat; follow the widget extension pattern (`ios/LumenWidgets`, shared code in `ios/Shared`, `project.yml` target, `package_ipa.py` validation). Release as 0.6.3.
3. **Phase 4:**
   - Speed, offline and sync reliability: outbox, retry and cold start.
   - Hands-free voice conversation mode: dictation → send → read aloud → listen again.
   - Further CI trimming.
4. **Optional web deploy** of the undeployed `src/` fixes (Deploy workflow, `presentation=canvas`).
5. **Housekeeping:**
   - Update the public live context: `docs/lumen-context/CURRENT_STATUS.md` on branch `docs/lumen-live-context`. It still describes 0.5.x.
   - Retire old Capacitor references there.

## Where everything lives

- **Repo:** `github.com/Seifonyx/Lumen`.
  - Work only on branches from `origin/main`.
  - Native branches are named `native/<topic>`; docs branches `docs/<topic>`.
- **Native app (`ios/`):**
  - `project.yml`: XcodeGen; `MARKETING_VERSION` is bumped per release.
  - `Lumen/`: the app, with `Views/`, `Services/` and `App/`.
  - `LumenCore/`: a Swift package of pure logic with swift-testing tests; it runs on Linux.
  - `Shared/`: App Intents used by the app and the widget.
  - `LumenWidgets/`: the WidgetKit extension.
  - `LumenUITests/`: the XCTest UI suites.
  - `release-notes.json`: the notes for each release.
  - `scripts/`:
    - build and test runners;
    - `package_ipa.py` (IPA validation);
    - `publish.py` (GitHub release plus feed update);
    - `reuse_pr_run.py` (reuses a PR's verified build on main);
    - `native_test_server.py` (the local provider fixture).
  - `tests/`: Python tests for those scripts.
- **SideStore feeds:** `ios/sidestore-source.json` and root `sidestore-source.json`, both updated by each release. `publish.py` copies the IPA's `NS*UsageDescription` keys into `appPermissions.privacy`; SideStore rejects a mismatch.
- **CI:** `.github/workflows/ios-native.yml`.
  - **Jobs:**
    - core: Linux Docker `swift:6.2`, Python tests.
    - One simulator build.
    - Four UI shards: compact or regular iPhone × `sync` or `features` suites (10 and 11 tests).
    - Release IPA archive, verify, then publish on main.
  - On main, the `reuse` job takes the verified artifact from the merged PR's run when `ios/` and the workflow are unchanged, so publishing takes about a minute.
  - A PR run takes 30–40 minutes. macOS runners are sometimes unavailable; such a run is *cancelled*, not failed. Re-run it.
- **Web:**
  - `src/`, `tests/`.
  - `scripts/handoff.mjs` (`npm run handoff`).
  - Deploy workflow `.github/workflows/deploy.yml` (`presentation=canvas`).
  - Provider relay Worker `server/provider-relay`.
  - Firestore rules in `firestore.rules`.
  - See AGENTS.md.
- **Firebase:**
  - Project `the-model-router`.
  - The native public client config is in `ios/Lumen/Resources/FirebaseClients.json` (public; not a service account).
  - Clients exist for the base bundle and for SideStore's `M2WDSAZ2A5` suffix.
- **Public live context:** branch `docs/lumen-live-context`, folder `docs/lumen-context/`. Public-safe only.
- **Archived/legacy branches (do not merge):**
  - `experiment/ios-sideload`: the old Capacitor iPhone app (1.1.0), superseded by `ios/`.
  - `archive/codex-capacitor-leftovers`: untracked Codex files saved from a local checkout.
  - `codex/*`: old Codex work; #150 is closed and replaced by #152.
- Merged branches remain on origin and can be deleted.

## Decisions and why

- **Native first.** The owner wants an iPhone app that feels like the AI apps they use. The web gets fixes only.
- **SideStore, unsigned IPA, $0.** There is no paid Apple developer account; spending must stay at $0.
- **Standing authority:**
  - Owner, 2026-11-11: "Publish any update from now on without waiting for me", and "If there's anything you would like to do you have my approval".
  - Under it: merge green PRs, publish native releases, then tell the owner the next step.
  - Escalate auth changes, Firestore rule changes, new network endpoints and anything costing money.
- **Every native feature ships with** design polish, accessibility (VoiceOver labels, Dynamic Type), Light and Dark, and functional XCTest coverage.
- **Reports to the owner** end with a plain-language summary of what changed for them, by area.
- **Behaviour modelled on ChatGPT and Claude:**
  - The sent question pins to the top while the reply writes below it.
  - The keyboard hides on send.
  - Replies continue in the background and notify.
- **Links never auto-send.** `lumen://…&send=1` is honoured only in DEBUG simulator UI tests; App Intents send only when the user invoked them.
- **Notifications are local only**; there is no push server. Temporary chats hide the reply text.
- **Handoff to the web is deferred**, because the web can't open a chat from a link.

## Gotchas and rules

- **Secrets and data:**
  - Never commit, log or send secrets or user data.
  - QA is synthetic only: Firebase emulators and a local provider fixture. No real accounts, keys or paid inference.
  - Never print credentials.
- **Git:**
  - Never force-push and never work on `main` directly.
  - Don't enable auto-merge. Merge with `gh pr merge --merge --match-head-commit <sha>` after green CI on that exact head.
  - Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR bodies end with the Claude Code line.
- **Windows Python edits:** open files with `encoding='utf-8', newline=''`. cp1252 and CRLF once broke builds and caused whole-file merge conflicts.
- **SwiftUI:** a long `ChatView.body` hits a type-check timeout, so keep the view split into helpers. `SensoryFeedback.Weight.soft` doesn't exist.
- **GitHub Actions:** dependents of a skipped job are skipped too, unless their `if:` includes `!cancelled()` explicitly. The workflow relies on this.
- **Releases:** a release must bump `MARKETING_VERSION`. Merging a PR without a new version would republish the same tag from a different commit.
- **Flaky simulator behaviour** to read around when a UI test fails:
  - It sometimes stalls on an animation for 60 s (tests carry an `executionTimeAllowance`).
  - It can ignore taps on notifications.
  - It can split fast typing (`enterDraft` waits for the full text).
  - Check the failure screenshots in the run artifacts before changing app code.
- **Pinning:** the room under a pinned question is sized from the tallest height the screen has had (`pinRoom`), because sending happens while the keyboard is still open. The pin holds until the user scrolls or taps Latest.
- **Local Windows test:** `test_packages_device_app_and_records_actual_metadata` fails on Windows even on main. Ignore it locally; it passes in CI.

## Open bugs and unverified

- **Notification tap-to-open:** unverified; see Next step 1.
- **Hardware not checked on a real iPhone:**
  - Real mic and TTS voice.
  - Siri phrases.
  - Background time limits.
  - Widgets and controls.
- **Compact simulator:** touch-and-hold on a sidebar chat sometimes registered as a tap. The test retries; confirm on the device.
- **Library** shows files only from chats cached on the phone. A web chat's files appear after that chat is opened once.
