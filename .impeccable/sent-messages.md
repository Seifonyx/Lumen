# Sent-message navigation

Mode: Operate; ordinary extension preserving DESIGN.md and .impeccable/design.json.

## Current direction

The user requested removing the list/count button shown in their screenshot while keeping the timeline lines on both phone and PC. Remove the button and its dialog; keep the existing line appearance, current-position marker and immediate click/tap jumps. Fit bounded lines to conversation height, retaining first/latest turns where space permits. Every line has a 44px target and an accessible question-preview label. Reserve a narrow content gutter so phone text is not obscured. Preserve drafts, selection and streaming reading position; exclude automatic context. No new identity or raster assets.

## Prior release

Task 3 ec40842 was deployed and verified on both sites; CI 38375897530 passed 42 suites. This correction supersedes its button/searchable-dialog design. Phone hardware remains unverified.

## Correction verification

Complete: 1a1f828 deployed to live/preview (38379955887). Tested assets match both sites. Local and hosted line-only checks pass all five layouts in Chromium/WebKit, including virtual/normal jumps, drafts, streaming and keyboard geometry. Type/build/unit, long-history, project and native sidebar checks pass. Full CI 38379920137 remains running at this record; no new full-suite pass claimed. Preserve incumbent visual-system files.

## Correction review and documentation comparison

Fresh finish review: ship, with no fixes requested, across `.impeccable/review/rail-chromium-1280-light-lines.png`, `rail-chromium-320-light-lines.png`, `rail-chromium-390-dark-lines.png`, `rail-chromium-430-black-lines.png` and `rail-chromium-844-dark-lines.png`. This is the parent-supplied review disposition; the targeted test and deployment proof is recorded above.

The implemented rail preserves the incumbent neutral surfaces, restrained accent, rounded controls and visible focus treatment. Desktop and phone both use compact horizontal lines with a wider accent current-position marker, immediate jumps and preview labels. Each line has a 44px square target. Height-based sampling bounds the rail to eight stops, preserves first/latest stops where capacity permits, and hides the rail below 44px of conversation height. A reserved 56px end gutter protects regular and virtualized conversation text. The list/count button and searchable dialog are removed as requested.

Comparison against PRODUCT.md, DESIGN.md and the sidecar found an ordinary component correction within the existing visual system. Preserve DESIGN.md and `.impeccable/design.json`; no identity, palette, typography or system-wide rule refresh is required. The concept detector was unavailable after a cache failure, so no detector result is claimed. Physical iPhone behavior remains unverified.

## Timeline outline correction

Current user direction: “Don’t outline the message when i click on a timeline”. Pointer clicks and touch taps jump to the original message without an added bubble outline. Keyboard activation retains visible destination focus: navigation passes an explicit keyboard flag from the activation event, and the thread applies its keyboard-only destination marker alongside the existing focus-visible treatment. Existing jump, draft and reading-position behavior is preserved.

Fresh finish review: ship, with no material fixes requested; the second scoped review of Safari keyboard tracking also returned ship. Parent-supplied desktop (1280px) and phone (320px) pointer-jump captures are `.impeccable/review/rail-chromium-1280-light-jump.png` and `.impeccable/review/rail-chromium-320-light-jump.png`. Test and deployment proof remains pending at this record.

Comparison against PRODUCT.md, DESIGN.md, `.impeccable/design.json` and the navigation/thread/CSS implementation confirms an ordinary interaction correction within the existing visual system. Preserve DESIGN.md and the sidecar; no system refresh or raster assets are required. The concept detector remains unavailable after its cache failure. Physical phone behavior remains unverified.
