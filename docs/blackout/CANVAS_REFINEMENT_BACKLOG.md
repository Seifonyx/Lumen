# Canvas refinement backlog

A prioritized, living list. Severe functional and accessibility issues are fixed in place. They are never parked here as "polish".

## Decided by the owner (CP05)

| Item | Decision | Status |
|---|---|---|
| Pinch zoom on phones | Keep it disabled in the main chat. Keep comfortable text sizes and the text-size setting ("Auto" follows the system on iPhone). The document Canvas may get its own zoom later. | Unchanged, as decided |
| Switches | Monochrome ink on iPhone and desktop, with clear on and off states. | Done: the off state now has a visible rim and a grey knob in light, dark and true black |
| Display font | Keep Geist. No Archivo, no font dependencies. | Done: the Archivo name is removed from the Canvas tokens; the contract asserts Geist |
| "Use model" | Return to the chat, keeping the draft and the model, with clear confirmation. | Done: a "Now using … in this chat" toast; the contract asserts it |

## P2 — visual refinement (non-blocking)

1. **Settings, phone:** the section title in the header is small; give the opened section a Canvas display heading.
2. **Routing Center, phone:** section tabs scroll sideways (Usage and Diagnostics are off-screen); consider "More".
3. **Providers list:** 32 rows, mostly "No key saved"; group the unconnected providers under a folded heading.
4. **Hub pages** (Library, Tools, Projects): the "Back to chat" and "Done" buttons could use the Routing Center's "← Chat" pill.
5. **Project manager:** it still offers colour dots, though Canvas shows monochrome monograms. Either hide them or use the colour subtly.
6. **Composer usage chip:** it shows "0%". The proof's "~N tokens" context wording is pending.
7. **Not yet visually reviewed:** Login and onboarding, long-press menus, the Compare results view (needs live answers), Study deck and quiz views (needs a deck).
8. **Routing Center, desktop:** wide spacing between "Connect" and "a provider".
9. **Sidebar:** the active row's ⋯ on phones; the folder chevron animation timing.

## Done

- **CP03:** date-group headings removed (one newest-first list).
- **CP04:** provider rows overlapping on desktop; "1 keys"; route text wrapping.
- **CP05:**
  - A project brief now opens from Library, Tools and Projects.
  - The picker opens from a resting composer.
  - Monochrome project tile.
  - Monochrome assistant avatars and the Study ring and due chips.
  - Compare checks.
  - The document Canvas panel's head and view switch.
  - True black is covered by the contract.
