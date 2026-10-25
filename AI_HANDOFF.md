# Dynamic Model Picker operational handoff

## Active checkpoint — Phase4 Slice2 CP3 Model Discovery & Selection (2026-10-25)

- **Authority:** owner approved CP2 merge/deploy, then delegated the conflicting same-PR instruction. PR54 reviewed03ef74a merged normally as **b619862707062cca75bd30f9678b9d4313f612fa**. A merged PR cannot remain a draft; CP3 continues on successor **feat/phase4-prism-models**, based on this released main. CP3 implementation/review only. **STOP for final Slice2 owner/planner review; no CP3 merge/deploy, Gate, spending, inference, protected auth/network/schema or later-phase work.** No overall program percentage is defined.
- **Production:** [Deploy40191019110](https://github.com/Seifonyx/Lumen/actions/runs/40191019110) explicitly Canvas, all steps successful including live Hosting and existing dev channel. Independent HTTPS comparison187/187 files matched the b619862 build. Anonymous phone sign-in rendered with no runtime errors (browser proxy needed test-only ignoreHTTPSErrors; independent asset fetch used normal system CA validation). Rollback: previous Canvas db94c2326a3c35b9f28a5a1714020453ae927bca via existing Deploy workflow. CP3 is not released.
- **CP3 implementation:** pure shared alias/all-word search; picker uses indexed catalog lookup rather than repeated scans and exposes search with two choices. Lazy PrismModels ledger uses24-row pagination, existing FilterMenu for actual capability/state filters, provider identity and current selection, progressive model metadata, honest unknown/declared/cached labels and existing recovery Settings. No new model/provider/routing owner or telemetry.
- **Manual contract:** selectionProblem is a typed characterization of the prior CP2 gates, with optional precomputed set lookup for inventories. Send-time eligibility/scoring is untouched. Use model rechecks account/conversation and gates, calls setChatModel, closes Prism, toasts, and focuses the same mounted composer without rewriting draft/selection/undo/attachments. Picker's existing preference-selection/retry semantics, Auto/Layout remain unchanged.
- **Independent review:** found missing selected IDs absent from discovery. Added an unknown-metadata fallback and recovery in the existing current-route disclosure, plus selected-filter row. Selectable-first ordering deliberately protects the owner's320px first-usable-row requirement; a blocked current choice remains named/recoverable in the route disclosure and Selected filter even with32 usable alternatives. No quality ranking implied.
- **Files / plan:** docs/design/PRISM_MODEL_CHECKPOINT.md records approach and boundaries. src/components/PrismModels.tsx, RoutingCenter.tsx, ModelPicker.tsx, src/lib/model-search.ts, model-discovery.ts, lazy scoped canvas-routing.css; focused unit/browser tests, exact CI wiring and explicit isolation declarations. No production credential/auth/network/state/storage owners changed.
- **Evidence at source checkpoint:**95 unit files/typecheck passed; ordinary/Canvas builds, QA01 isolation8/8 (including planted controls), CP01 ordinary graph174 artifacts/14 negative controls passed. Budgets unchanged: startup growth12.2KB gz, CSS15.3KB, lazy RC8.0KB, approximate CSS source18.5KB. Chromium/WebKit each8 main discovery/selection cases plus8 metadata/recovery/account cases passed. Chromium provider containment24 cases passed; final WebKit containment/gated suites and exact-head CI will be recorded in the delivery report/PR/live checkpoint, never inferred from earlier head.
- **Test development:** initial alias search and missing-current regressions failed on earlier builds, then passed after fixes. Source/type lint found one removed unused import. First performance run exposed obsolete build files accumulated outside root; clean --emptyOutDir corrected double-counting, real startup overhead was then reduced by separating pure search from lazy selection helpers. Existing budget limits were not raised. A states-test reload after Back/Forward reproduced the known Linux WebKit engine crash; account regression now uses actual Sign out, verifies Back cannot restore Prism, then checks another owner in a fresh tab. Initial test incorrectly assumed nested Settings had a General ancestor; fixed to use the real navigation hierarchy, without weakening account assertions.
- **Final continuity correction:** extracted inventory initially lost its search after Usage → Back (real browser red). Reuses existing account-scoped ephemeral screen memory for query/filter/page, keyed by conversation or provider; no browser payload/storage schema. Both engines are rerunning the focused matrix. Wide rows were independently visually reviewed and made compact columns; phone first-row geometry remains covered.
- **Private checks:** committed2c1ecd2 gated Routing Center3/3 viewports per engine (10 checks each), composer4/4 per engine including390×480, synthetic Send/Stop/undo/IME-safe Escape, and picker accessibility4/4 per engine passed. Provider wrapping24/24 per engine passed. Final source CI supplies complete regression coverage.
- **Next:** publish the curated exact-source review and successor draft PR, verify final exact-head CI and synchronize source/live documentation. **Then STOP**. Physical Safari/PWA/VoiceOver and genuine provider connectivity remain unverified; synthetic selection/IME/keyboard tests do not prove physical device behavior.

## Historical checkpoint — corrected Phase4 phone pass (2026-10-24)

Source checkpoint `764d2db49da31779f110b2550710a7e584f64789`; final evidence in `docs/testing/phase4-phone-sections.md` and `docs/reviews/phone-sections/review.html`. Final evidence commit is docs-only; exact PR head/CI and public-safe live status are synchronized separately. Isolation8/8, CP01 ordinary graph, gated RC3sizes and Canvas screens4cases passed locally. New source matrix8/8 per engine passed, including preference/resize/native-search fixes. No design acceptance or release.

- Owner correction is authoritative: **original SidebarCanvas restored exactly to ad78d2f**. Rejected drawer rail/bottom Search were never pushed. Shared glass Back/ellipsis retained. Top horizontal sections and bottom contextual Search belong to **Library and Routing Center**, not sidebar/Tools.
- Worktree `/workspace/Lumen-iphone-final`, local branch `iphone-final-pass`, publishes normally to existing `feat/iphone-navigation-reset` / draft PR52. Earlier dirty worktree remains preserved. No merge/deploy/Gate/next-phase authorization. Production remains871bc1a /Deploy68.
- Design/interface/test details: `docs/design/IPHONE_FINAL_PASS.md`. New PhoneSections, reactive phone breakpoint, additive Hub phone slots, existing search relocated (RC portals), canonical history scroller registration only. Layouts uses existing policies ID/editor; permissions/routing/credentials/storage untouched.
- Local type/unit/build and16 focused engine/size/theme cases passed. Exact-head CI is a separate pending step at this checkpoint; gated verification and curated final evidence are complete locally. Source parentad78 had23/23 CI success; never attribute that result to this new work. Static audit25 inherited findings; ordinary build compiles, but generated byte identity is not claimed after additive shared component interfaces.
- Exact next action: push the evidence checkpoint, let exact-head CI finish, address actual introduced failures, synchronize live checkpoint, then **stop for owner/planner visual review**. Phases1–3 shipped; later Phase4 slices/Phase5 remain; no overall percentage defined.

## Historical reset checkpoint (superseded operational state)


## Active owner reset — shared iPhone navigation (Codex, 2026-10-24)

- Owner rejects the floating feature docks and authorizes substantial shared navigation/Library/Tools work. **No design acceptance, merge or deployment.** PR50 and PR51 remain intact. Current branch `feat/iphone-navigation-reset` is isolated at `/workspace/Lumen-navigation-reset`, based on verified PR51 source `1b23b0d922b5ffd5bb5adb0cf3219244bccda988`; released main remains871bc1a / Deploy68.
- Contract and navigation map: `docs/design/IPHONE_NAVIGATION_RESET.md`. Milestone A source implemented: shared phone bar; canonical UI snapshots with opaque browser markers; real section/provider history; contextual provider menu; drawer retained at root. Milestone B source implemented: Library type selector and list/media treatment, account-scoped browsing memory, accessible item actions/confirmed deletion; Tools searchable capability lists and assistant creation. Shared bars also applied to Settings, project detail and document canvas.
- Independent review identified and prompted fixes for project context, departing scroll, local detail restoration, explicit Library destination priority and Escape/swipe consistency. History records semantic local-view keys and restore callbacks only in session memory; account changes clear them. Browsing cache is account-scoped and not persisted. No routing, provider-network, auth or persistent-schema owner changes.
- Focused Chromium journeys passed four widths (320/390/430/1440): provider→settings→Back, browser Back/Forward, Library filter restoration, document return, draft retention and assistant draft restoration. Unit history adapter test covers canonical UI, layers, account invalidation and opaque history. Type/build/unit checks passed at earlier checkpoints; rerun for exact final source. Ordinary byte parity with PR51/released baseline has been verified repeatedly after correcting Canvas seams; must verify again at final checkpoint.
- Latest source verification: typecheck, ordinary/Canvas builds, all92 unit files; Chromium main journeys4/4, screen-state journeys3/3, project create/edit/delete/draft journeys3/3; provider cases8/8, Hub actions4/4, glass and assistant CRUD3/3. Ordinary output exactly matches174 baseline files. QA01 isolation8/8 passed after correcting the static module seam. Private gated QA browser4/4 and Routing3/3 passed. Full gated shell/screens and exact-head CI remain pending at this checkpoint.
- Independent review prompted atomic project Save (replace form with destination, distinct from Cancel), project draft cache, deleted-reference validation and menu clipping/focus-race corrections. Project creation succeeds from both drawer and Projects; edit/delete are covered. Ephemeral form drafts clear on successful save and account changes.
- Linux WebKit1.56.1 crashes on reload following Back/Forward plus a new history branch; reproduced on a static page with no Lumen code. Diagnostic `tests/e2e/helpers/webkit-history-reload.cjs` retains the failure. Do not call the combined WebKit refresh matrix passed. Chromium refresh passes; primary WebKit journeys and project forms are tested separately.
- Tool-return closure: comparison setup presents over Tools until explicit submission; local analysis runner participates in canonical history; chat-search drawer closes when Back restores Tools. Tool launch/project brief/New chat actions batch synchronous canonical mutations into one visible history step. Desktop document rows and action buttons are shared with phone, while media remains a collection.
- **Milestone C is still in progress:** migrate tests that specifically assert the rejected docks/Chat pills; run final Chromium/WebKit/axe/isolation/budgets and exact-head CI; self-review curated actual captures. Do not call the reset complete or owner-approved merely from the focused journey. Physical iPhone, installed PWA, VoiceOver/Dynamic Type remain unverified.
- Performance decision: shared first-interaction history requires about1.1–1.3KB gz more startup code; JS growth budget9.5→12KB (measured11.6KB); Canvas CSS source16→17KB (measured16.9KB) for shared phone chrome/content rows. Startup CSS16KB and lazy Routing Center9KB limits unchanged. Provider menus/Library actions/type filter load lazily. Report actual measurements, not fabricated speed improvements.
- Program progress: Phases1–3 shipped; this owner-directed reset is in implementation/review; Phase4 Slices2–3 remain. Library/Tools work does not complete Phase5. No defensible overall program percentage is defined. Preserve historical scope ledgers below as history.
- Exact next action: finish Milestone C regression migration and rendered review; commit/push coherent checkpoints to this branch and synchronize the separate live context. Never overwrite older WIP or merge/deploy without explicit owner approval.


## Current checkpoint — Phase 4, Slice 1 review 2 (Claude), awaiting owner visual review

- **Authority:** the owner reviewed PR #51 (review 1) and did not approve it. They granted creative freedom to rethink navigation, the overview, providers, the provider detail, actions and the desktop workspace. **Draft only: do not merge or deploy, and do not claim acceptance; stop for the owner's visual review.** Crease icon detailing stays deferred until all planned phases are done.
- **Branch:** `claude/lucid-dijkstra-541bbi` (draft PR #51), on top of review 1 (`c19b2ab`) and Codex's `0cdf5f4` (PR #50, untouched). Release base is still `main` `871bc1a` / Deploy #68. The exact pushed SHA and CI live in the PR and the live checkpoint.
- **What changed:** see "Review 2" in `docs/testing/phase4-routing-providers.md`:
  - phone dock with four places, plus Usage and Diagnostics drill-ins from the route panel
  - the drawer button or Back, never both
  - the lit route panel
  - the provider ledger with verdicts and name chips
  - provider detail as verdict, one contextual primary, four independent facts and a model table
  - "Refresh model list" replaces "Check connection"
  - one sticky desktop header line
- **Files touched:** `RoutingCenter.tsx`, `RoutingExtras.tsx` (refresh button, recent answers), `canvas-routing.css`, `provider-presentation.ts` (wording) and the tests that pin those.
- **Verified locally:**
  - `npm test`
  - ordinary parity with `main`
  - CP01/QA01 isolation against `main`
  - budgets with none raised
  - `routing-providers` Chromium 8/8
  - CP04 Chromium 3/3
  - CP01/02/03/05 contracts
  - 8 in-app suites on Canvas
- **Not verified:** WebKit (CI covers it), physical iPhone, VoiceOver, Dynamic Type.
- **Next:**
  1. The owner's visual review of the review-1 versus review-2 boards.
  2. Apply feedback on this branch.
  3. Merge or deploy only with explicit approval; the owner chooses between #50 and #51.

## Earlier checkpoint — Phase 4, Slice 1 redesign (Claude), awaiting owner visual review

- **Authority:** the owner asked for a major design reassessment of the Routing Center overview, provider browser and provider detail. Draft PR only. **Do not merge or deploy, and do not claim owner acceptance; stop for the owner's visual review.**
- **Branch:** `claude/lucid-dijkstra-541bbi`, built on Codex's `feat/phase4-routing-providers` head `0cdf5f4` (PR #50). Codex's branch was not modified; this branch adds the redesign on top. The released base is still `main` `871bc1a` (Deploy #68). The exact pushed SHA, the draft PR and CI state are in the PR and the live checkpoint `docs/lumen-context/CURRENT_STATUS.md` on `docs/lumen-live-context`.
- **What changed:** see the redesign section of `docs/testing/phase4-routing-providers.md`. In short:
  - The phone overview is the map, and sections open as pages with Back in the bar.
  - Provider detail shows a connection path.
  - One status vocabulary.
  - Consolidated `canvas-routing.css`, with no budget raised (Canvas CSS source 16.0/16 KB).
  - Only `RoutingCenter.tsx`, `canvas-routing.css`, the two Routing Center tests and a screenshot helper changed.
- **Verified locally:**
  - `npm test`
  - ordinary byte parity with `main`
  - CP01/QA01 isolation with the `main` baseline
  - `routing-providers.cjs` Chromium 8/8
  - CP04 Chromium 3/3
  - CP01/CP02/CP03/CP05 contracts
  - 7 navigation/gesture in-app suites on Canvas
- **Not verified:** WebKit, which CI covers; physical iPhone, VoiceOver and Dynamic Type.
- **Next:**
  1. Owner visual review of the before/after evidence.
  2. Apply the owner's feedback on this branch.
  3. After explicit approval, decide with the owner how PR #50 and this PR combine. This PR contains #50's commits, so merging this one supersedes #50.
- Phase 4 Slices 2 and 3 have not started.

## Earlier checkpoint — Phase 4, Slice 1 (Codex)

- **Authority:** owner completed Phase 3 and authorized Phase 4. Work on `feat/phase4-routing-providers`; draft PR only. **No merge/deploy, no implicit release approval from green checks.** Optional Crease icon detailing remains deferred.
- **Recovered release:** `main` `871bc1a647f36550e6f66e527b1252ac84437506`; PR #49 merged; Deploy #68 / Actions `40030589058` completed successfully with Canvas. No new production deployment or physical-iPhone verification in this session.
- **Isolation of concurrent work:** old `/workspace/Lumen` QA01 uncommitted work and draft PR #34 were preserved untouched. Current work is a clean separate worktree `/workspace/Lumen-phase4` from released main. Do not copy the old unfinished QA01 implementation over current main’s existing private QA system.
- **Implemented:** route-first overview with truthful recorded-answer evidence; provider readiness entry point; grouped saved connections and Explore providers; Needs attention filter; separate saved/enabled/catalog/reply facts; typed safe recovery; concise phone header, readable wrapping section labels, phone Back and desktop list/detail; lazy scoped RC stylesheet. Canonical model actions, credentials, permission, storage, routing and network owners are unchanged.
- **Verification:** see `docs/testing/phase4-routing-providers.md` for actual checks, curated before/after review and remaining device gaps. Source checkpoint is `6d2255a519a1d6e37189991909dc3541e037b9da`; delivery commits add the review artifact/docs, stable screenshot capture and strengthened isolation declarations. Initial CI at `358cc71` found a missing reviewed-file declaration for the new helper; fixed by an exact filename plus Canvas-required/ordinary-forbidden graph checks and a planted negative control; both strengthened audits pass. CI at `61b2d74` then exposed attachment-font baseline and WebKit expiry-focus timing assumptions; corrected test preconditions retain strict original assertions, with released-source delayed-font reproduction and independent review. No product source changed. Local checks pass (90 unit files, Chromium/WebKit 8+8 new cases, 3+3 existing QA viewports, isolation and budgets). Exact pushed delivery SHA and post-push CI state live in the PR / canonical docs checkpoint; inspect them instead of assuming this local checkpoint is a release. No claims of live-provider or real-iPhone testing.
- **Progress (current seven-phase Lumen design/UX program):** Phases 1–3 shipped and owner-declared complete; Phase 4 Slice 1 implemented and verified in draft PR #50 but awaiting owner design approval; Phase 4 Slices 2–3 and later phases remain. **No approved overall percentage for this program exists.** Historical Blackout and completed Dynamic Model Picker weighted scores apply only to their separate legacy scopes; never repeat them as overall Lumen completion or percentage remaining. No Phase 4 acceptance/merge/deploy credit is inferred from passing CI.
- **Next:** publish the delivery commit/draft PR and verify exact-head CI; synchronize the canonical live checkpoint. Stop for owner design review before any merge or deployment. Slice 2 is not implemented here. Historical release instructions below apply to their earlier milestones.


## Verification speed (owner request, 2026-10-23)

- **CI layout:**
  - In-app runs on 5 machines per build.
  - Safari (WebKit) runs on 2 machines.
  - The Canvas contracts run in 3 balanced groups per engine, with the isolation audit in the shell/browser group.
  - Gates keep the original check names; the new Safari gate is "Safari engine (WebKit)".
  - 19 parallel jobs, within the 20-job limit for public repos.
  - Measured on PR #46: 6 min 22 s instead of 9 min 30 s. The slowest jobs are now two ordinary in-app shards (about 6.2 min against 4.3–4.7 for the others); rebalancing them by recorded time is the next speed step.
- **Local verification policy for agents:** before a push, run only what the change touches: `npm test`, the ordinary byte check, the budget, the affected contract(s) and the affected in-app suites. Leave the full 103-file Canvas list (about 20 minutes on this 4-CPU container) to CI, which runs the same list in parallel. Run the full list locally only to diagnose a CI failure.

## Chat, Reading & Composer, Phase 3 slice 3 (streaming and scroll) — 23 October 2026

PR on `claude/lucid-dijkstra-541bbi` from `main` `b171a3e` (slice 2 merged, deploying as Deploy #67). Canvas only; the ordinary build is byte-identical to `main`. The owner pre-approved merge and deploy once CI is green ("merge it and deploy it").

- **Assessment** (`tests/e2e/helpers/stream-fixture.cjs`, a local streamed reply with no network or inference, about 7 s of Markdown; 1440 and 390):
  - Already sound: following while at the bottom; holding still when scrolled away; the "Writing…" pill and its return; Stop to "Stopped"; announcements.
  - No long tasks while text arrives, even with the long conversation open; only the send itself, about 60 ms.
  - Gaps found:
    - While streaming, every paragraph is its own `div`, so the "first child has no top margin" rules (base and slice 1) took headings' space away until the reply finished, and the text jumped then.
    - The scroll handler measures once a frame, so a streamed update could pull the view back under a wheel or finger that had just started moving up.
    - After Stop, focus stayed on the button.
- **Implemented:**
  - `canvas-reading.css`: only the reply's first and last blocks lose their outer margins.
  - `ChatView.tsx` (Canvas only, `if (CANVAS_SHELL) useEffect`): a wheel up, finger drag down, PageUp, ArrowUp or Home stops following at once.
  - `ComposerCanvas.tsx`: on computers, Stop returns the keyboard to the message box; phones keep the keyboard down.
  - Removed the phone `h2:first-child` margin in `canvas-shell.css`.
  - Budget: startup JS limit 9 → 9.5 (measured 9.1), with the reason recorded.
- **Checks:**
  - The new `tests/e2e/streaming.cjs` (1440/390) passes 4 of 4 runs and fails on the previous build.
  - 16 scroll, streaming and message suites pass on the Canvas build.
  - `npm test` passes; the ordinary build is identical.
- **Not done:** a physical iPhone (momentum scrolling while a reply streams, VoiceOver announcements).

## Chat, Reading & Composer, Phase 3 slice 2 (the composer) — 23 October 2026

[PR #48](https://github.com/Seifonyx/Lumen/pull/48) was merged as `b171a3e` (owner-approved 2026-10-23). CI first caught two regressions, both fixed: the usage meter became unreachable at 320 (`design`, QA browser contract), and the model name was hidden at rest (`workspace-design`, the 2.4.3 readability requirement). The name now shows at every width; below 380 px the box says "Message".

- **Assessment** (`tests/e2e/helpers/composer-shots.cjs`: resting, typing, multiline, attachments, streaming/Stop, writing sheet, project chip; 1280/1440 and 320/390/430, Light and Dark):
  - Desktop was sound.
  - On phones, controls overflowed and wrapped. At rest, the voice button sat alone on a second row (104 px tall at 320). While writing, Send/Stop and Dictate dropped to a third row.
  - The writing sheet's title was cut to "Launch plan, ..." beside the count.
  - The remove-attachment target was 22 × 22.
  - On Safari, the Enter that confirms an IME candidate arrives after `compositionend` (`isComposing` false, `keyCode` 229) and could send.
- **Implemented:**
  - `canvas-composer.css` (phones):
    - At rest: one row; the model shows its provider mark and is still announced by name.
    - While writing: two rows; the model name shortens; the usage meter shows its ring.
    - 44 pt hit areas for small controls.
    - A returning-focus usage meter floats instead of taking a slot, so the next press can't miss a moved control (caught by `sheet-drag`).
  - `ComposerCanvas.tsx`: the count under the sheet title; the IME Enter guard.
- **Checks:**
  - `npm test` passes; the ordinary build matches `main` under `diff -r`.
  - Budget: JS 8.9/9, CSS 15.9/16.
  - QA01 and CP01 pass.
  - CP02, CP03 and CP05 pass in Chromium.
  - The new `tests/e2e/composer.cjs` passes, and fails on the previous build. It covers 320/390/430 plain and glass plus 1440, with axe.
  - 14 composer and message suites pass on the Canvas build. `coding-plan` needed one retry under 3 lanes, then passed 3 of 3 runs alone.
- **Not done:** a physical iPhone (dictation, the real keyboard, a Japanese IME).
- **Next:** owner review. Then slice 3: streaming, scrolling and the response lifecycle.

## Chat, Reading & Composer, Phase 3 slice 1 — 23 October 2026

[PR #47](https://github.com/Seifonyx/Lumen/pull/47) was merged as `1536d9a` and is live as Deploy #66 (owner-approved 2026-10-23; all 180 files byte-identical to the live site). CI first caught a regression: the floating composer could cover the last reply when the draft grew. It was fixed in `acb6ef7` by reserving the composer's real height (`--cv-composer-h`). Phase 2 was merged and deployed on the owner's instruction; its physical-iPhone checklist (`docs/testing/phase2-navigation-iphone-checks.md`) is still not run.

- **Assessment** (synthetic `tests/e2e/helpers/chat-fixture.cjs`, screenshots by `chat-shots.cjs` at 1280/1440/1920 and 320/390/430, Light and Dark, actual size):
  - Answer headings were 27 px against 15.5 px body text, in fixed px.
  - Quotes were filled boxes with a heavy bar.
  - On phones, the line under a reply took two or three rows.
  - On computers, a model that Auto picked was hidden until hover, leaving an empty line.
  - A stopped reply looked finished.
  - On phones, every question held a hidden 28 px gap: `.msg-actions { min-height: 28px }` beat the folded `max-height: 0`.
  - Scrolling code blocks were not keyboard-reachable (axe `scrollable-region-focusable`).
  - The composer on phones puts the voice button alone on a second row (left for slice 2).
- **Implemented:**
  - `src/styles/canvas-reading.css`, loaded by the on-module after `canvas-shell.css`: em-based headings, quiet quotes, inline code, code and tables (with scroll shadows), sources (a swipeable line on phones), a calm error note, the one-line reply meta, attachment cards and the turn rhythm.
  - `MessageItem.tsx`: "Stopped" (`.cv-stopped`) and file type and size (`.cv-file-meta`), behind `CANVAS_SHELL` ternaries.
  - `markdown.ts`: a Canvas code `pre` with `tabindex="0" role="region" aria-label="Code, <lang>"`.
  - Note: a constant-false `&&` inside JSX children leaves `!1` in the ordinary bundle. Use ternaries whose ordinary branch is the original markup.
- **Checks:**
  - `npm test` passes; the ordinary build matches `main` under `diff -r`.
  - CP01 isolation passes, with the reading CSS added to its forbidden paths and sentinels.
  - QA01 passes, with `canvas-reading.css` added to its allow-list.
  - Budget: startup CSS 15.3 KB gz; the limit was raised from 14 to 16 with the reason recorded.
  - CP03 and CP05 pass in Chromium.
  - The new `tests/e2e/reading.cjs` passes (1440/390/320, Light and Dark, axe on `.messages`). It is listed in `canvas-core.txt` and skipped on the ordinary build.
  - Ten message-related in-app suites pass on both builds.
- **Not done:** a physical iPhone. Composer (slice 2) and streaming/scroll (slice 3) are not started.
- **Next:** owner visual review of slice 1. Then slice 2, the composer: phone layout (the voice button alone on a second row), multiline and expanded writing, attachments, paste, IME and dictation, Send/Stop.

## Desktop & iPhone navigation, Phase 2 slice 3 — 23 October 2026

Merged as PR #46 (`de78183`) and live as Deploy #65 (owner-approved, 2026-10-23; 180/180 files byte-identical to the live site).

- **Assessment** (`journeys.cjs` probe on the production build, desktop and 390 phone):
  - Back left Lumen from Settings, a project overview and All chats.
  - Drafts were kept per chat, including across a reload, but nothing showed where they were.
  - The drawer ignored the text size (fixed px, plus glass.css's fixed 16px/44px rows).
  - `reveal()` could leave keyboard-reached rows under the sticky section header.
  - Already correct: project association on send (general chats carry no project instructions), and drafts across hubs, Back, the Routing Center and Settings.
- **Changes:**
  - `CanvasNav` treats `settingsOpen`, `projectWorkspaceOpen` and a back layer (`src/lib/back-stack.ts`, used for All chats) as surfaces. Back closes the topmost one and re-marks history if something is still open.
  - SidebarCanvas marks rows whose `mr.draft.<uid>.<chat>` exists with `data-draft`; CSS `content: 'Draft' / ''`; described as "Unsent draft".
  - The text-size block at the end of `canvas-shell.css`.
  - `reveal()` subtracts the sticky header.
- **Budget:** startup JS 8.5 → 9 KB (measured 8.6; reason in the script).
- **Tests:** CP03 adds Back from Settings, the overview and All chats, the draft marker, and text-size growth. `tests/unit/canvas-nav.test.mjs` is extended. Helper: `tests/e2e/helpers/large-text-shots.cjs`.
- **Phase 2 accessibility follow-up:** large text and Dynamic Type are addressed here. Real Dynamic Type needs a physical iPhone; Chromium can only simulate it via `--fs`.

## Desktop & iPhone navigation, Phase 2 slice 2 — 23 October 2026

Draft PR on `claude/lucid-dijkstra-541bbi`, from `main` `f16c6d1` (slice 1 is live as Deploy #63). Canvas only; the ordinary build is byte-identical to `main`. **Not approved for merge or deploy.**

- **Tree:**
  - Arrow keys come from `src/lib/tree-keys.ts`, loaded through the Canvas switch (`loadTreeKeys`) with the tree's first focus.
  - Search: ArrowDown enters the tree, Enter opens the first result.
  - Screen readers: lists are named after their project; the open chat gets `aria-current`; pinned chats get an `aria-describedby` "Pinned" (set as attributes by SidebarCanvas, so the shared ChatRow keeps one seam); the search count is announced.
  - Focus rings are drawn inset.
- **Drawer:**
  - Closing returns focus to the opener: the chat, hub or Routing Center ☰.
  - The open chat is revealed on open.
  - **Owner correction (same day):** the tile row was rejected. Places are now quiet 44pt icon-and-label rows at every phone size.
  - The two New chat actions say where they create: "New chat in <project>" sits first under the folder's overview, and the bottom pill shows "New chat / in <project>" when a project is active. The store's rule is unchanged: `newChat` uses `activeProjectId`, which stays set until the composer chip is removed.
  - The overview row is highlighted only while the overview is open (`.cv-brief.open`; `.active` still marks the selected project for tests).
  - Calmer surfaces: plain close and account buttons (glass discs on iOS), a transparent overview row, and a 44pt hit area for ⋯.
  - Boards: `tests/e2e/helpers/drawer-shots.cjs`, with `GLASS=1` for the iOS default look.
  - **Owner decision (New chat):** the global New chat (drawer bottom, desktop sidebar, rail, top bar, ⌘⇧O, palette) is always general. `src/lib/new-chat.ts` `newGeneralChat` clears `activeProjectId` and `mr.activeProject`, then calls `newChat`. Shared callers reach it through the switch, and the ordinary build stays byte-identical. "New chat in <project>" → `newProjectChat`. The old "in <project>" pill label is removed; the general actions are described as "Not in a project". CP03 covers the general/project switches, drafts and assignments.
- **Phase 2 accessibility follow-up (owner, recorded):** support large text and Dynamic Type in the iPhone drawer. Its sizes are fixed px and ignore Lumen's text-size setting and iOS Dynamic Type. This is planned for Phase 2 slice 3.
  - At most 360px wide: the drawer is `100vw − 40px`.
- **Budget:** startup JS 8 → 8.5 KB (reason in `scripts/canvas-budget.mjs`); measured 8.2.
- **Checks:**
  - `npm test`; QA01/CP01 isolation; CP02–CP05 and the browser contract in Chromium (CP03 extended); the full Canvas in-app list run locally with emulators (see PR).
  - WebKit runs in CI.
  - The physical-iPhone checklist `docs/testing/phase2-navigation-iphone-checks.md` is **not run**.
- The fixture gained a long-title chat (`tests/e2e/helpers/nav-fixture.cjs`).

## Desktop & iPhone navigation, Phase 2 — 23 October 2026

Draft PR #44 on branch `claude/lucid-dijkstra-541bbi`, from `main` `1c574a4` (Phase 1 is live; CI is sharded since PR #43). Canvas only; the ordinary build is byte-identical to `main`. **Not approved for merge or deploy.**

- **Assessment** (current production Canvas on a synthetic account; `tests/e2e/helpers/nav-fixture.cjs` and `nav-shots.cjs`, run against a local `LUMEN_CANVAS=1` build):
  - Focus fell to `<body>` after closing hubs or the Routing Center, and after collapse or expand.
  - Browser Back left the app.
  - The collapsed desktop sidebar offered only an expand button.
  - On phones the Routing Center had no drawer button, and its header differed from the other hubs.
  - The pin glyph pushed titles off their shared edge, and there was no clear-search control on iPhone.
  - Drawer touch targets were already 44px.
- **Slice 1:**
  - `src/components/CanvasNav.tsx` (through the switch; null in the ordinary module): one history entry for pages shown in place of the chat, focus return, and collapse/expand focus.
  - `CanvasRail.tsx`: the collapsed rail, loaded lazily.
  - Routing Center: a `rc-topbar` (drawer button on phones, Chat at the end), swipe back on phones, and Connect full width on phones.
  - Pin trails the title; `cv-search-clear`.
  - The approved "pinned first, one list" tree is unchanged (CP03 enforces it).
- **Checks:**
  - `npm test`; the ordinary build matches `diff -r` against `main`.
  - QA01 and CP01 isolation (CanvasNav and CanvasRail are on the reviewed list).
  - CP02–CP05 and the browser contract in Chromium; CP03 and CP04 extended for the rail, Back and focus.
  - Budget: startup JS growth 7.4 of 8 KB.
  - 16 navigation-related in-app suites on the Canvas build, run locally with emulators.
  - WebKit and the full sharded run are left to CI. No physical iPhone was used.
- **Next:** gather owner feedback on slice 1. Candidate slice 2 items:
  - Keyboard movement through the tree (arrow keys).
  - Draft preservation across the account/project switch.
  - Hub transitions on desktop.
  - Drawer density on 320×568.


## Brand identity and design foundation, Phase 1 — 23 October 2026

Live status and authorizations are in `docs/lumen-context/CURRENT_STATUS.md` on `docs/lumen-live-context`; this entry records the coding work only. Branch `claude/lucid-dijkstra-541bbi`, from `main` `26c209d` (the live Canvas build, Deploy #61).

- **Identity proposal "Crease" (not adopted):** a flat successor to the shipped folded-L (two planes, a constant gap where the light comes through) and a Geist 600 "lumen" wordmark whose l is cut at the mark's 28° angle. Masters, icons, launch screens, manifest and context mockups in `brand/crease/`, generated by `node scripts/brand-crease.mjs`; rationale, critique, usage rules and a practical similarity review in `brand/crease/README.md`. Nothing in the app references these files; `public-canvas/` is unchanged.
- **Foundation (Canvas only):** type, label and radius tokens in `src/styles/canvas.css` (values unchanged; pixel-identical screens, verified by screenshot diff at 1440/390, both themes); text selection uses "lamplight" (`#f1e2b6` / `#4d4130`), raising Dark selection contrast from about 4.1:1 to 8.5:1. Written up in `docs/brand/DESIGN_FOUNDATION.md`; `DESIGN.md`'s stale Mark section corrected.
- **Checks:** `npm test` (typecheck + unit), ordinary build byte-identical to `main`, `scripts/canvas-budget.mjs` passes, Canvas screens contract (see PR). Not done: physical iPhone (home-screen icon and launch screens only matter on adoption).
- **Stop point:** owner approval of the final identity is required before adopting it; merging and deploying need their own approvals. Adoption steps are listed at the end of `brand/crease/README.md`.
- **Phase 1B (same day, after an owner course correction):** the open-laptop reading of the unchanged Crease mark is primary. Integrated-L letterforms were explored in scratch only and set aside (never committed). The A/B/C comparison is in `brand/crease/mockups/phase-1b-compare.png`. The recommendation is **A′**: the unchanged mark on the wordmark's baseline at 1.1× height, closer to the word (`lockupBaseline` in `scripts/brand-crease.mjs`; `svg/lockup-baseline-*.svg`). The Phase 1 masters regenerate byte-identical. Placements are in `phase-1b-context.png`. Stopped again for owner review.
- **Phase 1C (owner chose C):** the Crease is now the L of a bespoke "Lumen" wordmark.
  - **Artwork:** the standalone mark is unchanged. The wordmark L is an optical variant: a flatter hinge so the base lies on the baseline, the crease raised for a broader screen, Geist 660 "umen" with stem tops cut at the hinge angle. Files are `svg/lumen-wordmark{,-small}-{ink,paper,mono}.svg` plus `app-icon-dark-rim.svg`. Generator: `WORD`/`lumenWordmark` in `scripts/brand-crease.mjs`; glyphs from `brand-crease-glyphs.py` (adds `geist-660.json`).
  - **App preview:** behind `LUMEN_IDENTITY=crease` (needs `LUMEN_CANVAS=1`): `src/lib/brand-identity{,.on}.ts`, `src/components/BrandCrease.tsx`, generated `src/lib/brand-crease-art.ts`, `src/styles/brand-crease.css`, the asset swap in `vite.config.ts`. Placements: sidebar/drawer head, collapsed bar, shared header; sign-in gets the new icon with a rim on Dark.
  - **Isolation:** without the switch, the ordinary and default Canvas builds are byte-identical to the PR's previous head (and the ordinary build to `main`). No workflow sets the switch.
  - **Checks:** the new unit test `tests/unit/brand-identity.test.mjs`. Boards: `phase-1c-before-after.png`, `-in-app.png`, `-presentation.png`. Stopped for the owner's review of the finished artwork; merge, deploy and official adoption each need separate approval.
- **Final polish (owner-requested):** the L-to-u gap is +16 units (`WORD.GAP` 56, small 72). The dark sign-in rim is 22% white. The private iPhone QA review shows the preview via the committed opt-in `qa/iphone/review-identity.json`, read by `vite.qa.config.ts` (adapter `qa/iphone/adapters/brand-identity.ts`). QA01 forbids environment reads in `scripts/qa/build.mjs`, so the build script only reports the opt-in. Checks: QA01 (9) and CP02–CP05 plus the QA browser contract pass on the preview-enabled review build; the ordinary and default Canvas builds are still byte-identical; budget and `npm test` pass. Board: `brand/crease/mockups/final-polish-actual-size.png`. Before merging without adoption, remove `qa/iphone/review-identity.json`. Stopped for the owner's final artwork review.
- **Release (owner-approved, 2026-10-23):**
  - **Identity:** Crease is the official Canvas identity. The components ship through `canvas-presentation.on.ts`, and `public-canvas/` is generated by `scripts/brand-crease.mjs`. The preview switch, the QA opt-in and `canvas-icons.mjs` are retired.
  - **Greeting:** the Canvas greeting keeps one line: the name steps aside when it can't fit. `welcome.cjs` and `design.cjs` pin the clock to 15:00 UTC.
  - **Budget:** startup JS 6 → 8 KB gz, for the inline artwork.
  - **Merge, deploy and live verification:** recorded in the live checkpoint (`docs/lumen-context/CURRENT_STATUS.md` on `docs/lumen-live-context`).

## Independent usage-draft fix — 20 October 2026 (Africa/Cairo)

The fix-only branch `fix/usage-draft-no-submit-20261020` contains source checkpoint `8a328bb` (cherry-pick of reviewed `1736a92`). Five UsageMeter buttons explicitly avoid form submission; the new pointer/Enter regression checks draft/message/network/focus behavior at 1440/390 in Chromium and Linux WebKit. Red/green reproduction, independent reruns, typecheck, 149 unit tests and production build passed; normal design regression also passed. See `docs/testing/usage-draft-regression.md`.

Release verification: PR #35 head `d9422173f4d5d503164b15b54dd991265412abae` passed all three exact-head CI jobs in run39444721821 and merged normally to `677bc51f39fbf8fcf66bc91f846b71a4912bb306`. Deploy39447533639 succeeded on that exact SHA; this is the latest verified production runtime. All18 reviewed built assets match live over system-CA-validated HTTPS. Hosted synthetic usage-draft checks passed Chromium/WebKit1440/390. Chromium default cloud CA trust failed, so its test rerun narrowly pinned the existing environment proxy CA public key; WebKit passed with SSL_CERT_FILE pointing to the system CA bundle. No general TLS bypass or product trust change. This verifies the hosted UI fix, not live provider inference or physical iPhone. Model Picker's existing98.5% methodology remains unchanged.

The separate Blackout initiative continues in draft PR #34. Both latest user course corrections explicitly leave identity Gate 1 **NOT APPROVED**. Its full master/research and experimental Workspace/Routing Center proofs remain on that branch; no experimental UI is included here. Do not restart rejected visual directions or merge them with this fix.

Manual test: type an unsent draft; open and close Usage using pointer or Enter. The draft must remain, no message should be sent, and focus returns to Usage. Continue the separate Blackout task from its branch handoff. Rollback is a reviewed normal merge revert followed by deploying a known-good main revision; no force push/reset or branch-protection bypass.

## Permanent amendment: Progressive Verified Deployment Policy

Added by the user on 2026-10-18. This execution-policy amendment supplements MASTER_REQUIREMENTS.md without replacing or weakening it. It remains active for every future agent and session unless the user explicitly changes it.

Every completed, independently production-ready milestone must be evaluated for immediate integration into main and production deployment. Do not wait for the entire overhaul merely because unrelated phases remain unfinished. Never merge incomplete, unverified, unsafe, or dependency-breaking work to accelerate release.

For each milestone:

1. Determine independent releasability and unfinished dependencies.
2. Verify relevant tests, type checks, builds, and required CI checks.
3. Review security, privacy, compatibility, and regression risks.
4. Confirm no unresolved dependency on unfinished work.
5. Understand deployment and rollback procedures.
6. Merge through the authorized GitHub workflow, respecting branch protections.
7. Verify the actual production deployment.
8. Test that the live application remains functional.
9. Record the merge commit, deployment status, verification evidence, and outstanding work.
10. Continue the next phase without restarting the project.

Keep unfinished work isolated. Where practical, use reviewable commits or a dedicated release branch to release only a verified subset. A pushed branch, successful local build, or green subset of tests is not production-readiness proof. Never bypass protections, force-push, disable checks, or overwrite unrelated changes.

Future agents must track committed, pushed, merged, and deployed states separately; record the exact latest verified production commit separately from the latest feature-branch commit; document specific release blockers when a milestone is not ready; and continue remaining phases after each deployment. Before handoff, update this file and the companion plan/handoff, preserve the full master requirements and this policy, synchronize coherent verified commits safely, and record uncommitted/unverified work and the exact next task.



## Permanent amendment: Project Continuum Version2.0

Read PROJECT_CONTINUUM.md at every continuation alongside the complete original MASTER_REQUIREMENTS.md and this file. Reuse IMPLEMENTATION_PLAN.md baseline v1, its24 stable task IDs and100weights. Initial baseline83%; evidenced P02-B reopening82%; prior checkpoint88%; current **98.5% (medium confidence)**, earned98.5/100,1.5remaining after PR24 production acceptance and PR25 exact-head CI plus ordinary main merge (10.5 earned additional points). No feature scope/weight change. PR22 complete CI/main/live acceptance earned4.75 in P01-D/P03-A/P05-B/P08-A; PR23 acceptance earned1.25 in P09-A/P10-B. All unfinished rows retain partial credit. Recalculate with `node scripts/project-progress.mjs`; never substitute another agent's scoring. Report previous/current percentage, change, confidence, phase, evidence, Git/production and precise next milestone at session start/end.

## Model Picker hosted acceptance — 2026-10-22

**Supersedes the 2026-10-19 "exact next actions" 1–3 below.** Hosted acceptance is done against production runtime `677bc51f39fbf8fcf66bc91f846b71a4912bb306` (Deploy `39447533639`, includes all PR25 Model Picker work): all 174 built files match the live site byte for byte, and the Model Picker/core chat suites passed on `https://lumen-chat.web.app` in Chromium (18 suites, 96 checks) and WebKit (13 suites, 80 checks) with synthetic guest profiles. Full record: [docs/testing/hosted-model-picker-acceptance.md](docs/testing/hosted-model-picker-acceptance.md). The stale `docs/model-picker-release-ledger` branch no longer exists on the remote; its only unique content (the PR24 release record) was already preserved in `docs/MODEL_PICKER_VALIDATION.md`, so nothing from it remains to fold in. With the owner's approved normal merge of this documentation (PR #37), P11-B = 1 and Model Picker baseline v1 is **100/100 (medium confidence)**. This is defined-scope completion, not a claim about answer quality or physical-device coverage. Outside this scope and not claimed: emulator-only authenticated offline/reconnect suites on the hosted origin, real provider answer quality, physical iPhone.

## Active release and cross-agent checkpoint — 2026-10-19 (normal chat)

**Authoritative current operational checkpoint:** supersedes the dated PR23/PR24/PR25 pending tables and instructions further below. Preserve older snapshots as history. Project Continuum v2.0 and original master requirements remain active.

| State | Verified evidence and limitations |
|---|---|
| Latest merged main | `1966348725a9cc6a3bfec0a283448a451aa9d6cd`; PR25 confirmed normally merged/closed. Comparison with PR25 tested source `1ca29f0f207e261267fbd80c8b39b31e1e0ad8e0` shows **zero changed files**, establishing identical merged source tree. |
| PR25 exact-head checks | CI `39249464644` completed **success** on all three jobs: Chromium/Firebase emulators, WebKit, and type/build/unit tests. This chat did not run a separate local test suite. |
| Previous fully hosted-verified release | `6447a13d84150b8b16837176515f44e6ef5d8caf` (PR24), Deploy `39250100845` successful; earlier agent recorded 18 matched assets plus hosted Chromium3/WebKit2 clean. |
| Latest confirmed Firebase live deployment | [Deploy #57 / run `39257887973`](https://github.com/Seifonyx/Lumen/actions/runs/39257887973), `workflow_dispatch` on exact merged runtime SHA `1966348725a9cc6a3bfec0a283448a451aa9d6cd` — completed/success, attempt1. GitHub job steps `npm ci`, typecheck, build, `Deploy live` and dev preview all success; logs confirm production deploy succeeded. User reports the live app is 'all good'. **Independent current live asset parity and hosted Chromium/WebKit smoke coverage not executed from this chat.** |
| Weighted progress | **88 → 98.5/100, +10.5, medium confidence**, using unchanged 24 task weights. Remaining P11-B 1.5 points: 0.75 production/live validation; 0.75 final merged documentation/release-ledger acceptance. Recalculate using `node scripts/project-progress.mjs`. |
| Documentation branches | Older `docs/model-picker-release-ledger` diverges from current main and must NOT be blindly merged (contains historical PR24 release record). PR26 documented weighted98.5% and merged into main as `2f9a0e3817b5c01834b2b72180378b3ce5b29c9c`. New `docs/model-picker-production-confirmation-20261019` preserves PR24 history in validation docs, confirms PR25 Deploy and user manual feedback, and records pending hosted acceptance. |

### Exact next actions — after verified Deploy #57

1. Confirm current hosted assets match the reviewed PR25 build and execute hosted Chromium/WebKit smoke tests for core Model Picker flows (catalog/selection, layout save/reconnect/delete, fixed-layout helpers, quota-bound Canvas/Research recovery, held-press Study/Compare). Firebase deploy itself is verified; these hosted checks have **not** run in this chat.
2. User reported `its all good` after deployment; preserve that as a **manual positive acceptance signal**, without attributing specific unreported tests or claiming synthetic provider/billing/physical iPhone coverage.
3. Reconcile original `docs/model-picker-release-ledger` by preserving its uniquely useful historical PR24 release note in `docs/MODEL_PICKER_VALIDATION.md`; do not overwrite current source or handoff with the stale branch. Publish final docs through the normal reviewed PR process.
4. Keep weighted completion at **98.5% (medium confidence)** until the defined hosted acceptance and final documentation gate both pass. After hosted verification, update P11-B 0.5→0.75, then complete exact synchronized docs and P11-B 0.75→1 only if applicable final criteria truly pass. No speculative new feature work needed. Any real regression requires a tested fix.

**Environment limits:** GitHub exact manual-run metadata and deploy-job logs are accessible by providing the run URL; the previous inability to list workflow_dispatch runs has been resolved for this specific supplied run. The application URL could not be fetched through this chat/container due to network/DNS restrictions, so no live assets or hosted browser automation were inspected. No local test/build run was performed here.

## Historical operational state — 2026-10-19 (superseded)

The complete overhaul remains in progress. Historical intermediate checkpoints are archived in docs/history/MODEL_PICKER_2026-10-18.md and MODEL_PICKER_2026-10-19.md; they do not override this ledger.

| State | Exact revision / evidence |
|---|---|
| Latest verified production/main | `dab0fff854cc9657fd707b9e279c3bdb168bd64d`, PR23 normal merge, Deploy39243721175 success;18asset matches +hosted Chromium3/WebKit2 clean |
| Previous verified runtime/rollback | `3f48c6e02719b5f0c28be85e4c1e6e3cc2ef045b`, PR22 normal merge, Deploy39243260811 success;18asset matches +hosted Chromium4/WebKit2 clean |
| Earlier foundation | `02c322da48368d6277e5eb8b599edfead7f92e0e`, PR19 +Deploy39157498252 verified; later docs20/21 did not change runtime |
| Latest pushed key candidate | `2ce5c9a886219f5dfb2e73e11c4036c66ea00dc1`, feat/model-picker-key-save, PR24; exact remote verified, replacement fullCI39247939607 running |
| Current ROOT branch/base | `d9cf8dbd31b007fbc6656dda595d395d0c8dc79e`, feat/model-picker-final-recovery in /workspace/Lumen, PR25; pushed/exact remote verified, replacement fullCI39248044452 running |
| Isolation | Runtime release worktree /workspace/Lumen-runtime-release at984b1a9; key release worktree /workspace/Lumen-policy-release atb704902. Neither includes ROOT final implementation. Four named stashes are recovered owned backups, not hidden unique source. Do not blindly pop. |

Never confuse pushed/merged/deployed/production-verified. Actual latest remote main must be rechecked before integration. No force push, protections bypass or unfinished-source release.

## Exact next actions

1. Evaluate PR24 exact2ce5c9a fullCI39247939607. Source/exact remote verified; type/build/73unit passed, browsers pending. Independently releasable key-save repair, no dependency on final settings/routing work. Once every exact-head check passes and full logs are reviewed, normal matching-head merge, dispatch Deploy onmain, verify exact workflow SHA/success, reviewed policy-release/dist asset parity and hosted core Chromium/WebKit. Serialize deployments.
2. Evaluate PR25 exactd9cf8db fullCI39248044452. Source/exact remote verified; type/build/79unit passed, browsers pending. After24, normal merge and deployment/live verification of reviewed /workspace/Lumen/dist. Product/workflow tree equals7cde3ea; latest changes repair fixtures/rendered role coverage only.
3. b704902 CI39245177533 failed2/100Chromium files;7cde3ea CI39245877175 was superseded/cancelled with the same2/101 failures in its completed test step. Both preserved unit/build/WebKit success. These are historical failures, never green evidence. Fixture roots/fixes/regressions are recorded below.
4. Final ledger/validation documentation is held locally to preserve stable source CI. Update final mapping/weights only on evidence, commit/push normally, merge a docs-only PR after releases. No100% until all mandatory source/release/final-document gates pass. Main23 CI39243719879 already succeeded.


## Released implementation

PR19 foundation: scoped registry/cache/lifecycle discovery, stable selection/defaults, eligibility/manual consent, quality/speed/cost/balanced priorities, saved layout requirements/fallbacks, credential cancellation and request/health isolation, phone first-input race and optional Markdown resilience. Source/master and phone welcome/compact composer preferences preserved.

PR22 source984b1a9 passed completeCI39199646064:68unit/type/build,98Chromium files clean904s, all required WebKit. Declared models support live add/edit/remove/provenance and sticky API denials; saving/weekly checks never automatically probe unchecked declarations. Classified finite recovery and throttled metadata expiry; helper/title/research policy/budgets; comparison slot retry/Stop/selected-source synthesis. Semantic stream completion vsEOF, partial-output safety,100ms usage drain, cancellation of buffered deltas, redaction before truncation, native cumulative usage once, truncated-helper refusal. Title snapshots survive later tool continuations while preserving first-input/privacy/account/key guards; actual title accounting; lazy SelectionTools initial-selection fix; preview quota stays local. PR22 hosted4Chromium49s/2WebKit66s clean; pr22-live-assets.json18matches.

PR23 source1793e4a passed completeCI39199773200:69unit/type/build,99Chromium files clean893s, required WebKit. Bounded family/diversity scans retain routing outputs; shared reply-budget revalidation, Gemini thinking-only parameter retry, canonical select labels/Escape/Tab, query/focus stability,44px metadata fields and comparison announcements. UX-CONTRACT.md and docs/MODEL_PICKER_VALIDATION.md map ownership/architecture/all modes. Synthetic1000-model CPU medians Auto135.0ms→7.76ms/helper128.3→7.60ms,144+512complete-output parity cases, zero provider requests; these are not inference latency/answer-quality benchmarks. PR23 hosted3Chromium35s/2WebKit67s clean;18assetmatches. Reproduce with scripts/benchmark-model-picker.mjs.

## PR24 candidate — pushed, full current CI pending

https://github.com/Seifonyx/Lumen/pull/24, latestb704902. Source8f4a02c +provider accounting correction and test guest-scope correction. Local durability activates immutable normalized keys/catalog without awaiting Firestore ACK. Ordered SDK enqueue and cache-only pending revisions protect replacements/removals/stale reads/reload; currentUID/auth-session/revision guards prevent stale denial and same-UID read-cache reuse. Explicit permission denial clears local cache/active credentials and blocks replay; only authoritative server reads restore access. Account switch does not await quota ACK; lifecycle/day guards prevent quota timer revival/stale totals/reset pollution. No remote schema/rules migration/new dependency. UI distinguishes local save from later sync.

Evidence:72unit/type/build; key-save-final-chromium5 suites clean40s; actual WebKit guest/a11y3 clean35s; additional authenticated account-isolation/sync/attachments/quota/delete/privacy/tasks7 clean152s; phone390px save-feedback screenshot inspected/nooverflow. Pure/integration29cases and meaningful blocked-write browser scenario. Optional authenticated WebKit emulator run passes save/replace/reload/switch/reconnect/removal functional assertions but FAILS strict pageerror checking on emulator WebChannel CORS; not claimed green and no error filtering.

Full CI on earlier8ade00b exposed providers.cjs expecting one reply while a malformed SSE title mock triggered fallback. Corrected nonstreamJSON mock +exacttitle/provider request/input/output assertions, independently reviewed, two focused suites green26s; full98/99 CI subsequently green. PR24 denial hardening exposed legacy test guests with nonguest logical IDs and emulator URLs. b704902 normalizes profile+seed IDs consistently, updates direct storage/manual helper refs, uses actual WebKit research with pointer-independent Add control. Real Firebase/invite/denial tests unchanged. Five affected suites pass against exactkey source30s, actual WebKit research8s. Earlier39243179620 is superseded/cancelled, not proof of readiness; fresh39245177533 must pass.

## Final milestone — committed/pushed PR25, not yet merged/deployed

P02-B/P04-A durability: new account-settings-persistence.ts stages full immutable JSON settings before existing800ms debounce, independent settings revisions/ACK/read/replay and permission/session guards, semantic no-op detection. Reconciliation captures BOTH snapshots before network, protects settings first then passes chosen settings to key reconciliation. Remote write replaces the whole settings field via mergeFields while preserving keys. Deletions cannot revive from recursively merged old maps. Storage failure is explicit. Genuine edits during cached-account startup stage before remote read completes; empty hydration cannot overwrite another device's newer settings. No premature SDK submission before readiness. Same-UID key replay dedupes per session and refuses old-session ACK.

P06-B/P07-A caller reliability: Canvas passes current blockedModels so exhausted backups cannot consume all five attempts before a ready outside authorized backup. Fixed-order helper assignments bypass only Auto exclusions; dynamic Auto/outside exclusions, fixed order/consent, hard capabilities/context/readiness remain. Research refreshes quota readiness per query within its frozen authorized search pool, preserving strict search/4096budget and explicit first assignment. No unrestricted workflow editor/new product scope.

Relevant files: src/lib/account-settings-persistence.ts, account-key-persistence.ts, firebase.ts, store.ts; new account-settings persistence/integration/startup, Canvas/helper-layout/research-readiness integration tests; layout-save-resilience.cjs; required WebKit research list. Existing helper fixture corrections inherited fromb704902, not separate unverified source.

Evidence (directory /workspace/.lumen-verification/dynamic-picker-2026-10-18): final-recovery-current-unit.log all78unit/type pass; current-build production build passes (existing ineffective dynamic-import warning). Account settings16pure/7boundary cases; actual updateSettings startup7cases red→green; SDK option assertion locks complete-map replacement. Canvas2/helper-layout5/research1actual-caller cases red→green; research18bounded calls/no outside model/search+4096 preserved. Layout browser cleanred against prior runtime loses saved layout afterreload; current source key+layout2 suites clean12s, subsequent final7-file run6individual suites pass (key/layout/Canvas/writing/study/layout policies) but old deep-research fixture failed. Corrected guest fixtures then pass5Chromium33s (research/images/import/layout-builder/archive) and4actualWebKit47s (research/writing/study/layout). Do not call the failed7-file batch green. Independent review found startup gap, reproduced/fixed it and approved remaining source; guest helper consumers/direct storage refs independently reviewed, six manual refs fixed and syntax-checked. Full current CI is still mandatory.

## Architecture, limits and verification commands

Extend existing browser adapters/shared registry/deterministic router/bounded runtime; retain provider-prefixed stable IDs and one active connection per provider. API/documented capabilities outrank user assumptions; unknowns stay honest. Existing Auto/order layout semantics remain; comparison→conditional synthesis and research implement useful parallel/sequential/dependency/stage recovery. Arbitrary DAG editing is separate product scope, documented under master “where appropriate” clauses. Static hosting cannot refresh when browser execution is suspended. No invented arbitrary provider protocol or endpoint.

No paid real-provider benchmark, physical iPhone test or device-service account was available. Linux WebKit/mocks are explicitly narrower evidence. Generic premium scan still has22 inherited form/textarea findings explained in UX-CONTRACT.md; no claim of globally clean static scan. No new dependencies, rules/schema migration or credential destinations.

Use Node22 PATH=/workspace/.lumen-tools/node_modules/node/bin:$PATH; npm test; npm run build; npm run test:e2e -- selected-names. Local Firebase emulators9099/8080 must be active for authenticated tests; do not spawn competing emulators/preview servers. Browser preload NODE_OPTIONS=--require=/workspace/.lumen-tools/browser-preload.cjs; actual WebKit adds MR_WEBKIT=1 only for suites that select it. Hosted preload hosted-browser-preload.cjs with MR_TEST_URL=https://lumen-chat.web.app/. Never rebuild a dist under its active runner. Compare live assets with /tmp/lumen-verify-live.py using exact reviewed dist/merge/deploymentSHA. Hosted tests use synthetic guest accounts/mockproviders, real live assets, no paid inference.

Normal integration: inspect fresh remote/diff/exact-head CI, gh pr merge --merge --match-head-commit FULL_SHA; gh workflow run deploy.yml --ref main; verify successful run SHA, assets and live workflows before another deployment. Rollback is ordinary reviewed merge revert +known-good deployment, never force/reset/protection bypass. PR attachment app tool is unavailable on this host; created PR URLs remain in GitHub/chat. Do not reveal credentials.

## Manual tests after each corresponding release

- Custom models: add valid supported ID/details, save unchecked without paid probe; edit/remove/reload. Explicit Check models may probe. Invalid limits stay inline; Escape/focus behave consistently.
- Auto/layout: choose fixed order/fallback scope, mark assigned model Not in Auto, use Study or rewrite; explicit assignments remain while outside Auto exclusions stay enforced. Change metadata/availability and verify no unauthorized provider is used.
- Compare two models: Stop retains finished answer; retry only failed slot; combine only completed selected answers. Interrupted visible streams remain partial/error without silent model splice.
- Keys: disconnect and save/replace, reload, reconnect; latest key persists/syncs. Remove and verify model eligibility disappears. Switch accounts during stalled sync: no credential inheritance/endless spinner.
- Layout durability (final milestone): build/edit while sync is unavailable, reload, reconnect; latest layout and requirements persist, removed layout stays removed, keys remain unchanged. Make a settings edit immediately after opening cached account; refresh must preserve it.
- Canvas/research (final milestone): with controlled quota-limited backups, a permitted ready alternative can recover without retry starvation; research retains earlier successes/search restrictions and never uses outside fixed-layout pool.
- Picker UX: keep search open across refresh; arrows/Escape/Tab; phone provider field label and44px metadata inputs; light/dark/nooverflow. Original phone welcome/composer/motion preferences preserved.


Final coherent checkpoint verification before commit: final-checkpoint-unit.log all78unit/type pass, final-checkpoint-build.log build passes after integration ofb704902 ancestry and all source review fixes. Product tree was not changed afterward. Four actual WebKit suites pass47s and five corrected guest Chromium suites33s; key/layout current browserproofs and individualCanvas/writing/study/layout passes are detailed above. Required newCI will run101Chromium files and include actualWebKit deep research. Source snapshots and docs are coherent; commit/push now, verify exactremoteSHA, open PR, waitfullcurrentCI before release. No production claim for this final milestone.


Latest operational checkpoint: root source7cde3ea39a13408a266d16ae325b0e88357af387 is pushed/exact remote verified, https://github.com/Seifonyx/Lumen/pull/25, fullCI39245877175 pending. Subsequent changes in this worktree are documentation only, intentionally held for final source/main/live synchronization rather than superseding a running source CI with ledger-only edits. Preserve source head while24/25checksrun; continue normal progressive releases when green.


## Full-CI fixture follow-up — 2026-10-19

PR24 exactb704902 fullCI39245177533 passed type/build/72unit and required WebKit, but failed2/100Chromium files: answer-style used an explicitly privileged preview identity while expecting developer controls hidden; phone-windows seeded Study data under its former unprefixed account ID. No product failure or permission change. Corrected preview-role expectation and exact normalized Study key. New developer-options unit renders the actual AboutSection with actual developer list/isPreviewUser, preserving ordinary/missing-user negative coverage plus both developers/case normalization and preview positive. The current invite list contains only the two developer accounts; no invented nondeveloper authenticated access.

Evidence: key-fixture-role-phone-chromium.log2suites clean15s including390/320phone; key-role-phone-unit.log type/all73unitfiles pass; actual rendered2case matrix passes. Independent profile-consumer/permission review accepted coverage and found no other mismatches. Runtime/build tree remains identical tob704902, so prior reviewed production build is retained. Require fresh complete exact-head CI before normal merge/deploy; earlier failed run is not green evidence. Completion remains88%, pending final release gates.


Current integration checkpoint: merges key fixture source2ce5c9a886219f5dfb2e73e11c4036c66ea00dc1 into final source7cde3ea. Both runtime application trees are unchanged; only fixture/component-render coverage and accurate documentation change. PR24 b704902 CI39245177533 failed the two fixture cases above; PR25 7cde3ea CI39245877175 inherits them and must be superseded. Commit/push the reviewed integration, verify the exact remote revision and require fresh full CI for PR24 and PR25. No new production deployment. Owned final-ledger stash recovered into this checkpoint; do not blindly pop old backups.

Integrated final fixture evidence: final-role-phone-unit.log type/all79unitfiles pass; final-role-phone-chromium.log2suites clean9s. Product/workflow tree matches7cde3ea exactly; reviewed final dist remains valid. PR24 updated exact2ce5c9a fullCI39247939607 is running. Commit/push this fixture-only merge and require fresh complete PR25 CI; no runtime release is claimed.

Latest continuation checkpoint: source heads2ce5c9a/d9cf8db are committed/pushed/exact remote verified. All implementation is committed. Local AI_HANDOFF.md and validation checklist edits are documentation only, held for final release synchronization. Fresh fullCI39247939607/39248044452 are the only current release gates. Production remainsdab0fff/Deploy39243721175.


## Tools interaction root-cause repair — 2026-10-19

Current key/final replacement WebKit jobs118044358442/118044968193 succeed but are NOT retry-free: hub-actions desktop second comparison open retried in PR24; Study opening retried in PR25. Logs pr24-role-green-webkit.log/pr25-role-green-webkit.log preserve first failures. Investigation found ToolsPage declares Card inside its render function: React changes the component type and replaces tool buttons whenever parent search/connection/scroll-observer state updates. A release can therefore lose its original pointer target. This predates all current key/settings work; deterministic browser reproduction establishes the defect, not an unsupported claim that historical logs captured its exact triggering event.

The new tool-card-stability regression holds Study/Compare while changing only trailing search whitespace (identical filtering/position), asserts the original DOM node survives, then releases and checks the actual page/dialog. Old d9cf8db build fails isConnected=false on both runner attempts (tool-card-stability-red.log). Module-scope ToolCard preserves identical markup/actions with stable component identity; no memoization, permissions, animation or model-policy change. Local79unit/type/build pass; Chromium3suites tool-card-stability/hub-actions/study pass. Actual WebKit3suites and independent final diff review pending. The new regression is also added to required WebKit CI.

This small UI recovery repair belongs to final PR25; PR24 remains application-source unchanged and independent. Require fresh full PR25 CI after this source change, not only old d9cf8db CI. PR24 current fullCI39247939607 continues and can release independently once all checks and diagnosed retry evidence are accepted. Production remainsdab0fff. No increased progress credit until release acceptance.

Tool-card final local verification: tool-card-stability-unit.log type/all79unitfiles pass; build passes; targeted Chromium3suites clean27s and actual WebKit3suites clean45s (tool-card-stability-chromium/webkit.log). Independent actual source/test review finds no blocker. Source/root head will include this coherent repair; require a fresh exact-head complete PR25 CI after push. No application code in key-release branch2ce5c9a changes.
