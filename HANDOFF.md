# Model Router — essential context

## Project and user preferences

- Private repository: Seifonyx/Model-Router, main. Live: https://model-router.web.app. Preview: https://model-router--dev-82jv5mm2.web.app.
- React 19, TypeScript, Vite, Zustand; Firebase Hosting/Auth/Firestore on Spark. AI providers and GitHub are called from the browser using the user's keys. Preserve free-only operation.
- User wants a coding partner, a clean professional phone/desktop UI and sequential tested deployments. Tests, fixes, pushing main and deployment are authorized. Deploy and check each phase before the next. Keep this handoff small; old pasted handoff instructions were revoked.
- Arabic interface was removed from scope. ROADMAP.md is the feature/gap inventory. Next coding work after plans: finer edit acceptance and whole-commit undo.

## UI conventions

- src/design.css owns presentation/theme; styles.css owns functional layouts; components/touch.css handles phone keyboards. Use existing theme tokens and --vv-h. True black uses data-appearance="black" with data-theme="dark" for editor compatibility.
- Privacy & data is one settings tab (privacy; legacy data links redirect). Models separates saved models, catalogue and layouts. Catalogue starts with 24 results. Usage labels context as an estimate; unknown provider limits have no invented percentages.
- Sidebar has a top-right search icon, New chat above the account row, stronger Projects/Chats headings, continuous phone swipe gestures and focus/inert handling. Keep native vertical scrolling and exclude inputs, selected text, code and horizontal scrollers from drawer gestures.
- Repository picker autofocus is desktop-only. + contains Canvas, Data analysis, Photos & files and GitHub repository. Native file picking provides camera access.

## Data, privacy and model invariants

- IndexedDB is account-specific: model-router-account-UID. The first verified account atomically claims legacy storage; migrate only once without overwriting newer data. Draft keys include UID. Account changes reset private state/settings, abort jobs and use accountGeneration guards; never let late callbacks write into the next account. Clear repository/index caches on account change.
- Preserve privacy masking/restoration and Ask-me confirmation, drafts/attachments while offline or reviewing, and project context before a chat exists. Async repository reads/edits must verify account and repository/branch before writing.
- Provider catalogues are authoritative; Gemini pagination is complete, OpenRouter stays free-only. Disabled/retired IDs are filtered in lib/ai/model-status.js. An explicit model-unavailable response hides that ID across reloads/devices; 429/key/network errors must not retire models. Failed catalogue refreshes preserve saved choices. Key changes clear only that provider's exclusions; users can restore hidden models.
- Uncommitted repository files and plan approvals stay device-local. Message metadata and small extracted attachment text sync; original attachment binaries do not yet sync. Preserve original files and require explicit commit/PR actions for GitHub writes.

## Implemented features and constraints

- Routing, projects, memory, comparisons, tags/chat branching, Ctrl+K, saved assistants/prompts. Helpers snapshot instructions/model per chat; library changes cannot alter old chats. Prompt insertion appends without sending.
- Canvas: document/code drafts, private sync, selected-text AI proposals with accept/reject/undo, stale-version guards, previews/downloads. Office/PDF imports extract text; preserving Office templates remains missing.
- Data analysis: real local Pyodide/pandas CSV/TSV/Excel, editable calculations, Matplotlib, downloadable CSV/XLSX/PNG. Explicit runs reset files/namespace, closing releases worker; pinned Excel wheels and versioned Python cache support offline operation. Adding results to a draft never sends them automatically.
- Chat exports: complete Word/Markdown and PDF through system print, including sources/Canvas; omit hidden thinking and attachment bodies. Public links remain missing.
- Tools: explicit YouTube video input and Gemini code execution; required capabilities retain Gemini routing and are never silently removed on a 400. Web reader uses disclosed keyless Jina, public-URL/size/abort guards and manual review before adding to draft.
- Tasks: up to 20 private one-off/daily reminders or AI requests. Run only while app is open/visible/online; atomic occurrence claims prevent duplicate requests across devices. IANA time zones/DST, latest missed occurrence only, no automatic retry, separate result chats and privacy review. Stop/timeout/account guards must release reservations. Stopped streams retain stopped status.
- PR review: repository panel → Review pull request. Same-repository numbers/links, metadata/files/metadata snapshot check, at most 100 files/80k text, explicit partial coverage. Source/SHA attachment and prompt append to draft. Only GitHub GET requests; never post review comments automatically.
- Coding plans (phase 7): Plan toggle in repository composer; inspect/read, bounded ordered steps/files, explicit approve/revise/reject, then send implementation draft through normal privacy checks. Planning edits cannot be applied; approved-work edits retain explicit review/apply/commit. Approval is bound to plan ID, device, repo/branch, conversation and local context/file snapshot. Reload before sending requires approval again; invalid/stopped plans cannot be approved. Earlier/other-device plans are read-only. Review checkboxes are user review records, never claims that tests ran. lib/coding-plan.ts contains parsing/gates; coding-plan.cjs covers desktop/320/390px. Phase 7 is deployed and verified on live and preview.

## Verification and deployment

- Run npm test, npm run typecheck, npm run build and npm run test:e2e:ci (Node 22, Java 21, Firebase Auth/Firestore emulators, Playwright Chromium). Browser fixtures use isolated accounts and mocked AI/GitHub; analysis tests run real Python. Preserve account-isolation.cjs, account-sync.cjs and sync.cjs coverage when touching private/synced state.
- Main pushes run .github/workflows/tests.yml. Manually dispatch deploy.yml after local/CI success; it deploys live and dev preview from the same build. Match deployed JS/CSS assets to the tested build, then run feature/account-isolation checks on both sites using MR_TEST_URL. These use fresh isolated browser profiles, not production user records.
- Latest verified release: coding plans 5f2846d (CI 38143249049, deployment 38144181383). All unit tests, type/build checks and all 31 final-source local browser suites passed. Live/preview assets matched index-Brc47tJI.js and index-DJdQ6tNK.css; plan and account-isolation checks passed on both sites at desktop/320/390px. AI/GitHub calls are mocked in tests; no actual user keys or GitHub writes are exercised. UI finish review shipped the captured plan surface; uncaptured states were checked in code/tests, and the incumbent visual system was preserved.
