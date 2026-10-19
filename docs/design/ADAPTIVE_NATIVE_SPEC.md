# Lumen Adaptive Native — platform design specification (draft v0.1)

**Current status:** design specification only. Real UI source/screenshots examined in [the baseline audit](ADAPTIVE_NATIVE_BASELINE.md); **no alternate visuals are approved yet and no production CSS/JS changes have been made**.

**Design ambition:** best practically achievable craft and utility for Lumen's actual web architecture: **iOS-native tactility + desktop-workspace precision + Lumen's own Switchboard identity**. Avoid generic AI chatbot mockups. "Best" is a continuous evaluation goal, not a guarantee that software can never improve.

## Design thesis: one identity, purpose-built interfaces

**Identity anchors:** existing Eclipse moon and asymmetrical flare, cool ink/paper surfaces, precise geometric iconography, visible model provenance and lime `--signal` used **for activity/selection/focus**, not decorative fills. The routing capability is a distinctive product feature: signal should tell a useful story (which model was chosen, why, whether rerouting is happening) without becoming a neon status dashboard.

**Differentiation:** don't add empty-states that are pure slogans or oversized decorative icon art. The interface should look premium because the information hierarchy, optical spacing, material engineering, interactions and real functionality are exceptional.

**Platform adaptation is presentation, not data split:** shared React component owners, Zustand state and persistence; device-appropriate layout components and CSS driven by viewport/input modality/capability/user preferences rather than naïve UA-only styling.

### Respect current baseline

- `DESIGN.md` governs the existing brand and original iPhone welcome/composer. Do not replace the brand.
- Actual entry is `src/main.tsx` → `src/app.css` + `src/glass.css`. `src/lib/glass.ts` guards eligible hardware and reduces material on slow devices. Some historical docs mention `workspace.css`/`design.css`, but they are not current entry-point imports.
- Existing product UX and `UX-CONTRACT.md` owners must survive intact; do not replace native controls solely to satisfy aesthetic goals.
- Rejected draft PR #28 and its HTML are examples of what **not** to ship: simplified incomplete mockups detached from real Lumen.

## Interaction quality and visual grammar

### Hierarchy / information architecture

1. **Writing and reading** first: stable comfortable text measure, no repeated panel borders around every answer, obvious message ownership and trustworthy source/error/provenance cues.
2. **Primary action** second: contextual New chat / Send / Open / Save. One primary action per local context, using ink/paper for generic action; lime only when the signal semantics call for it.
3. **Routing context** third: selected model/layout, context/capability/availability, ongoing routing status. Never hide a meaningful capability or manual override for a cleaner screenshot.
4. **Power features** fourth: tools, GitHub, Canvas, Study, projects, search, exports, history. These need discoverable and elegant homes, not removal or new duplicate navigation bars.
5. **System state** always perceptible: loading, partial, quota, offline, errors, consent, disabled, focus, undo.

### Typographic system (candidates, verify against real screenshots)

| Layer | Desktop proposal | iOS proposal | Guardrails |
|---|---|---|---|
| UI family | Geist Variable locally installed | existing OS/SF preference for glass-eligible iOS | don't add network font dependency |
| Technical/model IDs | Geist Mono | monospaced system fallback or Geist Mono | never truncate the *only* distinguishing part of a model |
| Reading | 15–16px, line-height 1.55–1.7 | 16px where input/focus zoom and dynamic type call for it | user's 14/15/17 text-size setting remains authoritative |
| Page title | 20–24px, semibold, precise tracking | 18–22px compact / contextual large title in hubs | avoid giant welcome slogans and text overflow |
| Meta | 12–13px, semantically muted | 12–13px where readability/contrast passes | meaningful status never only color |
| Keyboard hint | 11–12px mono or calm label | avoid nonnative keyboard shortcut clutter | hide only nonessential hints |

### Material system

- **Persistent layout**: solid or opaque cool neutral surfaces separated by tone and a single hairline border. Depth follows overlay hierarchy.
- **Floating UI**: composer, sheets, popovers and dialogs can use a careful contact shadow and, when supported, a real material with enough opacity for readable foreground text.
- **iOS selective glass**: keep the existing animated glass mode, but the sheet/content pair must guarantee foreground legibility over *actual conversation imagery and text*. Use solid/strong material behind lists and translucent edges/bars only where useful.
- **Desktop**: high-quality solid surfaces; avoid forcing iOS translucent widgets or macOS traffic-light chrome into browser UI. Precise borders and restrained shadows, responsive hover/focus states.
- **True black**: pure canvas black with perceptible layer separation and restrained glows; don't let surfaces disappear into each other.
- **Lime signal**: reserved send when ready, Auto/routing marker, deliberate active state, keyboard focus when contrast passes, logo. No green large cards, no glow behind every control.

### Spacing and form

