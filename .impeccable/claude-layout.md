# Reference conversation layout

Mode: Operate. The user supplied exact desktop and phone Claude references; match their composition using Model Router identity, real tools and actual account/usage state. No fabricated Claude limits, upgrade prompts, status bar or unavailable capabilities.

## Pinned references

- Desktop: C:/Users/seife/AppData/Local/Temp/codex-clipboard-45ab2e13-be05-4eeb-959c-be7839d837af.png
- Phone home: C:/Users/seife/.codex/codex-remote-attachments/01a126d1-060f-7831-89e9-e79d3fcfe92e/4DAD0E49-D0B2-4351-8A1E-E3379A9FEC06/1-Photo-1.jpg
- Phone add sheet: same directory, 2-Photo-2.jpg.

## Implemented composition

Desktop: 288px sidebar, full search, New/Projects/Artifacts/Scheduled/Customize/More and account footer. Navigation actions and project/history scroll together; header, search and account footer remain fixed outside this region. Centered 800px writing area, orange mark beside single-line Georgia greeting. Project/model controls sit below the composer. Existing artifacts/tasks/helpers use real app data and behavior.

Phone through 899px: round hamburger and incognito controls, centered mark above Georgia time/name greeting; bottom anchored 24px-radius composer with model pill next to +, mic and send. Safe areas, native input zoom and visible keyboard viewport remain supported.

Add to Chat: close/back, Photos, native Camera/Photos picker actions; grouped files/project, connectors/memory and tools/repository. Browser cannot display the user's device-gallery thumbnails. Tools retains existing app capabilities. Settings Connectors owns GitHub credentials and honest saved/verified status.

Incognito is ephemeral, with history/draft/storage/sync/backup/memory guards. Provider requests still transmit message content. Project assignment and memory are disabled for temporary chats. Normal drafts, explicit consent and external write approval behavior remain.

Effective tokens are recorded in DESIGN.md and its sidecar. Dark canvas/sidebar/surface are #171715/#121210/#232321 with orange #ce714e. Light green and true-black neutral/green-accent appearance remain. Dark action text, hover, selected tint, focus and borders use the contrast-correct tokens recorded in DESIGN.md. Automatic system dark matches explicit warm-dark neutrals; the final media override excludes true-black. The welcome mark is orange #ce714e in every theme. claude-layout.css loads last.

## Verification

Layout revision ffe24c2 passed full CI 38432567075 (45 browser suites plus type/build/unit) and deploy 38432608298. Both hosted sites matched tested assets and passed six layouts plus incognito/Connectors in Chromium/WebKit. Final cleanup additionally binds file/voice callbacks to their originating chat, stops private speech playback, and blocks temporary sync tombstones. Its unit/type/build, eight incognito cases across both engines, and five file/account/canvas/privacy/sync regression suites passed locally. Cleanup deployment/full-CI status pending. Physical iPhone unverified; detector unavailable. No shipping raster assets.
