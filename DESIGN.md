# Lumen design: "Switchboard"

Lumen is a switchboard for free AI models: one place to talk, and the app routes each message to
the right model. The design says that: calm ink-and-paper neutrals, and one **signal colour** that lights
up wherever something is live, like the status light on a router.

It is its own app. Don't copy another product's look (no serif "greeting" headings, no terracotta/orange
accent, no warm-brown dark mode, no ghost icon). When in doubt, remove.

## Mark
- **Ordinary build:** the **Eclipse**, a dark moon ringed by lime light with one white flare (src/components/Logo.tsx, public/icon.svg; PNGs rendered from the same drawing). It is always a dark tile, in every theme.
- **Canvas build:** **Crease** (owner-approved 2026-10-23). The integrated Crease-as-L wordmark appears in the sidebar and drawer head and the shared header. The standalone mark appears in the collapsed bar, and as the app icon on sign-in, home screen, favicon and launch screens. It's drawn by `scripts/brand-crease.mjs` into `brand/crease/`, `public-canvas/` and `src/lib/brand-crease-art.ts`; components are in `src/components/BrandCrease.tsx` (through the Canvas "on" module). Rules are in `brand/crease/README.md`. Brand placements are `role="img"` labelled "Lumen"; ordinary text stays text.

The Canvas foundation (type, colour, radii, lamplight selection, brand-to-interface rules) is written up in `docs/brand/DESIGN_FOUNDATION.md`. Where the sections below talk about lime "signal", that is the ordinary build; Canvas maps it to ink.

## Tokens (the Identity section of src/app.css is the source of truth)

| Role | Light | Dark | True black |
|---|---|---|---|
| Page `--bg` | `#f6f7f9` | `#0d0f12` | `#000` |
| Panels `--surface` | `#fff` | `#15181c` | `#0b0c0e` |
| Sidebar `--sidebar` | `#eef0f3` | `#0a0c0e` | `#000` |
| Text `--text / -2 / -3` | `#0e1116` / `#4a5260` / `#636b78` | `#eceef1` / `#a9b1bb` / `#8b939d` | `#eef0f2` / `#adb3ba` / `#8d939a` |
| Lines `--border` | `#e1e4e9` | `#22272e` | `#1c1f23` |
| Primary buttons `--accent` | ink `#0e1116` | paper `#eceef1` | paper |
| **Signal** `--signal` | lime `#c2ef3a` with ink text `--signal-ink` | same | same |
| Signal as text/icon `--signal-strong` | `#3f6a00` (readable on white) | `#c2ef3a` | `#c2ef3a` |

Neutrals are cool (slightly blue-grey), never warm. Status colours (green/red/orange/blue) keep their
meanings from the Base section of src/app.css.

### The signal colour is only for "live" things
- the Send button, the Auto option and the active model dot in the message box
- the dot before each reply's model name, and the routing chip in the top bar of a new chat
- the bar beside the open chat in the sidebar, switches that are on, keyboard focus
- the output node of the logo, and the three sparkles on a new chat

Never use it for large areas, body text on white, or decoration.

## Type
- **Geist** for everything; **Geist Mono** for code, file paths and *model names* (they read like routes:
  `● Gemini Flash · Auto: quick reply`).
- Body 15px (14/17 with the text-size setting). Fields are 16px+ on touch screens (no iPhone zoom).
- Headings are semibold with slight negative tracking. Welcome heading 26–36px, weight 650.
- Section labels in the sidebar are sentence case ("Projects", "Recents", "Today"), not uppercase.

## Shape & depth
- Corners: buttons/fields 8px, cards/menus 12–14px, message box 16px (20px on phones), chips are pills.
- User messages: `16px 16px 4px 16px` (the "tail" corner points at the sender).
- Depth comes from tone and 1px lines; shadows only on floating things (message box, menus, dialogs).

## Layout and what goes where (one place for each thing)
- **Sidebar**: logo + name · primary **New chat** · search · **Library** (photos, attached files, canvas documents, generated files and searchable documents) · **Tools** (actions and assistants) · Projects (+ New project chip on the heading row) · Recents (phones: New chat floats bottom-right) · View all chats (select several → Move, Export, Delete) · account. Chips are small outlined pills.
- **Top bar**: chat title, project pill, repository toggle, canvas. On a new chat the title spot stays quiet; incognito retains its `Incognito · not saved` indicator. Model selection lives in the composer; routing status appears only while a request runs. Incognito
  (eye-off) only on a new chat or while incognito.
