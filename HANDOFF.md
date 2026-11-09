# Lumen checkpoint

Updated: 2026-11-09. Read the user's current request; update this checkpoint after meaningful work.

## Now

- Latest owner instruction: recover and back up all unfinished Phase2 work. **Do not merge or publish.**
  Earlier authorization to keep releasing is paused. No release workflow is active.
- This worktree contains **Part2.5**, branch `codex/phase2-recovery`. Paged long chats, bounded context, interruption restoration, independent retries and simulator preparation; staged changes now being committed.
  93 Swift tests and19 Python tests passed before recovery; native runtime pending. This backup is not a claim of release readiness.
- The three cumulative branches are `codex/phase2-drafts` (2.3), `codex/phase2-attachments` (2.4),
  and `codex/phase2-recovery` (2.5). Preserve their commit histories and worktree files.
- Part2.3 review found two Important save-failure issues; fixes and regressions are retained:
  engine/composer identity alignment and account-keyed in-memory draft recovery.
- Part2.4 review found two Important issues; fixes and regressions are retained:
  reference-aware original cleanup after durable removal and correctly named PDF text derivatives.
  Cleanup is blocked when the chat cache cannot be read or its last write failed.
- **Part2.5 still has two Important review findings, not fixed:**
  1. `applyRemoteMetadata` clears local `inheritedMessageIDs`; preserve it across metadata refresh/restart
     so a later fork batch cannot reconstruct messages after the source is deleted.
  2. Loading only the newest60 messages omits early system instructions; hydrate authoritative
     instruction messages independently and retain them in reply context.
  Reproduction and review/test evidence are archived on the2.5 branch under `recovery/phase2/`.
- Local before-recovery snapshots, binary patch and file hashes are at
  `/workspace/lumen-phase2-backup-20261109T1711Z/`. No source or test files were discarded.
- Existing public release0.3.1 completed before this recovery request: native CI42628171164 from2cbb614.
  The separate web Tests run42628171124 failed and remains uninvestigated; preserve it for follow-up.
  Main/source must stay untouched during backup. Google chooser, SideStore signing, real picker behavior
  and live provider inference still require the owner's iPhone.
- Recovery commits are pushed to all three separate GitHub branches. Their original histories and
  every preexisting source/test file are retained; each worktree is clean. File-hash audits and a
  verified Git bundle are saved in the local backup directory. Remote tips/trees are checked again
  after the final checkpoint push. Main and the published source are untouched by this recovery.
- Next implementation work, only after the owner resumes it: fix Part2.5's two documented Important
  findings, then run native UI/backend checks. Do not merge or publish under this recovery request.

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
