# Canvas — final design refinement (one polish pass)

21 October 2026. The owner chose **A · Canvas**, borrowing Desk's project context. This pass refines Canvas without redesigning it. It is still an opt-in preview (`?proposal=canvas`): **no production change, merge or deployment. Gate1 NOT APPROVED.** Completion stays at 18.5%.

**What changed:** only `proposals/ProposalChrome.tsx` and `proposals/canvas.css`. Desk, `shared.css`, `src/`, and provider/routing/security code are untouched.

Before/after images are in [polish/](polish/). Each shows BEFORE on the left and AFTER on the right, from the actual app with a synthetic account.

## What changed

**Navigation (one tree, now with Desk's project context)**
- **Project brief:** an open project leads with its description, plus "Instructions · N files ›", which opens the project overview. This replaces the small "Overview" link.
- **Long lists:**
  - A project shows its 5 newest chats, then "Show N more".
  - Conversations are grouped as Pinned, Today, Yesterday, Previous 7 days, Previous 30 days and Older.
  - Section labels stay pinned while the tree scrolls.
- **Re-homed production actions:**
  - "+" beside Projects opens the Projects page.
  - "All chats" opens the real AllChats view (bulk archive/move/export/delete, archived tab).
  - Typing a search offers "Ask your chats" (the real AskChats).
- **Density:**
  - Desktop rows are 32–34px, so a realistic history fits.
  - iPhone rows keep 44pt targets.
  - "Models & routing" no longer wraps.

**Reading**
- **Gap before the first answer:** cut from about 62px (iPhone) and about 108px (desktop) to **24px**. On desktop, the user message's hover actions now overlay the space below the bubble instead of reserving their own row.
- **Measure and type:** unchanged at a 720px column and 16.5/1.72.
- **Desktop top bar:** the fade is longer, and the hard rule shown when scrolled is gone, so a scrolled heading no longer collides with the breadcrumb.
- **iPhone title:** a long title now truncates between the two glass buttons; before, it ran underneath them at 320px.

**Composer**
- **Rest state:** unchanged, one row (`+` · Message · `Auto ▾` · Send/voice). The text baseline is re-centred against the 38px controls.
- **Writing state:** the context estimate, expand and dictation now fade and scale in (0.24s) instead of popping in.
- **iPhone glass:**
  - It is still production glass (rim, sheen and blur).
  - The tint is now 90% opaque (production's strong glass is 68%), so the draft stays readable even where blur isn't drawn.
  - It respects the bottom safe area.
- **Desktop:** a soft fade sits under the floating capsule, so the last lines of an answer don't collide with it.
- **Reduced transparency:** under `prefers-reduced-transparency`, the capsule and glass buttons become solid.

**Writing sheet**
- It rises in (0.38s), and the scrim fades in.
- **iPhone:**
  - **Drag the header down to put it away.** A drag of 90px or more dismisses it; a shorter drag springs back.
  - The title gets the full width, with the word/token count beneath it. Before, it was cut to "A launch wor…".
- **Unchanged:** Done, the expand control and Escape still close the sheet, keeping the same textarea, draft, cursor, selection and focus.
- **Reduced motion:** the existing global rule removes all of this motion.

## Production navigation audit

| Production sidebar action | In Canvas |
|---|---|
| New chat, Library, Tools, Settings | Yes |
| Search (titles) | Yes |
| Ask your chats | Yes (new this pass) |
| View all chats: bulk archive/move/export/delete, archived tab, swipe pin/delete | Yes, via AllChats (new this pass) |
| Projects list + New project | Yes (+ is new this pass) |
| Grouped recents (Pinned/Today/…) | Yes (new this pass) |
| Per-row chat menu: Rename, Pin, Move to project, Archive, Side by side, Share/export, Delete; long-press menu | **Not re-homed.** Available only as AllChats bulk actions; no per-row menu in the tree. |
| Inline rename; Open side by side from a row | **Not re-homed** |
| Desktop sidebar collapse | **Not re-homed** (the tree is always shown on desktop) |
| Account avatar footer | **Not re-homed** (Settings is reachable) |

The top bar's canvas, repository and incognito actions are kept from production.

## Tests (actual app, synthetic account, localhost preview)

- **`capture.cjs`, Canvas:** passes in all of these, with 0 axe violations, 0 page errors and 0 overflow:
  - Chromium desktop 1440×900;
  - Chromium iPhone 393×852, 320×693 and 430×932;
  - **WebKit 26.0** iPhone 393×852 (official Playwright 1.56.1 image).

  Each run asserts:
  - expand keeps the same textarea, draft, selection (12–38) and focus, and so does Escape;
  - the real model picker and usage dialogs open;
  - exactly one intercepted Send, then Stop.
- **`polish-check.cjs`** (new; 1440 and 393, with 21 seeded chats):
  - "Show 7 more" folds a 12-chat project and then reveals all of it;
  - the tree scrolls, with sticky section labels;
  - the gap between question and answer is 24px;
  - **swipe:** a 35px drag keeps the sheet; a 155px drag puts it away, keeping the draft and selection (6–11);
  - 0 page errors.
- **Regression:**
  - Desk desktop and iPhone pass `capture.cjs`.
  - Production iPhone passes `capture.cjs`.
  - The consolidated harness passes at 390 and 1440.
  - Proof `tsc` passes.
- **Raw frames:** outside Git in `/home/user/.lumen-verification/canvas-polish/{before,after}`.

## Not tested (and why)

- **Physical iPhone:**
  - The preview still renders only on `localhost` (see [FINAL_VERIFICATION.md](../FINAL_VERIFICATION.md)).
  - So these are untested on a device: the real keyboard (the composer rides on production's existing keyboard handling, which wasn't re-tested), the feel of the swipe gesture, the blur and saturation, and Dynamic Type.
- **WebKit 26 in Docker draws little or no backdrop blur.** Glass looks flatter there than on a device, so those frames check layout and legibility only.
- **Simulation limits:** the swipe was simulated with mouse-driven pointer events in Chromium, not real touch. `prefers-reduced-transparency` was not emulated (Playwright can't), so that rule is reviewed in code only.
- **Not covered:** the light theme and a very long conversation tree on low-end desktops.

## Recommendation

Canvas is ready for the owner's review as the chosen direction. If it's accepted:
1. Next, design per-row actions in the tree. The tree's own row menu (rename/pin/move/archive/delete, with long-press on iPhone) is the main production capability still not re-homed.
2. Then run the physical-iPhone check, which needs the owner to approve a test-only host allowance.
3. Only after both, plan migration.

**STOP for owner review.** Gate1 is not approved by this pass.
