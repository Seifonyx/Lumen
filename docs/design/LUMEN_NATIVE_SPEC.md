# Lumen Native — visual and interaction specification v1

**State:** initial design proposal, **not active production styling**. User-approved direction: **Refined Lumen Native** (2026-10-19). Approval of this *specific visual concept* and live implementation is still pending. Companion documents: [execution plan](LUMEN_NATIVE_PLAN.md) and [screen concepts](LUMEN_NATIVE_CONCEPTS.md).

## North star

**"Quiet workspace, luminous intelligence."** Lumen should feel designed for long, focused work: unhurried layout, readable content, native-feeling interactions and subtle confidence. As a browser-based app it must respect iOS/Android/macOS/Windows conventions while retaining a consistent cross-platform brand. Think *precision, tactility and calm*, not imitation, novelty animations or glass everywhere.

Three principles:
1. **Content first:** writing and answers carry the hierarchy; chrome gives context without asking for attention.
2. **One clear control owner:** no duplicate model choosers, menus, project switchers, hidden gestures or competing action rows. Reuse canonical component boundaries in UX-CONTRACT.md.
3. **Depth by purpose:** material/shadow only where a layer floats above content; outlines and tone separate persistent panes. Lime marks *active/routing/ready/focus* states, never decorative background blocks.

**Brand invariants:** Eclipse mark from `src/components/Logo.tsx` and `public/icon.svg` (dark tile in every theme), cool-neutrals, Geist/Geist Mono on general browser UI, `--signal #c2ef3a`, no orange/terracotta accent, no borrowed product-specific motifs, the original compact centered phone welcome and single-row mobile composer behavior. Preserve light, dark and true-black modes and accessibility.

## Visual language and semantic tokens

These are **design intentions**, not a request to paste duplicated CSS token declarations. Existing `src/app.css` Identity tokens are authoritative. `src/glass.css` owns conditional iOS material, `src/lib/glass.ts` owns performance/feature fallback. First implementation PR must document effective cascade/overrides and modify canonical definitions only.

| Semantic role | Light proposal | Dark proposal | True-black proposal | Usage and notes |
|---|---|---|---|---|
| Workspace `--bg` | `#f6f7f9` | `#0d0f12` | `#000000` | uninterrupted app canvas, not floating cards |
| Primary surface `--surface` | `#ffffff` | `#15181c` | `#0b0c0e` | chat/composer/modal interiors |
| Navigation `--sidebar` | `#eef0f3` | `#0a0c0e` | `#000000` | spatial separation by tone |
| Primary text | `#0e1116` | `#eceef1` | `#eef0f2` | body/headings |
| Secondary text | `#4a5260` | `#a9b1bb` | `#adb3ba` | descriptions, metadata |
| Tertiary text | `#636b78` | `#8b939d` | `#8d939a` | only where legible at intended size; verify contrast |
| Dividers | `#e1e4e9` | `#22272e` | `#1c1f23` | 1px edge, not around every grouping |
| Signal | `#c2ef3a` | `#c2ef3a` | `#c2ef3a` | send, active Auto/routing marker, focus where contrast passes |
| Signal text / ink | `#3f6a00` | `#c2ef3a` | `#c2ef3a` | never raw lime text on white |
| Input border | current `--input-border` | current | current | increase contrast on hover/focus, do not double-outline |
| Status colors | existing semantic success/warning/danger | existing | existing | never make all statuses lime |

**Token decision:** use existing palette first; any changed swatches require measured contrast and screenshots across *all* appearances. The live color values may differ because `app.css` is long and contains layered historical overrides; inspect computed tokens before adopting this table. Do not invent a new color taxonomy on top of old selectors.

### Spacing, shape and elevation

- Use a practical spacing rhythm **4 / 8 / 12 / 16 / 24 / 32 / 40** CSS px, with optical adjustment for glyph alignment rather than arbitrary one-off offsets.
- Field/action radius **8px**; group/card/menu **12–14px**; composer **16px desktop / 20px touch**, as already defined in DESIGN.md; pills rounded fully. Avoid rounding every container to the same large radius.
- Maintain a consistent icon system with `lucide-react`: base 18–20px, minor 16px, touch button hit area ≥44×44px where applicable. Stroke weight approximately 1.75; center icons optically. Don't replace meaningful native controls with nonsemantic divs.
- **No global cardification**: groups of navigation links can share a quiet backdrop; main reading flow should not be boxed into cards. Shadows reserved for composer float, dialogs, contextual menus, popovers, and sheets. Two depths max for routine tasks.
- Borders 1px and subtle; floating surfaces can have one contact shadow. Avoid gradient borders around ordinary content or translucent material under dense text.

