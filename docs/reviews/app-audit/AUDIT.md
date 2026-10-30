# Lumen UI/UX audit (Canvas, 2026-10-30)

Scope: every Canvas screen as captured by the CP05 and Router suites at 320, 390, 430 and 1440 px in Light and Dark
(chat, model picker, attach sheet, all-chats sheet, Library, Tools, Projects, a project, Study, assistants, compare,
Settings and its sections, Router, Activity). Rules referenced are in
[DESIGN_FOUNDATION.md](../../brand/DESIGN_FOUNDATION.md) ("calm pass"). Evidence: `tests/e2e/out/cp05/**`,
`docs/reviews/calm-pass/after/`, `tests/e2e/out/prism-usage-diagnostics/`.

Priority: **Critical** breaks a task or loses data · **High** confusing or clearly broken-looking on a main path ·
**Medium** inconsistency or friction · **Low** polish. Status: **Done (P1)** shipped in Phase 1, **Phase 2** planned,
**Deferred** with a reason.

## Shared system

| ID | Where | Problem | Why it matters | Fix | Priority | Impact | Status |
|---|---|---|---|---|---|---|---|
| S1 | Library, Projects, Assistants (form) | Native `<select>` controls ("Newest first", "All projects", "Recently active", "Default model") drawn as white outlined boxes | Looks like a different app beside FilterMenu triggers and Router's segmented controls; outlines break the one-container rule | Library and Projects sort/project pickers use `FilterMenu` (text + chevron, fill when active); form selects get the shared field style (surface fill, no outline, chevron) | High | Every list screen reads as one system | Phase 2 |
| S2 | Settings (desktop and phone), Tools rows, project "Context" and composer cards, Tools key card | Cards drawn with a 1 px rim on top of a surface fill | Doubles the container language the calm pass removed in Router | Canvas `settings-card`, Tools lists and project cards use tone only (rim transparent; forced-colours keeps a border) | High | Calmer, consistent depth | Phase 2 |
| S3 | Settings groups ("APPEARANCE", "CHAT"), Tools/attach "TOOLS" label | Mono uppercase 10.5 px labels | Two group-label styles in one app; mono caps read as code | Group labels become 13/600 secondary, sentence case, everywhere | Medium | Consistent hierarchy | Phase 2 |
| S4 | Tools chips, Settings "Sign out", project "Edit", all-chats "Select", Tools "Set up" | Outlined pill buttons | Third button style beside ink pill and text buttons | Text buttons (fill on hover/press); the one main action stays the ink pill | Medium | Two button kinds, as the rules say | Phase 2 |
| S5 | Library and Tools rows, project chats | Row titles at 600 weight | Router and Settings rows are 500; bold titles shout in long lists | Row titles 500/15 | Medium | Quieter lists, clearer emphasis | Phase 2 |
| S6 | Search fields: Tools/Projects/Library (fill), Router (surface), all-chats sheet (outlined) | Three search-field styles | Same control, three looks | One style: surface fill, no outline, 44 px on phones, focus ring | Medium | Consistency | Phase 2 |
| S7 | App-wide | No error boundary around lazy screens | A render error (as found and fixed during Activity work: an invalid date format) blanks the whole app | Wrap lazy Canvas screens (Router, Activity) in an error boundary with "Something went wrong · Reload" and keep the chat mounted | High | One bad panel can't take the app down | Phase 2 |
| S8 | Activity, Router | Toasts covered the phone title | Hid Back and the page name | Toasts sit below the phone bar | High | — | Done (calm pass) |

## Chat

| ID | Where | Problem | Why | Fix | Priority | Impact | Status |
|---|---|---|---|---|---|---|---|
| C1 | Answer tables on phones | Wide tables are clipped at the right edge with no hint that they scroll | People miss columns | Horizontal scroll container with an edge fade on the overflowing side and a focusable, labelled region | Medium | Tables readable on phones | Phase 2 |
| C2 | Model picker capture (1440) | The picker was captured mid-fade over the answer | Probably capture timing; needs a check that the open picker is opaque | Verify in the running app; if real, make the panel's surface opaque once open | Low | — | Deferred (verify first) |

## Library

| ID | Where | Problem | Why | Fix | Priority | Impact | Status |
|---|---|---|---|---|---|---|---|
| L1 | Library header (desktop) | Page title + tagline + "From your chats" section heading + paragraph + count before any item | Four lines of chrome push content below the fold | Keep the page title; drop the tagline and the section paragraph; the count moves into the result summary | High | Content first | Phase 2 |
| L2 | Library (phone) | Same intro block plus two native selects | Same as L1 and S1 | As L1 and S1 | High | — | Phase 2 |
| L3 | Library rows | Three lines per item (name, kind, chat · time) with a full-bleed divider and no container | Dense and unlike other lists | Two lines (name; kind · chat · time) in a grouped list | Medium | Faster scanning | Phase 2 |

