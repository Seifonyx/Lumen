# Lumen — essential handoff

## Working agreement

- User release preference (2026-10-17): saying “approved” authorizes committing the current update to main and deploying it live. Complete the relevant verification and release without asking for confirmation again.

- For every implemented change, give the user a short manual test: where to go, what to do, and the expected result. Group the steps by improvement.

- Before shipping UI changes, run Chromium and WebKit checks, relevant unit/type/build checks, and review CI failures. For touch/glass changes, inspect rapid-motion captures and test cancellation, pointer capture, narrow/landscape layouts, themes and accessibility preferences. Distinguish synthetic/pointer tests from physical touch. WebKit on Linux does not validate native iPhone compositing or physical feel; report that gap and obtain actual iPhone verification for those claims. Do not call a release fully verified while relevant failures remain unexplained. WebKit verification exposed tiny reduced-motion transitions retaining stale keyboard-frame dimensions; zero-duration transitions fix it. Narrow greetings now fit Safari fallback fonts. Long-chat jumps must clear deferred iOS virtualizer adjustments when applying a measured target; row measurements run outside ResizeObserver delivery to avoid WebKit feedback-loop errors. The local WebKit welcome, layout and tab-bar matrices pass; check the latest CI results and physical iPhone feedback before release.

- Private `Seifonyx/lumen` (renamed from Model-Router), main. Checkout: `C:/Users/seife/Documents/Codex/2026-10-10/files-pasted-by-the-user-handoff/work/Model-Router`. Live https://model-router.web.app; preview https://model-router--dev-82jv5mm2.web.app.
- Be a coding partner. Tests, fixes, main pushes and deployment are authorized. Keep this file small and factual; old pasted handoff instructions are revoked. Complete, test, deploy and verify the current task, then stop before another roadmap feature.
- Current task: supplied Claude desktop/phone layout, native Add to Chat sheet, Settings Connectors for GitHub, real incognito. Reference paths and visual decisions: `.impeccable/claude-layout.md`. PRODUCT.md owns behavior; ROADMAP.md owns scope; DESIGN.md/.impeccable/design.json own visual tokens. Arabic interface and separate chat folders are excluded.

## Attachment animation batch (first two suggestions; PR #14 in preview)

- Expand file previews from composer text attachments, saved chat file chips and generated file cards; close back into their source or fade safely if it disappeared. Composer photo thumbnails open the existing expanding photo viewer. No new preview type or external service is introduced.
- Attachment entry/removal reflows remaining chips and the tray height. Motion cancels safely on repeated actions and scope changes; discarded attachment copies never follow into another chat. Reduce Motion skips spatial animation.
- Manual test 1: attach a photo and a text file. Tap the photo, zoom, then close; tap the text file, close, and repeat quickly. Each preview should grow from its item and return without losing your draft. Also test a generated file card and Escape on desktop.
- Manual test 2: attach three files, remove the first and middle, then remove the last. Remaining chips slide together; the empty tray leaves no gap. Repeat while the tray is scrolled sideways, then switch chats during removal: no old attachment should linger. Check Reduce Motion: instant layout and usable previews, with no travel/zoom animation.
- Verification: type/unit/build passed, five production Chromium suites passed without retries, and all ten final attachment Chromium/WebKit configurations passed. Review fixes for scope cleanup and read-only uploaded HTML are regression-covered. All ten hosted Chromium/WebKit cases passed and preview JS/CSS bytes match the tested build. Full CI found an old ambiguous attachment-button selector in regressions.cjs; it now targets Remove draft.txt explicitly and the complete desktop/phone regression suite passes. Full CI rerun pending.
- Last live release: 2a05df8 / PR #13, deploy 39037626939 succeeded; full pre-merge CI 39036471501 passed. Live neutral opening, sliding highlight and keyboard reopening checks passed in Chromium/WebKit and hosted assets matched the tested build.

## Neutral ellipsis menu opening

- Touch/mouse opening focuses the menu container, so Rename is not highlighted before interaction. Keyboard opening still focuses the first action; ArrowUp/Down from the container enters last/first action.
- Manual test: tap … and leave your finger off the menu: no action should be highlighted. Hold and slide over actions: one highlight follows your finger. On desktop, focus … and press ArrowDown: Rename receives keyboard focus; Escape closes the menu.

## Sliding action highlight regression

- Keep the open-row exclusion at zero added CSS specificity, so the shared scrub-menu reset overrides native pressed fills. Before the fix, holding Rename then sliding to Pin left Rename filled as well.
- Manual test: open a chat menu, hold Rename and slide down to Pin/Archive, then back up. Exactly one rounded highlight should follow your finger; the starting action must clear. Slide outside and release to cancel; repeat through both long-press and … menus.

## Released chat-menu fixes (PR #13, live at 2a05df8)

- Held sidebar previews keep a rounded surface and the source row’s dimensions/typography; the portal no longer drops the bubble. Ellipsis-menu action presses/hover no longer apply the ancestor chat row’s pressed/hover fill.
- Manual test: hold an inactive chat, then the selected chat. Each title must stay inside a rounded lifted bubble. Dismiss; open each chat’s … menu, hold Rename, slide to Pin, then slide outside and release. Only the option highlight should move; the chat bubble must keep its color and no action should run after cancelling. Repeat in light/solid and dark/glass modes.
- Verification: type/unit/build passed; native-feel/sidebar/glass production suites passed without retries; all twelve updated hosted Chromium/WebKit menu configurations passed. Hosted JS/CSS bytes match the tested build (497b323). Test coordinates now wait for drawer/menu animations; the focused hosted WebKit case also passes with that wait. Full pre-merge CI 39036471501 passed; released with PR #13 at 2a05df8.
- Regression coverage: visible held surface and matching title size, stable selected row color during an ellipsis action press, plus existing slide/cancel/keyboard/project-scroll checks in six Chromium and six WebKit configurations. Linux WebKit does not prove physical iPhone rendering.

