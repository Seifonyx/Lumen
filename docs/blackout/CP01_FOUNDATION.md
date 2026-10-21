# CP01 — isolated implementation foundation

21 October 2026. Owner accepted the Canvas blueprint and authorized **CP01 only**: contract characterization, additive typed presentation interfaces, isolated scoped tokens and physical-device feasibility investigation. Gate 1 approved; Gates 2/3 pending. No CP02+, production visual migration, auth/routing/storage/billing change, preview exposure, merge or deployment.

## Execution ledger

Source base: `df54edf244ccadf6886f0608f230631fe3b52dee`. Live checkpoint recovered: `d1bccab78fbbf0992a53e1603890c502dd968130`, including ChatGPT's blueprint review. Available worktree was clean; unrelated worktrees preserved. Existing master requirements, blueprint and canonical ownership remain authoritative.

| Task | Deliverable / acceptance | State |
|---|---|---|
| CP01.1 | Existing production and approved-preview behavioral characterization with existing synthetic profile/fixtures; no new expansion behavior | Verified: 12 Chromium/WebKit cases; expected remount-negative failure |
| CP01.2 | Export current props; type-only App/Sidebar/ChatView/Composer presentation contract, positive and negative compile checks; no runtime wiring | Verified RED → GREEN compile checks |
| CP01.3 | Namespaced semantic Canvas token adapter, test-only loading; existing materials inherited; no production import | Verified RED → GREEN token assertions; scoped browser/theme checks |
| CP01.4 | Type/build/unit/browser checks; module-graph isolation audit and unchanged-build comparison; device feasibility; focused evidence | Verified: type/unit/build/audit/matrix plus all6 focused existing suites pass |
| CP01.5 | Whole-change review, plan/handoff/remote synchronization; stop for owner/ChatGPT review | Verified source/docs and independent review; final remote refs recorded in delivery/live checkpoint |

**Pre-flight interfaces:** CP01.1 characterizes existing owners consumed by CP01.2; CP01.3 only supplies named custom properties for a later presentation, not a replacement stylesheet. CP01.4 must verify that CP01.2 erases at build time and CP01.3 never enters the default import graph. No task owns routing/auth/storage changes.

**Ruling:** the owner-approved blueprint already supplies the design/spec; do not repeat brainstorming or seek renewed design approval. Use this existing-workstream ledger for task status because cloud skill helper executables are unavailable locally. Cost if wrong: documentation-tool convenience only, not product behavior.

**Ruling:** component-interface preparation exports the current contracts and a type-only composition map; no injectable replacement UI, expansion controller or alternate App state is implemented. The already-approved isolated Canvas proof supplies expansion characterization. Cost if wrong: CP02 will still need explicit production wiring, correctly outside CP01.

## Interfaces and isolation design

Implemented: export current `AppProps`, `SidebarProps`, `ChatViewProps`, `ComposerProps`; type-only `WorkspacePresentation` map in `src/lib/workspace-presentation.ts`. Composer retains its actual model, ModelPicker and UsageMeter slots; App's no-prop contract stays no-prop. No callbacks for sending, credentials or state replacement are added. Existing caller behavior and emitted production assets must be unchanged.

Implemented token owner: `src/styles/canvas.css`, under `[data-lumen-canvas-foundation]`, setting **only `--canvas-*` custom properties**. It inherits the production theme/glass values and approved Canvas geometry/type proportions. No root/global resets, font/network loading, component rules or production import. Browser characterization explicitly loads it explicitly into a test-owned scope. Actual Canvas visuals remain the existing approved preview; this adapter does not migrate them.

Existing isolated entry remains `docs/blackout/workspace-proofs/index.html` → `bootstrap.ts`, with its localhost/account/transport checks unchanged. Tests use the existing `profile`/`seed` utilities and proposal fixture. No new routable preview entry or permission flag is needed. The ordinary root entry remains `index.html` → `src/main.tsx`.

## Verification ledger

Baseline/final logs, full graph and hashes, expected-failure evidence and browser JSON are outside Git in `/tmp/lumen-cp01/`. The concise committed evidence file accompanies this note. No historical runtime pass is claimed as a fresh result.

