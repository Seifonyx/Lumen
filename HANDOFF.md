# Lumen checkpoint

Updated: 2026-11-10. The complete native visual Phase 2 was merged and SideStore 0.3.5 is listed in the main feed. Owner requested a new composer layout patterned after compact native AI chat bars.

## Current work

- Branch `native/phase0-1-foundation`, PR #151 (draft): native **0.4.0**, Phase 0 plus the first part of Phase 1 of the native plan (https://claude.ai/artifact/GRPpkuK6yMvdAaeFsCpom9).
- Owner decisions, 2026-11-11:
  - **Streaming:** behave like Claude and ChatGPT. The sent question is pinned at the top, the reply writes below it with no auto-follow, and a Latest button shows when scrolled away.
  - **Overall:** "the whole experience still feels uncomfortable". So Phase 1 rebuilds the visible shell on iOS 26 components.
- **Done in #151:**
  - LumenCore `MarkdownBlocks` parser with tests, and block Markdown replies.
  - One glass composer.
  - The model moves to the chat title.
  - The hide-keyboard button is gone (tap or drag the conversation instead).
  - Haptics.
  - No Projects/Library placeholders; Router only in Settings.
  - The sidebar footer shows the name only.
  - QA runs display a placeholder email. The fixture must keep an invite-listed address; Firestore rules are unchanged.
- **Unverified:** nothing has compiled yet (no Swift toolchain on the Windows machine); CI is the first build. Not seen on a physical iPhone.
- **Next:** get #151 green on its exact head, then merge (SideStore 0.4.0 publishes from main) and run the owner's iPhone session.
- **Then:** Phase 1 continues.
  - The sidebar as a push drawer that tracks the finger. Draft #150 by Codex covers the gesture, with one compact features shard failing; reconcile it with #151 rather than duplicating it.
  - Dynamic Type at accessibility sizes, VoiceOver labels, and error copy.

## Standing decisions

- New native features should ship with finished design polish, accessibility, Light/Dark and functional XCTest coverage.
- Last native release (0.3.5) incorporated sidebar search, swipe navigation, Router, archive in Settings/search and temporary chat toolbar action.

## 2026-11-10 test coverage and release preparation

- Updated the same 14 native XCTest methods (no deletions): collapsed default (+ / prompt / Send), expanded model row on focus, collapsed row after keyboard dismissal with draft retained, expanded screenshots in Light/Dark; all original chat, provider, file import and conversation tests remain.
- Added helper `openModelPicker()` that first focuses the composer if collapsed, then opens the same full-name `ModelSheet`. This preserves all preexisting test paths and verifies intentional focus behavior.
- Composer + menu still exposes simulator fixture text/photo actions and external Photos/Files UI. Version bumped to `0.3.6`, with updated release notes. Keep PR draft and unmerged until CI passes exact current SHA.
