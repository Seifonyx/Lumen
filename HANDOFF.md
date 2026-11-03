# Lumen handoff

Where the work stands, for whoever picks it up next (any agent, any machine). Facts that git and GitHub know
(branches, commits, PRs, what is deployed) are **not** written here; they are computed fresh by `npm run handoff`,
which runs automatically when a Claude Code session starts. This file holds what git can't know.

**Keep it current:** update *Now* and *Next* whenever you finish a step or stop, and move finished work out (a line
in *Recently shipped* at most; git history has the rest). The pre-commit hook reminds you when you commit app code
on a branch that *Now* doesn't describe. Never let this file grow into a log.

## Now

- **Branch:** `codex/native-ui-cleanup` from verified main `f3b2f00`.
- **Task:** Canvas copy and density cleanup across core workspaces. Decision-making guidance stays with the relevant controls. Release follows affected checks, exact PR CI and the gated Canvas deploy.
- **Authority:** standing (see Decisions): test, merge, deploy when verified.

## Next

- [ ] Owner, on the iPhone (Router): native edge Back/Forward versus whole-feature Exit, Use→Chat draft/attachment/focus restoration, nested model/provider/Layout navigation, VoiceOver, keyboard/IME, Dynamic Type and PWA safe areas. Both browser engines and synthetic accessibility checks passed; these remain physical-device checks.

- [ ] Owner, on the iPhone (PR #97, live): swipe back from Browse all tools opened from + (should slide straight to the
      chat, no + sheet); a partial swipe let go; a few open/close cycles.