| Check | Actual result |
|---|---|
| Clean baseline `npm test` and ordinary `npm run build -- --outDir /tmp/lumen-cp01/baseline-dist` | Passed before production source edits |
| New compile contract before exports | Expected RED: missing App/Sidebar/ChatView/Composer props and composition-map exports; after type-only preparation, GREEN including negative credential/dispatch/store/readonly cases |
| Token foundation before implementation | Expected RED: missing foundation assertion; after scoped variables, both new unit cases pass |
| Final `npm test` | Typecheck and all **80 unit-test files pass**, including new foundation/compile checks |
| Proof `tsc -p docs/blackout/workspace-proofs/tsconfig.json` | Passed |
| `CP01_BASELINE_DIST=… node tests/security/canvas-build-isolation.mjs` | Ordinary production build passes; **2,556 graph modules inspected**, proof/test/type-map/token paths absent; **174 emitted artifacts have identical names and SHA-256 bytes** to baseline; 5 negative import controls and known-marker checks pass |
| New browser contracts | **12 cases pass**: ordinary built App and approved Canvas proof × 1440×960 / 390×844 / 320×568 × Chromium 141 / Linux WebKit 26.0, Playwright 1.56.1 |
| Remount negative control | Expected failure when an expanded proof textarea is deliberately replaced; ordinary successful run preserves same node/Unicode draft/backward selection/focus |
| Preview/runtime isolation | Both engines pass 4 boundary checks: normal-account rejection even with forged harness flag, non-localhost denial, manual fixture transport blocking, ordinary build ignores proposal query |
| Existing focused browser suites | All6 passed against the final built artifact: usage-draft, chat-menu, selection-boundaries, model-picker-accessibility, incognito, account-isolation |
| Independent read-only review | No Important/Critical findings. Reviewer personally ran both foundation unit cases/compile checks, script syntax checks and diff check, independently hashed all174 baseline/final artifacts; did not rerun browser matrix |

### What the characterization proves

The tests use canonical UI controls and existing synthetic `profile`/`seed` and proposal fixtures. The existing approved Canvas proof, not a new production controller, supplies expansion. Repeated expand/Done/Escape retains textarea identity and backward selection; real Auto/manual/Layout changes, picker Tab/Enter and UsageMeter restore focus without sending. Chat/reload/project round trips preserve the per-chat draft. Incognito draft stays out of localStorage; exit restores the normal draft. One held synthetic provider call is explicitly sent then cancelled by real Stop. Reload into another synthetic account does not reveal the first account's chat/draft. No live inference or physical-device behavior is claimed.

The module graph is the ordinary configured Vite build; the observation-only plugin does not alter its entry or emitted assets. Negative controls prove the auditor rejects forbidden paths, including CSS/query and Windows forms. Exact asset equality supplies strong evidence of unchanged production appearance and behavior for this revision. This is not a claim that TypeScript is an authorization mechanism, that an audit can predict every future source edit, or that hypothetical CP02 wiring is already implemented.

### Failures encountered and scope limits

- Initial Chromium launch lacked its pinned binary: downloaded Playwright's existing-version Chromium into a temporary test cache. Host WebKit lacked native libraries: used the official Playwright 1.56.1 Noble Docker image (digest `sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a`) with read-only repository mount. No dependencies/configuration were added to the project.
- Initial browser test assumptions were corrected against canonical behavior: reload does not promise automatic reopening of the same chat; a folded project must be opened before clicking its child; an unconfigured second account may show setup over the still-mounted composer; Incognito starts from an empty chat. No product behavior or assertions were weakened to hide a failure. All final cases pass without automatic retries.
- Build logs include existing ineffective dynamic-import warnings and the expected external-outDir notice. No new compiler error or suppressed warning.
- Final self-review found that the proof-only boundary script requires an explicit local server URL and would fail automatic built-app discovery. Reproduced that failure, moved it to `tests/security/canvas-preview-isolation.cjs`, then reran it successfully in both engines, reran all80 unit files, and ran ordinary `canvas-integration` without a proof URL (3 cases pass). No pipeline changes or silent skipped cases.
- Send/Stop is characterized with cancellation before response delivery, not partial-stream retention. Account boundary characterization uses reload, not an actual live auth transition. Existing account/temporary-chat tests supplement it; no emulator-backed full-suite, physical-iPhone, VoiceOver, IME/undo/device gesture or live-provider claim.
- Reduced motion and light/dark/black token aliasing are browser-verified; reduced-transparency rules are source/AST reviewed, not physically verified. Context/picker/usage contracts preserve their canonical data semantics; no new telemetry or quota data is introduced.

## Focused visual evidence

These are **ordinary production App** captures using the existing synthetic fixture, not Canvas migration or physical-iPhone screenshots. Desktop1440×960 and phone390×844 baseline/final PNG bytes match exactly. Only one copy per viewport is committed; the duplicate baseline is retained in the temporary evidence directory. Both captures were visually inspected. No new concept or historical screenshot collection was generated.

[Ordinary desktop](cp01/ordinary-desktop.png) · [Ordinary phone](cp01/ordinary-phone.png) · [Concise machine evidence](cp01/evidence.json)

## Reproduce / owner-review checks

