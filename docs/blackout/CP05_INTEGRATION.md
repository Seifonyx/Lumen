# CP05 — Canvas across the app (first milestone; production activation off)

**22 October 2026.** The owner approved **Gate 2** for the overall visual and interaction foundation, with polish to continue, and authorized **CP05** in the isolated feature branch.

**Not authorized:** merge, deployment, default production activation, new spending and Gate 3. Progress stays at **21.5%**: whole B03–B07 groups are not yet complete and accepted.

Commits:
- `d2edc0c` — composer fix;
- `3f5c963` — Canvas screens;
- `9f7f2af` and the following test/fix commit.

## What changed

- **Canvas across the app:** `src/styles/canvas-screens.css` restyles the canonical components' existing markup, scoped to `html[data-lumen-canvas]`. That covers:
  - Settings and its sections;
  - the HubPage shell for Library, Tools, Projects, Study and Assistants;
  - the project workspace;
  - dialogs, sheets and menus.
- **Look:** ink-on-paper accents (the signal colour, switches and focus ring become ink); display headings and mono section labels; rimmed cards, pill actions and segmented tabs; monochrome tool icons and project monograms. Light and dark are both covered.
- **Scope seam:** App sets the document scope only while the shell switch is on; the ordinary build folds it away. The QA switch replacement loads the stylesheet. Production output stays **byte-identical (174 files)**.

**Fixes found while integrating:**
- **Composer:** from the resting capsule, clicking **Auto** moved the button mid-click, so the picker never opened. Now only the message box engages the composer (at once), and other controls never change the state mid-press. This also protects Safari taps.
- **Sidebar:** a project brief didn't open its project while Library, Tools or Projects was showing.

**DESIGN.md** gains the Canvas ownership map and rules. The **refinement backlog** is in [CANVAS_REFINEMENT_BACKLOG.md](CANVAS_REFINEMENT_BACKLOG.md).

## Verification (milestone run)

New `tests/security/private-qa-canvas-screens.mjs`: Chromium and Linux WebKit; 1440×960 and 390×844; dark and light. Each of the four combinations runs 7 checks:
- Canvas scope and ink accents;
- Settings, Library, Tools, Projects;
- create a project (it appears in the tree);
- project from brief while a page is showing;
- All chats, picker from rest, + menu;
- Routing Center;
- axe per screen, plus overflow, CSP, network and page errors.

All pass, alongside:
- CP04, CP03 and CP02 contracts and the QA browser contract, in both engines;
- QA01 isolation 8/8;
- CP01 graph check;
- `npm test`.

**Test note:** WebKit measured an opening dialog mid-fade as low contrast. The contract now waits for animations to settle before axe; settled screens have no violations.

Evidence: [desktop dark](cp05/desktop-dark.png), [desktop light](cp05/desktop-light.png), [phone](cp05/phone.png), and results in [cp05](cp05).

## Owner review (iPhone, existing Codespace)