### Type and content

- General browsers: local **Geist Variable**; model IDs, code and paths: **Geist Mono**. iOS's proven glass mode may use system/SF font as already implemented in `glass.css`. No network font requirement.
- Main reading body **15px / line-height about 1.6**; user text-size choices (14/15/17px) remain functional. Explanatory label **13–14px**, page title **20–24px**, new chat greeting **26–36px** semibold, exact value responsive.
- Desktop reading measure approx **min(100% − 48px, 760px)** (tune during baseline); avoid long edge-to-edge message paragraphs. Replies need breathing room, stable code block sizing and visible content selection.
- Hierarchy: meaningful page titles, semibold labels and generous group spacing. Keep tiny uppercase metadata exceptional. Error texts and helper copy must wrap.
- Any input on touch uses font-size ≥16px, allowing OS font scaling where feasible; long filenames, Arabic/right-to-left strings, model IDs and selected text must not overflow.

## Screen contracts — desktop

### App shell and navigation

- A stable sidebar at the repo's existing approximate **272px** width (not an invented permanent navigation rail), adjustable by responsive breakpoints where appropriate. Eclipse/logo and app name at top, primary New chat, search, Library, Tools, Projects, Recents and account settings. Preserve active-chat narrow signal bar and real navigation actions.
- Main top bar has title/project context and any existing repository/Canvas/incognito controls only in their legitimate states. Use 1px divider or tone separation rather than heavy header shadow.
- On initial/new chat, render one centered greeting with the Eclipse moon and restrained three sparkles. No marketing hero, large decorative gradients, or duplicate suggestions.
- Composer remains the action focus near the bottom: one pleasant elevated surface with open writing space, bottom utility row for attachments/model/context/voice and a single highly visible send button; keep canonical model selection and existing + menu. No new "Auto" control outside the picker.
- Conversation: human content aligned to existing user bubble convention; assistant replies in readable open rows. Use muted row metadata, subtle small active model indicator and uncluttered action affordances; preserve Copy/Regenerate/Retry/overflow, streaming and partial-output state.
- Response states: one calm routing line `● Routing → model` with meaningful status, discreet elapsed time after 8s; no repeated animated AI loaders competing with content.
- Keyboard: Cmd/Ctrl+K, Escape hierarchy, focus restoration, message navigation and selection must remain correct.

### Tablet 768–1023px

- Reclaim reading width; sidebar may overlay rather than permanently squeeze conversation below sensible measure. Preserve project context, composer actions and canvas's side-by-side constraints.
- Avoid card layouts with two awkwardly narrow columns. Prefer one rich column or adaptive grids that wrap content without overflow.
- If app currently uses 899px as a mobile/glass threshold, do not introduce inconsistent breakpoints without testing both sides of 899px.

## Screen contracts — phones / native behavior

- At **320, 375 and 390px** viewports the original welcome and compact composer remain visibly centered, with comfortable safe-area insets and no horizontal scroll.
- Top bar: one reliable drawer/back control, short contextual title, trailing contextual action only if relevant. No three independent bars or floating nav controls obscuring the conversation.
- Bottom input: preserve native keyboard insets and prevent keyboard activation on mere navigation. Long draft expands within bounded height and stays accessible while the OS keyboard is open; attachments and context chips wrap safely.
- Files, context and other secondary actions open the **existing contextual sheet**; tap outside, swipe-dismiss, Escape, focus restoration and safe-area behavior remain predictable.
- HubPage phone tabs preserve existing anchored icons, swipe/lens interaction only on supported glass devices, fallback to solid system-like tabs elsewhere. Native-feeling ≠ force iPhone design onto Android/Windows.
- One-handed use: primary actions in comfortable reach, ≥44px targets, prevent accidental swipe actions, keep scroll position when switching chats, respect reduced transparency and reduced motion.
- Accessibility decision to investigate: `PRODUCT.md` requests native pinch zoom but `main.tsx` intercepts gestures and root CSS constrains touch. Present the tradeoff, test VoiceOver/Android zoom and gesture conflicts, and implement a safely reviewed fix before closing LN06.

