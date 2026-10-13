# Sent-message navigation

Mode: Operate. Task 3 authorized after Task 2. Ordinary extension of the existing workspace; preserve its identity and all conversation data.

## Direction contract

THESIS: Retrace a question without scrolling through every answer. A quiet overview and searchable index keep long conversations navigable.

OWN-WORLD: Existing Geist, three appearances, restrained accent and native SVG icons. Ticks and controls share the established focus/contrast vocabulary; no new brand or raster assets.

STORY: Click an overview tick or open Sent messages, find a question, jump to its original turn. Automatic repository/file context does not appear as a sent question.

FIRST VIEWPORT: Desktop has a narrow right-side overview with bounded sampled ticks and an all-messages button. Narrow/short conversations collapse to a 44px bottom-side control; its searchable sheet/dialog uses large rows and respects the visual viewport/keyboard. Current position is marked.

FORM: Local component extension, user-confirmed purpose. Jumps mount the exact older row through the existing virtualizer, preserve drafts/selection and stop streaming from pulling the reader away. Smooth scrolling is avoided for dynamically measured long rows; movement is immediate and reduced-motion safe.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Finish and proof record — 2026-10-13

Finish verdict: **ship**, as reported by the independent finish reviewer after validating six required rendered states: desktop overview at 1280px/light; sent-message list and restored jump at 320px/light; keyboard state at 390px/dark; list at 430px/black; landscape list at 844px/dark. Evidence is stored as `.impeccable/review/navigation-chromium-{width}-{appearance}-{state}.png`. No material finish repairs were requested. These are local browser captures of synthetic conversations, not shipping raster assets; the feature introduces no raster imagery.

Documentation evidence checked: `PRODUCT.md`, incumbent `DESIGN.md` and `.impeccable/design.json`, `MessageNavigation.tsx`, its stylesheet, `MessageThread.tsx` and `ChatView.tsx`; desktop rail and 320px list captures were also inspected directly. The extension uses existing theme variables, inherited Geist typography, inline SVG icons, restrained tonal selection, visible focus and native nested-dialog handling. It preserves the writing column and drafts. Overview controls have 44px targets; list rows are 68px tall, with 16px search text. Narrow conversation areas below 760px, or areas below 260px high, use the compact trigger; phones below 599px bottom-align the dialog. Older-turn jumps mount and focus the exact row, mark its bubble and announce the sent-message ordinal without animated scrolling.

Incumbent-system comparison: no visual identity drift observed. The new task-local dialog uses 16px corners rather than the incumbent generic modal token of 20px, and introduces conversation-area breakpoints not enumerated in the existing sidecar. These component exceptions are recorded here; incumbent `DESIGN.md` and `.impeccable/design.json` are preserved. The sidecar does not yet demonstrate the sent-message navigator. A future authorized system refresh may add that example if it becomes a reusable pattern.

Verification reported by the parent: feature checks pass in Chromium and WebKit at all five viewports. Full regression is pending at the time of this record. The visual detector was unavailable because its cached runtime failed; the finish verdict rests on rendered review and functional checks. WebKit coverage verifies the browser engine; physical iPhone behavior remains unverified.

## Release proof

2026-10-13: ec40842 deployed to live and preview (38377988567); CI 38375897530 passed all 42 browser suites plus type/build/unit checks. Hosted JS/CSS match tested dist. Both sites passed all five navigator viewports in Chromium and WebKit; real iPhone hardware remains unverified. Three Windows canceled-download suites passed an elevated rerun without app/test assertion changes. Task 3 concluded; no next phase started.
