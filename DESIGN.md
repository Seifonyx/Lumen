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
  dark-bg: "#202120"
  dark-surface: "#292b29"
  dark-sidebar: "#181a18"
  dark-surface-2: "#30332f"
  dark-surface-3: "#3d413b"
  dark-text: "#f0f1ed"
  dark-text-2: "#b8bdb3"
  dark-text-3: "#a0a898"
  dark-border: "#363b33"
  dark-border-strong: "#4c5546"
  dark-input-border: "#485041"
  dark-accent: "#c0d6c1"
  dark-accent-hover: "#d7e7d7"
  dark-accent-soft: "#313e32"
  dark-accent-text: "#223026"
  dark-user-bubble: "#32362f"
  dark-code-bg: "#191c18"
  dark-focus: "#c0d6c1"
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
    fontFamily: "Geist Variable, Noto Sans Arabic, Geeza Pro, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "clamp(28px, 3.2vw, 40px)"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-.035em"
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
  composer: "16px"
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

The user-pinned reference is the clean, professional craft of ChatGPT and Claude. Model Router gives writing the clearest column, with quiet navigation and useful project context. Geist type, neutral surfaces, restrained green and subtle separators provide clear grouping across day, night and phone use.

**Key Characteristics:**

- Generous writing space and compact supporting navigation.
- White, charcoal and true-black appearances.
- Adjacent desktop project context and expandable phone context.
- Tonal grouping, subtle separators and modest ambient depth.

## Colors

The frontmatter records effective light, explicit dark and black workspace colors. CSS variables remain the implementation source of truth. Primary actions use accent, accent-hover and accent-text; selected tools use accent-soft. The three text levels separate reading, labels and metadata. Neutral surfaces and borders create grouping.

Black appearance sets data-theme to dark and overrides neutral colors; accent, focus and shadows inherit explicit dark. Existing link, warning, danger, success and syntax colors retain their semantic roles from styles.css. Automatic system dark currently uses design.css's more specific :root:not([data-theme='light']) media rule for shared variables; its charcoal values differ from explicit dark.

## Typography

Geist Variable serves the interface and headings; Geist Mono Variable serves code and paths. Existing mixed-script fallbacks do not imply an Arabic interface. Default body size is 15px/1.6; saved small and large settings change the size to 14px and 17px. Assistant prose retains 1.8 line height. Project description is 14px/1.6; context titles are 14px at weight 600; navigation is 13px.

Project titles use the recorded clamp and become 26px on phones. Welcome headings also use Geist, weight 550 and their recorded clamp. Composer text uses max(16px, var(--fs)); instructions, project fields and activity search use 16px. Modest negative heading tracking and weight establish hierarchy.

## Layout

Final presentation order is styles.css, design.css, feature-surfaces.css, workspace.css. The feature stylesheet preserves implemented secondary surfaces; workspace.css owns the final workspace overrides. Selector specificity still applies.

Desktop navigation is 260px wide. Its project/history area is a single flexible scroll region (flex: 1, min-height: 0, overflow-y: auto, overflow-x: hidden, overscroll-behavior: contain), with an unshrinking account/settings footer. The nested chat list stays overflow-visible and flex: none so short landscape viewports retain access to footer actions. The chat thread is capped at 820px and its composer at 740px. Project bodies are capped at 1200px, with minmax(0, 1fr) 300px columns, 44px gap and 32px inline padding. Context has a thin inline separator and 24px inset. Project and context section gaps are 28px; adjacent context sections add a separator and 24px top padding.

At max-width 1100px, context becomes 260px, column gap 28px, inline padding 24px and context inset 20px. At max-width 960px, the project becomes one column; context appears before writing as a disclosure of at least 56px height, with content hidden until expanded. Navigation separately becomes a sliding drawer at max-width 899px, sized min(320px, 86vw).

At max-width 599px, project inline padding is max(16px, env(safe-area-inset-left)), section gap 20px and composer padding 16px. Header actions wrap. Interactive project context in a chat header occupies its own full-width row. Project editor fields fill available width and color choices wrap. Safe-area bottom spacing and existing viewport/keyboard handling are retained. The viewport meta allows native pinch zoom.

## Elevation & Depth

Tonal surfaces and separators provide most grouping. The exact ambient composer and floating dialog/menu shadows are recorded in the sidecar. Project context cards, file rows and activity lists are open surfaces without added shadow. Composer focus keeps ambient shadow and changes the border; ordinary fields retain their existing --ring treatment. Modal backdrop blur is 5px.

## Shapes

Buttons and general fields use 10px corners, settings cards and disclosures 12px, composers 16px, menus 14px, modals and drawer end corners 20px, user bubbles 22px and preset chips pill corners. Borders are generally 1px. Phone color choices use 8px corners with minimum 36px width and 44px height.

## Components

Base buttons are 36px high, with 14px inline padding and weight 500. Primary, secondary, ghost and destructive variants retain distinct roles. Hover changes tone/border, active scales to .98 and disabled opacity is .45. Base buttons are not universally 44px targets.

The workspace header identifies the actively selected project. Its model choices remain in project settings and actual conversations; the workspace header has no model picker. A conversation header project button explicitly selects that project and opens its workspace.

The context disclosure is the signature responsive interaction: a native button with expanded state and rotating chevron, followed by file and instruction sections. Conversation titles are native buttons with 36px minimum height and underline on hover. Navigation selection is tonal; section titles use sentence case.

Project composer padding is 18px on desktop with 84px textarea minimum height. Instructions have 144px minimum height and 1.6 line height. Settings rows have 18px vertical padding. Library tabs use a bottom separator and tonal active state.

Keyboard controls retain a 2px --focus outline with 2px offset; ordinary fields use their border and ring focus. The skip link reaches the message input. Existing nested-dialog focus, local Escape and restoration logic remains in effect. Inputs and content support native selection; chrome suppresses selection and touch callouts.

Project header, file and phone row actions use 44px targets. Coarse pointers give composer tools and send controls 44px minimum width and height. Preset chips become 44px tall on phones. Existing swipe navigation remains available. The context chevron transition is .18s var(--ease), removed for reduced motion.

## Do's and Don'ts

### Do:

- Do use effective theme variables and Geist typography.
- Do preserve the desktop writing/context split and phone context disclosure.
- Do retain visible focus, native text selection, pinch zoom and wrapping phone controls.
- Do keep privacy, billing and external write approvals explicit.

### Don't:

- Don't revive repetitive boxes, oversized uppercase section labels or duplicate settings.
- Don't squeeze project context into a phone side column.
- Don't copy superseded token values from earlier stylesheets.
- Don't disable native zoom or make navigation chrome selectable.