- **Welcome**: the lime moon and one short greeting. Keep the original centered phone welcome and its spacing. Empty history uses quiet text, without a repeated illustration.
- **Canvas navigation (Phase 2)**: pages shown in place of the chat (Library, Tools, Projects, Study, Assistants, Routing Center) add one browser-history entry, so Back returns to the chat; closing returns focus to the control that opened the page (phones: the drawer button). A collapsed sidebar on computers becomes a 60px rail: mark, expand, New chat, search, Library, Tools, Projects, Models & routing and the account. The Routing Center uses the same bar as the other hubs.
- **Sidebar footer**: the avatar opens Settings. On phones New chat sits at the bottom right of the footer.
- **Hub headers**: keep the sidebar button at the top left in Tools, Library and Projects. Contextual creation gets a separate + beside it; Done returns to chat. Each active hub owns the main landmark and one exposed page heading, including the compact glass title.
- **Tool cards**: actionable cards open their setup. Compare models opens the shared comparison dialog with an editable question, preserving the current draft and attachments; only Compare sends requests. Writing tools is contextual guidance for selecting reply text, rather than a launch button.
- **Message box**: `+` menu · model chip · active chips (Web search, Project) · context ring · Dictate · Send (or labelled Voice conversation when empty). Desktop voice controls have visible labels; phones keep the compact icon controls in the original single row.
  The context ring stays a quiet circle until the chat is half full.
- **`+` menu** (one level): Files and images, Web search (switch), Project, GitHub repository; *Tools*:
  Document canvas, Data analysis, Compare models. Phones add big Camera/Photos buttons. Settings
  (memory, connectors, privacy) live in Settings, not here.
- **While a reply loads**: one line — `● Routing → model`, then what it's doing (Searching the web, Reading
  your files…), then elapsed seconds after 8 s.
- **Routing controls**: Settings → Models owns balanced/quality/speed/cost priority. The current prompt can override a saved priority. A compatible manual choice remains fixed; disabling automatic switching blocks substitutions for incompatible choices too. Auto exclusions are hard constraints. Missing price/context metadata stays unknown, and refresh preserves saved choices and open edits.
- **Under a reply**: model name (on Auto replies it opens "Why this model"), Copy, Regenerate, Retry with…, and `⋯` for Read aloud, Share,
  Save as Word, Edit in canvas, Select text.

## Rules
- Before adding a control, check it doesn't already exist somewhere else. If it does, don't add it.
- Touch targets are 44px on phones; nothing scrolls sideways at 320px (tests/e2e/fit.cjs checks this).
- Keep visible focus (2px `--focus` outline).
- Zoom is off on phones (pinch blocked in src/main.tsx, double-tap via `touch-action`, 16px fields);
  don't add `user-scalable=no` to the viewport tag (accessibility tools flag it).
- Filtering a list: search box plus one **filter dropdown** (`src/components/FilterMenu.tsx`: a "▾" button with
  counts that turns lime while filtering). Use it where a list needs narrowing (API keys, Browse models,
  Library); use tabs only for switching between different sections.
- All styles live in **src/app.css**, read top to bottom; later sections win. Put new colours and look
  rules at the end of the Identity section. Don't reuse a generic class name like `.empty` for a small
  part (it collided with the welcome screen once).
- SVG animations: animate an inner element, never one that carries a `transform` attribute (the
  animation replaces it; the stars once collapsed to a dot on iPhone).
- Check designs with `tests/e2e/helpers/` screenshot scripts (`shots`, `settings-shots`,
  `project-shots`, `more-shots`) and `textfit.cjs` (text spilling out of its box). `BROWSER=webkit`
  runs them in Safari's engine; the manual "Safari visual check" workflow does this on GitHub.

## Motion rhythm

