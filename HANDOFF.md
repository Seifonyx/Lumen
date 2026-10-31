# Lumen handoff

Where the work stands, for whoever picks it up next (any agent, any machine). Facts that git and GitHub know
(branches, commits, PRs, what is deployed) are **not** written here; they are computed fresh by `npm run handoff`,
which runs automatically when a Claude Code session starts. This file holds what git can't know.

**Keep it current:** update *Now* and *Next* whenever you finish a step or stop, and move finished work out (a line
in *Recently shipped* at most; git history has the rest). The pre-commit hook reminds you when you commit app code
on a branch that *Now* doesn't describe. Never let this file grow into a log.

## Now

- **Branch:** none in progress. Start new work on a branch from `origin/main`.
- **Task:** none. The owner asked for polish suggestions after the cleanup and audit release (2026-10-31); they were
  proposed in chat and are listed under *Next* until the owner picks.
- **Authority:** standing (see Decisions): test, merge, deploy when verified.

## Next

Polish candidates proposed 2026-10-31, awaiting the owner's pick (none started):

- Usage ring in the iPhone bar reads as a spinner when nearly empty: hide it until the chat is half full, or keep.
- Section labels: sentence case instead of mono uppercase (owner's view wanted).
- Radius tokens: replace the hard-coded 8/9/10/12/14/16/22/24/26 px in Canvas CSS with the defined tokens.
- Light-mode glass: tune against a real iOS 26 light capture.
- iPhone feel: haptic-style press feedback on primary actions, swipe actions on chat rows, pull-down to search.
- First run: a short, skippable key-setup path that ends in a first reply.

## Open (known, not scheduled)

- Not verified on a physical iPhone: glass, VoiceOver, Dynamic Type, keyboard/IME, PWA.
- `tests/e2e/canvas-integration.cjs` (not in CI) times out the same way on main.
- `streaming.cjs` long-task check is load-sensitive on the owner's Windows machine (fails on main too); CI passes.
- 21 Settings-driving e2e suites run on the ordinary build only (`tests/e2e/canvas-core.txt` lists the Canvas set).
- Local e2e: check the port is free first; a stale preview on 5191 once served an old build to the suites.
- Draft PR #34 (Blackout CP01, Oct 19) is still open on GitHub; close it if it is no longer wanted.
- Local branches `design/premium-foundation` (rejected warm palette), `lc`, `live-ctx-4` are unmerged; delete
  when the owner agrees.

## Decisions (owner; these override DESIGN.md and any older note)

- 2026-10-30 **Standing authority:** test, commit, merge and deploy finished, verified work without asking. Escalate
  only irreversible data changes, security risks, major trade-offs or permission blocks.
- **Deploy path:** merge to `main` → run the *Deploy* workflow with `presentation=canvas` (the default `ordinary` is
  the rollback) → confirm the live `index-*.js` matches a local `LUMEN_CANVAS=1` build of that commit. Hosting only;
  Firestore rules deploy separately (`npm run deploy:rules`) and only when they changed. No `gh` on the owner's
  machine: the GitHub REST API with git's stored credential works for PRs, merges and workflow dispatch.
- Report progress as done / in progress / verified / remaining. There is no overall completion percentage.
- iPhone: feel native to iOS 26 with Lumen's own identity; no copying other apps; no suggestion pills; the warm
  "premium" palette is rejected; floating feature docks are rejected; the three-control bar capsule stays; no chat
  title in the iPhone bar.
- Lamplight marks the active section tab and the model in use (calm pass, 2026-10-30).
- Keep: Study in Tools, the drawer as primary navigation, the ordinary build as a working rollback.
- Excluded: Arabic interface, separate chat folders, message-list icon/count, chat-tag badges.

## Recently shipped

- 2026-10-31 Cleanup and UX audit (PR #75, merged `f42155c`, deployed Canvas): three living docs and live
  `npm run handoff`; stable message box, readable model names, plain catalogue errors with *Check key*, picker hides
  switched-off providers, on-intent page loading, calmer tables, iPhone Settings/blur/jump-to-latest fixes.
- 2026-10-31 iPhone glass round 4 (PR #73, deployed `8aa07a1`): grouped iOS pages, glass bar buttons and Library
  search, tables fit phones, instant Back from Settings sections, Reduce Transparency fallbacks.