## Projects

| ID | Where | Problem | Why | Fix | Priority | Impact | Status |
|---|---|---|---|---|---|---|---|
| P1 | Projects list (phone), current project | The highlight fill stops short of the ⋯ button, so the row looks broken | Misaligned selection reads as a bug | Highlight the whole row, ⋯ included; or no highlight on the index (the sidebar already shows the current project) | High | — | Phase 2 |
| P2 | Projects list | "Instructions" chip beside the chat count | Unclear: is it a link, a status? | "Has instructions" as plain metadata text | Low | Clarity | Phase 2 |
| P3 | Project page chats | First row shows a preview line, others don't; ⋯ is 16 px and faint | Uneven rows, small target | One line per chat with date; ⋯ in a 44 px target at secondary contrast | Medium | — | Phase 2 |

## Study, assistants

| ID | Where | Problem | Why | Fix | Priority | Impact | Status |
|---|---|---|---|---|---|---|---|
| T1 | Study empty state | Two primary buttons for the same action ("New deck" bar and "Make your first deck") | Duplicate actions | Keep the empty state's button; hide the top bar button until there's at least one deck | High | — | Phase 2 |
| T2 | Study empty state | Icon inside a bordered gradient card | Decoration with no meaning | Plain icon tile | Low | — | Phase 2 |
| T3 | New assistant form | Outlined white fields on paper; Save alone at bottom right with no Cancel; no required marker on Name | Form looks unfinished; unclear what's needed | Shared field style (S1); Name marked required with inline message; Save disabled until a name exists | Medium | Fewer failed saves | Phase 2 |

## Tools

| ID | Where | Problem | Why | Fix | Priority | Impact | Status |
|---|---|---|---|---|---|---|---|
| TL1 | Tools key readiness card | Outlined card with a filled "Set up ↗" pill | Third container and button style on the page | Tone-only card, text "Set up" action | Medium | — | Phase 2 (with S2/S4) |
| TL2 | Tools rows | Three lines (title, description, where it lands) | Dense | Keep; the landing line is useful. Reduce weight per S5 | Low | — | Phase 2 (S5) |

## Settings

| ID | Where | Problem | Why | Fix | Priority | Impact | Status |
|---|---|---|---|---|---|---|---|
| SE1 | Settings desktop | "Settings" bar title plus "General" page title plus a subtitle line | Triple heading | Keep the bar title and the section title; drop the subtitle on desktop | Low | — | Phase 2 |
| SE2 | Settings sections | Outlined cards and mono caps labels | As S2, S3 | As S2, S3 | High | — | Phase 2 |

## Router and Activity

| ID | Where | Problem | Why | Fix | Priority | Impact | Status |
|---|---|---|---|---|---|---|---|
| R1 | Activity (old) | Usage and Diagnostics were separate panels of raw evidence with no overview, no search, no filters and no quota view | The owner's main request | New Activity: Overview, Logs, Quotas | Critical | — | Done (P1) |
| R2 | Activity Logs (phone) | Four filters and four actions wrapped onto extra lines | Toolbar taller than the first result | "Last 7 days" default reads as unfiltered; Refresh is an icon button; legend items don't wrap apart | Medium | — | Done (P1) |
| R3 | Activity chart legend | "Failed" wrapped away from its colour key | Misread legend | Each legend item no-wrap | Low | — | Done (P1) |
| R4 | Model-list refreshes in Logs | Every app start would log "Model list refreshed" per provider | Noise drowns real events | Only failures and recoveries are logged | Medium | — | Done (P1) |
| R5 | Activity, all views | A rendering error in a date format blanked the app (caught in testing) | Crash | Fixed; see S7 for the boundary | Critical | — | Done (P1), S7 Phase 2 |

## Accessibility and responsiveness (checked)

- axe WCAG 2.1 A/AA: no violations on Router, Activity (all three views), Settings index, Library, Tools, Projects at
  320–1440, Light and Dark (CP05, Router and Activity suites).
- Phone targets ≥ 44 px in Router, Activity and the Settings index; no horizontal overflow at 320 px or at 150 % text in
  the provider editor.
- Not verifiable here: VoiceOver on a physical iPhone, Dynamic Type, IME composition.
