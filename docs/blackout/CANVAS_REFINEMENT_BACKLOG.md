# Canvas refinement backlog

A prioritized, living list. Severe functional and accessibility issues are fixed in place. They are never parked here as "polish".

## P1 — owner decision or confirmation

| Item | Detail | Proposal |
|---|---|---|
| Pinch zoom is blocked on phones | Existing production behaviour: `src/main.tsx` blocks Safari `gesturestart`, and `touch-action` blocks double-tap. The text-size setting exists, but blocked zoom limits low-vision users (WCAG 1.4.4). The integration blueprint assumed zoom was preserved; it is not. | Owner decision. Recommend allowing pinch zoom of reading content before release. CP05 leaves it unchanged. |
| Switches are ink, not iOS green | Canvas is monochrome, so switches, Send and the focus ring are ink. On iPhone, green is the native convention. | Confirm on device; easy to restore green for glass (iPhone) only. |
| "Use model" returns to the chat | From the Routing Center. The alternative is to stay. | Keep unless the owner prefers staying. |
| Display font | Canvas headings name "Blackout Archivo", which is not bundled, so they fall back to Geist. | Decide whether to license and bundle Archivo (size and loading cost) or adopt Geist display as final. |

## P2 — visual refinement (non-blocking)

1. **Settings, phone:** the section title in the header is small; give the opened section a Canvas display heading.
2. **Routing Center, phone:** section tabs scroll sideways (Usage and Diagnostics are off-screen); consider "More".
3. **Providers list:** 32 rows, mostly "No key saved"; group the unconnected providers under a folded heading.
4. **Hub pages** (Library, Tools, Projects): the "Back to chat" and "Done" buttons could use the Routing Center's "← Chat" pill.
5. **Project manager:** it still offers colour dots, though Canvas shows monochrome monograms. Either hide them or use the colour subtly.
6. **Composer usage chip:** it shows "0%". The proof's "~N tokens" context wording is pending.
7. **Not yet visually reviewed:** the black theme; Study, Assistants and Compare; the document Canvas panel; Login and onboarding; long-press menus.
8. **Routing Center, desktop:** wide spacing between "Connect" and "a provider".
9. **Sidebar:** the active row's ⋯ on phones; the folder chevron animation timing.

## Done

- **CP03:** date-group headings removed (one newest-first list).
- **CP04:** provider rows overlapping on desktop; "1 keys"; route text wrapping.
- **CP05:** a project brief now opens from Library, Tools and Projects; the picker opens from a resting composer; monochrome project tile.
