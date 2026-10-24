# iPhone navigation reset — implementation contract

Owner rejects the floating feature docks. PR50 and PR51 remain preserved, unmerged and unaccepted. Base: PR51 verified source1b23b0d; release871bc1a unchanged.

## Decision
Keep the primary drawer (Chats, Projects, Library, Tools, Models & Routing, Settings). A feature is a screen, not a miniature app. Routing overview links to all six functional areas; provider selection pushes detail. Library uses a content-type selector and project filter. Tools exposes its capabilities together with search across categories. No floating category dock.

Alternative: moving the icon dock to the top retains competing home screens and hides hierarchy. Alternative: a new global bottom bar duplicates the existing discoverable drawer. Chosen: one drawer and screen stack, adapting canonical store/presentation owners to browser history. Back/Forward apply snapshots of canonical UI state; drafts, credentials and routing inputs are not copied into a second router. Browser history holds opaque session IDs, never prompts or credentials. A refresh starts at the actual root without invented Back.

## Screen map
Chats → primary drawer → Projects / Library / Tools / Routing / Settings.
Routing → Providers → provider → connection Settings → return to provider.
Routing → Models / Policies / Usage / Diagnostics → Routing.
Tools → Study / assistant editing; contextual action sheets remain sheets.
Library → content filtering → image preview / document editor / source chat; existing ownership and operations retained.
Settings → section → Settings → prior screen.

## Milestones
A: canonical history adapter, reusable phone navigation bar, Routing section hierarchy, provider Back.
B: remove category docks, searchable Tools index and Library type selector; restore local browsing state.
C: integrated browser journeys, focus/scroll, account boundaries, desktop and ordinary isolation, curated captures and exact-head CI. Physical iPhone/PWA/VoiceOver remain unverified until owner testing.

No merge/deploy, identity changes, backend/auth/network changes or spending. This contract records the owner's explicit implementation direction; no extra approval cycle is inferred. Design acceptance remains owner-only. No defensible overall program percentage is defined.

## History and presentation ownership
Local sheets/editors register an ordered presentation stack with their canonical screen context. Browser replay reconciles to the target and flushes component effects under the replay guard; a covered editor cannot add a second Settings entry during unmount. Draft edits refresh restoration metadata without reordering presentations. A completed destructive action replaces its obsolete confirmation snapshot before returning, so Forward cannot restore a deleted row. This is in-memory presentation metadata, not a second persistent router.

## Cost and checkpoints
Ordinary output matches the PR51 baseline byte-for-byte (174 files). Canvas startup JavaScript growth is approximately11.2KB gz over ordinary; budget9.5→11.5KB documents the additional shared history/ownership behavior. Startup CSS14.0/16KB, lazy Routing Center8.7/9KB, Canvas CSS source16.8/17KB. No runtime speed improvement is claimed. Final private gate contracts and exact-head CI are separate verification gates, still pending at this source checkpoint.
