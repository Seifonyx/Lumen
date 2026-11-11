# Lumen checkpoint

Updated: 2026-11-10. The complete native visual Phase 2 was merged and SideStore 0.3.5 is listed in the main feed. Owner requested a new composer layout patterned after compact native AI chat bars.

## Current work

- **Native plan** (owner-approved phases): https://claude.ai/artifact/GRPpkuK6yMvdAaeFsCpom9
- **Owner, 2026-11-11:**
  - Streaming should behave like Claude and ChatGPT: the question is pinned at the top, with no auto-follow.
  - "the whole experience overall still feels uncomfortable".
  - Full approval for agent-chosen native work.
  - **Publish every update without asking, then report the next step.**
- **#151 (0.4.0), merged to main 2026-11-11 12:53 UTC:**
  - Pinned streaming.
  - Block Markdown (LumenCore `MarkdownBlocks` and its tests).
  - A glass composer; the model in the title; tap or drag to hide the keyboard.
  - Haptics.
  - No placeholder routes; Router in Settings.
  - A placeholder email in QA screenshots.
  - Both SideStore feeds list the SwiftUI app.
  - **It merged before its PR CI ran**: there's no branch protection, and `gh pr merge --auto` merged at once. Repo auto-merge has been switched off again. Publishing still needs main's core, four UI shards and IPA jobs (`publish` needs `verify`). Check main run 43024198820; fix forward on failure.
- **#152 (0.4.1, base main):** a push-style sidebar that tracks the finger, with no edge tab or handle. It replaces Codex's #150, which is closed. Merge it once its CI is green on the exact head.
- **#153 (0.4.2), stacked on #152, finishes Phase 1:**
  - Dynamic Type everywhere (`@ScaledMetric`, no fixed font sizes).
  - VoiceOver traits and hints.
  - Error copy that's accurate wherever it shows.
  - Empty-chat guidance.
  - Two new UI tests: Accessibility XXL text, and `performAccessibilityAudit` on five screens. Shards are now 8 + 8.
- **Release order:**
  1. main's 0.4.0 run publishes.
  2. Merge #152 (0.4.1) when it's green on its head.
  3. Retarget #153 to main, update it from main, and merge it when green (0.4.2).
- **Owner, 2026-11-11:** "Publish any update from now on without waiting for me". Merge and publish each green release, then report the next step.
- **Phase 2 next (daily-driver parity):**
  - Auto routing.
  - Real Projects and Library synced with web.
  - Memory and personalization.
  - Share and export.
  - Sync conflict cases.
- Not verified on a physical iPhone.

## Standing decisions

- New native features should ship with finished design polish, accessibility, Light/Dark and functional XCTest coverage.
- Last native release (0.3.5) incorporated sidebar search, swipe navigation, Router, archive in Settings/search and temporary chat toolbar action.

## 2026-11-10 test coverage and release preparation

- Updated the same 14 native XCTest methods (no deletions): collapsed default (+ / prompt / Send), expanded model row on focus, collapsed row after keyboard dismissal with draft retained, expanded screenshots in Light/Dark; all original chat, provider, file import and conversation tests remain.
- Added helper `openModelPicker()` that first focuses the composer if collapsed, then opens the same full-name `ModelSheet`. This preserves all preexisting test paths and verifies intentional focus behavior.
- Composer + menu still exposes simulator fixture text/photo actions and external Photos/Files UI. Version bumped to `0.3.6`, with updated release notes. Keep PR draft and unmerged until CI passes exact current SHA.
