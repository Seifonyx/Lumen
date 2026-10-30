# Lumen design foundation (Canvas)

The visual rules behind the Canvas presentation, written down in one place, and how the identity connects to the
interface. Canvas tokens live in `src/styles/canvas.css`; palette and materials stay in `src/app.css` and
`src/glass.css`. The identity proposal is in [`brand/crease/`](../../brand/crease/README.md) (not adopted).

## Personality

Ink on paper, one voice (Geist), and light as the only warmth. The words carry the screen. Chrome is quiet until
you reach for it. Lumen should feel like a well-made notebook and a desk lamp, not a control panel.

## Type

Geist for everything; Geist Mono only for data: model names, keyboard shortcuts, counts and the uppercase section
labels. Tokens are in `canvas.css`.

| Role | Token | Value | Used by |
|---|---|---|---|
| Display | `--canvas-type-display` | 640 32/1.1, tracking −.03em | page titles: Library, Tools, Projects, Settings |
| Title | `--canvas-type-title` | 620 19/1.2, tracking −.015em | section headings inside a page |
| Reading | `--canvas-reading-size/-leading` | 16.5/1.72, 720 px measure | answers |
| Answer heading | (canvas-shell) | 620 27/1.18 | `##` in replies |
| UI body | `--fs` | 15 px (14/17 with text size) | controls, lists |
| Navigation | `--cv-fs` | 13.5 px, 600 when active | sidebar rows |
| Label | `--canvas-type-label` | Mono 500 10.5/1.3, uppercase, .12em | "Projects", "Conversations", settings groups |

Weights: 400 reading, 500 controls, 600 emphasis, 620–640 display. Don't introduce new in-between weights.

## Colour

Semantic, monochrome, two themes (Light and Dark; Canvas has no True black).

- **Ink and paper** (`--text`, `--bg`, `--surface`): cool neutrals from `app.css`.
- **Accent = ink.** Canvas maps the old lime "signal" to ink: the Send button, switches that are on, the model dot,
  focus. One solid ink pill per screen.
- **Fills and rims** are ink at fixed strengths: fill 7%, strong fill 12%, rim 10%. Hover uses the fill, the
  current item the strong fill, separators the rim.
- **Lamplight** (`--canvas-lamplight`): the only warm colour in the interface, the light from the mark's crease.
  Used for text selection and, since the calm pass (2026-10-30), for "this one is yours right now": the active
  section in a phone section bar and the "Selected" chip on the model in use. Never for buttons, focus or text.
  Light `#f1e2b6`, Dark `#4d4130`.
- **Status colours** (green, red, orange, blue) keep their meanings from `app.css` and appear only for state.
- **Exception, by owner decision:** the new-chat moon keeps its lime.

## Space and density

4 px base: `--canvas-space-1/2/3/4/6` = 4, 8, 12, 16, 24. Navigation rows are 32 px (34 for projects), with 2 px
between rows; touch targets are 44 px on phones (`--canvas-touch-target`). Answers are separated by 24 px.

## Surfaces, depth, radii

Depth comes from tone and hairlines; shadows only on floating things (composer, menus, dialogs, sheets), using
`--layer-shadow`. Cards are translucent surface over the page (`--cv5-card`) with a rim.

**Calm pass (2026-10-30), applied to Router and the phone Settings index; the rest of the app follows in a later
phase:**

- **One container per screen.** A grouped list is surface on paper, by tone alone: no outline, no card inside a
  card. A forced-colours border stays for Windows High Contrast.
- **Two kinds of button.** One solid ink pill for the screen's main action; everything else is plain text (with an
  icon when it helps). No outlined pills.
- **State facts, don't explain.** At most one short line under a row; longer explanations sit behind a disclosure
  ("Advanced", "Details"). Rows that would only say "Not connected" say nothing; their group heading says it.
- **Colour only for what needs you.** Status dots are small; a problem is one line with a coloured rule, not a
  tinted banner.
- **Four type steps in a page:** 28 (page title), 17 (section), 15 (rows and body), 13 (secondary and group
  labels). Group labels are 13 / 600 in the secondary colour.
- **One column on computers:** Router's content is at most 760 px wide, centred.

Radius tokens are defined but not yet applied everywhere; this is the scale new and migrated styles should use.

| Radius | Token | Value | Intended for |
|---|---|---|---|
| Row | `--canvas-radius-row` | 9 px | conversation rows |
| Control | `--canvas-radius-control` | 10 px | sidebar buttons, segmented items |
| Card | `--canvas-radius-card` | 16 px | settings cards, tool cards |
| Panel | `--canvas-radius-panel` | 20 px | floating panels |
| Composer | `--canvas-composer-radius` | 28 px | the message box |
| Pill | `--canvas-radius-pill` | 999 px | actions and chips |

## Icons

Lucide, outline, at 17–18 px with a 1.9 stroke in navigation; secondary colour at rest, ink when active. No filled
icons beside outline ones; no colour in icons.

## Controls, focus, selection

- Focus: 2 px ink outline, 2 px offset (`--focus` maps to ink). Visible on every control in both themes.
- Selected rows: strong fill and weight 600; a 6 px ink dot marks "you are here" in a folded section.
- Switches: ink when on, with the knob in page colour.
- Text selection: lamplight (see Colour). Before, it was a 45% ink wash, with about 4.1:1 contrast in Dark; it's now
  about 8.5:1 in Dark and 14.7:1 in Light. See [selection-before-after.png](selection-before-after.png).

## Brand and interface

The mark's three ideas map onto the interface:

| In the mark | In the interface |
|---|---|
| A standing page on a floor | the reading column on the page, the composer resting below it |
| Flat planes, two tones | ink fills at fixed strengths, no gradients |
| Light through the crease, the only warmth | lamplight on selected text, the only warm colour |
| The l cut at 28° | the wordmark in the sidebar head (on adoption) |

## Changed in this phase (2026-10-23)

- Foundation tokens for type, radii and labels added to `canvas.css`. Existing page titles, section titles and mono
  labels now read them; the values are identical, so the screens are pixel-identical (checked by diffing
  before/after screenshots at 1440 and 390, both themes).
- Text selection uses lamplight in Canvas (the one visible change).
- The ordinary build is byte-identical to `main`; Canvas CSS stays within its budget.

## Recommended next (not done)

- Move the remaining hard-coded radii (8, 12, 14, 18 px) in the Canvas files onto the four radius tokens.
- Sentence-case section labels in Geist 600 instead of mono uppercase would be calmer and closer to the identity.
  This reverses a Gate 1 choice, so it needs the owner's view.
- On adoption of the identity: the sidebar wordmark and the sign-in/shared pages switch to the Crease lockup.
