# Lumen checkpoint

Updated: 2026-11-10. The complete native visual Phase 2 was merged and SideStore 0.3.5 is listed in the main feed. Owner requested a new composer layout patterned after compact native AI chat bars.

## Current work

- **Phase 2 (daily-driver parity) is complete in code and CI.** Releases:
  - **0.5.0, Projects and Auto (#155).**
    - Projects in `settings.projects`, edited by transaction on settings.
    - Chats' `projectId` round-trips; project instructions lead each request.
    - Auto is a Swift port of the web's `planRoute`, with fallbacks on 404/429/5xx/network. Replies record `model`/`route`.
  - **0.5.1, Library (#156):** a view of files in cached chats (`LibraryIndex`).
  - **0.5.2, Memory (#157):** a port of `src/lib/memory.ts`.
    - Reads `memory/all` and the `memory`, `memoryAuto`, `aboutMe` and `customInstructions` settings.
    - `[[remember/forget]]` lines are hidden and saved.
    - Instructions are added after the context window.
  - **0.5.3, Export (#158):** `chatToMarkdown` port, shared from the chat menu.
- **CI:**
  - UI shards may take 45 min (a 9-test shard ran past 30).
  - The sync shard has 9 UI tests and features has 10, at about 20–25 min each.
- **Watch on a physical iPhone:** touch-and-hold on a sidebar chat sometimes acted as a tap on the hosted compact simulator. The test now retries; confirm on the device.
- **Library limit:** it shows files only from chats saved on this iPhone. A web chat's files appear after that chat is opened once.
- **Next:**
  1. The owner tries 0.5.x on the iPhone.
  2. Phase 3 (iPhone-only): share extension, App Intents/Shortcuts, widgets, notifications, voice, Handoff.
  3. CI speed: trim test waits, rebalance shards, reuse a passed PR run on merge.
- **Owner, 2026-11-11:** "Publish any update from now on without waiting for me". Merge and publish each green release, then report the next step.

## Standing decisions

- New native features should ship with finished design polish, accessibility, Light/Dark and functional XCTest coverage.
- Last native release (0.3.5) incorporated sidebar search, swipe navigation, Router, archive in Settings/search and temporary chat toolbar action.

## 2026-11-10 test coverage and release preparation

- Updated the same 14 native XCTest methods (no deletions): collapsed default (+ / prompt / Send), expanded model row on focus, collapsed row after keyboard dismissal with draft retained, expanded screenshots in Light/Dark; all original chat, provider, file import and conversation tests remain.
- Added helper `openModelPicker()` that first focuses the composer if collapsed, then opens the same full-name `ModelSheet`. This preserves all preexisting test paths and verifies intentional focus behavior.
- Composer + menu still exposes simulator fixture text/photo actions and external Photos/Files UI. Version bumped to `0.3.6`, with updated release notes. Keep PR draft and unmerged until CI passes exact current SHA.
