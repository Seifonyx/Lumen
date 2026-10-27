# Drawer reference — approved composition expansion

The owner's newer concept sheet supersedes the prior shared-workspace-panel proposal. Follow its hierarchy, density, proportions, typography, fine dividers, restrained blue selection, project folders, conversation rows and footer. Treat it as visual guidance: preserve actual data and canonical functionality; no fake search scope/filter, duplicated chats or collapsed phone sidebar.

## Current authorized deliverable

Owner approved the actual **390x844 iPhone Light populated drawer**. Expand that implementation to320/390/430px phones and desktop, Light/Dark, empty/populated/dense/expanded projects, long/pinned conversations and hover/selected/focus. The overall composition is fixed. Refine the search-to-navigation gap, section rhythm and restrained Dark selection. Capture the full matrix, run regressions, open/update the draft PR and STOP for review. No merge/deploy/Tools work, new schemas/infrastructure or spending.

## Implementation

- Keep Crease and actual Search chats scope; three existing destination rows gain decorative chevrons.
- Flat Projects and Conversations sections with fine dividers; no shared rounded workspace card. Existing folder disclosure and real All projects/All chats actions stay available. No fabricated Archived project or new filter.
- Canonical ChatRow has an optional detail line derived from the actual project name and existing relative-time formatter. Chat names remain the accessible control labels; descriptions carry the extra context. Existing pins, Draft, menus, long press and chat selection stay with their original owners.
- Pale blue current-chat selection, fine folder/chat glyphs and comfortable two-line rows. New chat stays leading in the footer; Settings avatar stays trailing. Preserve44px targets and non-overlapping rows.
- Desktop uses the same three zones with38px navigation and48px conversation minima; phones keep44px navigation and54px conversation minima. Rows grow with text size. One canonical global New chat lives in the quiet footer, Settings remains an avatar action, and desktop alone retains the existing collapsed rail. Empty Projects offers one compact New project button. All projects and All chats remain real, labelled section actions in populated workspaces.

## Focused proof

`tests/e2e/helpers/drawer-reference-shot.cjs` seeds four real synthetic project entities and four unique general chats, plus one real nested project chat. It captures the actual built application at390x844 Light. No copied owner screenshot, fake control or duplicated chat is included. It audits axe,44px targets, row non-overlap, canonical menu/focus, general New chat/draft return and zero inference requests.

Typecheck and the existing Canvas navigation/presentation-seam unit checks are required for this first gate. Broader tests from the interrupted earlier direction do not certify this new reference implementation. Physical iPhone/VoiceOver and release readiness are not claimed. The expanded matrix in `tests/e2e/drawer-reference.cjs` adds both engines, empty/populated/dense/expanded states, geometry, axe, menu/focus, keyboard disclosure, archived search, draft return and zero inference checks. Review actual screenshots before delivery, then STOP for owner design review.
