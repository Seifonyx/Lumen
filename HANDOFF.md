# Lumen handoff

Where the work stands, for whoever picks it up next (any agent, any machine). Facts that git and GitHub know
(branches, commits, PRs, what is deployed) are **not** written here; they are computed fresh by `npm run handoff`,
which runs automatically when a Claude Code session starts. This file holds what git can't know.

**Keep it current:** update *Now* and *Next* whenever you finish a step or stop, and move finished work out (a line
in *Recently shipped* at most; git history has the rest). The pre-commit hook reminds you when you commit app code
on a branch that *Now* doesn't describe. Never let this file grow into a log.

## Now

- **Branch:** `experiment/ios-sideload`, draft PR141. Phase1 baseline653071d passed32/32 PR CI and actual
  Simulator/browser workflow. Owner authorizes Phase2 synthetic-only integration groundwork now; installing Phase1
  first is not a gate. No real auth/cloud/provider network, secrets, spending, native redesign, merge or deployment.
- Preserve bundle `io.github.seifonyx.lumen.demo`, `capacitor://localhost`, Demo A/B UIDs and all existing stores.
  Owner physically verified earlier135af6b launch/navigation/keyboard/account separation/reopen persistence only.
  Newer IPA overwrite, native lifecycle, keyboard/IME, safe areas, share sheets and VoiceOver remain physical gaps.
- Phase2 adds account/lifecycle request leases, cancelable state-bound auth/session interfaces, memory-only sync and
  account settings adapters, scoped synthetic streaming, typed UIKit background bridge, inactive native Keychain.
  No callback scheme, Google/Firebase SDK/session, credential bridge, native permission or network activation.
- Reproduced native local projects disappearing on A/B/A: logout deleted the only demo account settings record.
  Native logout now clears identity/visible state while retaining owned sample data; browser regression passes.
- Tests/architecture/limitations: `native/docs/PHASE2_PLAN.md`, `PHASE2_INTEGRATION.md`, `FEATURE_PARITY.md`.
  Install/overwrite instructions: `native/README.md`. Memory replica is simulated, not cross-device/cloud durability.
- **Next:** finish exact-head CI/native iPhoneOS artifact and actual WKWebView smoke, inspect final evidence, deliver
  source/artifact to owner. Keep PR141 draft/unmerged. Separate explicit approval required for real SDK/config,
  callback/session bridge, test cloud/schema/egress or provider requests. Do not uninstall the working installation.
- Waiting on the owner's iPhone (Home Screen app), PR #136 (live): cold launch shows no band under the status bar in
  Light and Dark; Router and Settings get a status bar the same grey as the page, the chat white (Light) or grey
  (Dark); switching the iPhone between Light and Dark with Lumen open, the bar follows; relaunching into a restored
  Router shows no band. If the band remains, record iOS version and a screen recording: the next step would be a private
  diagnostic page (never production), since iOS's sampling cannot be emulated.
- Also waiting on the iPhone: #134 quiet updates (from the next release), #130 darker grey Dark, #128 touch feedback,
  the Browse all tools medium detent. #132 (where you left off) is owner-confirmed.