## Interaction & motion system

| Event | Proposed feel | Safety requirements |
|---|---|---|
| Press | tactile ~1.5–3.5% inward, immediate feedback, subtle release | never lose original pointer target when React rerenders (ToolsPage regression contract) |
| Open sheet/menu | 160–220ms fade/translate or restrained spring | focus trap, correct Escape, predictable cancel |
| Change main hub | very short connected transition | no duplicate interactive overlays or lost composer drafts |
| Append reply | restrained ~220ms entrance, not replayed for historical rows | scrolling respects user's reading position |
| Stream tokens | readable incremental content, subtle ~240ms new-text fade | no animation of entire paragraphs on each delta |
| Auto reroute | one restrained lime ring upon model decision | not repeated on clock tick |
| Visual orbit | existing Eclipse movement only where appropriate | pause when hidden/offscreen; static reduced-motion alternative |

These are starting motion budgets, not untested hard deadlines. Use existing `src/lib/motion.ts`, `src/lib/press.ts`, `src/lib/glass.ts`, `src/lib/visual-activity.ts` before adding new animation abstraction. Prefer compositor-friendly transforms/opacity; document performance evidence on low-end devices and in Chromium/WebKit.

## Component visual contracts

| Component owner | Design treatment | Behavioral invariants |
|---|---|---|
| `Sidebar` | calm stacked navigation, selected item one quiet tone + lime edge, clear section rhythm | project/chat search, context menus, drag/swipe, account menu |
| `ChatView` | generous content width, small contextual header, meaningful loading state | scroll anchoring, long conversation virtualization, focus, history |
| `Composer` | single distinct elevated writing surface and bottom action row | draft/attachments/voice/send/stop/Auto privacy/keyboard |
| `ModelPicker` | searchable model list with readable provenance/status, clear selection | source eligibility, Auto exclusions, manual consent, focus restoration |
| `HubPage` | shared page title, search, contextual create, consistent empty/detail surfaces | Tools/Library/Projects navigation ownership, phone tab gestures |
| `SettingsModal` | grouped form sections with generous label/hint spacing | provider consent, credential privacy, existing row controls and dirty state |
| `CanvasPanel`, Compare, Study | focused split/content panels, shared menus and status styles | side effects/undo/retry/source isolation and context boundaries |
| `Toasts` & dialogs | neutral elevation and status-specific cues, compact content | accessible announcements, Undo, warnings and exit focus |

## Accessibility and performance gates

1. **Visual:** WCAG AA text contrast ≥4.5:1 (large text ≥3:1) and non-text control indication ≥3:1 where applicable; don't use color alone. Test each token in its actual background context.
2. **Responsive:** no horizontal body overflow at 320/375/390px; 200% zoom reflow, Arabic/RTL and long model/file names; desktop at 1024/1440 and tablet around 768/899px threshold.
3. **Interaction:** semantic buttons/forms, visible 2px focus, logical tab order, roles/labels, keyboard/ESC, dialog focus restoration, stable pressed elements, pointer cancellation.
4. **Reduced preferences:** `prefers-reduced-motion` and `prefers-reduced-transparency` meaningful alternatives; no loss of information in non-glass fallback.
5. **Performance:** no material render, memory, or Core Web Vitals regression; profile scroll/input, heavy backgrounds and stream updates; no extra paid inference or unsafe user data in visual tests.
6. **State:** all layout/model/account/project/draft data remains identical before/after cosmetic changes, including offline/reload/account switching, incognito, streaming cancellation and accessibility preferences.

## Decision and review rules

- This specification is **Concept v1**. Approve or revise mockups first; do not edit live app CSS during this PR.
- Use before/after captures from **real app** as the next evidence gate; the standalone HTML concept is a design illustration and does **not** use Lumen's actual components, routing or data.
- First runtime changes should be narrow, reversible and visually testable. Do not touch monolithic `app.css` indiscriminately; trace the Identity section and winning override selectors. Preserve glass fallback.
- Under the progressive deployment policy, only independently production-ready reviewed batches go to `main` and live; attach exact tests, hashes, screenshots and rollback.
