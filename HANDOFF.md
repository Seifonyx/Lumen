# Lumen checkpoint

Updated: 2026-11-10. The complete native visual Phase 2 was merged and SideStore 0.3.5 is listed in the main feed. Owner requested a new composer layout patterned after compact native AI chat bars.

## Current work

- New branch `codex/composer-collapse-0.3.6` based on main commit `f3f8d6b0210974f6e80dbb9609753046c92d5a16`.
- Target native version **0.3.6**, not yet published. Existing production 0.3.5 is unchanged.
- Compact composer when the message field is not focused: show **+**, one-line prompt field, and Send/Stop in one short rounded row. Opening/focusing the prompt reveals the model picker on a second row; closing the keyboard collapses it again. Long drafts and attachment chips remain preserved.
- The + icon opens **photo and file** choices; no visible "Attach" label. Existing simulator fixture actions, fileImporter, PhotosPicker, 4-attachment limit, previews and import errors remain.
- The selected model displays only the provider's familiar short name in the expanded composer: Gemini / Claude / OpenAI / Groq; full actual model names are retained inside `ModelSheet` and in the control's accessibility label.
- Update existing native UI tests to account for focus-dependent picker visibility, plus-menu attachment behavior and compact/expanded screenshots in Light/Dark. Preserve all current assertions and journeys. `ios/project.yml` / release notes should prepare 0.3.6 on PR.
- Latest native CI #42871052308 on `f1e96460f0d5e6d4bce66d7daba3061c86889c62`: core/packaging, IPA archive, regular sync and both feature shards passed. Compact sync failed only at the long-history assertion because it hard-coded `60 of 180` while the simulator reported `60 of 182`. The working fix derives the total from the loaded page label, requires at least 180 seeded messages, and checks that the next page is exactly 120 of the same total.
- **Next:** commit and push this regression fix, then verify early Swift parse/core, all four compact+regular × sync+features Firebase UI shards, IPA archive and exact artifact verification on the new SHA. Keep PR draft until all pass; then merge and confirm SideStore 0.3.6 is published on main. No web work is in scope.
- No changes to web/PWA code. iOS bundle `io.github.seifonyx.lumen`; SideStore feed `ios/sidestore-source.json`.

## Standing decisions

- New native features should ship with finished design polish, accessibility, Light/Dark and functional XCTest coverage.
- Last native release (0.3.5) incorporated sidebar search, swipe navigation, Router, archive in Settings/search and temporary chat toolbar action.

## 2026-11-10 test coverage and release preparation

- Updated the same 14 native XCTest methods (no deletions): collapsed default (+ / prompt / Send), expanded model row on focus, collapsed row after keyboard dismissal with draft retained, expanded screenshots in Light/Dark; all original chat, provider, file import and conversation tests remain.
- Added helper `openModelPicker()` that first focuses the composer if collapsed, then opens the same full-name `ModelSheet`. This preserves all preexisting test paths and verifies intentional focus behavior.
- Composer + menu still exposes simulator fixture text/photo actions and external Photos/Files UI. Version bumped to `0.3.6`, with updated release notes. Keep PR draft and unmerged until CI passes exact current SHA.
