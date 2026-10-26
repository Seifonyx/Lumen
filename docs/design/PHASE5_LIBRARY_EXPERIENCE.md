# Phase 5 Slice 1 — Library experience and feature exit

Owner authorization: 2026-10-26; draft PR only, then stop for planner review. Base `d78363466e6460ce63c8ec7ab7fe67a527f22f15`. Overall completion percentage is not defined for this program.

## Findings and design

- `screen-history.ts` already snapshots canonical screens, local overlays, focus and scroll. The phone chevron calls `screenBack`, so provider sections, local editors and previews unwind individually. Add a distinct feature-exit traversal to the originating screen; browser Back/Forward and edge swipes keep sequential traversal. Traverse existing entries, never push a duplicate chat. Keep opaque history payloads and account reset.
- `CollectionPage` gathers chat documents and attachments, but Files and Searchable can show the same Knowledge collection, generated non-image attachments are misclassified, counts have ambiguous scope, and there is no sorting or useful file inspection. Use a Canvas-only workspace over the existing chat items and `KnowledgeLibrary`; keep the ordinary presentation compatible.
- Library categories: Everything (chat items), Photos (uploaded images), Documents (editable Canvas), Attached files, Made by Lumen (recorded assistant attachments), Knowledge (account-specific device-local originals/index). The Knowledge collection remains separate and explicitly device-local; never imply a synchronized combined total. Exclude automatic repository context, video links and temporary chats. Deduplicate repeated attachment IDs within the same chat, not unrelated equal filenames.
- Use a readable file ledger with media thumbnails, clear type/source/availability metadata, scoped query, project filter, newest/oldest/name sorting and specific empty/no-match recovery. Category navigation scrolls horizontally with full labels on phones; search remains above the keyboard and safe area. Desktop uses the same categories and controls.
- File details disclose recorded type, size, source chat and actual availability. Delegate original retrieval/preview to existing FileCard owners, editable documents to Canvas, citations/indexing/import/deletion to Knowledge. No unsupported generic preview or generated-export inventory is invented. Existing download/move/delete actions remain available.
- One leading chevron on Canvas feature headers, labelled with its destination; no trailing chat pills or floating home tabs. Overlays keep their own close/cancel controls, and exiting the parent dismisses its layers. Direct-start screens fall back by replacing the current entry.

## Data and edit safety

Composer drafts/attachments remain with their existing owners. History contains no content or account identity. Exiting a Library document restores the originating chat selection. Canvas text/name writes update canonical state immediately and persist via `saveCanvasDocument`; failed/pending saves and unapplied AI proposals need an explicit exit safeguard, not silent discard. Destructive Library and Knowledge deletions retain confirmation. Assistant/other tool drafts retain their existing account-scoped screen memory. No schema, routing policy, provider transport, auth, infrastructure or permission changes.

## Approach choice

Cosmetic changes to CollectionPage would retain confusing mixed ownership. A merged persistent index would violate the storage boundary. Chosen implementation: a Canvas-only content workspace and a separate exit operation in the existing history adapter, preserving canonical owners and ordinary compatibility. This is an implementation choice within the owner's supplied specification; planner review remains the final stop.

## Verification and limits

Pin regressions with real chat → feature → nested view → Exit journeys, draft/attachment and account checks, separate Back/Forward checks, save safeguards and truthful empty/unavailable states. Chromium and WebKit: 320/390/430/1440, Light/Dark, reduced motion, keyboard, focus, axe, overflow and touch targets. Capture the same synthetic fixture before and after, stamp source SHA. Run types/units, both builds, isolation/budgets and exact-head GitHub CI. Synthetic-only, loopback-only local servers, $0 incremental spend. Physical iPhone/PWA/VoiceOver/IME remain unverified. No merge/deploy or Slice 2.
