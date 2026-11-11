# Lumen checkpoint

Updated: 2026-11-11. Native 0.3.6 PR #149 is merged at `e248f23ed91adbe49286eb5a3f16c6ad3f86cd22`, and `native-ios-v0.3.6` is published. Phase 3 sidebar swipe work is in progress on PR #150.

## Current work

- Branch `codex/phase3-native-edge-drawer`, PR #150 draft, based on merged main commit `e248f23ed91adbe49286eb5a3f16c6ad3f86cd22`. The latest branch commit contains tests only; its current SHA and check run are available from PR #150 because this branch is still being updated.
- Scope is only the sidebar gesture interaction. With the sidebar closed, a deliberate rightward horizontal swipe anywhere on the chat screen opens it. With the sidebar open, a deliberate leftward horizontal swipe anywhere on the screen closes it. Both track the finger and settle smoothly after full, partial, or cancelled gestures.
- Remove the visible edge tab and duplicate drag handlers. Keep the sidebar overlay, design, content and actions. Vertical chat scrolling and sidebar history scrolling must continue working; gesture recognition must require intentional horizontal direction.
- The test-only run was #42910696330 on SHA `2663a9a5c1d14d6e96e804b18fc41f2faf33e6ad`. Its compact and regular features shards failed at the simulator-interactivity startup check in `launchCleanChat`; the swipe assertions were not reached, so this was not evidence of a product regression.
- Phase 3 implementation is now in the worktree: one root-level simultaneous drag tracks the panel and scrim with the finger. It locks the gesture to horizontal only when horizontal movement is clearly dominant, and permanently yields a vertical drag to the chat or sidebar scroll view. Right swipes open from anywhere on the root chat; left swipes close from anywhere while open. The edge tab, sidebar handle and duplicate gesture handlers are removed. The gesture is disabled on pushed navigation screens to preserve the system back swipe.
- The next candidate is 0.3.7 because 0.3.6 is already tagged and published. `ios/project.yml` and `ios/release-notes.json` are updated in the worktree for the swipe release; verify that exact candidate before merging so the main-branch publisher cannot reuse the 0.3.6 tag.
- An uncommitted change in `ios/Lumen/Views/RootView.swift` tightens axis lock from 1.3 to 1.5, starts recognition after 12 points, and restores the pre-gesture sidebar state plus axis after a cancelled drag. The test-only PR run #42921860249 passed core and IPA archive checks, but the regular/features simulator timed out in `launchCleanChat` while taps were still swallowed after boot; it did not reach the diagonal swipe assertion. The other three simulator jobs were cancelled when that run ended. This is not a gesture test result.
- UI tests measure a 1.4:1 horizontal-to-vertical diagonal in screen points and seed 16 empty history rows so sidebar scrolling is verified by reaching an older row. Run the full four-device matrix and archive on the new candidate; inspect startup failures separately from gesture assertions. The 0.3.7 candidate still requires artifact verification on its exact commit before merge/publish.
- Release workflow #42904673100 completed successfully after retrying regular sync. Core, both compact and regular simulator shards, IPA archive, artifact verification and publication all passed. Release tag `native-ios-v0.3.6`; published 2026-11-10.
- Preserve reduced-motion behavior for settle animations. Run the iOS simulator matrix and artifact verifier on the final commit before merging/publishing.
- No web work is in scope. iOS bundle `io.github.seifonyx.lumen`; SideStore feed `ios/sidestore-source.json`.

## Standing decisions

- New native features should ship with finished design polish, accessibility, Light/Dark and functional XCTest coverage.
- Last native release (0.3.5) incorporated sidebar search, swipe navigation, Router, archive in Settings/search and temporary chat toolbar action.

## 2026-11-10 test coverage and release preparation

- Updated the same 14 native XCTest methods (no deletions): collapsed default (+ / prompt / Send), expanded model row on focus, collapsed row after keyboard dismissal with draft retained, expanded screenshots in Light/Dark; all original chat, provider, file import and conversation tests remain.
- Added helper `openModelPicker()` that first focuses the composer if collapsed, then opens the same full-name `ModelSheet`. This preserves all preexisting test paths and verifies intentional focus behavior.
- Composer + menu still exposes simulator fixture text/photo actions and external Photos/Files UI. Version bumped to `0.3.6`, with updated release notes. Keep PR draft and unmerged until CI passes exact current SHA.
