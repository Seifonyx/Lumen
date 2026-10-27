# Drawer reference — staged visual approval

The owner's newer concept sheet supersedes the prior shared-workspace-panel proposal. Follow its hierarchy, density, proportions, typography, fine dividers, restrained blue selection, project folders, conversation rows and footer. Treat it as visual guidance: preserve actual data and canonical functionality; no fake search scope/filter, duplicated chats or collapsed phone sidebar.

## Current authorized deliverable

Only one representative **390x844 iPhone Light populated drawer**, followed by owner visual approval. Other states, desktop implementation, full matrix/CI and a new draft PR wait for that approval. No merge/deploy/Tools work, new schemas/infrastructure or spending.

## Implementation

- Keep Crease and actual Search chats scope; three existing destination rows gain decorative chevrons.
- Flat Projects and Conversations sections with fine dividers; no shared rounded workspace card. Existing folder disclosure and real All projects/All chats actions stay available. No fabricated Archived project or new filter.
- Canonical ChatRow has an optional phone detail line derived from the actual project name and existing relative-time formatter. Chat names remain the accessible control labels; descriptions carry the extra context. Existing pins, Draft, menus, long press and chat selection stay with their original owners.
- Pale blue current-chat selection, fine folder/chat glyphs and comfortable two-line rows. New chat stays leading in the footer; Settings avatar stays trailing. Preserve44px targets and non-overlapping rows.
- Desktop retains its existing presentation. Dark/empty/dense expansion is pending approval and unverified for this direction.

## Focused proof

`tests/e2e/helpers/drawer-reference-shot.cjs` seeds four real synthetic project entities and four unique general chats, plus one real nested project chat. It captures the actual built application at390x844 Light. No copied owner screenshot, fake control or duplicated chat is included. It audits axe,44px targets, row non-overlap, canonical menu/focus, general New chat/draft return and zero inference requests.

Typecheck and the existing Canvas navigation/presentation-seam unit checks are required for this first gate. Broader tests from the interrupted earlier direction do not certify this new reference implementation. Physical iPhone/VoiceOver and release readiness are not claimed. STOP for owner visual approval after showing the actual capture.
