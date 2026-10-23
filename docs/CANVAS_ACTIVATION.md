# Canvas activation

Canvas is Lumen's owner-approved visual and interaction design (Gates 1–3 approved, 22 October 2026). This change makes it available through the production code path. The design work, its records and the full readiness review live on the `docs/lumen-blackout-phase1-20261019` branch (draft PR #34).

## Naming

New docs use one internal name for the design system: **the Canvas presentation** (short form "Canvas"), after `src/lib/canvas-presentation.ts` and the `LUMEN_CANVAS` build switch. The other build is **the ordinary presentation**. Users never see either name. **Document canvas** stays the user-facing name of the side-by-side document editor (`CanvasPanel`), and docs call that feature by its full name so the two never blur. Older records may say "Canvas 5", "CP0x" or "Blackout"; they mean the same design system.

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
  - The `in-app-canvas` job runs the in-app suites listed in `tests/e2e/canvas-core.txt` (103 of 104) against the Canvas build with the Firebase emulators: account isolation and sync, keys and providers, privacy and account deletion, drafts, send and stop, attachments, the model picker, settings and the accessibility scan.
  - The `canvas` job runs, in Chromium and WebKit, the isolation audit (ordinary, Canvas production and QA builds) and the CP02–CP05, Routing Center and QA browser contracts on the synthetic QA build.
  - The WebKit jobs run in Playwright's container image, so they no longer download WebKit.

## Known gap

None for the in-app suites. All but one run on both builds; the 32 that once drove only the ordinary sidebar were ported in the polish release (selectors that work in both layouts, and `tests/e2e/helpers/open-chat.cjs` for chats filed in folded project folders). `canvas-integration` stays ordinary-only on purpose: it checks that Canvas styles and tokens never leak into the ordinary build.

The ports found two real Canvas bugs, both fixed: the home message box moved as chats loaded, and a chat's options menu was clipped by its sidebar section.

## Follow-up polish (non-blocking)

The owner's iPhone pass on the activated build (22 October 2026) found it looks good, with substantial polish still to do. None of this blocks the merge; the merge doesn't turn Canvas on.

**P1: noticed in the release-candidate review**

1. ✓ *Done in the polish release.* **Message navigation:** on narrow phones (320 px) with a draft, "Scroll to latest" covers the last tick of the navigation rail. Move the button left of the rail or raise it.
2. ✓ *Done in the polish release.* **Archived chats in search:** Canvas lists them without an "Archived" label (the ordinary sidebar has an Archived heading). Add a small tag on the row while searching.

**P2: visual refinement** (carried from the design backlog on the `docs/lumen-blackout-phase1-20261019` branch)

3. ✓ *Done in the polish run.* Hub pages (Library, Tools, Projects): use the Routing Center's "← Chat" pill for "Back to chat" and "Done".
4. ✓ *Done in the polish release (project colours fold to ink).* Project manager: hide its colour dots, or use colour subtly, to match Canvas's monochrome monograms.
5. ✓ *Done in the polish release.* Composer usage chip: shows "0%" on a new chat; the "~N tokens" context wording is pending.
6. ✓ *Done in the polish release.* Routing Center on desktop: wide spacing between "Connect" and "a provider".
7. ✓ *Done in the polish run.* Sidebar: the active row's ⋯ on phones; the folder chevron animation timing.
8. ✓ *Reviewed and fixed in the polish run.* Login and onboarding, long-press menus, the Compare results view, Study deck and quiz views.

**P3: test coverage**

9. ✓ *Done in the polish release (103 of 104).* Port the 32 ordinary-only suites (see Known gap) and add each to `canvas-core.txt`.

## On-device features (polish run, Tier 5)

All seven live only in the Canvas presentation and run on the device: no server, no new storage service, no new permissions, nothing spent.

- **Reroute reason (37):** when Auto falls back, the model line reads "Rerouted: <why>", from the stream's own notice. The separate notice box is folded into that line.
- **Usage history (38):** Routing Center → Usage shows answers per day for 14 days and per model, counted from chats saved on this device. Incognito and deleted chats don't count. No Firestore reads are added.
- **Check connection (39):** Routing Center → a provider asks the providers for their model lists again (the catalog refresh Lumen already runs). No message is sent. The result is shown in words; keys are never read or shown.
- **Routing file (40):** Routing Center → Policies exports Auto's preference, fallback, exclusions, enabled models, the default and Layouts as JSON. It never includes keys, connections, chats or memory. Import rebuilds each field from an allow list, drops models the catalog doesn't have, and previews the change before applying.
- **Request log (41):** Routing Center → Diagnostics lists how recent requests ended (answered, rerouted, stopped, failed with a category), from saved chats. It never shows prompts or answers; chat titles only when you tick "Show chat titles". No logger is added.
- **Context rail (42):** at 1280 px and wider, a toggle in the chat header opens the chat's outline, cited sources and the models that answered. It is off by default; the on/off choice is the only thing stored, on this device.
- **Project memory (43):** a project's page lists every memory kept for it, each editable or removable in place, plus Add. It uses the existing memory actions.

## Before deploying (owner-approved steps)

1. Exact-head CI green on `main` after the merge.
2. Owner physical-iPhone pass on the activated build through the private Codespace: done 22 October 2026 ("looks good", polish remaining).
3. Owner approval to merge, then a separate approval to run Deploy with `presentation: canvas`.

## Rollback

1. **Fastest:** Firebase Console → Hosting → `lumen-chat` → Release history → roll back to the version recorded before the deploy. No rebuild.
2. **Or rebuild:** run Deploy with `presentation: ordinary` (the default).
3. Then revert normally in git if needed (no force push).

Installed apps (iPhone home-screen PWAs in particular) keep the build they have until they see the new service worker (on return to the foreground, or every 30 minutes) and the user taps Reload. That is true of a rollout and of a rollback.