- [ ] Owner, on the iPhone (PR #95, live): + while typing (the keyboard should leave before the sheet rises); Library
      search with no matches and the keyboard up (Clear search stays visible); several image.jpg rows ("2 of 3 in this
      chat") with VoiceOver; Knowledge empty state. Keyboard states were checked with a stand-in, not iOS.
- [ ] Owner to confirm on the iPhone (PR #77, live): tapping the model and Expand while writing keeps the chat and
      opens them; the top fade is no longer a band. Neither reproduced in Chromium or WebKit emulation; the fix targets
      Safari's late blur/click order and `composer.cjs` replays it. If it still happens, get a screen recording.
- Polish backlog from the screen-by-screen audit of 2026-10-31 (each checked in the code and the production build;
  owner to pick): usage ring reads as a spinner; text boxes show a resize grip on phones (`resize: vertical` in
  app.css field-block, edit-box, memory-row); Tools "Set up" uses an external ↗ for an in-app page; the writing sheet
  counts "tokens"; Library file lines are wordy ("Preview only · original unavailable here", library-items.ts);
  inline code breaks mid-formula; All chats search and Chats/Archived share one cramped row on phones; no home-screen
  shortcuts in either manifest; long code lines scroll with no wrap option; Router with one model is mostly empty
  space; the incognito button is an unexplained crossed eye on phones (no hover).
- [ ] Owner, on the iPhone (PR #81, live): search a word from an old message; the result shows the line and opens
      at that message below the glass bar. Chromium and WebKit emulation pass; no physical device yet.
- [ ] Owner, on the iPhone (PR #83, live): tap the model name under a reply; the Answer details sheet sits clear of the
      home indicator and reads well with VoiceOver; Compare with… prefills that reply's question and keeps your draft.
- UX plan (owner-accepted 2026-11-01, https://claude.ai/artifact/77duerrTr2f6vQCztDNFVv), remaining in order:
  #2 owner's 12-step iPhone check, then fixes (the glass message box lets reply text show through: ready, S);
  #4 save a reply or
  excerpt to a project (`Saved from chats.md` in project files; owner decision on synced size); #5 one search for
  everything (projects, Library, Knowledge, Tools, models in the drawer search). Note: iOS ignores manifest shortcuts.
- Swipe actions stay on the All chats page only: in the drawer they would fight the swipe that closes it.

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
- 2026-11-02 **Testing (owner: fastest possible):** pull requests run only the tests their change can affect (or
  everything for build/test machinery and shared app state); `main` runs everything after each merge, and Deploy waits
  for that run and refuses to ship if it failed. Dispatch Deploy right after merging; it waits by itself.
- Report progress as done / in progress / verified / remaining. There is no overall completion percentage.
- iPhone: feel native to iOS 26 with Lumen's own identity; no copying other apps; no suggestion pills; the warm
  "premium" palette is rejected; floating feature docks are rejected; the three-control bar capsule stays; no chat
  title in the iPhone bar.
- Lamplight marks the active section tab and the model in use (calm pass, 2026-10-30).
- Keep: Study in Tools, the drawer as primary navigation, the ordinary build as a working rollback.
- Excluded: Arabic interface, separate chat folders, message-list icon/count, chat-tag badges.

## Recently shipped

- 2026-11-03 Swiping back from Browse all tools no longer shows the old + sheet (PR #97, merged `0672509`, deployed
  Canvas): Safari snapshots the previous screen when an entry is pushed, so the picker now opens one painted frame after
  the + sheet has gone. Suite `picker-back` (Chromium + WebKit). Safari's native swipe itself is not automatable.
- 2026-11-02 Library and + sheet quality pass (PR #95, merged `11b1da6`, deployed Canvas through the gated Deploy):
  compact no-match state kept above the keyboard, repeated-name cues, Knowledge empty state with one Import, keyboard
  leaves before the + sheet, no stacked sheets on Browse all tools, plain-icon picker with pinned area names.
- 2026-11-02 Fastest tests (PR #90, #92, #93): a Test plan job (`scripts/ci-plan.mjs`) runs only affected tests on
  pull requests (about 2 min for a small change when CI is idle) and everything on `main` (about 9 min, was 16–17);
  Deploy's gate (`scripts/wait-for-tests.mjs`) waited for and checked that run on `a6bd6a6`. Locally,
  `npm run test:affected -- --run` (53 s for a one-suite change). Measured durations for 131 suites balance machines;
  suite lists live in `tests/e2e/canvas-phone.txt` and `webkit.txt`. GitHub runs 20 jobs at once here, which sets the
  floor for a full run. Suites reach places through `tests/e2e/helpers/nav.cjs`.
- 2026-11-02 + sheet and Browse all tools density pass (PR #88, merged `e4ee271`, deployed Canvas), from the owner's
  iPhone screenshots: untitled short + sheet with flat rows, one scrolling row of areas, name + one short line per tool.
  Startup CSS budget 20 KB gz. `redesign-shots.cjs` now emulates an iPhone (glass) and captures the keyboard-open picker.
- 2026-11-02 Library redesign and Tools in the composer's + (PR #86, merged `55a1bec`, deployed Canvas): Tools left the
  sidebar, drawer and rail; + has attach, this chat, Deep research / Create image / Document canvas (missing key →
  key setup) and Browse all tools, a searchable picker (`ToolsWorkspace.tsx`, still `page: 'tools'`). Choosing a tool
  replaces the picker in history; each open starts with an empty search. Library rows are name-first with From/Added
  columns on computers. Budgets: startup JS 15.5, Canvas CSS 29.5 KB gz. Test helper: `tests/e2e/helpers/plus.cjs`.
- 2026-11-01 Auto's reasons and alternatives survive a reload (owner-approved): `src/lib/db.ts` keeps `routeDetail`
  when loading chats on this device (read path only; sync records still don't carry it).
- 2026-11-01 Answer details and Compare with… (PR #83, merged `721457a`, deployed Canvas): the model name under every
  finished reply opens one panel (`src/components/AnswerDetails.tsx`, lazy; rules in `src/lib/answer-details.ts`) with
  only recorded facts; Compare with… seeds the composer's Compare sheet with the reply's own question and sends only the
  conversation before it (`runComparison` `before`). Startup JS budget 14 → 14.5 KB gz (measured 14.1).
- 2026-11-01 Search shows where it matched (PR #81, merged `405d2b7`, deployed Canvas): drawer and Jump to share
  `src/lib/chat-search.ts`; message matches show an excerpt and open at the newest matching message through
  `src/lib/message-jump.ts` (one request, used once, 5 s, one account, message must exist). Jumps now land below the
  floating top bar on computers too. Local Windows WebKit fails `message-navigation`'s outline check on main as well;
  CI's Linux WebKit passes.
- 2026-10-31 Audit fixes (PR #79, merged `1eb3dc3`, deployed Canvas): All chats rows no longer squeezed to 21 px (all
  devices), project rows drop the repeated name, Settings account row says it holds Appearance.
- 2026-10-31 Phone polish (PR #77, merged `88a4594`, deployed Canvas): composer holds through Safari's late tap, soft
  top fade, sentence-case labels, one corner scale, haptics on copy and model choice.
- 2026-10-31 Cleanup and UX audit (PR #75, merged `f42155c`, deployed Canvas): three living docs and live
  `npm run handoff`; stable message box, readable model names, plain catalogue errors with *Check key*, picker hides
  switched-off providers, on-intent page loading, calmer tables, iPhone Settings/blur/jump-to-latest fixes.
- 2026-10-31 iPhone glass round 4 (PR #73, deployed `8aa07a1`): grouped iOS pages, glass bar buttons and Library
  search, tables fit phones, instant Back from Settings sections, Reduce Transparency fallbacks.
