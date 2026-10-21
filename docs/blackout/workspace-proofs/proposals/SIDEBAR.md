# Canvas — navigation completeness and sidebar refinement

21 October 2026. This is a targeted refinement of the owner-selected **A · Canvas** sidebar, informed by the owner's iPhone sidebar reference (a ChatGPT screenshot). It is not a redesign.
- **Scope:** opt-in preview only (`?proposal=canvas`). There is no production change, merge or deployment.
- **Status:** Gate1 NOT APPROVED. Progress stays at 18.5%.

**Files changed:**
- **New:** `proposals/CanvasNav.tsx` (the sidebar), `proposals/nav-check.cjs` (its verification).
- **Edited:**
  - `ProposalChrome.tsx`: the sidebar moved out, and desktop collapse was wired up.
  - `canvas.css`: navigation styles.
  - `polish-check.cjs`: one selector updated for the new folder markup.

Untouched: the composer, writing sheet, reading surface, iPhone glass, `src/`, Desk, and provider/routing/security code.

**Images** are in [sidebar/](sidebar/), from the actual app with a synthetic account and a long history (4 projects, 25 chats):
- **Before/after:** iPhone default, iPhone project expanded, 320px, desktop default.
- **After only:** sections collapsed, the long-press menu, desktop collapsed, and the desktop row menu.

## What we took from the reference, and what stays Lumen

**Taken (layout principles):**
- a large wordmark at the top, with a round search control;
- a short list of icon + label rows for destinations;
- a hairline separator before the history;
- generous 44–48pt rows on iPhone;
- **New chat as a pill at the bottom left, with a round account control at the bottom right**, within thumb reach;
- a calm, monochrome hierarchy.

**Intentionally Lumen:**
- **Identity:** Lumen's mark and Archivo wordmark, mono uppercase section labels, and ink-on-paper colour. New chat is ink, not a brand blue.
- **Materials:** production iPhone glass for the drawer and round controls (90% tint, so contrast never depends on blur; solid under reduced transparency).
- **Navigation model:** Projects and Conversations stay **one tree**. Projects keep:
  - their folders, briefs and "Instructions · N files";
  - "New chat in …";
  - "Show N more".
- **Destinations:** only Lumen's own (Library, Tools, Models & routing). Nothing was copied from the reference's list (no Codex, Plugins, Scheduled or Explore), and Projects is not duplicated as a separate destination.
- **Settings:** reached from the account avatar, as in production.

## Sidebar behaviour

**Collapsible sections**
- **Controls:** the Projects section, each project folder and the Conversations section each have their own chevron. It points right when closed and down when open, and rotates in 0.24s.
- **Folding:**
  - Content eases open and shut.
  - Closed content is `inert`, so it can't be focused and is hidden from assistive tech.
  - Each heading is a real button with `aria-expanded` and `aria-controls`; Enter and Space toggle it.
- **Independence:** each part folds on its own. Projects doesn't affect Conversations; one folder doesn't affect another; "Show N more" still works inside open folders.
- **Where the open chat is:** when its folder or section is closed, that heading shows a small dot (with screen-reader text, "contains the open chat").
- **While searching:** every match is shown regardless of folding, and the section toggles are disabled. Clearing the search restores your layout.
- **Remembered:** saved per signed-in account on this device (`lumen.blackout.canvasNav.<uid>`). Another account starts from its own defaults, which was tested. Folders you haven't touched open automatically when they contain the open chat.
- **Reduced motion:** the existing global rule removes the fold and chevron animation (tested).

