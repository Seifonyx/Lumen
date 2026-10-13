# Sent-message navigation

Mode: Operate; ordinary extension preserving DESIGN.md and .impeccable/design.json.

## Current direction

The user requested removing the list/count button shown in their screenshot while keeping the timeline lines on both phone and PC. Remove the button and its dialog; keep the existing line appearance, current-position marker and immediate click/tap jumps. Fit bounded lines to conversation height, retaining first/latest turns where space permits. Every line has a 44px target and an accessible question-preview label. Reserve a narrow content gutter so phone text is not obscured. Preserve drafts, selection and streaming reading position; exclude automatic context. No new identity or raster assets.

## Prior release

Task 3 ec40842 was deployed and verified on both sites; CI 38375897530 passed 42 suites. This correction supersedes its button/searchable-dialog design. Phone hardware remains unverified.

## Correction verification

In progress: targeted Chromium/WebKit viewport checks, fresh finish review and deployment. Preserve incumbent visual-system files.

## Correction review and documentation comparison

Fresh finish review: ship, with no fixes requested, across `.impeccable/review/rail-chromium-1280-light-lines.png`, `rail-chromium-320-light-lines.png`, `rail-chromium-390-dark-lines.png`, `rail-chromium-430-black-lines.png` and `rail-chromium-844-dark-lines.png`. This is the parent-supplied review disposition; the full test and deployment summary is pending.

The implemented rail preserves the incumbent neutral surfaces, restrained accent, rounded controls and visible focus treatment. Desktop and phone both use compact horizontal lines with a wider accent current-position marker, immediate jumps and preview labels. Each line has a 44px square target. Height-based sampling bounds the rail to eight stops, preserves first/latest stops where capacity permits, and hides the rail below 44px of conversation height. A reserved 56px end gutter protects regular and virtualized conversation text. The list/count button and searchable dialog are removed as requested.

Comparison against PRODUCT.md, DESIGN.md and the sidecar found an ordinary component correction within the existing visual system. Preserve DESIGN.md and `.impeccable/design.json`; no identity, palette, typography or system-wide rule refresh is required. The concept detector was unavailable after a cache failure, so no detector result is claimed. Physical iPhone behavior remains unverified.