Controls press inward by 1.5–3.5% and release with one short spring in solid and glass appearances; scrolling their own container or cancelling input clears feedback. Reduced motion keeps controls stationary. Hub navigation uses a connected push/pop on phones and a short crossfade on desktop, with only one outgoing, inert surface during interrupted navigation. Canvas arrives as an adjacent panel. Bottom sheets track the finger and backdrop together, return safely after cancellation, and respect reduced motion when settling. Preserve the existing phone welcome and compact voice controls.

Only replies appended to an open conversation receive a 220ms entrance; opening history and remounting virtual rows never replay it. New streaming text fades from readable opacity over 240ms without restarting existing paragraphs. Auto selection adds one 520ms lime ring per model choice, retained through elapsed-time updates; reduced motion keeps the signal still. Floating panels use `--layer-shadow` for a soft contact edge and cast shadow in each appearance; the composer and tab-bar materials keep their existing treatment.

### Attachment continuity

Loaded composer photos open the existing pinch/zoom viewer from their thumbnail. Previewable text attachments and generated file cards expand into the existing file preview and return to their current on-screen source when closed; missing/offscreen sources use a short fade. Closing during entry cancels the entrance cleanly, and reduced motion skips spatial animation.

Attachment chips arrive and reflow over 240ms, retaining their current visual position during interrupted changes. The tray settles its own height, ignores horizontal scroll when computing movement, and leaves no empty gap after the final removal. Only explicit Remove actions leave brief inert exit copies; switching chats/accounts removes all previous-scope attachment UI immediately. Keep the phone keyboard, welcome and input layout unchanged.

### Animated artwork

The existing eclipse/logo and welcome moon carry one orbiting light with a fading trail and one slow flare per eight-second orbit. Keep the existing welcome geometry, greeting and mark.

Pause decorative CSS and native SVG timelines when offscreen, when the document is hidden, or while Reduce Motion is enabled. Reduce Motion shows the static mark. Observers, preference listeners belong to their mounted surface and clean up on chat/account/navigation changes. Use no external artwork, network calls or animation dependency.

## Phone tab bar gestures
The iPhone glass bars in Tools and Library support pressing and sliding across tabs. The lens follows the finger continuously and gently enlarges the real tab content in place over a translucent, backdrop-blurred surface; release selects the previewed tab. Keep every icon anchored and visible, with only the candidate coloured during a drag. Do not move a duplicated icon inside the lens. Respect reduced motion and reduced transparency preferences. Release outside the bar, a cancelled gesture or lost pointer capture restores the current tab. Tab gestures do not start page swipe-back. Ordinary taps and keyboard activation stay available.

## Chat context menus

A held chat’s menu owns the remainder of that touch, so moving the finger cannot drag the sidebar underneath it. Dismissing the menu leaves the drawer open and usable. Held and ellipsis chat menus share one rounded highlight: sliding previews an action, release chooses only the current action, and leaving the menu or cancelling the touch chooses nothing. Long option lists remain reachable by edge scrolling; touch does not draw a keyboard focus box, while keyboard navigation keeps visible focus. Chat options omit Study and tag editing; Study stays in Tools. Chat tags have no badges or search behavior; existing stored metadata remains compatible.

## Selection boundaries

App chrome, blank page space and body-mounted portal titles inherit selection suppression from html/body. Desktop message content and editors keep native selection. On touch screens, message bodies use the existing Select text reading surface. Code, readable errors/thinking, that reading surface and real inputs retain their existing native selection and copy. Lifted context-menu copies always suppress selection. Keep gesture handling, zoom and focus behavior unchanged.

## Model layout building

Reuse the existing Modal, fields, status and save/cancel flow. Rank only models meeting every requested capability and explicit context minimum; show honest empty results when none fit. Keep available models ahead of temporarily blocked ones and retain provider-diverse backups. Rechecking preserves the name and unchecked choices; stale account/connection results cannot be saved. Explanations describe model-family hints and observed behavior, not benchmark scores or guaranteed answer quality.

Removed recommended layouts stay hidden. Omit the bulk restore control and its empty-state hint; New layout and Build for a task remain available.

## Provider-error feedback

Chat and Browse models use the shared CatalogErrorNotice with an accessible close button and a 44px touch target. Dismissal lasts across navigation for the current error; it does not clear the failure needed for reconnect recovery. A fresh catalogue result resets dismissal, and account changes clear the previous account's feedback.