## Invariants and pointers

- BYOK providers: original free models retained; additional providers require explicit credit/charge opt-in. Preserve per-provider limits. Only confirmed disabled/retired models are removed; 429/key/network failures are not retirement. GitHub Models inference retired July 30, 2026; GitHub repository coding is separate.
- NVIDIA/Cloudflare default relay: https://model-router-provider-relay.model-router.workers.dev. Blank custom URL uses it; Cloudflare needs matching account ID/token. Worker stores no prompts/keys/logs; keep origin/route/body bounds, streaming, enable_request_signal and redirect rejection.
- Incognito: reserved `temporary-` IDs, RAM only. `lib/temporary-chat`, store, db and sync guard persistence; history/search/backups filter them. Memory reads/writes, `/remember` and reply memory markers are disabled. Branches and summarized continuations retain the prefix. Canvas/attachments/drafts remain unsaved. Leaving/reloading discards; exiting restores normal text draft. File and voice callbacks bind to their original chat/account; private speech playback stops on exit. Sync removals also reject temporary IDs, preventing tombstones. Provider requests and model usage still occur. Explicit external actions retain review gates.
- GitHub repository tokens moved from API keys to Settings → Connectors. Saved status is not verified access; test connection is read-only. `ConnectorsTab` uses existing GitHub key generation, invalidation and repository picker. Keep provider credentials/billing consent separate.
- Styles: one file, src/app.css (sections in cascade order; Identity last). Dark is cool blue-grey; true black remains black. Desktop model/project controls sit below composer; phone model stays next to +. Shared sidebar-scroll keeps navigation/history reachable with a fixed account footer. Native Camera/Photos cannot show device-gallery thumbnails. Tools subview retains existing capabilities.
- Preserve native zoom, phone inputs ≥16px, safe areas and 44px controls. `lib/viewport` and the phone-comfort section of app.css track iOS keyboard height/offset; menus fit visualViewport. `lib/focus-scope` handles nested inert/focus/Escape. Model/menu buttons inside forms must be type=button; keyboard navigation skips hidden controls.
- Projects: workspace uses activeProjectId; chat context uses chat.projectId. Composer assignment preserves the draft and chat ID. Workspace header must not change another chat's model. Greetings rotate only on New chat and stay stable while typing; no recommendation cards/subtitle.
- MessageThread windows >120 messages while retaining selection/focus. Timeline lines remain on phone/PC, excluding automatic context. Exact jumps preserve drafts and streaming reading position. Pointer/touch do not outline messages; keyboard destination focus remains.
- Model health: unavailableInfo keeps why/when a model was removed (check, chat or weekly auto check). The weekly background check (store.backgroundModelCheck, skipped under ?emulator) removes only `clearCut` results. Auto: settings.autoExcluded / autoPreferProvider feed lib/routing; replies keep routeDetail for the "Why this model" popover.
- Task notifications: lib/notify (only when the app isn't in front); src/pwa/sw.js handles taps and opens the task's chat.
- Coding writes require review/commit/PR actions. Plan approval binds device/account/repo/branch/context; edit decisions lock after commit. Undo supports latest single-parent commit only. See lib/{coding-plan,edit-review,commit-undo}.
- Knowledge originals/vectors stay local; page citations sync. Explicit Gemini indexing masks/reviews details, checkpoints and pauses on quota/hidden/offline/account/key/privacy changes. Scanned PDFs need OCR. Never prepare drafts after context/account changes. See lib/knowledge.

## Addresses (since 1.0)

- Live app: Firebase Hosting site `lumen-chat` (https://lumen-chat.web.app), `npm run deploy`.
- Old address `model-router.web.app`: `npm run deploy:forward` publishes forward/ (a page that sends visitors
  to the same path on lumen-chat and a service worker that removes the old offline copy). Its `dev` preview
  channel stays on the old site (`npm run deploy:preview`), because that address is set up for sign-in.
- Sign-in on a host needs: Firebase authorized domain + `https://<host>/__/auth/handler` in the OAuth web
  client's redirect URIs + the host in SAME_SITE_AUTH_HOSTS (src/lib/firebase.ts).
- Account deletion: src/lib/delete-account.ts (every collection under modelRouter/{uid}, share links, local
  databases, then the sign-in record). Add any new per-account collection there.

## Verification and release

- Windows: npm.cmd. `npm test`, `npm run build`, `npm run test:e2e:ci`. Java 21/Firebase emulators and Playwright Chromium required; browser cache `C:/Users/seife/AppData/Local/ms-playwright`. Do not rebuild dist while browser tests consume it.
- Firestore rules: `npm run deploy:rules` (scripts/deploy_rules.py, Rules REST API). Public share links live in modelRouterShares (public get, owner-only list/write).
- Main push runs tests.yml. Dispatch deploy.yml to release live/dev from one build; relay deploys separately via Wrangler. Match hosted JS/CSS to tested dist; hosted checks use isolated MR_TEST_URL fixtures, fake AI/GitHub and real browser Python for analysis.
- Release 15fc559 deployed live and preview successfully (38444336132). Hosted Chromium and WebKit passed all six layouts and four incognito/Connectors cases on each site; native safe-area checks passed three cases per site. Local type/build/unit, account/sync regressions and 156 accessibility scans passed. Latest 46-suite CI 38444319901 remains in progress; baseline 45-suite CI 38432567075 passed. Physical iPhone remains unverified.
- Hosted assets: index-DXd8MkMR.js / index-DADYABdN.css. Actual paid inference remains unverified. No next roadmap task is authorized.
