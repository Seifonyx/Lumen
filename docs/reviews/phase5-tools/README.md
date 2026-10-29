# Phase 5 Slice 2 review evidence — Tools experience

**Draft PR only. Stop for owner review; no merge, deployment or next slice.** All data is synthetic, browsers ran on loopback with every non-local request blocked, nothing was published and no money was spent. Overall completion percentage is not defined for the seven-phase program.

Design record: [PHASE5_TOOLS_EXPERIENCE.md](../../design/PHASE5_TOOLS_EXPERIENCE.md). The owner approved the 390px iPhone Light checkpoint ([before](checkpoint/before-390-light.png) · [after](checkpoint/after-390-light.png)) and asked for expansion without routine approval pauses.

## Provenance

| Evidence | Source |
|---|---|
| Before | Released main `2df3d60af43e4ed6686b501803e6662ba592b80f`, Canvas build |
| After | `1c1634749db0767dd3a367625ffaa9f10d1d3ac4`, Canvas build (later commits add evidence/docs only) |
| Fixture | [`tests/e2e/tools-experience.cjs`](../../../tests/e2e/tools-experience.cjs): Gemini key saved, no Cloudflare key, one custom assistant; dense case has 12 custom assistants; no-key case has neither key |
| Hashes | [captures.json](captures.json): SHA-256 of all 72 PNGs; each engine folder has a `results.json` |

These are screenshots of the running app, not mockups.

## Before / after

| View | Before | After |
|---|---|---|
| iPhone 320 Light | [Chromium](before/chromium/320-light-tools.png) | [Chromium](after/chromium/320-light-tools.png) |
| iPhone 390 Dark | [WebKit](before/webkit/390-dark-tools.png) | [WebKit](after/webkit/390-dark-tools.png) |
| iPhone 430 Light | [WebKit](before/webkit/430-light-tools.png) | [WebKit](after/webkit/430-light-tools.png) |
| Desktop 1440 Light | [Chromium](before/chromium/1440-light-tools.png) | [Chromium](after/chromium/1440-light-tools.png) |
| Desktop 1440 Dark | [WebKit](before/webkit/1440-dark-tools.png) | [WebKit](after/webkit/1440-dark-tools.png) |

States after (390 and 1440, Light and Dark, both engines): area filter (`*-area.png`), scoped no-match (`*-empty.png`), no keys (`*-no-keys.png`), dense assistants (`*-dense.png`), assistant editing (`*-editing.png`).

## What the fixture asserts (every width × theme × engine)

axe WCAG 2.1 AA on the page; no horizontal overflow in the page or workspace; phone targets ≥36px (rows and Edit ≥52px); readiness stated in words; the unavailable tool's description names the missing key; Writing tools is not a button; area filter shows only that area; scoped no-match with "Search all areas" and "Clear search"; Web search is a `switch` that toggles without leaving Tools; Edit opens the assistant editor and Back restores the chosen area; whole-feature Exit returns to the chat with its draft intact; no page errors.

## Verification

| Check | Result |
|---|---|
| Type check and full unit suite | Pass |
| Tools fixture, 320/390/430/1440 × Light/Dark | Pass in Chromium and WebKit |
| Canvas suites touching Tools (Chromium): accessibility, assistants, feature-exit, free-tools, glass, hub-actions, iphone-navigation, iphone-navigation-states, iphone-tool-return, tool-card-stability, study, phone-windows, writing-tools, deep-research, ask-chats | 15/15 pass |
| Same in WebKit: feature-exit, tool-card-stability, hub-actions, iphone-navigation-states, assistants, study | 6/6 pass |
| Ordinary build: tool-card-stability, hub-actions, free-tools, study | 4/4 pass |
| CP05 Canvas screens contract | Pass in Chromium and WebKit (1440, 390; Light and Dark) |
| CP03 Canvas shell contract | Pass in Chromium. Windows WebKit hits the previously documented Library rail-focus limit (not Tools); Linux CI is authoritative |
| QA01 isolation (9 checks) and CP01 production graph (22 negative controls) | Pass. The workspace is lazy, Canvas-only and absent from the ordinary graph |

Test changes keep every assertion: shared suites now accept either row style, and one iPhone test drives the area filter where it used the removed "Browse capabilities" disclosure.

## Performance

Same-source build comparison: ordinary startup **468.1 KB JS / 60.4 KB CSS gz**, Canvas **481.3 / 75.4 KB**. Canvas startup JS growth 13.1 KB (cap 13.5) and startup CSS growth **15.0 KB (was 15.4)**, because the old card/rail/browse rules were removed from startup Canvas CSS. Lazy Prism 7.6 KB. The Canvas CSS *source* cap is raised **21 → 22 KB** (now 21.1): the new lazy `tools-workspace.css` is about 1.1 KB gz against about 0.5 KB removed. This is a recorded decision for review.

## Limitations

- Physical iPhone/PWA, real Safari edge swipe, VoiceOver, Dynamic Type and IME are unverified; WebKit and Chromium runs are synthetic.
- Study partner still appears under both Learn and Assistants → From Lumen.
- Windows WebKit renders Geist's variable weights lighter than Chromium in both before and after captures.
- The assistant editor itself is unchanged; only how it is reached and returned from was checked.