- Native-iOS audit (2026-11-05, https://claude.ai/artifact/PK7jQcsYY8MEAzbibHivp7): Stage 1 remaining: haptics/switch
  semantics, hardware-keyboard send.

## Next

- Planned (owner, 2026-11-04; not started): **background agents at no cost.** A second Cloudflare Worker beside the
  provider relay, woken by a free Cron Trigger, advances each task one step per wake (models: the user's free key or
  Workers AI's free allowance), and sends a free Web Push when done (Home Screen app, iOS 16.4+). Before any code:
  verify Cloudflare's current free limits (Durable Objects/Workflows on Free are unclear; KV or D1 as fallback), then a
  one-page plan for the owner covering the new endpoint, what is stored server-side (task text, results, a key; agent
  tasks only, never incognito, deleted when done) and any Firestore rule change. Owner sign-off needed on all three.
  Use high effort for the design and security parts. No paid services (owner cannot pay).

- [ ] Owner, on the installed Home Screen app (PR #108, live): from the drawer open Router, Library,
      Projects and Settings; on each, swipe right (edge and mid-screen) to reveal the drawer with the screen peeking on the
      right, then swipe left or tap the strip to return; switch Router tabs (no slide); open a provider, a document, a
      Settings section and a project, and swipe back (one level up, also when released near the right edge); + Ã¢â€ â€™
      Document canvas from a new chat with a draft, then Back. Reduce Motion and VoiceOver. Native feel is not accepted
      until then.
- [ ] Physical iPhone: in Safari, write an unsent draft with a disposable attachment. Open Router > Providers > detail.
  Start an edge swipe and return your finger to the edge before lifting. Repeat with a completed swipe to the Providers
  list, then swipe Forward. Tap the feature chevron and verify that the original chat, draft, model and attachment return.
  Repeat in Library > document, Projects > project, Settings > section and + > Browse all tools. Check for duplicate
  screens, jumps and flashes. Repeat the cancel/commit sequence in the installed Home Screen app, which uses Lumen's
  custom Back. For any failure, record iOS version, tab or Home Screen, screen pair and a privacy-safe recording.

- [ ] Owner, on the iPhone (Router): native edge Back/Forward versus whole-feature Exit, UseÃ¢â€ â€™Chat draft/attachment/focus restoration, nested model/provider/Layout navigation, VoiceOver, keyboard/IME, Dynamic Type and PWA safe areas. Both browser engines and synthetic accessibility checks passed; these remain physical-device checks.

- [ ] Owner, on the iPhone (PR #97, live): swipe back from Browse all tools opened from + (should slide straight to the
      chat, no + sheet); a partial swipe let go; a few open/close cycles.
- [ ] Owner, on the iPhone (PR #95, live): + while typing (the keyboard should leave before the sheet rises); Library
      search with no matches and the keyboard up (Clear search stays visible); several image.jpg rows ("2 of 3 in this
      chat") with VoiceOver; Knowledge empty state. Keyboard states were checked with a stand-in, not iOS.
- [ ] Owner to confirm on the iPhone (PR #77, live): tapping the model and Expand while writing keeps the chat and
      opens them; the top fade is no longer a band. Neither reproduced in Chromium or WebKit emulation; the fix targets
      Safari's late blur/click order and `composer.cjs` replays it. If it still happens, get a screen recording.
- Polish backlog from the 2026-10-31 audit: all done except home-screen shortcuts in the manifests (iOS ignores them).
- [ ] Owner, on the iPhone (PR #81, live): search a word from an old message; the result shows the line and opens
      at that message below the glass bar. Chromium and WebKit emulation pass; no physical device yet.
- [ ] Owner, on the iPhone (PR #83, live): tap the model name under a reply; the Answer details sheet sits clear of the
      home indicator and reads well with VoiceOver; Compare withÃ¢â‚¬Â¦ prefills that reply's question and keeps your draft.
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
- **Deploy path:** merge to `main` Ã¢â€ â€™ run the *Deploy* workflow with `presentation=canvas` (the default `ordinary` is
  the rollback) Ã¢â€ â€™ confirm the live `index-*.js` matches a local `LUMEN_CANVAS=1` build of that commit. Hosting only;
  Firestore rules deploy separately (`npm run deploy:rules`) and only when they changed. No `gh` on the owner's
  machine: the GitHub REST API with git's stored credential works for PRs, merges and workflow dispatch.
- 2026-11-02 **Testing (owner: fastest possible):** pull requests run only the tests their change can affect (or
  everything for build/test machinery and shared app state); `main` runs everything after each merge, and Deploy waits
  for that run and refuses to ship if it failed. Dispatch Deploy right after merging; it waits by itself.
- Report progress as done / in progress / verified / remaining. There is no overall completion percentage.
- 2026-11-04 **iPhone navigation follows iOS chat apps:** the drawer is the root; swiping back on a place chosen in it
  reveals the drawer (screen peeking on the right), not the chat; drill-downs go up one level. Do the best, complete
  fix rather than the easy one.
- iPhone: feel native to iOS 26 with Lumen's own identity; no copying other apps; no suggestion pills; the warm
  "premium" palette is rejected; floating feature docks are rejected; the three-control bar capsule stays; no chat
  title in the iPhone bar.
- Lamplight marks the active section tab and the model in use (calm pass, 2026-10-30).
- Keep: Study in Tools, the drawer as primary navigation, the ordinary build as a working rollback.
- Excluded: Arabic interface, separate chat folders, message-list icon/count, chat-tag badges.

## Recently shipped

- 2026-11-06 iPhone status bar / launch band (PR #136, merged `71f4b32`, deployed Canvas, live `index-C_loOs_L.js`,
  `sw.js` `2456c4f28b94` match the merge build). Cause: iOS 26 colours a Home Screen app's opaque status bar from the
  page (a fixed top layer, else the page background), ignores theme-color, and re-samples only when such a layer appears
  or disappears (the drawer cleared the band). `src/lib/status-bar.ts` keeps the page background the screen's colour and
  briefly shows a 6 px strip when it changes. Suite `status-bar`. Physical iPhone not yet checked.

- 2026-11-06 Quiet, safe updates (PR #134, merged `fe54c21`, deployed Canvas, live `index-ClWumcuP.js` and `sw.js`
  version `7c176d3cf709` match the merge build): no banner on Canvas; a new version waits and is used at the next start
  after no window runs the old one, or from Settings Ã¢â€ â€™ General Ã¢â€ â€™ Update now, which waits with a reason while work exists
  only in memory (`src/lib/update-safety.ts`, owners register `useUpdateHold`). The previous version's files stay one
  release for windows still running it. A start-up takeover was tried and dropped (Chromium holds it until the page
  closes). Suites `updates` (real service worker behind a local proxy; WebKit through a dead proxy, so nothing leaves
  the machine) and `offline`; `tests/unit/sw.test.mjs`. Physical iPhone not yet checked.

- 2026-11-05 Where you left off (PR #132, merged `510d7fe`, deployed Canvas, live `index-BppjgJv8.js` matches the merge
  build): a relaunch reopens the same chat at the same message, or the same workspace or drawer place, as a root
  (`src/lib/resume.ts`; DESIGN.md Ã¢â€ â€™ Product). No time limit; sign-out, other accounts, incognito, New chat and deleted
  chats end it. Remembered spot drawn in the first frame; Safari keeps it while older messages load. Startup JS budget
  18.25 (measured 18.1). Suite `resume` (Canvas phone, Chromium + WebKit; relaunch = fresh tab, the known Linux WebKit
  reload crash). Physical iPhone not yet checked.

- 2026-11-05 Darker grey Dark (PR #130, merged `96169d7`, deployed Canvas `index-C1X7Fis1.js`): page #161618, fills
  #202023 / #2a2a2d / #353539; status bar, launch screens and manifest follow.
- 2026-11-05 Grey Dark and iOS touch feedback (PR #128, merged `63fb98f`, deployed Canvas `index-B0bJcQ4x.js`): Dark
  page #1f1f21; phones swell / light / sink / dim by look (`lib/press.ts`, DESIGN.md Motion); first-touch blur hold removed.
- 2026-11-05 Status bar colour (PR #126, merged `363232f`, deployed Canvas `index-BzA_hr83.js`): Canvas `theme-color`
  is the page's #fff/#000; the old #f6f7f9/#0d0f12 drew the launch band. (#120/#122/#124 blur changes didn't touch it.)
- 2026-11-05 Launch glass (PR #124, merged `e27ba74`, deployed Canvas `index-B32Mc3uX.js`): every blur on the phone
  screen waits for the first touch (launch-made blurs drew a dim rim and a haze until the drawer re-created them).
- 2026-11-05 Launch band and list numbers (PR #122, merged `1bc289a`, deployed Canvas `index-CYQrjuRG.js`): scroll-edge
  blur starts at the first touch; older replies no longer clip two-digit list numbers.
- 2026-11-05 Design run 3 (PR #120, merged `d996ea4`, deployed Canvas, live `index-CeqKF8qz.js` matches the merge build):
  launch fade fixed (no mask on the scroll-edge blur; Safari painted it black until a repaint); Browse all tools opens at
  a medium detent (the model picker stays a plain sheet); Router tabs keep focus, model search first in Tab order,
  Selected via aria-current; drawer focus trap verified; "Balanced" fits at 320; short inline code on one line; code
  Wrap toggle; All chats search on its own line. Canvas CSS budget 34.75 KB gz. Physical iPhone not yet checked.

- 2026-11-05 Design run 2 (PR #117 `319b6aa`, live `index-BzioBKkG.js`; PR #118 `ce61ebb`, live `index-B_4xJFYL.js`, both
  matching their merge builds): no Incognito text; iOS 26 glass material (clear tint, specular rim, inner edge glow;
  frosted message box); progressive-blur scroll edge at the top bar and behind the message box (pauses while streaming);
  frameless tables, filled code blocks, quieter thinking; drag-down dismisses the keyboard. Physical iPhone not yet checked.

- 2026-11-05 One consistent look on phones, design run 1 (PR #115, merged `cc17ffc`, deployed Canvas, live `index-RBkyiEoj.js` matches the merge build):
  Router Models as a grouped list (Lamplight only on the Selected chip, search in the bottom bar), iOS large titles on
  Library/Router/Projects/Settings with pinned tabs (`LargeTitle`, own Suspense boundary: suspending blanked Settings
  mid-pop), end-only tab fades, `--type-*` tokens, audit fixes (resize grip, pie usage gauge, Incognito label, no
  token count, short Library lines). Canvas CSS 34.43 Ã¢â€ â€™ 34.4 KB gz. Physical iPhone not yet checked.

- 2026-11-04 Native iOS drawer (PR #112, merged `25b3b11`, deployed Canvas, live `index-CXpjvqO1.js` matches the merge
  build): 20 pt place rows, plain single-line projects and chats, ink New chat capsule, all scaling with text size;
  choosing the place on screen only closes the drawer; drawer moves on a class (no :has()) with no live blur beside
  it, against black frames over Router (needs the owner's iPhone to confirm).

- 2026-11-04 Home Screen app owns every swipe (PR #110, merged `98f255a`, deployed Canvas, live `index-s4ZUe1It.js`
  matches the merge build): iOS 26 gives Home Screen apps Safari's own edge swipe, which went Back by itself over
  stale snapshots; the stack now lives in memory there (one browser entry). Drawer: one gray highlight for what is on
  screen, iOS sizes. The drawer's New chat returns to an unsaved new chat with its draft. Startup JS budget 16.5.

- 2026-11-04 iPhone navigation follows iOS chat apps (PR #108, merged `70557c7`, deployed Canvas, live
  `index-BaCxtj64.js` matches the merge build): the drawer is the root (places chosen in it have the menu button; a
  right swipe slides the screen aside to show the drawer with a 64 pt peek); drill-downs and screens opened from a chat
  go up one level, still guarded; Router tabs switch in place on phones; one drawer tap is one history step; UIKit-style
  release; + Document canvas returns to the new chat with its draft. Startup JS budget 16 KB gz (measured 15.9).
  Suites leave places through `helpers/nav.cjs` `leavePlace`. Physical iPhone not yet checked.

- 2026-11-04 Phone Back goes up, like an app (PR #106, merged `a819d14`, deployed Canvas, live `index-DJ04GfTB.js`):
  one Back leaves a feature; a Settings section returns to the list; only the leading edge starts the swipe.
- 2026-11-04 Native-feeling phone navigation (PR #104, merged `09669d0`, deployed Canvas, live `index-MPQsLi3U.js`
  matches the merge build): one coordinator (`src/lib/navigation-coordinator.ts`) owns Back and the drawer; the screen
  follows the finger over the real or kept screen behind it; one traversal per swipe; taps share the slide; Safari tabs
  keep native Back. Canvas computers crossfade with a view transition. Startup JS growth 15.5 Ã¢â€ â€™ 15.0 KB gz. Suite
  `native-navigation` (Chromium + WebKit). Filmstrips in `docs/native-navigation/`. Physical iPhone not yet checked.
- 2026-11-03 Projects redesign and residual copy cleanup (PR #101, merged `9803535`, deployed Canvas, live
  `index-CJLROoyc.js` matched the merge build): name-first All projects, a workspace with chats first and context in a
  rail or one disclosure, less narration across the app. Before/after in `docs/projects-redesign/`.
- 2026-11-03 Swiping back from Browse all tools no longer shows the old + sheet (PR #97, merged `0672509`, deployed
  Canvas): Safari snapshots the previous screen when an entry is pushed, so the picker now opens one painted frame after
  the + sheet has gone. Suite `picker-back` (Chromium + WebKit). Safari's native swipe itself is not automatable.
- 2026-11-02 Library and + sheet quality pass (PR #95, merged `11b1da6`, deployed Canvas through the gated Deploy):
  compact no-match state kept above the keyboard, repeated-name cues, Knowledge empty state with one Import, keyboard
  leaves before the + sheet, no stacked sheets on Browse all tools, plain-icon picker with pinned area names.
- 2026-11-02 Fastest tests (PR #90, #92, #93): a Test plan job (`scripts/ci-plan.mjs`) runs only affected tests on
  pull requests (about 2 min for a small change when CI is idle) and everything on `main` (about 9 min, was 16Ã¢â‚¬â€œ17);
  Deploy's gate (`scripts/wait-for-tests.mjs`) waited for and checked that run on `a6bd6a6`. Locally,
  `npm run test:affected -- --run` (53 s for a one-suite change). Measured durations for 131 suites balance machines;
  suite lists live in `tests/e2e/canvas-phone.txt` and `webkit.txt`. GitHub runs 20 jobs at once here, which sets the
  floor for a full run. Suites reach places through `tests/e2e/helpers/nav.cjs`.
- 2026-11-02 + sheet and Browse all tools density pass (PR #88, merged `e4ee271`, deployed Canvas), from the owner's
  iPhone screenshots: untitled short + sheet with flat rows, one scrolling row of areas, name + one short line per tool.
  Startup CSS budget 20 KB gz. `redesign-shots.cjs` now emulates an iPhone (glass) and captures the keyboard-open picker.
- 2026-11-02 Library redesign and Tools in the composer's + (PR #86, merged `55a1bec`, deployed Canvas): Tools left the
  sidebar, drawer and rail; + has attach, this chat, Deep research / Create image / Document canvas (missing key Ã¢â€ â€™
  key setup) and Browse all tools, a searchable picker (`ToolsWorkspace.tsx`, still `page: 'tools'`). Choosing a tool
  replaces the picker in history; each open starts with an empty search. Library rows are name-first with From/Added
  columns on computers. Budgets: startup JS 15.5, Canvas CSS 29.5 KB gz. Test helper: `tests/e2e/helpers/plus.cjs`.
- 2026-11-01 Auto's reasons and alternatives survive a reload (owner-approved): `src/lib/db.ts` keeps `routeDetail`
  when loading chats on this device (read path only; sync records still don't carry it).
- 2026-11-01 Answer details and Compare withÃ¢â‚¬Â¦ (PR #83, merged `721457a`, deployed Canvas): the model name under every
  finished reply opens one panel (`src/components/AnswerDetails.tsx`, lazy; rules in `src/lib/answer-details.ts`) with
  only recorded facts; Compare withÃ¢â‚¬Â¦ seeds the composer's Compare sheet with the reply's own question and sends only the
  conversation before it (`runComparison` `before`). Startup JS budget 14 Ã¢â€ â€™ 14.5 KB gz (measured 14.1).
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
