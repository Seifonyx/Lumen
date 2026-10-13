---
name: Model Router
description: A quiet private AI conversation workspace with useful project context.
colors:
  light-bg: "#fcfcfb"
  light-surface: "#fff"
  light-sidebar: "#f3f3f1"
  light-surface-2: "#f4f4f2"
  light-surface-3: "#e9e9e6"
  light-text: "#242624"
  light-text-2: "#626660"
  light-text-3: "#686d65"
  light-border: "#e7e8e4"
  light-border-strong: "#d5d8d1"
  light-input-border: "#d9dcd5"
  light-accent: "#365b49"
  light-accent-hover: "#284735"
  light-accent-soft: "#eaf0eb"
  light-accent-text: "#fff"
  light-user-bubble: "#efefed"
  light-code-bg: "#f4f4f2"
  light-focus: "#366e50"
  dark-bg: "#171715"
  dark-surface: "#232321"
  dark-sidebar: "#121210"
  dark-surface-2: "#2b2b29"
  dark-surface-3: "#343432"
  dark-text: "#f0f1ed"
  dark-text-2: "#b8bdb3"
  dark-text-3: "#a0a898"
  dark-border: "#33332f"
  dark-border-strong: "#4a4a45"
  dark-input-border: "#484842"
  dark-accent: "#ce714e"
  dark-accent-hover: "#df8866"
  dark-accent-soft: "#27201c"
  dark-accent-text: "#171715"
  dark-user-bubble: "#32362f"
  dark-code-bg: "#191c18"
  dark-focus: "#e18e69"
  black-bg: "#000"
  black-sidebar: "#000"
  black-surface: "#0c0c0c"
  black-surface-2: "#171717"
  black-surface-3: "#252525"
  black-border: "#282828"
  black-border-strong: "#414141"
  black-input-border: "#393939"
  black-text: "#f2f2ef"
  black-text-2: "#bcbcb7"
  black-text-3: "#a0a09a"
  black-user-bubble: "#1b1b1b"
  black-code-bg: "#080808"
typography:
  body:
    fontFamily: "Geist Variable, Noto Sans Arabic, Geeza Pro, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "15px"
    lineHeight: 1.6
  project-title:
    fontFamily: "Geist Variable, Noto Sans Arabic, Geeza Pro, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(26px, 2.6vw, 34px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-.03em"
  welcome-title:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "clamp(26px, 3.4vw, 44px)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-.04em"
  welcome-title-phone:
    fontFamily: "Georgia, Times New Roman, serif"
    fontSize: "clamp(27px, 7vw, 38px)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-.04em"
  navigation:
    fontFamily: "Geist Variable, Noto Sans Arabic, Geeza Pro, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "13px"
  instructions:
    fontFamily: "Geist Variable, Noto Sans Arabic, Geeza Pro, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  mono:
    fontFamily: "Geist Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace"
rounded:
  button: "10px"
  field: "10px"
  panel: "12px"
  composer: "20px"
  composer-phone: "24px"
  modal: "20px"
  bubble: "22px"
  pill: "999px"
spacing:
  compact: "8px"
  navigation-inline: "12px"
  phone-inline: "16px"
  composer-padding: "18px"
  supporting: "24px"
  project: "28px"
  desktop-inline: "32px"
  desktop-columns: "44px"
components:
  button-primary:
    backgroundColor: "{colors.light-accent}"
    textColor: "{colors.light-accent-text}"
    rounded: "{rounded.button}"
    height: "36px"
    padding: "0 14px"
  button-secondary:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.button}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.light-text}"
    rounded: "{rounded.button}"
  input:
    backgroundColor: "{colors.light-surface}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
    height: "38px"
  context-disclosure:
    backgroundColor: "{colors.light-surface-2}"
    rounded: "{rounded.panel}"
    padding: "12px 14px"
  preset-chip:
    backgroundColor: "{colors.light-surface-2}"
    rounded: "{rounded.pill}"
    padding: "6px 10px"
---
# Design System: Model Router

## Overview

