# iOS feature-parity matrix

**Current account-release delta (2026-11-08):** Existing web accounts/data are now explicitly authorized.
A separate account-connected package reuses the production project, native Google SDK and canonical cloud paths;
normal Lumen login replaces the test-only screen. Added project-separated local cache/consent, preserving Demo stores.
Free-only OpenRouter is available through explicit in-app consent; other native network/worker paths remain blocked.
See [account release scope and verification](ACCOUNT_RELEASE.md). Physical native sign-in/sync is not yet verified.
The table below records the earlier audit and is not a claim that its Phase1 service statuses are current.

Audited 2026-11-07 against production Canvas source `12dc99a` and PR141 starting source `5e4116b`.
The owner reports Phase2 IPA overwrite, prior data, account separation, stream cancellation, background/resume,
keyboard and exports all passed. VoiceOver and new real-service native flows are unverified. These are owner
reports, not agent physical-device tests. No manual/device testing is requested this round.

Agent inspection: ran the native bundle in loopback Chromium/WebKit with all external requests denied;
local reply, Router return, draft and A/B separation passed. Ran the production Canvas build locally using its
synthetic preview account with external egress denied: Library and Projects empty interfaces rendered; first-run
Router provider setup rendered. Reviewed actual prior Simulator sign-in screenshot and its missing smoke report.
Code audit is broader than runtime coverage. Presence in this table is not a claim of complete native parity.

Status: Local = canonical local behavior packaged; Synthetic = artificial service response; Blocked = interface
retained but service/permission unavailable; Device = physical verification still needed. Every Local row still
needs its stated native/device checks. Production UI, routes and implementations are retained unless explicitly
listed as a native-only replacement in `../vite.config.ts`.