**Conversation actions** (restored, using production's own store actions and components)
- **Actions:**
  - Rename (inline)
  - Pin / Unpin
  - Move to project (any other project, or none)
  - Archive
  - Open side by side (wide screens, other chats)
  - Share or export
  - Delete, behind production's confirmation
- **Desktop:** a ⋯ button appears on hover, focus or the open chat; right-click also works. The menu is keyboard-operable: arrows, Home/End, Escape returns focus to ⋯, and Tab closes it.
- **iPhone:** press and hold opens production's long-press `ContextMenu` (lifted row, haptic), and "Move to project" opens the project list in the same menu. The ⋯ button appears only on the open chat, or when it has VoiceOver/keyboard focus, so the list stays clean.

**Account and desktop**
- **Account:** the avatar footer is restored. On desktop it shows avatar, name, "Settings & keys" and a gear; on iPhone, a round avatar opposite the New chat pill. Both open Settings.
- **Desktop collapse:** reuses production's existing behaviour rather than a new state:
  - the `.app.sidebar-collapsed` state, saved in `mr.sidebarCollapsed`;
  - the ⌘⇧S / Ctrl⇧S shortcut.

  The sidebar's collapse button and the top bar's "Show sidebar" button drive the same toggle. When collapsed, the reading column and the writing sheet take the full width.
- **Search:** always visible on desktop; on iPhone, behind the round search button (Escape clears and closes it).

**Preserved:** the project brief, date groups, Pinned group, long-list folding, All chats (bulk actions and archived tab), Ask your chats, the New project +, breadcrumb, and all real destination handlers.

## Production navigation audit (update)

Everything listed as not re-homed in [CANVAS_POLISH.md](CANVAS_POLISH.md) is now re-homed:
- the per-row menu, including long-press;
- inline rename;
- Open side by side;
- desktop sidebar collapse;
- the account avatar.

Remaining differences:
- **Search:** like the earlier Canvas, sidebar search matches titles. Production also searches message text; that is still reachable through Ask your chats and All chats.
- **Project editing:** the production "Edit project" pencil is reached via the project overview (the brief), not from the folder row.
- **Archived chats:** they are listed in All chats → Archived, not inline in the tree.

## Tests (actual app, synthetic account, localhost)

**`nav-check.cjs`**, run on:
- Chromium: desktop 1440×900 and iPhone 393×852, 320×693, 430×932;
- WebKit 26.0 (official Playwright image): iPhone 393×852 and desktop 1440×900.

Each run asserts:
- **Folding:**
  - folder independence, with the marker on a closed folder holding the open chat;
  - "Show 7 more";
  - Projects-only and both-closed section states, with closed content inert;
  - Enter/Space toggling;
  - state remembered across a reload and kept separate for a second account;
  - search reaching into folded sections.
- **Row actions:** menu contents and keyboard Escape; Pin, Move, Rename, Archive (the row leaves the tree) and Share/export, each verified in the store; Delete cancelled (the chat is kept), then accepted (removed); Side by side on desktop.
- **Account and collapse:** the account opens Settings. On desktop, collapse removes the sidebar and shows the button, survives a reload, and ⌘⇧S restores it.
- **State:** the composer draft and its selection (2–7) are unchanged through every sidebar interaction before a reload, and the draft afterwards.
- **Health:** reduced motion gives 0s transitions; 0 page errors; no horizontal overflow; 0 axe violations on the default, collapsed and open-menu states.

Engine differences:
- **Chromium iPhone:** the long-press is a real CDP touch hold.
- **WebKit iPhone:** touch-hold can't be simulated, so the ⋯ menu is checked through keyboard focus instead, and the mutating row actions ran in the other engines.

**Regression** (all pass):
- `capture.cjs`: Canvas desktop, iPhone and 320px (expand keeps the same textarea, draft and selection; one intercepted Send/Stop); Canvas iPhone in WebKit.
- `capture.cjs`: Desk desktop and iPhone.
- `polish-check.cjs` at 393 and 1440 (swipe-down sheet, fold, 24px reading gap).
- Consolidated harness at 390 and 1440.
- Proof `tsc`.

**Raw output:** `/home/user/.lumen-verification/canvas-nav/{before,after}`, outside Git.

## Limitations and remaining issues

- **No physical iPhone:** not tested on a real device; the preview still renders only on `localhost`. Untested there: the long-press feel and haptic, drawer blur, momentum scroll, and VoiceOver rotor behaviour.
- **WebKit 26 in Docker draws little or no backdrop blur**, so its glass looks flatter than on a device.
- **The drawer opens but isn't swipeable:** there's no edge-swipe to open it or drag to close it (tap, the close button and the scrim work).
- **Destructive confirmation:** Delete uses production's native `confirm()`, unchanged. A Lumen-styled confirmation would be a production-wide decision.
- **Untested:** the light theme was not reviewed in this pass.

## Physical iPhone access — recommendation (nothing changed)

The guard (`bootstrap.ts:23`, `location.hostname !== 'localhost'`) blocks any network access, which is intended.
- **Now, with no approval needed:** open `http://localhost:5195/docs/blackout/workspace-proofs/?proposal=canvas` in the **iOS Simulator** on your Mac. It is real Mobile Safari/WebKit with real blur, but not a physical device.
- **Safest physical option (needs your explicit approval first):**
  1. Run the preview on your own Mac on your home Wi-Fi.
  2. Make a **test-only, default-off** guard change that also accepts exactly one private LAN address, supplied when the dev server starts (for example an environment variable naming the Mac's `192.168.x.x` or `<name>.local`).
  3. Open that address on the iPhone, with the synthetic account only and no real keys. The proof already mocks sign-in and providers.
  4. Remove the allowance afterwards.
- **Not recommended:** a public tunnel (ngrok, Cloudflare Tunnel), deploying the preview, or loosening the guard to accept any host.

## Readiness

Ready for final owner review of the Canvas sidebar. Recommended review order:
1. `sidebar/iphone-default.jpg` and `after-iphone-collapsed-and-menu.jpg`.
2. `desktop-default.jpg`, `after-desktop-row-menu.jpg` and `after-desktop-collapsed.jpg`.
3. Then decide on the physical-iPhone allowance above.

**STOP for owner review. Gate1 remains unapproved.**