**Creative North Star: "A clear conversation workspace"**

The user-pinned reference is the clean, professional craft of ChatGPT and Claude. Model Router gives writing the clearest column, with quiet navigation and useful project context. Geist interface type, a Georgia welcome on both device classes, warm dark surfaces and restrained orange and subtle separators provide clear grouping across day, night and phone use.

**Key Characteristics:**

- Generous writing space and compact supporting navigation.
- White, charcoal and true-black appearances.
- Adjacent desktop project context and expandable phone context.
- Tonal grouping, subtle separators and modest ambient depth.

## Colors

The frontmatter records effective light, explicit dark and black workspace colors. CSS variables remain the implementation source of truth. Explicit dark conversation overrides use warm canvas/sidebar/surface tones and orange accent from claude-layout.css. Light retains green; true-black neutral overrides remain intact. The welcome mark uses orange #ce714e in every theme. Primary actions use accent, accent-hover and accent-text; selected tools use accent-soft. The three text levels separate reading, labels and metadata. Neutral surfaces and borders create grouping.

Black appearance sets data-theme to dark and overrides neutral colors; the final warm-dark override excludes black, preserving its existing green accent, focus and shadows. Existing link, warning, danger, success and syntax colors retain their semantic roles from styles.css. Automatic system dark uses the same warm neutral palette as explicit dark; the final media override excludes true-black appearance.

## Typography

Geist Variable serves the interface and headings; Geist Mono Variable serves code and paths. Existing mixed-script fallbacks do not imply an Arabic interface. Default body size is 15px/1.6; saved small and large settings change the size to 14px and 17px. Assistant prose retains 1.8 line height. Project description is 14px/1.6; context titles are 14px at weight 600; navigation is 13px.

Project titles use the recorded clamp and become 26px on phones. The desktop welcome size applies above 899px; the phone size applies at 899px and below. Both use Georgia at weight 400 and tracking -.04em, retaining the single-line greeting. Composer text is 16px on desktop and 18px on phones; instructions, project fields and activity search use 16px. Modest negative heading tracking and weight establish hierarchy.

## Layout

Final presentation order is styles.css, design.css, feature-surfaces.css, workspace.css, claude-layout.css. The feature stylesheet preserves implemented secondary surfaces; workspace.css supplies shared workspace styling and claude-layout.css supplies the final conversation composition overrides. Selector specificity still applies.

Desktop navigation is 288px wide, with full search and New, Projects, Artifacts, Scheduled, Customize and More actions. Account/settings remains at the bottom. At min-width 900px greeting and composer cap at 800px; project/model controls sit below the composer, left/right respectively. At max-width 899px the greeting stacks mark above text and the composer anchors at the bottom with its model pill beside +. Its navigation actions and project/history area share a single flexible scroll region (flex: 1, min-height: 0, overflow-y: auto, overflow-x: hidden, overscroll-behavior: contain), while header, search and account/settings footer remain outside. The nested chat list stays overflow-visible and flex: none so short landscape viewports retain access to footer actions. The chat thread retains its 820px cap; final desktop composer cap is 800px. Project bodies are capped at 1200px, with minmax(0, 1fr) 300px columns, 44px gap and 32px inline padding. Context has a thin inline separator and 24px inset. Project and context section gaps are 28px; adjacent context sections add a separator and 24px top padding.

At max-width 1100px, context becomes 260px, column gap 28px, inline padding 24px and context inset 20px. At max-width 960px, the project becomes one column; context appears before writing as a disclosure of at least 56px height, with content hidden until expanded. Navigation separately becomes a sliding drawer at max-width 899px, sized min(320px, 86vw).

At max-width 599px, project inline padding is max(16px, env(safe-area-inset-left)), section gap 20px and composer padding 16px. Header actions wrap. Interactive project context in a chat header occupies its own full-width row. Project editor fields fill available width and color choices wrap. Native safe-area insets are retained on headers, composers and model sheets. Header inline padding is max(22px, side inset) on desktop and max(16px, side inset) on phones; composer inline padding is max(28px, side inset) on desktop and max(12px, side inset) on phones. Header top padding respects the top inset; bottom composer spacing and existing viewport/keyboard handling remain. The viewport meta allows native pinch zoom.

