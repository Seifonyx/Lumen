# New-chat welcome

Ordinary extension of DESIGN.md; Operate mode. User requested removal of recommendation cards and gray subtitle, and a clean, short, single-line greeting that varies like Claude.

Keep only a brief centered greeting above the existing composer. Rotate five short messages when starting a new chat, including reuse of an empty chat. Do not animate or change it while typing. Preserve drafts, models, project context and tool access through the + menu. Retain mobile keyboard/safe-area behavior and native zoom. Current component-local greeting size: 22–40px; regular font and themes preserved. No new identity or raster assets.

Finish/proof pending targeted Chromium/WebKit checks and fresh review/documentation.

## Finish review and design comparison — 2026-10-13

Fresh finish review: ship. The five Chromium captures at 1280×844 light, 320×740 light, 390×844 dark, 430×932 black and 844×390 dark show a readable single-line greeting, clear space above the composer and retained composer actions, without recommendation cards or a heading subtitle. Evidence: `review/welcome-chromium-{1280-light,320-light,390-dark,430-black,844-dark}.png`. The existing composer information note remains below the composer.

Local targeted welcome checks passed in Chromium and WebKit across all five viewports: five distinct greetings rotate on New chat, the reused empty-chat draft survives, typing keeps the greeting stable, + menu repository access remains available, no greeting/page overflow occurs, and simulated keyboard fit and automated WCAG checks pass. The counter is session-only store state; project-less empty-chat reuse normalizes undefined/null identity. Broader affected regressions are tracked by the parent implementation task.

Compared PRODUCT.md, DESIGN.md and `.impeccable/design.json` with ChatView, welcome copy, store behavior and final workspace CSS. The incumbent Geist typography, neutral theme colors, restrained green, composer shape/depth and responsive navigation remain coherent with the documented world. The local welcome exception uses `clamp(22px, 3.2vw, 40px)` with nowrap to keep all five greetings on one line; DESIGN.md's incumbent welcome token still records a 28px minimum. This is recorded surface-local drift, not authorization to refresh DESIGN.md or its sidecar. Both are preserved. No new visual identity or raster asset was introduced.

Physical phone behavior remains unverified; WebKit and simulated viewport changes are engine checks. The concept detector was unavailable because of its cache failure, so no detector score or generated comparison is claimed.

## Release proof

9c23272 deployed to live and preview (38384534237); both serve tested assets. All ten affected local browser suites and unit/type/build passed. Welcome and navigation passed all five layouts in Chromium/WebKit locally and on both sites, including all greetings, draft reuse, keyboard fit and outline behavior. Full CI 38384213657 is still running; no 43-suite pass is claimed. No further phase started.
