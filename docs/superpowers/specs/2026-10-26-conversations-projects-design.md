# Conversations & Projects experience

Owner scope clarification, 2026-10-26: implement Conversations & Projects first. Phase5 Slice2 Tools remains deferred. Deliver one new draft PR from released main `1e93777767c632dcc3f37faf8f831f583795ad4e`; no merge, deployment, spending or protected infrastructure changes.

## Audit and intent

The unified tree already owns folder disclosure, pins, recent ordering, account-specific draft markers, keyboard navigation, long-press menus and original New chat semantics. Preserve these owners. Current weaknesses: every project is an initial tile rather than a recognizable folder; expanded folders repeat description/context metadata before chats; uppercase labels and small dense rows compete with destinations; project collection cards repeat monograms and pills; project overview has strong card borders around context and little rhythm between conversations.

## Direction and alternatives

Use the supplied references for consistent inset alignment, quiet selected rows, restrained hierarchy and legible nesting. Retain Geist, Crease and ink/paper Light/Dark tokens. Builder choice: a calm folder tree plus a project ledger, with a composed overview and a quieter context column. A card-only polish leaves the hierarchy problem; a new navigation model introduces unnecessary behavior risk. Neither is appropriate for this bounded UI checkpoint.

## Surfaces

- Sidebar: outlined folder instead of initial tile, trailing disclosure, clearer sentence-case section labels, generous consistent rows, restrained nested guide, compact overview entry, visible pin/Draft/archived states. Keep global New chat, upper Search, Library/Tools/Prism and footer in their existing locations.
- Projects collection: a single responsive list with folder, name, useful description, plain counts and updated time. One canonical project opening action and existing contextual menu. Search feedback, clear search and sorting available on both phone and desktop; retain query/sort history memory.
- Project overview: purposeful header, composer and chat list, quieter context rail, readable snippets and touch-sized actions. Preserve the existing project creation/editing, memory, file, conversation and send implementations. No automatic requests while browsing.
- Phone: 320/390/430px, 44px targets, 16px search fields, no horizontal clipping, visible focus, text scaling and reduced motion. Desktop1440px: calm density and useful overview width.

## Contracts and verification

Keep original folder/chat/overview destinations, pinned-first/recent order, account isolation, general/project New chat distinction, selection/model/draft/attachment preservation, feature Exit versus browser history, accessible arrow keys and menus. No new providers/services/storage schemas/telemetry or Tools changes. Screenshots are inspiration, not instructions to copy assets or another product's identity.

Add a shared deterministic synthetic fixture and capture baseline `1e93777` before editing UI. New e2e checks cover visible hierarchy, filters, folders, project opening, draft return, contextual menus and no unexpected network; Chromium/WebKit at320/390/430/1440 Light/Dark plus axe. Run unit/type, both builds, unchanged budgets, QA isolation and exact-head CI. Existing canonical navigation/privacy suites remain required. Physical iPhone/PWA/VoiceOver remain unverified unless actually tested. No overall program percentage is defined.
