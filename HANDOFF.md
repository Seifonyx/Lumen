# Lumen handoff

Where the work stands, for whoever picks it up next (any agent, any machine). Facts that git and GitHub know
(branches, commits, PRs, what is deployed) are **not** written here; they are computed fresh by `npm run handoff`,
which runs automatically when a Claude Code session starts. This file holds what git can't know.

**Keep it current:** update *Now* and *Next* whenever you finish a step or stop, and move finished work out (a line
in *Recently shipped* at most; git history has the rest). The pre-commit hook reminds you when you commit app code
on a branch that *Now* doesn't describe. Never let this file grow into a log.

## Now

- **Branch:** `chore/cleanup-ux-pass` (from main `ebfe69c`).
- **Task:** (1) repo and docs cleanup, done: 13 root docs and `docs/` (37 MB of old review captures) folded into
  [AGENTS.md](AGENTS.md), this file and [DESIGN.md](DESIGN.md); dead code removed (InstallHint, ~120 unused CSS
  selectors, stale scripts and config); self-updating live state added (`scripts/handoff.mjs`, `.githooks/`,
  `.claude/settings.json`). (2) the UX audit fixes from 2026-10-31: implemented and checked in the production
  Canvas build (desktop 1366 and phone 393, Chromium); verification and release in progress (Next).
- **Authority:** standing (see Decisions): test, merge, deploy when verified.

## Next

- [x] Audit fixes in code: phone message box keeps its width at rest (the model button is capped at 34vw); desktop message
      box keeps one shape (nothing moves on focus); model picker measured unscaled so it stays on screen; sidebar
      highlight off while Settings covers the page; catalogue banner in plain words with *Check key*; Tools shows a
      rejected key; readable model names everywhere (`modelLabel` fallback); + menu wider, Web search switch;
      Library/Tools/Router/Settings code loads on intent (pointer/focus on the place, phone drawer open; pages
      then open in ~130 ms; not at idle start-up, which stalled streaming replies); tables: no ghost edge line,
      phone columns ≥ 6.5em with a pinned first column, hover only with a pointer; Tools filter a quiet list on
      desktop; Knowledge link chevron; Retry is an icon; drawer project rows at body size; desktop page name shows
      in the bar once the title scrolls; iPhone: no double gap above Settings, deeper message-box blur, centred
      jump-to-latest; no scrollbar flash on the welcome.
- [x] Local checks: typecheck, unit, both builds, budget; full `canvas-core` run, then the 22 affected suites all
      green on the final build. `streaming.cjs` fails first try on this Windows machine for main too (load-sensitive
      long-task check); CI is the judge.
- [ ] PR, exact-head CI, merge, Deploy (`presentation=canvas`), live asset check.
- Checked and **not changed** (with reason): the "wrong welcome flash" was a mis-click during the audit, not a bug;
  header icons already have tooltips; theme switching is already instant; Router "Loading models…" was slow dev
  code loading, not a stuck state; "Ask anything." is the Canvas welcome's one line by design; Lamplight on the
  active tab is an owner rule; iPhone pages keep centred titles (iOS pattern for pushed screens); Notify switch
  already explains the blocked case.
- Owner's call: the iPhone bar's usage ring can read as a spinner when nearly empty; options are to hide it until
  the chat is half full or keep it as is.

## Open (known, not scheduled)

- Light-mode glass is tuned by eye; no native light iOS 26 capture to match yet.
- Not verified on a physical iPhone: glass, VoiceOver, Dynamic Type, keyboard/IME, PWA.
- `tests/e2e/canvas-integration.cjs` (not in CI) times out the same way on main.
- 21 Settings-driving e2e suites run on the ordinary build only (`tests/e2e/canvas-core.txt` lists the Canvas set).
- Radius tokens are defined but some Canvas CSS still hard-codes 8/12/14/18 px.
- Owner's view wanted: sentence-case section labels instead of mono uppercase.
- Draft PR #34 (Blackout CP01, Oct 19) is still open on GitHub; close it if it is no longer wanted.
- Local branches `design/premium-foundation` (rejected warm palette), `lc`, `live-ctx-4` are unmerged; delete
  when the owner agrees.

## Decisions (owner; these override DESIGN.md and any older note)

- 2026-10-30 **Standing authority:** test, commit, merge and deploy finished, verified work without asking. Escalate
  only irreversible data changes, security risks, major trade-offs or permission blocks.
- **Deploy path:** merge to `main` → run the *Deploy* workflow with `presentation=canvas` (the default `ordinary` is
  the rollback) → confirm the live `index-*.js` matches a local `LUMEN_CANVAS=1` build of that commit. Hosting only;
  Firestore rules deploy separately (`npm run deploy:rules`) and only when they changed.
- Report progress as done / in progress / verified / remaining. There is no overall completion percentage.
- iPhone: feel native to iOS 26 with Lumen's own identity; no copying other apps; no suggestion pills; the warm
  "premium" palette is rejected; floating feature docks are rejected; the three-control bar capsule stays; no chat
  title in the iPhone bar.
- Lamplight marks the active section tab and the model in use (calm pass, 2026-10-30).
- Keep: Study in Tools, the drawer as primary navigation, the ordinary build as a working rollback.
- Excluded: Arabic interface, separate chat folders, message-list icon/count, chat-tag badges.

## Recently shipped

- 2026-10-31 iPhone glass round 4 (PR #73, deployed `8aa07a1`): grouped iOS pages, glass bar buttons and Library
  search, tables fit phones, instant Back from Settings sections, Reduce Transparency fallbacks.