- Base spacing ramp **4/8/12/16/20/24/32/40** CSS px, refined optically after screenshot comparison. Keep existing compact geometry as a source constraint.
- Shape grammar follows existing `DESIGN.md`: fields/buttons about 8px, cards/groups 12–14px, composer 16px desktop/20px phone, chips pill. Tune per-platform without random one-off radii.
- Minimum meaningful touch targets 44×44 CSS px on phone where physically possible; focus ring visibly distinct; avoid invisible-icon buttons.
- Icons use the existing lucide set and stable stroke/optical sizing, not a mixture of emoji, icon fonts and screenshots.
- Content width around 700–760px for prose as a starting hypothesis, adapted to code/tables/split editors. Text should never be edge-to-edge on wide desktop.
- Before any token change inspect **computed winning selectors** in the existing ~347 KB monolithic CSS; refactor under behavior tests rather than dumping a second stylesheet of overrides.

## iOS / iPadOS: native-quality workflow

**Design goal:** native-feeling, legible, fluid, expressive **without gratuitous iOS cosplay**.

**New-chat welcome:**
- Keep actual Eclipse moon and three sparks; preserve current greeting rhythm, mid-screen visual calm, usable bottom composer and keyboard behavior.
- Make optical hierarchy feel intentional rather than inserting inspirational slogans, promo tiles or fake onboarding cards.
- Keep status/privacy/incognito controls in their legitimate header states.

**Conversation:**
- A light structural top bar with drawer or back, readable title, contextual actions only when relevant. Use system-safe insets.
- Content is the experience: assistant responses need beautiful paragraph rhythm, code/table readability and clear citation attachments. User messages stay recognizably user-owned.
- Under-response actions remain findable; long press/Copy/Retry/Why this model retain exact behavior. Streaming state appears without repeated dancing skeletons.
- One composer surface remains anchored to visual viewport and keyboard. Avoid double-offset when keyboard opens, layout jumps on attachment chips, or obscured final message.

**Sheets, pickers and overlays:**
- `+` menu: Camera/Photos and tools retain their actual actions and disclosure; dense lists should be legible even when a bold greeting or colored picture is behind them. Fix overlap **only after browser reproduction**; keep ability to drag and dismiss without hijacking underlying chat.
- ModelPicker: real availability/metadata and Auto/manual/layout behaviors unchanged. If two columns at 320px conceal card content, test and solve with responsive layout or clear reachable scroll affordance; do not drop choices.
- Hubs: retain `HubPage` meaningful hierarchy, existing contextual create actions and their phone tab gesture contract. Glass lenses follow finger only where supported; reduced-transparency and motion variations maintain equivalent behavior.
- Native-like keyboard: font ≥16px in text inputs; voice/IME/dictation, text selection and safe-area/reduced preferences all verified. Investigate existing global zoom prevention independently, don't sneak behavior changes into palette work.

**Touch-motion language:**
- Interaction progress tracks the finger where actual drag is supported. Reversible interruptions, no competing animations and no hidden duplicated interactive surfaces.
- Use one subdued settling spring for gesture-linked motion and short ~140–220ms exits/entries for ordinary navigation, subject to measured results. Reduced-motion alternative static.
- For translucent content, test dark/tinted/colored content behind layers, especially with model picker and Add sheet fully open and half dragged.

**Platform constraints:** WebKit-on-Linux verifies layout/engine behavior but *does not prove physical iPhone haptics, real dynamic blur or input-latency quality*. Mark physical-device acceptance as outstanding until actually performed.

## Desktop: precision and capability

**Design goal:** an excellent professional workspace: calm when writing, dense when inspecting, quick under a keyboard.

**Sidebar and primary shell:**
- Improve existing approx 272px sidebar, clear nested Project/Recents hierarchy, compact search and selected-chat signal line. Do not create a redundant global toolbar/sidebar rail with duplicated controls.
- At small desktop widths make navigation adaptive, favoring minimum reading width over permanent chrome; route ownership unchanged.
- Establish deliberate rhythm between sidebar navigation, content header and reading column. Use responsive line length and rich content measures for code/Canvas and Compare.
- Empty new chat needs sculpted spatial balance, not added filler or giant visual treatments.

**Desktop productivity:**
- Existing shortcuts and command palette, keyboard selection/escape/return focus, model search, command labels, scroll ownership and drag-drop preserved and polished.
- Popovers are anchored to their invoking controls; menus need stable arrow/focus origin and sensible maximum heights. Desktop dialogs shouldn't take over full viewport for 2 actions.
- Chat model status should be factual and comprehensible with a tap/click to more detail. Quota/fallback warnings shouldn't be visually hidden.

**Projects, Canvas, Library, Tools, Study, Compare:**
- `HubPage` supplies consistent top hierarchy, but each feature gets information density suited to its job. Libraries use thumbnails when actual content exists; Projects expose file/instruction context; coding tools support side-by-side; Study/Compare preserve their own controls and statuses.
- Complex forms in Settings/API keys/Model Picker use clear groups and valid error states, not a monolithic wall of generic cards.
- Top-bar title and project context adapt to narrow windows and split views, never burying active task identity.

