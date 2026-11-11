# Lumen checkpoint

Updated: 2026-11-10. The complete native visual Phase 2 was merged and SideStore 0.3.5 is listed in the main feed. Owner requested a new composer layout patterned after compact native AI chat bars.

## Current work

- **Native 0.4.2 is published** (2026-11-11 23:20 UTC, main `50cb2c6`, release `native-ios-v0.4.2`, listed in both SideStore feeds). **Phase 1 is complete** in code and CI, but not yet verified on the owner's physical iPhone.
- **What 0.4.2 contains (#151 and #153; #152 was folded into #153):**
  - Pinned streaming, like Claude and ChatGPT, with a Latest button that shows only when the end is off screen.
  - Block Markdown replies (LumenCore `MarkdownBlocks`).
  - One glass composer; the model as the chat title.
  - Tap or drag to hide the keyboard.
  - A push sidebar that follows the finger.
  - Haptics.
  - Dynamic Type up to accessibility sizes. At those sizes the composer stops at 3 lines and the empty state scrolls.
  - VoiceOver labels.
  - Plain error copy.
  - No placeholder routes.
  - A QA placeholder email in screenshots.
  - The root feed lists the SwiftUI app.
- **Native CI is faster and steadier:**
  - One simulator build per commit from a warm DerivedData cache. The shards download the tarred products, and the simulator boots during the download.
  - The release IPA has its own cache.
  - The Swift checks run in the `swift:6.2` Docker image (setup-swift kept failing on key servers).
  - Emulator seeding retries.
  - Verify counts tests from `SHARDS` and tells shards apart by runner and simulator.
  - About 28 minutes in total; it was about 45.
- **Next:**
  - The owner tries 0.4.2 on the iPhone for a day.
  - Then Phase 2: Auto routing, real Projects and Library synced with web, memory, share/export, sync conflict cases.
  - CI time is now dominated by UI tests (18–23 minutes per shard). Next speedups:
    - Trim waits in tests.
    - Rebalance shards.
    - Reuse a passed PR run when merging, instead of re-running everything on main.
- **Owner, 2026-11-11:** "Publish any update from now on without waiting for me". Merge and publish each green release, then report the next step.

## Standing decisions

- New native features should ship with finished design polish, accessibility, Light/Dark and functional XCTest coverage.
- Last native release (0.3.5) incorporated sidebar search, swipe navigation, Router, archive in Settings/search and temporary chat toolbar action.

## 2026-11-10 test coverage and release preparation

- Updated the same 14 native XCTest methods (no deletions): collapsed default (+ / prompt / Send), expanded model row on focus, collapsed row after keyboard dismissal with draft retained, expanded screenshots in Light/Dark; all original chat, provider, file import and conversation tests remain.
- Added helper `openModelPicker()` that first focuses the composer if collapsed, then opens the same full-name `ModelSheet`. This preserves all preexisting test paths and verifies intentional focus behavior.
- Composer + menu still exposes simulator fixture text/photo actions and external Photos/Files UI. Version bumped to `0.3.6`, with updated release notes. Keep PR draft and unmerged until CI passes exact current SHA.
