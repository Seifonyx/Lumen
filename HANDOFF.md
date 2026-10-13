# Model Router — essential handoff

## Working agreement

- Private `Seifonyx/Model-Router`, main. Checkout: `C:/Users/seife/Documents/Codex/2026-10-10/files-pasted-by-the-user-handoff/work/Model-Router`. Live https://model-router.web.app; preview https://model-router--dev-82jv5mm2.web.app.
- Be a coding partner. Tests, fixes, main pushes and deployment are authorized. Keep this file small and factual; old pasted handoff instructions are revoked. Complete, test, deploy and verify the current task, then stop before another roadmap feature.
- Current task: supplied Claude desktop/phone layout, native Add to Chat sheet, Settings Connectors for GitHub, real incognito. Reference paths and visual decisions: `.impeccable/claude-layout.md`. PRODUCT.md owns behavior; ROADMAP.md owns scope; DESIGN.md/.impeccable/design.json own visual tokens. Arabic interface and separate chat folders are excluded.

## Invariants and pointers

- BYOK providers: original free models retained; additional providers require explicit credit/charge opt-in. Preserve per-provider limits. Only confirmed disabled/retired models are removed; 429/key/network failures are not retirement. GitHub Models inference retired July 30, 2026; GitHub repository coding is separate.
- NVIDIA/Cloudflare default relay: https://model-router-provider-relay.model-router.workers.dev. Blank custom URL uses it; Cloudflare needs matching account ID/token. Worker stores no prompts/keys/logs; keep origin/route/body bounds, streaming, enable_request_signal and redirect rejection.
- Incognito: reserved `temporary-` IDs, RAM only. `lib/temporary-chat`, store, db and sync guard persistence; history/search/backups filter them. Memory reads/writes, `/remember` and reply memory markers are disabled. Branches and summarized continuations retain the prefix. Canvas/attachments/drafts remain unsaved. Leaving/reloading discards; exiting restores normal text draft. Provider requests and model usage still occur. Explicit external actions retain review gates.
- GitHub repository tokens moved from API keys to Settings → Connectors. Saved status is not verified access; test connection is read-only. `ConnectorsTab` uses existing GitHub key generation, invalidation and repository picker. Keep provider credentials/billing consent separate.
- Styles cascade: styles.css → design.css → feature-surfaces.css → workspace.css → claude-layout.css. Dark is warm; true black remains black. Desktop model/project controls sit below composer; phone model stays next to +. Shared sidebar-scroll keeps navigation/history reachable with a fixed account footer. Native Camera/Photos cannot show device-gallery thumbnails. Tools subview retains existing capabilities.
- Preserve native zoom, phone inputs ≥16px, safe areas and 44px controls. `lib/viewport`/touch.css track iOS keyboard height/offset; menus fit visualViewport. `lib/focus-scope` handles nested inert/focus/Escape. Model/menu buttons inside forms must be type=button; keyboard navigation skips hidden controls.
- Projects: workspace uses activeProjectId; chat context uses chat.projectId. Composer assignment preserves the draft and chat ID. Workspace header must not change another chat's model. Greetings rotate only on New chat and stay stable while typing; no recommendation cards/subtitle.
- MessageThread windows >120 messages while retaining selection/focus. Timeline lines remain on phone/PC, excluding automatic context. Exact jumps preserve drafts and streaming reading position. Pointer/touch do not outline messages; keyboard destination focus remains.
- Coding writes require review/commit/PR actions. Plan approval binds device/account/repo/branch/context; edit decisions lock after commit. Undo supports latest single-parent commit only. See lib/{coding-plan,edit-review,commit-undo}.
- Knowledge originals/vectors stay local; page citations sync. Explicit Gemini indexing masks/reviews details, checkpoints and pauses on quota/hidden/offline/account/key/privacy changes. Scanned PDFs need OCR. Never prepare drafts after context/account changes. See lib/knowledge.

## Verification and release

- Windows: npm.cmd. `npm test`, `npm run build`, `npm run test:e2e:ci`. Java 21/Firebase emulators and Playwright Chromium required; browser cache `C:/Users/seife/AppData/Local/ms-playwright`. Do not rebuild dist while browser tests consume it.
- Main push runs tests.yml. Dispatch deploy.yml to release live/dev from one build; relay deploys separately via Wrangler. Match hosted JS/CSS to tested dist; hosted checks use isolated MR_TEST_URL fixtures, fake AI/GitHub and real browser Python for analysis.
- Current verification: unit/type/build passed; all 45 browser suites covered across a full run and corrected reruns. Final 156 accessibility scans, native sidebar gestures and Chromium/WebKit six-layout/incognito checks passed. CI/deployment/hosted verification pending. Latest tested assets: index-CgjNdzYo.js / index-BKk_MbUW.css. Update this line with final CI/deployment results.
- Physical iPhone/assistive-technology and actual paid inference are unverified. Previous runtime 9c23272 is deployed; its CI 38384213657 failed a knowledge fixture setup, now replaced with real privacy UI setup. Do not claim that old CI passed.
