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
