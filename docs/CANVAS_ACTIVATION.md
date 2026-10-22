# Canvas activation

Canvas is Lumen's owner-approved visual and interaction design (Gates 1–3 approved, 22 October 2026). This change makes it available through the production code path. The design work, its records and the full readiness review live on the `docs/lumen-blackout-phase1-20261019` branch (draft PR #34).

## The switch

`src/lib/canvas-presentation.ts` holds the presentation switches, all off. Builds turn them on by resolving that module to `src/lib/canvas-presentation.on.ts`, which also loads the five Canvas stylesheets and lazy-loads the Routing Center:

- **Production:** `LUMEN_CANVAS=1 npm run build` (selected in `vite.config.ts`). Unset or `0` produces the ordinary build, byte-identical to the pre-activation release. That build is the rollback build.
- **Synthetic QA review build:** `vite.qa.config.ts` swaps in `qa/iphone/adapters/canvas-presentation.ts`, which only re-exports the same "on" module. The owner's private iPhone review therefore shows exactly what production ships.

The switch is build-time only, not a runtime toggle, a query parameter or a security boundary. Data, storage keys, providers, routing, permissions, auth and drafts are unchanged.

## Workflows

- **Deploy** and **Preview** take a `presentation` input: `canvas` (default) or `ordinary`. **Merging this change does not deploy anything. The next Deploy run ships Canvas.** Deploy also refreshes the `dev` preview channel from the same build.
- **Tests:**
  - Existing jobs keep testing the ordinary build, which guards the rollback path and shared logic.
  - The `checks` job also builds Canvas.
  - The `in-app-canvas` job runs the in-app suites listed in `tests/e2e/canvas-core.txt` (72 of 104) against the Canvas build with the Firebase emulators: account isolation and sync, keys and providers, privacy and account deletion, drafts, send and stop, attachments, the model picker, settings and the accessibility scan.
  - The `canvas` job runs, in Chromium and WebKit, the isolation audit (ordinary, Canvas production and QA builds) and the CP02–CP05, Routing Center and QA browser contracts on the synthetic QA build.
  - The WebKit jobs run in Playwright's container image, so they no longer download WebKit.

## Known gap

32 in-app suites still look for the ordinary sidebar's own controls (the date-grouped chat list, `.usage-chip`, `.view-all-chats`, `.sidebar .new-chat`, the old sidebar footer's layout) or measure ordinary-layout geometry, so they run only on the ordinary build: app-feel, archive, ask-chats, assistants, auto-explain, auto-intelligence, bulk-chats, canvas-integration, chat-menu, deep-research, design, fit, free-tools, glass, layout, message-navigation, model-health, more-motion, motion-controls, native-feel, phone-windows, quota, regressions, roadmap, safe-insets, sheet-drag, sidebar, smart-memory, study, transitions, welcome, workspace-design. The features they exercise are shared code and stay covered there; what is not yet proven on Canvas is how those features are reached in the Canvas layout. Port them (selectors that work in both layouts, as in `sync.cjs`) and add each to `canvas-core.txt`.

## Before deploying (owner-approved steps)

1. Exact-head CI green on the activation PR, including WebKit and the `canvas` job.
2. Owner physical-iPhone pass on the activated build through the private Codespace: VoiceOver on the composer, navigation and Routing Center; an external keyboard; dictation; light, dark and true black.
3. Owner approval to merge, then separate approval to deploy.

## Rollback

1. **Fastest:** Firebase Console → Hosting → `lumen-chat` → Release history → roll back to the version recorded before the deploy. No rebuild.
2. **Or rebuild:** run Deploy with `presentation: ordinary`.
3. Then revert normally in git if needed (no force push).

Installed apps (iPhone home-screen PWAs in particular) keep the build they have until they see the new service worker (on return to the foreground, or every 30 minutes) and the user taps Reload. That is true of a rollout and of a rollback.
