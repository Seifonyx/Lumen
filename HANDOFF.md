# Lumen checkpoint

Updated: 2026-11-11. Native 0.3.6 PR #149 is merged at `e248f23ed91adbe49286eb5a3f16c6ad3f86cd22`, and `native-ios-v0.3.6` is published. Phase 3 sidebar swipe work is in progress on PR #150.

## Current work

- Branch `codex/phase3-native-edge-drawer`, PR #150 draft, based on merged main commit `e248f23ed91adbe49286eb5a3f16c6ad3f86cd22`. Current PR head is `e4ca9763e75d6433b1aed8131cd473304263652e`; no workflow is running because the previous candidate run #42917307886 was cancelled for a gesture-cancellation fix.
- Scope is only the sidebar gesture interaction. With the sidebar closed, a deliberate rightward horizontal swipe anywhere on the chat screen opens it. With the sidebar open, a deliberate leftward horizontal swipe anywhere on the screen closes it. Both track the finger and settle smoothly after full, partial, or cancelled gestures.
- Remove the visible edge tab and duplicate drag handlers. Keep the sidebar overlay, design, content and actions. Vertical chat scrolling and sidebar history scrolling must continue working; gesture recognition must require intentional horizontal direction.
- The test-first run was #42910696330 on test-only SHA `2663a9a5c1d14d6e96e804b18fc41f2faf33e6ad`. The compact and regular features shards reported failures in `testNativeScreensInLightAndDark`; the compact run also reported a separate failure in `testConnectedDeleteCleansTheCloudConversation`. The baseline run was cancelled after this regression was demonstrated.
- Phase 3 implementation is now in the worktree: one root-level simultaneous drag tracks the panel and scrim with the finger. It locks the gesture to horizontal only when horizontal movement is clearly dominant, and permanently yields a vertical drag to the chat or sidebar scroll view. Right swipes open from anywhere on the root chat; left swipes close from anywhere while open. The edge tab, sidebar handle and duplicate gesture handlers are removed. The gesture is disabled on pushed navigation screens to preserve the system back swipe.
- The next candidate is 0.3.7 because 0.3.6 is already tagged and published. `ios/project.yml` and `ios/release-notes.json` are updated in the worktree for the swipe release; verify that exact candidate before merging so the main-branch publisher cannot reuse the 0.3.6 tag.
- `ios/Lumen/Views/RootView.swift` has an uncommitted cancellation recovery fix: a recognizer cancelled mid-drag restores the pre-gesture open/closed state and resets axis classification. `ios/LumenUITests/LumenUITests.swift` now has an uncommitted diagonal-scroll case with only slightly dominant horizontal movement; first push this test by itself and confirm it fails against the current 1.3 horizontal/vertical ratio, then tighten the classifier and push the fix.
- Current PR checks are cancelled, not running. After the classifier and scroll assertions are ready, push the final 0.3.7 candidate and require the full iOS simulator matrix plus archive and artifact verification to pass on that exact SHA.
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