Use existing Node22 dependencies; no new package, backend or auth setup. Logs/output should remain outside Git. The build-isolation script audits the ordinary configured Vite graph; setting `CP01_BASELINE_DIST` additionally checks exact artifact equality when the pre-change baseline is available.

```sh
npm test
node node_modules/typescript/bin/tsc -p docs/blackout/workspace-proofs/tsconfig.json
CP01_OUT=/tmp/lumen-cp01-review node tests/security/canvas-build-isolation.mjs
```

For browser checks, start the existing Vite source server and the audited ordinary build **on loopback only**, each in its own terminal. The proof is the existing guarded entry; no new hostname allowance or public delivery is needed for local automated checks:

```sh
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5196 --strictPort
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5198 --strictPort --outDir /tmp/lumen-cp01-review/production-dist
MR_TEST_URL=http://localhost:5198/ CP01_PROOF_URL='http://localhost:5196/docs/blackout/workspace-proofs/?proposal=canvas' node tests/e2e/canvas-integration.cjs
MR_TEST_URL=http://localhost:5198/ CP01_PROOF_URL='http://localhost:5196/docs/blackout/workspace-proofs/?proposal=canvas' node tests/security/canvas-preview-isolation.cjs
```

Use `MR_WEBKIT=1` on a host with matching Playwright WebKit dependencies (this session used the official container). Running `canvas-integration` without `CP01_PROOF_URL` deliberately runs the ordinary-build contracts only; the explicit preview boundary script lives outside ordinary E2E discovery and requires its URL. Stop owned servers after review.

**Something to test:** in a synthetic local session, type/select a multiline draft, switch Auto/manual/Layout, open and dismiss Usage, change chats/projects, and verify the draft remains; in the existing Canvas proof, expand/Done/Escape and verify the same selection. Explicitly Send then Stop with intercepted transport. Do not use real provider keys to test CP01. The default application's appearance is expected to remain unchanged.

## Device preparation

**Verified environment:** remote Linux, no `/dev/bus/usb` device tree and no `xcrun`, `idevice_id` or `usbmuxd` executable. No attached iPhone, Mac Safari or real device-service session is available. Docker WebKit remains Linux WebKit. CP01's three owned test servers were confirmed listening only on `127.0.0.1` (5196–5198); no Vite/hosting/auth configuration or preview guard was changed. Temporary servers are stopped at handoff.

| Option | Feasibility / boundary |
|---|---|
| Existing localhost preview on an attached iPhone | **Not currently feasible.** The iPhone's localhost is itself, not this remote computer. Safari Web Inspector over USB does not itself forward the Mac/Linux localhost server into iPhone Safari. No verified transparent device-local path is available here. |
| Owner-controlled Mac + iPhone / Safari Web Inspector | Useful for inspecting real touch/keyboard/compositing once an authorized device-reachable build exists; requires the owner's hardware and device setup. It is not an emulator available in this cloud or an automatic way around the current origin guard. |
| Private device delivery or narrowly constrained local test host | May be designed later with explicit owner approval for the exact origin/access/lifetime and synthetic transport. No LAN bind, public tunnel, host allowance, preview channel, TLS/auth-domain change or distribution was performed or authorized by CP01. |
| Existing Linux WebKit and short viewport simulation | Feasible and run for layout/state regression only; cannot close physical iPhone keyboard/glass/touch/VoiceOver acceptance. |

**CP02 prerequisites:** separate owner authorization, a reviewed device-access method, canonical same-input/focus/gesture/viewport integration design, and its acceptance tests. Physical access is unresolved, not silently waived. No new device-service account, paid usage or third-party software on the owner's phone was requested.

The concurrent live-context clarification at `3a0bf755da9b27577a237b906649fb127ef4ac70` was read and preserved: higher visual polish is an acceptance lens for CP02–CP04/Gate2, not permission to expand CP01 or copy reference layouts.

## Stop boundary

Stop after CP01 commit/push and separate public-safe live checkpoint verification. CP02 and later require separate owner authorization, regardless of green tests. No merge/deployment or Gate 2 approval.

## Final scope and progress

CP01 is complete as an isolated foundation, not a production visual integration or completed B03/B07 phase. **21.5% → 21.5%, Medium confidence**; all stable v1 weights/fractions unchanged (78.5 remaining). Scoped token aliases and type preparation do not complete any entire existing four-part acceptance group. No unrelated progress or user-approval credit is added. CP02–CP06 remain not started/unauthorized.

**Final review ruling:** keep preview-only checks outside automatic built-app test discovery—ordinary CI must not require a manually started exploratory server. Cost if wrong: reviewers must invoke the explicitly documented preview command to obtain those additional guard results. No deferred reviewer minors; remaining device/runtime-composition limits are CP02 prerequisites, not hidden CP01 claims.