## Android and other browser layouts

- Respect Android's back button, IME, safe areas, touch targets, system text scaling and reduced-motion preferences; use standard CSS/material choices rather than mechanically emulating Apple.
- Tablet is not just stretched phone: navigation and content adapt to available width; test 768, 899, 1024 and portrait/landscape breakpoints.
- Desktop remains excellent with touch laptops and mobile browsers with reduced capabilities. Use feature detection and coherent fallback, not UA-specific CSS everywhere.

## Visual decisions by exact first screen (must prototype from real app)

| Surface | Baseline evidence | Approved design exploration | Nonnegotiable functional preservation |
|---|---|---|---|
| 390 dark welcome | `layout-webkit-390-dark-home.png` | refine moon/greeting visual rhythm and composer material **without repositioning entire experience** | model selector, voice, `+`, send, incognito, accessibility |
| 1280 light welcome | `layout-webkit-1280-light-home.png` | editorial proportion, crisp sidebar and reading column; not another generic chat template | project/search/new chat, settings, full canvas |
| 390 dark Add sheet | `layout-webkit-390-dark-plus.png` | improve contrast/compositing and group hierarchy over underlying content | Camera/Photos/files/web/search/project/GitHub/Tools, gesture dismissal |
| 320 light model picker | `layout-webkit-320-light-keyboard-model.png` | responsive arrangement, readable full labels, trustworthy choice state | Auto, layouts, eligible/manual models, keyboard, account scope |
| 430 true black | `layout-webkit-430-black-home.png` | deliberate material layers with no excessive glow/low-contrast UI | theme fidelity, OLED-black screen, entire toolset |
| Desktop action menu | `layout-webkit-1280-light-plus.png` | consistent anchored menu typography/dividers/hover | every action, focus/cancel hierarchy |
| Settings/Projects/Tools/Library | present in product and UI source, screenshots still needed in this audit | design each actual filled/empty/error state after captures | feature parity including destructive actions and consent |

## Visual prototype quality bar — prevent another rejected "5 minute" design

1. **Real app, real controls:** propose changes by modifying actual existing component screens on an isolated branch, not drawing a totally new toy chat page. Every screenshot must show the recognizable Lumen elements and state.
2. **Minimum high-fidelity review set:** iOS welcome+conversation+Add sheet+model picker, desktop welcome+conversation+sidebar/command+one feature hub, Android/tablet notes, each in light/dark/black as appropriate.
3. **Matched before/after screenshots:** identical dimensions, theme, fixture, feature state; brand and controls accounted for. Include close-up at native pixel scale (not only a downsized montage).
4. **Design detail inspection:** 1px alignment/optical spacing, real typographic hierarchy, hover/focus/press/disabled, long labels, empty/error, field focus and modal layering. No false realism from a decorative mock.
5. **Design review gate:** user must affirm that the proposal is an aesthetic improvement on the existing app. User rejection returns the phase to concept without merging speculative UI.
6. **Functional verification:** existing CI + targeted Chromium/WebKit screenshot and behavioral suites; for iOS-sensitive touch/keyboard also physical iPhone review when possible. Don't weaken assertions or modify behavior without need.
7. **Performance and accessibility:** WCAG 2.2 AA oriented contrast/text reflow/focus/touch checks (not certification from visual glance), no extra network fonts/effects, measure dynamic material and motion performance rather than assuming.
8. **Safe progressive deployment:** independently ready, user-reviewed milestone → verified PR → merge to `main` → actual Firebase preview check → production when accepted. Record exact SHA, no forced merges/deploying a stale build.

## Priority order

**P0 — trust and platform polish:** modal/sheet foreground legibility, 320 picker reachability, keyboard and zoom accessibility investigation. Scope not yet approved as runtime defects: reproduce first.

**P1 — craft the flagship experience:** preserve but elevate iPhone new chat / ongoing chat and desktop sidebar/new chat. Test human aesthetic acceptance before touching smaller screens.

**P2 — consistent high-quality tool workspaces:** Tools, Projects, Library, Settings, Canvas, Study, Compare and every state. Preserve information density; never flatten them into generic cards.

**P3 — motion and performance finesse:** only after geometry, contrast, focus and behavior are sound. Never use animation to distract from mediocre composition.

## Decision status and next act

Direction **approved** at strategy level: Lumen Adaptive Native. Specific visual implementation **not approved**. Next: complete baseline screenshot capture across feature surfaces (existing manual Safari workflow), create **first isolated real-app iOS proof** addressing one P0 observation, run screenshots and test focus/gestures, collect user aesthetic review. Then do desktop proof in parallel/next independently releasable branch. Do not treat concept approval as blanket approval for a full UI replacement.
