# Canvas activation

Canvas is Lumen's owner-approved visual and interaction design (Gates 1–3 approved, 22 October 2026). This change makes it available through the production code path. The design work, its records and the full readiness review live on the `docs/lumen-blackout-phase1-20261019` branch (draft PR #34).

## The switch

`src/lib/canvas-presentation.ts` holds the presentation switches, all off. Builds turn them on by resolving that module to `src/lib/canvas-presentation.on.ts`, which also loads the five Canvas stylesheets and lazy-loads the Routing Center:

- **Production:** `LUMEN_CANVAS=1 npm run build` (selected in `vite.config.ts`). Unset or `0` produces the ordinary build, byte-identical to the pre-activation release. That build is the rollback build.
- **Synthetic QA review build:** `vite.qa.config.ts` swaps in `qa/iphone/adapters/canvas-presentation.ts`, which only re-exports the same "on" module. The owner's private iPhone review therefore shows exactly what production ships.

The switch is build-time only, not a runtime toggle, a query parameter or a security boundary. Data, storage keys, providers, routing, permissions, auth and drafts are unchanged.

## Workflows

- **Deploy** and **Preview** take a `presentation` input: `ordinary` (default) or `canvas`. **Canvas ships only when someone runs Deploy and picks `canvas`.** Any other value builds ordinary. Merging this change deploys nothing, and a routine Deploy keeps the ordinary presentation. Deploy also refreshes the `dev` preview channel from the same build.
- **Tests:**
  - Existing jobs keep testing the ordinary build, which guards the rollback path and shared logic.
  - The `checks` job also builds Canvas.
  - The `in-app-canvas` job runs the in-app suites listed in `tests/e2e/canvas-core.txt` (72 of 104) against the Canvas build with the Firebase emulators: account isolation and sync, keys and providers, privacy and account deletion, drafts, send and stop, attachments, the model picker, settings and the accessibility scan.
  - The `canvas` job runs, in Chromium and WebKit, the isolation audit (ordinary, Canvas production and QA builds) and the CP02–CP05, Routing Center and QA browser contracts on the synthetic QA build.
  - The WebKit jobs run in Playwright's container image, so they no longer download WebKit.

## Known gap

32 in-app suites still look for the ordinary sidebar's own controls (the date-grouped chat list, `.usage-chip`, `.view-all-chats`, `.sidebar .new-chat`, the old sidebar footer's layout) or measure ordinary-layout geometry, so they run only on the ordinary build: app-feel, archive, ask-chats, assistants, auto-explain, auto-intelligence, bulk-chats, canvas-integration, chat-menu, deep-research, design, fit, free-tools, glass, layout, message-navigation, model-health, more-motion, motion-controls, native-feel, phone-windows, quota, regressions, roadmap, safe-insets, sheet-drag, sidebar, smart-memory, study, transitions, welcome, workspace-design. The features they exercise are shared code and stay covered there; what is not yet proven on Canvas is how those features are reached in the Canvas layout. Port them (selectors that work in both layouts, as in `sync.cjs`) and add each to `canvas-core.txt`.

## Follow-up polish (non-blocking)

The owner's iPhone pass on the activated build (22 October 2026) found it looks good, with substantial polish still to do. None of this blocks the merge; the merge doesn't turn Canvas on.

**P1: noticed in the release-candidate review**

1. **Message navigation:** on narrow phones (320 px) with a draft, "Scroll to latest" covers the last tick of the navigation rail. Move the button left of the rail or raise it.
2. **Archived chats in search:** Canvas lists them without an "Archived" label (the ordinary sidebar has an Archived heading). Add a small tag on the row while searching.

**P2: visual refinement** (carried from the design backlog on the `docs/lumen-blackout-phase1-20261019` branch)

3. Hub pages (Library, Tools, Projects): use the Routing Center's "← Chat" pill for "Back to chat" and "Done".
4. Project manager: hide its colour dots, or use colour subtly, to match Canvas's monochrome monograms.
5. Composer usage chip: shows "0%" on a new chat; the "~N tokens" context wording is pending.
6. Routing Center on desktop: wide spacing between "Connect" and "a provider".
7. Sidebar: the active row's ⋯ on phones; the folder chevron animation timing.
8. Not yet visually reviewed: login and onboarding, long-press menus, the Compare results view, Study deck and quiz views.

**P3: test coverage**

9. Port the 32 ordinary-only suites (see Known gap) and add each to `canvas-core.txt`.

## Before deploying (owner-approved steps)

1. Exact-head CI green on `main` after the merge.
2. Owner physical-iPhone pass on the activated build through the private Codespace: done 22 October 2026 ("looks good", polish remaining).
3. Owner approval to merge, then a separate approval to run Deploy with `presentation: canvas`.

## Rollback

1. **Fastest:** Firebase Console → Hosting → `lumen-chat` → Release history → roll back to the version recorded before the deploy. No rebuild.
2. **Or rebuild:** run Deploy with `presentation: ordinary` (the default).
3. Then revert normally in git if needed (no force push).

Installed apps (iPhone home-screen PWAs in particular) keep the build they have until they see the new service worker (on return to the foreground, or every 30 minutes) and the user taps Reload. That is true of a rollout and of a rollback.