| Feature | Canonical implementation | Phase 1 / native dependencies and change needed | Risk and verification |
|---|---|---|---|
| Google sign-in | lib/firebase.ts, Login.tsx | Offline by default; isolated build uses native Google SDK + configured test clients; Google test consent pending | OAuth/session boundary; staged sign-in/logout/revocation and callback tests |
| Invite/access denial | firebase.ts, NotInvited.tsx, Firestore rules | Real checks excluded; no demo can become a real account | Must preserve production invite authorization; negative access tests after approval |
| Account selection/logout | store.ts, firebase.ts | Local fixed Demo A/B identities, same existing UIDs; no SDK or cloud | Browser/native A->B->A, no prior surface or draft leaks |
| Delete account/reauth | lib/delete-account.ts, SettingsModal.tsx | Real deletion blocked by SDK stub; destructive UI remains | Needs approved native reauth; never simulate a successful production deletion |
| Keys/account settings | account-key-persistence.ts, account-settings-persistence.ts | Local settings; fixed invalid synthetic key; saving real keys rejected | No real key input in QA; future Keychain threat model and consent required |
| Chat send/edit/retry/branch | store.ts, MessageItem.tsx, ai/chat.js | Synthetic responses through canonical chat path; no inference | Browser/native UI send and error/Stop, preserve edits and branch structure |
| Streaming/cancellation | lib/api.ts, ai/chat.js, ai/abort.js | Phase1 adds incremental local SSE with abort; previously single immediate chunk | Unit abort before/during read; UI Stop; no late content after cancellation |
| Manual model/Auto | ModelPicker.tsx, model-selection.ts, ai/registry.js | Two clearly named local demo catalog entries; existing Flash ID retained | Selection + Use->Chat keeps draft/attachment, no real readiness claim |
| Provider management | ProviderConnections.tsx, ai/provider-config.js | Full UI; only fake Gemini key. Actual setup/check/consent cannot establish live access | Existing paid-provider consent untouched; missing/unavailable reasons retained |
| Routing/fallback | routing.ts, helper-routing.ts, ai/eligibility.js | Canonical policy executes against synthetic catalog | Exclusions/manual selection preserved; real rate-limit/fallback needs approved service QA |
| Layouts | LayoutsTab.tsx, layouts.ts, layout-policy.ts | Local settings persist; full editor remains | Create/edit/import/export and invalid-layout validation |
| Activity Overview/Logs/Quotas | ActivityCenter.tsx, lib/activity/* | Local demo activity, not actual provider usage/cost/quota | Keep unknowns honest; export and section navigation; no invented usage facts |
| History/pin/archive/rename/delete | AllChats.tsx, CanvasNav.tsx, store.ts | Local canonical IndexedDB chat records | Reopen and upgrade verification; deletion/pin/archive UI |
| Drafts/model/attachments in navigation | Composer.tsx, chat-records.ts, screen-history.ts | Local canonical ownership; unsent attachment Files remain memory-only | Navigate/return preserves in-session; termination cannot restore unsent Files |
| Resume/reading position | lib/resume.ts, reading-position.ts | Canonical account-scoped local restoration | Reopen chat/project; invalid/missing resources; Incognito excluded |
| Account chat database | lib/db.ts | Same `model-router-account-preview-native-demo-a/b`, schema v2 | No schema/reset/origin change; preserve data on overwrite upgrade |
| Cloud sync/conflicts/history pull | lib/sync.ts | Offline demo is synthetic; isolated build reuses canonical Firebase/ChatSync, emulator-verified; live authorized roundtrip pending | Real SDK in isolated graph only; offline/conflict/delete/restart tests pass; no production config |
| Chat export/import | ChatExportModal.tsx, ImportChats.tsx, chat-export.ts, import-chats.ts | Local JSON/Markdown/HTML; native share-sheet download <=10MB | Native controller must actually load; Files/open/import and roundtrip; owner reports Phase2 exports passed; further format/import coverage remains partial |
| Public share links | SharedLinks.tsx, share.ts, SharedChatPage.tsx | Blocked; remote Firestore stub rejects | Do not present capacitor:// links as working public shares; approval + access/privacy tests |
| Projects CRUD/chat membership | CanvasProjects.tsx, ProjectWorkspace.tsx, store.ts | Local preview settings/project data; full UI retained | Create/edit/delete/project conversation; account switch/reopen |
| Project files/instructions/memory | ProjectWorkspace.tsx, ProjectMemory.tsx, memory.ts | Local editing; any AI memory generation synthetic | Local content lifecycle, deletion and isolation; production limits unchanged |
| Library file browsing/search/filter | CanvasCollectionPage.tsx, library-items.ts | Local collected chat/project files | Empty/populated states, long names, search/deletion; native file-picker checks |
| Knowledge import/chunk storage | KnowledgeLibrary.tsx, knowledge/import.ts, knowledge/db.ts | Local text/PDF/Office parsing packaged; PDF worker compatibility needs native test | PDF scanning/large-file limits and memory pressure; sample-only imports |
| Knowledge keyword search | knowledge/engine.ts, search.worker.ts | Blocked by current worker-deny seam; UI preserved | Separate reviewed local-worker enablement needed, not a fake search result |
| Knowledge embeddings/semantic retrieval | knowledge/engine.ts | Blocked; no embedding response fabricated | Explicit text-send consent, account cancellation and provenance before network approval |
| Document Canvas/editor/versions | CanvasPanel.tsx, canvas.ts, editors | Local canonical documents, code/text editors; AI edit requests synthetic | Save/version/undo/dirty exit and account isolation; native keyboard/selection |
| Office generation | lib/generate/*, FileCard.tsx, OfficeEditCard.tsx | Local DOCX/XLSX/PPTX builders packaged, ordinary generated content path | Build/export formats; share-sheet native file integrity; no claim synthetic reply generates every format |
| Office/file previews | PreviewModal.tsx, DeckPreview.tsx, files/read.ts | Local parsers retained; iframe/script previews blocked by CSP; PDF worker uncertain | Native rendering fixture tests needed, no enabling arbitrary frames for parity |
| File attachments/images/PDF | AttachSheet.tsx, files/read.ts, images.ts | Local text/image resizing/small PDF attachment; live image generation blocked | Picker/cancel, thumbnail and limits; no camera/photo permission added |
| Native exports/sharing | native/demo/download.ts, DemoViewController.swift | Blob bridge + UIActivityViewController <=10MB | Main-frame/origin/size checks; cancellation/cleanup; physical Files/share check |
| Compare/fork/synthesis | CompareModelsModal.tsx, comparison-stage.ts, comparison-snapshot.ts | Canonical UI, synthetic models/replies; synthesis not real intelligence | Two local models, Stop, return to original chat/draft; no external requests |
| Study decks/cards/quiz/scheduling | Study.tsx, study.ts | Phase1 fixed clearly labeled sample deck via existing parse/save/review path | Local generation/save/grade/reopen + A/B separation; sample is not derived factual study content |
| Assistants CRUD/built-ins | AssistantLibrary.tsx, assistants.ts, store.ts | Local settings and assistant instructions; responses synthetic | Create/edit/start/delete and correct account/model/draft behavior |
| Saved prompts | ToolsWorkspace.tsx, assistants.ts | Local canonical prompt management/use | CRUD/use/import caps and account ownership |
| Writing selection/actions | SelectionTools.tsx, writing-tools.ts | UI retained; synthetic output, not a meaningful rewrite/translation | Selection/focus/draft and preview acceptance; real quality deferred |
| Ask your chats | AskChats.tsx, chat-search.ts | Local text lookup where available; AI answer synthetic | No false retrieved citations; semantic dependence noted |
| Web search/research/reader/YouTube | ResearchCard.tsx, research.ts, FreeTools.tsx, free-tools.ts | Interface retained; external fetches blocked, plain responses explicitly synthetic | No fake visited sites/citations/completed research; actionable unavailable errors |
| Image generation | images.ts, GeneratedImage.tsx | Blocked (Cloudflare/Hugging Face); no image service | Provider approval, spending consent, native binary/download tests |
| Python/data analysis/calculation | RunPanel.tsx, analysis.ts, runner.ts | Blocked worker/Pyodide/CDN; canonical UI retained | No pretend executed code/results; reviewed offline runtime packaging future |
| JavaScript/TypeScript runner | runner.ts, RunPanel.tsx | Blocked worker; remote npm imports unavailable | Sandbox/egress audit required before local execution support |
| HTML preview/run | RunPanel.tsx, PreviewModal.tsx | Blocked frame-src none | Future isolated non-privileged frame, no native bridge exposure |
| GitHub repo/index/plan/commit/PR/revert | github.ts, repoindex.ts, coding-plan.ts, pull-review.ts, commit-undo.ts | Blocked; no GitHub token/network; UI retained | Explicit review/approval scope and origin snapshots preserved; staged synthetic API harness later |
| Scheduled tasks | tasks.ts, task-store.ts, task-store.ts | Local schedule/editor may persist; execution requires AI/app runtime | No promise of native background delivery; lifecycle/native notifications approval |
| Memory/custom instructions/profile | MemoryTab.tsx, memory.ts, settings.ts | Local management; AI extraction synthetic | Incognito never writes memory; account isolation and deletion |
| Themes/text size/layout/preferences | SettingsModal.tsx, settings.ts, app.css/glass.css | Canonical UI retained, no native redesign | Light/Dark and size; UIKit statusbar/keyboard/VoiceOver still physical |
| Privacy shield | privacy.ts, PrivacyCheck.tsx | Canonical local masking/consent | Input/output provenance and send-as-is stay unchanged |
| Incognito | temporary-chat.ts, store.ts, db.ts | Canonical memory-only conversation behavior | Test no chat/draft/attachment persistence; switch/reopen leaves no Incognito content |
| Navigation/search/gestures | screen-history.ts, back-stack.ts, navigation-coordinator.ts, CanvasNav.tsx | Canonical installed-app owner; native edge history disabled once custom controller active | Feature Exit separate from sequential Back/Forward; cancel/commit/focus/draft; physical touch pending |
| Deep links/shortcuts/command palette | CommandPalette.tsx, shortcuts.ts, router-settings-route.ts | Internal routes preserved; external URL/universal links not configured | Future validated callback allowlist; no broad external navigation |
| Notifications/haptics/wake lock | notify.ts, haptics.ts, wakelock.ts | Web capability-dependent; no native permission/plugin enabled | Graceful unsupported state; native features require separate scoped capability review |
| Voice/dictation/read-aloud | speech.ts, VoiceMode.tsx | Browser capability-dependent; media capture denied, no mic permission | No promise of offline/private STT; native permission/data-flow approval first |
| PWA/offline/update lifecycle | pwa/register.ts, update-safety.ts | PWA registration replaced; all app assets packaged, not remotely refreshed | No SW on capacitor scheme; existing web/ordinary builds unchanged |
| Native controller/bridge | native/DemoViewController.swift, scripts/prepare-ios.mjs | Phase1 fixes SceneDelegate constructing stock CAPBridgeViewController | Runtime marker + actual HTTP denial + guarded WebKit smoke, not source-only assurance |

## Phase 3 activation delta

See [test environment, fixes and exact remaining authorization](PHASE3_TEST_ENVIRONMENT.md).
The owner-approved Spark project `lumen-ios-test` now exists with Google provider, iOS/web clients, free-tier
Firestore and deployed strict Google/custom-claim/per-UID rules. Billing disabled verified. Test SDK metadata stays
private; default installed/build mode remains offline. Google SDK compilation passed; live end-to-end Google
consent and authenticated cloud sync are not verified without a dedicated test identity. No production access.

Native real-service sync now retains offline deletion intent across restart until server ACK and reconciles the
initial server snapshot before uploads, preserving newer remote revisions. Both regressions proved by real
canonical Firestore/ChatSync emulator tests. Bridge payload logging disabled; no root app/schema changes.

## Phase 2 delta

Phase1 completed at653071d (32/32 PR CI; native device/Simulator/browser workflow passed). This preserves that
baseline; installing its IPA is not a gate for Phase2. See [implemented foundation and protected activation
proposal](PHASE2_INTEGRATION.md) for exact contracts, evidence, simulation limitations and owner test sequence.

| Existing matrix area | Phase2 safe change | Remaining gap |
|---|---|---|
| Auth/session/logout | Attempt/state/callback/cancel/expiry ports, synthetic adapter | No Google/Firebase, registered callback, SDK credential exchange or real invite authorization |
| Conversations/history/Incognito | Scoped ChatSync-shaped memory replica and replay; canonical local persistence | No real cloud, durable distributed retry or cross-device sync |
| Projects/preferences | Retain authoritative per-UID records at logout; synthetic settings port | No project/settings remote service |
| AI models/stream/Stop | Owner-scoped synthetic request lifecycle, errors/retry/abort | No real inference, keys or provider networking |
| Background/native bridge | UIKit+visibility lifecycle, stale callback cancellation | Actual suspension/lock/upgrade still physical tests |
| Credential storage | Inactive native Keychain facility and opaque-reference contract | Not connected, no runtime credentials or real SDK session tested |

## Phase 1 scope and acceptance

Use one canonical Canvas app with native-only service adapters. A remote-site wrapper would break offline
identity/persistence and approved network boundaries. A SwiftUI rewrite would delay functionality and is excluded.
Keep both demo UIDs, `capacitor://localhost`, bundle ID, database versions and storage namespaces unchanged.
No data migration is introduced. Do not uninstall the owner's working app or instruct a reset.

Implementation order:
1. Fix generated SceneDelegate ownership, make generation idempotent and fail on an unrecognized template.
   Add a regression against the real pinned template before changing generation. Require runtime proof of guard activation.
2. Add local incremental, abortable replies and structured sample Study responses, reusing canonical AI/Study code.
   Unit tests first; two clearly labeled synthetic models; retain old selected model ID.
3. Expand private browser/native regression coverage: navigation, files/drafts, projects/docs, Study, persistence,
   existing-build-to-new-build storage reuse, A/B separation and Incognito. Keep physical and simulated claims distinct.
4. Improve free workflow diagnostics/provenance and concise owner install/overwrite/refresh guidance.
   Finish exact-head native build/artifact and PR CI. No merge/deploy.
5. Document protected integration and secure future update architecture, with precise next-phase gates.

No claim that every matrix row works offline or that native Phase 1 is production-ready. Blocked advanced
services stay visible and fail closed. No new schemas, dependencies, hosting or authentication configuration.