## Elevation & Depth

Tonal surfaces and separators provide most grouping. The exact ambient composer and floating dialog/menu shadows are recorded in the sidecar. Project context cards, file rows and activity lists are open surfaces without added shadow. The final conversation composer has no shadow; focus changes its border; ordinary fields retain their existing --ring treatment. Modal backdrop blur is 5px.

## Shapes

Buttons and general fields use 10px corners, settings cards and disclosures 12px, composers use the recorded composer radius, general menus 14px and the desktop add popover 12px, phone add-sheet top corners 30px and grouped rows 18px, modals and drawer end corners 20px, user bubbles 22px and preset chips pill corners. Borders are generally 1px. Phone color choices use 8px corners with minimum 36px width and 44px height.

## Components

Base buttons are 36px high, with 14px inline padding and weight 500. Primary, secondary, ghost and destructive variants retain distinct roles. Hover changes tone/border, active scales to .98 and disabled opacity is .45. Base buttons are not universally 44px targets.

The workspace header identifies the actively selected project. Its model choices remain in project settings and actual conversations; the workspace header has no model picker. A conversation header project button explicitly selects that project and opens its workspace.

The context disclosure is the signature responsive interaction: a native button with expanded state and rotating chevron, followed by file and instruction sections. Conversation titles are native buttons with 36px minimum height and underline on hover. Navigation selection is tonal; section titles use sentence case. Chat/Code modes switch views while preserving the current chat and draft. Pressed modes and Recents filters have visible selected states; long artifact names wrap.

The composer uses 18px 16px 12px desktop padding and 16px 12px 10px phone padding, with 20px/24px desktop/phone corners. Desktop textarea minimum height is 70px; phone text is 18px to avoid iPhone focus zoom. Model selection opens upward, below the desktop composer on the right and inside the phone composer beside +. The lower-left + opens Add to Chat, a 320px desktop popover or a visible-viewport phone sheet. Close/back and Photos actions head the sheet. Camera and Photos invoke native device pickers; no device gallery thumbnails are fabricated. Primary groups contain Add files/Add to project, Connectors/Memory, and Tools/GitHub repository. Tools reveals existing canvas, analysis, comparison, search, privacy and library actions. Desktop rows are at least 44px tall, phone rows 52px. Phone composer controls remain at least 44px tall. Settings Connectors manages GitHub credentials and repository access with actual status. The round top-right ghost toggles ephemeral incognito chat; history, drafts, sync, backups and memory must respect this state. Providers still receive message content. Project assignment and memory are disabled in incognito. Instructions have 144px minimum height and 1.6 line height. Settings rows have 18px vertical padding. Library tabs use a bottom separator and tonal active state.

Keyboard controls retain a 2px --focus outline with 2px offset; ordinary fields use their border and ring focus. The skip link reaches the message input. Existing nested-dialog focus, local Escape and restoration logic remains in effect. Inputs and content support native selection; chrome suppresses selection and touch callouts.

Project header, file and phone row actions use 44px targets. Phone sidebar header controls, Recents filter and Connector buttons also have 44px minimum width and height. Coarse pointers give composer tools and send controls 44px minimum width and height. Preset chips become 44px tall on phones. Existing swipe navigation remains available. The context chevron transition is .18s var(--ease), removed for reduced motion.

## Do's and Don'ts

### Do:

- Do use effective theme variables, Geist interface typography and the recorded Georgia welcome typography.
- Do preserve the desktop writing/context split and phone context disclosure.
- Do retain visible focus, native text selection, pinch zoom and wrapping phone controls.
- Do keep privacy, billing and external write approvals explicit.

### Don't:

- Don't revive repetitive boxes, oversized uppercase section labels or duplicate settings.
- Don't squeeze project context into a phone side column.
- Don't copy superseded token values from earlier stylesheets.
- Don't disable native zoom or make navigation chrome selectable.