1. Start the Codespace; it updates and builds by itself.
2. Tap **Reset** for fresh synthetic data.
3. Check:
   - Settings → General → Theme (switch to Light and back);
   - Library;
   - Tools;
   - Projects → New project (it appears in the menu's Projects);
   - a project's description card;
   - the model picker from the resting capsule;
   - Models & routing.
4. Decide the P1 items in the backlog: zoom, green versus ink switches, display font, and the "Use model" return.

## Second milestone — remaining screens, owner decisions, activation plan

**Owner decisions applied** (see the backlog's "Decided" table):
- **Pinch zoom:** stays disabled in the main chat, unchanged.
- **Switches:** monochrome ink with a clear off state (rimmed track, grey knob).
- **Display face:** Geist (the Archivo name is removed from the Canvas tokens).
- **"Use model":** returns to the chat, keeping the draft and the model, and confirms with "Now using … in this chat".

**Screens added (scoped CSS only, canonical components unchanged):**
- **Assistants:** ink avatars instead of per-name hues; rimmed cards; mono section labels.
- **Study:** ink progress ring and due chip; rimmed stats and decks.
- **Compare:** ink checks.
- **Document Canvas panel:** display head and a quiet segmented Edit/Preview switch.
- **True black:** covered throughout.

**Activation:** [CANVAS_ACTIVATION_PLAN.md](CANVAS_ACTIVATION_PLAN.md) covers the one-commit switch flip, the pre-activation checklist, the Hosting rollback and partial switch-off. **Nothing is activated.**

**Contract:** `private-qa-canvas-screens.mjs` now also covers:
- Study, Assistants (avatar ink asserted), Compare and the document Canvas panel;
- all three themes (dark, light, true black);
- 9 checks per combination.

The Routing Center contract also asserts the "Use model" confirmation.

**Verified at `38c4dce`:**
- **Contracts:** CP05 (dark, light, true black; 1440 and 390), CP04 (now asserting the confirmation), CP03, CP02 and the QA browser contract. All pass in Chromium and in Linux WebKit.
- **Isolation:** QA01 isolation 8/8.
- **Production:** CP01 graph check passes with baseline equality, and the production build is byte-identical to the baseline.
- **Unit tests:** `npm test` passes.

Evidence: [desktop](cp05/m2/desktop.png), [phone](cp05/m2/phone.png), [Chromium results](cp05/m2/results-chromium.json), [WebKit results](cp05/m2/results-webkit.json).

## P2 refinement — phone Routing Center sections, folded providers, phone Settings heading

Owner-authorized follow-up after the owner's iPhone review ("all looks good"). Scope is the three backlog items only; the approved design is unchanged.

- **Routing Center sections (phones):** the segmented control becomes a 3 × 2 grid. All six sections are visible at 320 to 899 px, each a 44pt target, with no sideways scrolling. The desktop row is unchanged.
- **Providers:** providers with neither a saved key nor permission fold under one **Not connected · N providers · no key saved** row (a real button with `aria-expanded` and `aria-controls`). Saved or enabled providers stay listed with their exact state. A provider without a key that is still enabled is never folded, and its row now says so ("No key saved · enabled"). The fold starts open when the current model's provider is unconnected. A search or a filter shows the plain full list. The count line and the detail view are unchanged.
- **Settings (phones):** the opened section shows its Canvas display heading (30 px Geist), which production hides on phones. The bar's small section title fades in only once the heading scrolls away, and stays in the accessibility tree throughout. The glass look is untouched.

Presentation only. `RoutingCenter.tsx` is reached only through the QA switch, and the CSS is scoped to the Canvas attributes, so the ordinary production build is unchanged (byte-identical, see below). No state, routing, key, draft or account logic changed.

**Contracts extended:**
- CP04 asserts that every section is fully visible and at least 44pt tall on phones. It also checks the fold (closed by default, the saved connection listed with its state, open and close, a search reaching a folded provider) and saves a folded screenshot.
- CP05 asserts the phone Settings display heading (at least 28 px, "General") and that the small bar title is hidden while the heading is in view.

**Verified at `c3b59d8`:**
- **Contracts:** CP05 (dark, light, true black; 1440 and 390), CP04 (1440, 390, 320), CP03, CP02 and the QA browser contract. All pass in Chromium and in Linux WebKit (Playwright 1.56.1 image).
- **Isolation:** QA01 isolation 8/8.
- **Production:** the CP01 graph check passes (2560 modules, 174 artifact hashes), and the build is byte-identical to a fresh build of `main` (`655438f`).
- **Unit tests:** `npm test` passes.
- Synthetic and automated only, not a physical iPhone.

Evidence: [phone providers, folded](cp05/p2/phone-providers-folded.png), [320 px sections](cp05/p2/phone-320-sections.png), [phone Settings heading](cp05/p2/phone-settings-heading.png), CP04 results for [Chromium](cp05/p2/cp04-results-chromium.json) and [WebKit](cp05/p2/cp04-results-webkit.json).
