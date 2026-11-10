# Lumen checkpoint

Updated: 2026-11-11. Native 0.3.6 PR #149 is merged at `e248f23ed91adbe49286eb5a3f16c6ad3f86cd22`; its main-branch SideStore release workflow is still being checked. Owner requested Phase 3 work on iPhone sidebar swipes while that release is checked.

## Current work

- Branch `codex/phase3-native-edge-drawer`, based on merged main commit `e248f23ed91adbe49286eb5a3f16c6ad3f86cd22`.
- Scope is only the sidebar gesture interaction. With the sidebar closed, a deliberate rightward horizontal swipe anywhere on the chat screen opens it. With the sidebar open, a deliberate leftward horizontal swipe anywhere on the screen closes it. Both track the finger and settle smoothly after full, partial, or cancelled gestures.
- Remove the visible edge tab and duplicate drag handlers. Keep the sidebar overlay, design, content and actions. Vertical chat scrolling and sidebar history scrolling must continue working; gesture recognition must require intentional horizontal direction.
- The test-first run is #42910696330 on test-only SHA `2663a9a5c1d14d6e96e804b18fc41f2faf33e6ad`. The compact features shard completed with `testNativeScreensInLightAndDark` among its failures, confirming the old code does not meet the new swipe journey; it also reported a separate failure in `testConnectedDeleteCleansTheCloudConversation`. The remaining shards are still running.
- Phase 3 implementation is now in the worktree: one root-level simultaneous drag tracks the panel and scrim with the finger. It locks the gesture to horizontal only when horizontal movement is clearly dominant, and permanently yields a vertical drag to the chat or sidebar scroll view. Right swipes open from anywhere on the root chat; left swipes close from anywhere while open. The edge tab, sidebar handle and duplicate gesture handlers are removed. The gesture is disabled on pushed navigation screens to preserve the system back swipe.
- The expanded XCTest journey also checks that a vertical chat swipe leaves the sidebar closed, alongside sidebar-history scrolling, center-origin opening, both close regions, repeated gestures and partial gestures. It must pass on compact and regular iPhones before merge or release.
- Main release workflow #42904673100 completed with core, IPA archive, compact features/sync and regular features green. Regular sync failed before XCTest: the first Firestore emulator reset request timed out after 15 seconds. The exact failed job (#130140125331) has been retried; wait for it and the verifier/publisher before advancing the Development copy.
- Preserve reduced-motion behavior for settle animations. Run the iOS simulator matrix and artifact verifier on the final commit before merging/publishing.
- No web work is in scope. iOS bundle `io.github.seifonyx.lumen`; SideStore feed `ios/sidestore-source.json`.

## Standing decisions

- New native features should ship with finished design polish, accessibility, Light/Dark and functional XCTest coverage.
- Last native release (0.3.5) incorporated sidebar search, swipe navigation, Router, archive in Settings/search and temporary chat toolbar action.

## 2026-11-10 test coverage and release preparation

- Updated the same 14 native XCTest methods (no deletions): collapsed default (+ / prompt / Send), expanded model row on focus, collapsed row after keyboard dismissal with draft retained, expanded screenshots in Light/Dark; all original chat, provider, file import and conversation tests remain.
- Added helper `openModelPicker()` that first focuses the composer if collapsed, then opens the same full-name `ModelSheet`. This preserves all preexisting test paths and verifies intentional focus behavior.
- Composer + menu still exposes simulator fixture text/photo actions and external Photos/Files UI. Version bumped to `0.3.6`, with updated release notes. Keep PR draft and unmerged until CI passes exact current SHA.
