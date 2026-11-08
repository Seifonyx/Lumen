# Lumen checkpoint

Updated: 2026-11-08. This is the current continuation point; agent update guidance is in [AGENTS.md](AGENTS.md).

## Now

- **Branch:** `codex/simplify-agent-checkpoint` for this cleanup; continue from `main` after merge.
- **Goal:** plan the owner's fresh native iOS app; Foundation has not started.
- **Done:** replaced the long agent guide with a short read/update instruction; condensed this handoff;
  removed the design rulebook and historical UI/Router reports. Kept setup, release and licence references.
- **Verification:** Markdown links/commands, preserved licences, Node/shell syntax and offline handoff passed;
  seven reminder smoke checks passed. Independent read-only review found no material issues.
  CI passed typecheck, builds, budgets and units, then flagged a stale historical allowlist. Added only the
  existing SideStore listing workflow and the relay README to that list; see
  [PR #144](https://github.com/Seifonyx/Lumen/pull/144) for the current CI result.
  Application-file edits only remove comments referencing deleted documents; no application deployment is needed.
- **Next action:** review the proposed phases in this chat, then begin Foundation when the owner requests it.

## Next

The owner requested a fresh SwiftUI iOS 26 app in `ios/`, with GitHub macOS builds, simulator screenshots,
unsigned IPA downloads and SideStore installation. This session proposes the phases; native code has not started.

Proposed sequence (details in the current chat):
0. Native shell, Liquid Glass navigation, simulator checks and an installable IPA.
1. Native Google/Firebase sign-in and the existing account's data; verify on the SideStore-installed app.
2. Everyday chat: streaming, drafts, attachments, history, editing, retry and incognito.
3. Model/provider setup, routing, layouts, comparison and usage; test Swift behavior against shared fixtures.
4. Projects, Library, memory, search and offline/sync behavior.
5. Documents, knowledge, research, image generation, Study and assistant tools.
6. Data analysis/code execution and GitHub coding, including review, commits/PRs and undo.
7. Native voice, settings, accessibility and iPhone integrations.
8. Feature parity, reliability and native-app cutover; web retained as a stable fallback is the recommendation.

Earlier ideas remain backlog: $0 background agents (free quotas/storage/delivery need investigation), save
reply excerpts into projects (synced size undecided), unified search and native haptics/keyboard improvements.

## Open

- Legacy IPA work is in draft [PR #141](https://github.com/Seifonyx/Lumen/pull/141), branch
  `experiment/ios-sideload`. The owner now wants a fresh native implementation; this cleanup does not
  merge or continue that experiment. Its physical sign-in/sync results are not established here.

- Older web/PWA parity checks remain on physical iPhone: status-bar/launch color, quiet updates,
  touch feedback, drawer/nested navigation, draft/attachment restoration, keyboard, VoiceOver and Dynamic Type.
- Earlier notes report `canvas-integration.cjs` timing out on main and a load-sensitive `streaming.cjs`
  check on Windows. Reproduce before treating either as a new regression.

## Decisions

- 2026-11-08: the owner requested minimal project documentation and an automatically maintained handoff,
  replacing the previous detailed agent workflow and design rules.
- Canvas (`LUMEN_CANVAS=1`) is the production presentation; the ordinary build is the existing fallback.
  This documentation cleanup does not need an application deployment.
- `sidestore-source.json` lists native iOS 1.1.0 (2026-11-08). Its release process is documented in
  [SideStore releases](docs/ios/SIDESTORE_RELEASES.md); the IPA was not tested during this cleanup.
- `npm run handoff` reports current branch, PR and deployment facts. Earlier shipped work and deleted
  documents remain available in git history.
