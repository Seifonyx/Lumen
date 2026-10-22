# Lumen Blackout — cross-agent handoff

> **Historical workstream log — not current authorization.** For the current workstream state, latest owner decisions, next action and Gate approvals, read [the compact live checkpoint](https://github.com/Seifonyx/Lumen/blob/docs/lumen-live-context/docs/lumen-context/CURRENT_STATUS.md). “Latest”, “Next”, “STOP” and “unauthorized” inside dated sections below describe what was true **when that section was written**, not what is authorized now. At meaningful milestones update the live checkpoint and this handoff's newest milestone section without erasing older evidence. The frozen progress ledger is in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Latest — CP03 sidebar polish + CP04 Routing Center (implemented, verified; owner iPhone review next)

The owner authorized both in one assignment. See [CP04_ROUTING_CENTER.md](CP04_ROUTING_CENTER.md).
- **Sidebar:** one heading-free, newest-first list with pinned first.
- **Routing Center:** a canonical `RoutingCenter.tsx` reusing `setChatModel`, `LayoutEditor`, `UsageTab`, `RouteWhy`, `FilterMenu` and Settings → Keys. Its lazy loader exists only in the QA switch replacement; production is byte-identical.

**Verified:** all four browser contracts (CP04, CP03, CP02, QA) in Chromium and WebKit, isolation 8/8, the CP01 check and `npm test`.

**Not authorized:** CP05, merge, deploy, spending or Gate 2. Progress 21.5%.

## Previous — CP03 Canvas navigation, header and reading (implemented, verified; stop for owner review)

The owner accepted CP02 and authorized **CP03 only**. See [CP03_SHELL.md](CP03_SHELL.md).
- A canonical `SidebarCanvas` (unified Projects/Conversations tree, reusing `ChatRow` and Sidebar's state), a CSS breadcrumb and Canvas reading are all behind `CANVAS_SHELL = false`.
- Production is byte-identical. The QA review build turns the shell on and seeds the synthetic projects.

**Verified:** CP03 and CP02 contracts in Chromium and WebKit, the QA browser contract, isolation 8/8, the CP01 check and `npm test`.

**Next:** owner iPhone review (Reset the review to load the projects). No CP04, merge, deploy or Gate 2. Progress 21.5%.

## Previous — CP02 confirmed on a real iPhone (owner-run, 22 October 2026)

The owner tested CP02 in one private $0 Codespace; all eight physical items passed (see [CP02_COMPOSER.md](CP02_COMPOSER.md)).

Fixed afterwards:
- automatic start now runs from a VS Code folder-open task (to confirm on the next start);
- the review link without its trailing slash is redirected;
- the "~1 token" label.

Codespace start also fast-forwards to the latest branch commit, so the owner keeps one Codespace for future tests. Gate 2 not marked approved; no CP03, merge or deploy. Progress unchanged at 21.5%.

## Previous — CP02 Canvas composer + QA fixes (implemented, verified; stop for owner review)

Owner authorized two QA-only fixes and **CP02 only**.

**QA fixes** (`7c628bb`, `5065ff7`, `64f7fdc`):
- The review banner takes its own layout row. The app, phone drawer and keyboard layout start below it, with a 0 px gap asserted in both engines.
- The Codespaces start is now a foreground `postAttachCommand` script with timed logs and clear `FAILED:` messages. See the [session guide](QA02_CODESPACES_SESSION.md).

**CP02** (`e0196eb` code, `ea3954c` tests) — read [CP02_COMPOSER.md](CP02_COMPOSER.md):
- The canonical Composer gains resting/engaged/expanded states and a writing sheet through `ComposerCanvas.tsx`. It reuses the existing focus-scope, sheet-drag and viewport hooks.
- It keeps the same mounted textarea, draft, attachments, Send/Stop, picker and usage controls.
- `CANVAS_COMPOSER` is `false`, so production output is **byte-identical (174 files)**. Only the synthetic QA review build turns it on.
- **Verified:**
  - `npm test`;
  - the new CP02 browser contract, Chromium and WebKit × 4 viewports;
  - the existing QA browser and Codespaces contracts;
  - the QA01 isolation audit 8/8, with the guard deliberately allowing exactly the 4 CP02 files with the flag off;
  - the CP01 graph check.
- **Open:** 8 physical-iPhone confirmation items, listed in the record.

**Exact next action: STOP for owner review.** Only the owner may create the next Codespace (it will serve the Canvas composer automatically). No CP03, merge, deploy, Gate 2 or paid service.

## Previous — first private Codespaces iPhone session succeeded (owner-run)

Owner ran one $0 session per [QA02_CODESPACES_SESSION.md](QA02_CODESPACES_SESSION.md): no payment method, Codespaces $0, no secrets; port 4173 Private; iPhone Safari GitHub sign-in and the synthetic app worked; composer/keyboard/picker/Send/Stop/scroll/navigation/rotation reported OK; Codespace deleted. Follow-ups: QA banner overlaps the page top; `postStartCommand` did not start automatically (manual start documented). Served app is the ordinary app; CP02 not started. Progress 21.5%. **Next: owner decides on CP02.**

## Previous — Codespaces private-port QA adapter (implemented, locally verified)

Owner authorized the QA-only Codespaces adapter; Cloudflare Z1 stays paused. Read [QA02_CODESPACES_SESSION.md](QA02_CODESPACES_SESSION.md). Added `scripts/qa/serve-codespace.mjs` (QA01 gate on 127.0.0.1; Codespace-only; verified build only; forwarded/loopback hosts only; discards browser identity and signs its own synthetic identity), `.devcontainer/devcontainer.json` (Node 22, builds and serves port 4173, no visibility override, no secrets), `server/private-qa/memory-storage.mjs` (moved from fixtures), unit + browser tests. **Verified at code commit `ac93683280f5dc4d8a2aaaf0df20f05d4fb1fee7`:** `npm test` 84 files; QA01 isolation 8/8 with production output byte-identical (174 files); Codespaces browser smoke Chromium + Linux WebKit at 390×844/1440×960. **Not executed:** a real Codespace, GitHub's port proxy/sign-in, iPhone Safari. Owner $0 checks and session/teardown steps are in the guide. **STOP; the first private Codespaces session needs separate owner authorization.**

## Previous — Codespaces private-port feasibility (planning only)

Owner paused the Cloudflare passkey/Durable Object Z1. [Feasibility](QA02_CODESPACES_FEASIBILITY.md): a temporary GitHub Codespace serving the QA01 build on a **private** forwarded port (creator-only GitHub sign-in, 3 h cookie) is viable at $0 when no payment method is on file (free quota 120 core-hours/15 GB-month; use is blocked, not billed, when exhausted). Smallest change for approval: `scripts/qa/serve-codespace.mjs` (reuses QA01 gate, injects synthetic identity, Codespace/host-restricted) + `.devcontainer/devcontainer.json` (private port 4173). Owner checks: no payment method; Safari cookie behaviour on first session. **STOP for owner approval.**

## Previous — $0 passkey security amendment (paused)

Read [QA02_PASSKEY_AMENDMENT.md](QA02_PASSKEY_AMENDMENT.md). Corrects the $0 revision: stateless signed challenges are **not** single-use and config changes are not globally immediate. Adds one SQLite-backed Durable Object (documented as available on Workers Free; over-quota fails, no overage) as the atomic authority for one-time challenges, single enrolment, opaque sessions, credential/session revocation and kill switch; fail closed on any DO error. `@simplewebauthn/server` (documents Workers support) with exact origin/RP ID and user verification; `jose` dropped. Owner checks V1–V5 (Workers Free, no billing prompt on the first DO migration, account MFA). Exact Z1 local-only scope and replay/concurrency/enrolment/session/storage-failure/bypass/revocation tests defined. **STOP for owner and ChatGPT review.**

## Previous — strict $0 QA02 architecture revision (amended by the passkey amendment)

Read [QA02_ZERO_COST_ARCHITECTURE.md](QA02_ZERO_COST_ARCHITECTURE.md). Owner made **$0 a permanent hard requirement**. Cloudflare Access is excluded (Zero Trust onboarding requires entering payment details even on Free; MFA plan availability unknown), and so are R2 (card may be required) and every paid fallback from QA02-A. **Recommended:** one Worker on **Workers Free** + Static Assets with `run_worker_first: true` (Worker checks every request) + **self-hosted passkey (Face ID) sign-in** using pinned `@simplewebauthn/server` and `jose` sessions; registry/expiry/revocation as deployment configuration (no KV/R2); integrity verified before upload and by a post-deploy sweep instead of per-request hashing (fixes the 10 ms CPU risk). Stages Z0 (owner read-only checks O1–O4) → Z1 local code + review → Z2 deny-only → Z3 passkey + canary → Z4 revocation/teardown → Z5 QA03; tests A1–A12, R1–R5, S1–S5, B1–B2. Fallback if Z1 review or O1 fails: local-only testing. Nothing created or deployed.

**Exact next action: STOP for owner and ChatGPT review.**

## Previous — QA02-A Cloudflare readiness preflight (superseded on hosting/cost by the $0 revision)

Read [QA02A_PREFLIGHT.md](QA02A_PREFLIGHT.md). Owner authorized QA02-A only after accepting QA01. **No Cloudflare account access exists in this session** (no token/login/account; relay secrets not read) and direct fetches of developers.cloudflare.com are refused by the session network policy, so capabilities come from search summaries of Cloudflare's own docs/changelog and are listed as **owner checks**, not verified facts. Nothing was created, enrolled, configured, deployed, paid for or exposed.

**Findings:** Access Free covers ≤ 50 users at $0; independent MFA (Face ID passkey/TOTP, per application) exists but its plan availability is **unknown**; one-click Access for Workers covers workers.dev + preview URLs (shared preview policy); Workers Free 100k requests/day and **10 ms CPU per request** — QA01's per-request SHA-256 of large files may exceed it (new finding; canary must measure; fix via stored R2 checksums or $5 Workers Paid); R2 free tier 10 GB, payment method possibly required to enable; R2 tokens can be bucket-scoped, Worker deploy tokens assumed account-wide; budget alerts are informational, never caps.

**Decisions recommended:** pinned `jose` (Cloudflare's documented Access-JWT pattern) in the QA Worker package only, keeping QA01's policy layer and all negative tests; QA-only per-namespace swap of five device-wide preferences (`mr.settings`, `mr.activeProject`, `mr.sidebarCollapsed`, `mr.canvasWidth`, `mr.sideWidth`) in `qa/iphone/main.tsx` before QA03 — no production change. Owner-only login with OTP + Face ID passkey MFA preferred.

**Rollout:** step 0 owner read-only dashboard checks → 1 local code (jose, deny/canary Worker, CPU-light integrity, device-key fix) → 2 Access/MFA setup → 3 deny-only Worker → 4 R2 + harmless canary → 5 iPhone Safari login/MFA → 6 revocation/teardown rehearsal → 7 QA03. Each step lists its required approval; tests D1–D8 and C1–C10 defined. **Target $0/month; worst case $12/month** ($5 Workers Paid + $7 Access seat) only with explicit approval.

**Superseded by the $0 revision.** (Was: owner can do step 0 (read-only checks, report privately). Steps 1–7 each need the explicit approval named in the preflight.

## Previous — QA01 local private-testing foundation (verified; stop for review)

Read [QA01_FOUNDATION.md](QA01_FOUNDATION.md) and [qa01/evidence.json](qa01/evidence.json). Owner authorized **QA01 only** after the [QA proposal](PRIVATE_IPHONE_QA_PROPOSAL.md). Codex's partial ledger reached Claude Code as an upload; **its in-progress QA01-A code was not accessible** (remote ended at `88c7baa`; no local QA01 files, stash or worktree) and was re-implemented from the proposal, not claimed as recovered. Codex's two rulings (ordinary presentation, no CP02; WebCrypto RS256 with injected test keys, no new dependency) were kept.

**Implemented:** `server/private-qa/` (paths, RS256 verifier, manifest/registry/publish/revoke with conditional writes and revocation tombstones, fail-closed gate with per-request registry reads and private/no-store/CSP headers); `vite.qa.config.ts` + `qa/iphone/` (separate synthetic build: Firebase/sync/SW replaced at build time, Firebase SDK stubbed, every app `fetch` rewritten and the page-wide `fetch` replaced by a deterministic local Gemini transport, workers disabled, lease lock, synthetic banner, per-reviewer/build namespace and fixtures, canonical App/store/Composer/picker/usage/Incognito unchanged); `scripts/qa/{audit,build,verify}.mjs` (commit-pinned, clean-tree-only, no network/credentials/publication); tests in `tests/unit/private-qa-*` (CI via `npm test`) and `tests/security/private-qa-{isolation,browser,local-gate,fixtures}.mjs`. `.gitignore` adds `dist-qa`. **No `src/`, root entry, Vite production config, packages, Firebase config/rules, relay, `public/`, workflow or localhost proof file changed** (asserted against `88c7baa`).

**Verified at code commit `d0ef5f84b0d949ca1612453e45ccd937985caeeb`:** `npm test` 83 unit files (new: gate 14, control 10, transport 8 cases); isolation audit 8/8 with production output **byte-identical (174 files)** to the pre-QA01 baseline and planted controls (11+4 graph, 1 missing adapter, 10 output, 4 real planted builds, `?raw`, 12 transform, 4 verifier) all caught; browser contract **Chromium 141 and Linux WebKit 26.0** at 1440×960/390×844/320×568/390×480: 0 external requests, 0 blocked app hosts, 0 refused Firebase calls, 0 CSP violations, 0 page errors, 0 service workers, 0 overflow, 0 axe; draft/selection through picker/usage, synthetic stream and real Stop; planted fetch refused by transport, XHR/WebSocket/image/SW refused by CSP, CSP-bypassed detector control caught; reviewer namespaces separate; revocation and expiry lock open pages and refuse reloads. Six existing Chromium suites pass on the ordinary build. Failures and fixes are recorded in the QA01 note.

**Independent review:** no Critical; 3 Important (72 h bound from publication time, ASCII-only identity, indirect fetch) all fixed with tests; 10 minor/test findings fixed; 2 documented — **JWT library vs hand-written WebCrypto verifier needs explicit owner/ChatGPT sign-off before QA02**, and canonical `mr.activeProject` stays device-wide (changing it would touch production `src/`).

**Not claimed:** physical iPhone, hosted Access/MFA/JWKS/R2/Worker behaviour, live providers, production verification. No Cloudflare/hosting/credential/tunnel/Firebase change, preview publication, merge or deployment. CI artifact handoff is documented only (QA01 note).

**Progress:** QA01 is unweighted preparation; **21.5% → 21.5%, Medium confidence.**

**Superseded:** QA01 accepted; see QA02-A above. QA02 (service/access/budget/canary, plus JWT-verifier sign-off), QA03 (publication/tooling) and CP02 each need separate explicit authorization.

## Previous — QA00 private iPhone testing decision proposal

Read [PRIVATE_IPHONE_QA_PROPOSAL.md](PRIVATE_IPHONE_QA_PROPOSAL.md). Owner wants reusable, strong-access-controlled, versioned, synthetic-only iPhone Safari testing without Mac/USB. This supersedes the CP01 stop **only for planning/documentation**. No QA infrastructure/adapter implementation, service enrollment/account creation/spending, remote publication/tunnel, host/auth/Firebase change, CP02, merge/deploy or Gate2 approval.

**Recommendation:** dedicated Cloudflare Access-protected QA Worker, private R2 serving store/control registry and private short-lived CI staging. Stable protected entry, immutable SHA/run-pinned builds, exact reviewer identity + MFA/JWT, per-request strong registry expiry/revocation, no public assets/aliases or SW. Proposed defaults:8-hour login/MFA,72-hour builds,3 active builds,7-day serving-object retention. Preserve production Firebase/relay and localhost proof. Build-only adapters must remove Firebase/live transport/SW without a second state/routing owner; the existing seeded proof is not sufficient remote isolation. No testing link exists.

**Research/decision evidence:** inspected current manual Firebase preview/deploy, Cloudflare relay tooling, normal build/PWA and Firebase/sync initialization, canonical fixture/contracts and proof bootstrap. Retrieved/read official Cloudflare Access/routing/JWT/MFA/R2/consistency/pricing, Firebase preview/multisite, Google Cloud Run IAP and GitHub workflow/environment/artifact documentation. Firebase hashed preview links are public; ordinary public Actions artifacts are not private delivery; a new manual workflow needs separate default-branch tooling approval. Secure CI staging is explicit and still needs QA01 tests. Vendor/account feature and token scopes are not presumed available. Free-plan cost is conditional; no old seat-price guarantee. No completed design/9Router research repeated.

**Recovery:** clean root worktree at local/remote `c9153fd75ba16ebf70908f5d8c092cb540b9aa58`; PR34 draft/open/unmerged. Read all three live files from actual remote `f26f835e19be3aad266e8161b78711ad6906cfa9`, including owner planning authorization, CP01 review and polish clarification; preserve concurrent changes. Existing separate live worktree was clean; fast-forward/re-read before its update. Unrelated worktrees/WIP untouched. No reset or force push.

**Verification this session:** source/workflow/bootstrap and complete intended diff review; primary-source retrieval/read; **128 local Markdown link targets resolve**, six authorized Markdown paths only, all weighted rows unchanged (100/21.5/78.5); **10 explicit master/amendment/Continuum/bootstrap/build/hosting/deploy files byte-identical** and zero runtime/config/test changes; `git diff --check` passes. Fresh GitHub query confirms previous [CP01 CI39631070563](https://github.com/Seifonyx/Lumen/actions/runs/39631070563) completed successfully at c9153fd, all3 jobs; this supplements its earlier local-only snapshot, not a new runtime test. Product types/build/unit/browser, hosted security/expiry, physical iPhone and live-provider tests were **not rerun** for Markdown-only QA00. QV01–QV10 are proposed acceptance, not passes. One supplementary token-document URL returned403; prefix-scoped temporary-token support remains explicitly unverified, not a claimed capability. No new infrastructure or external preview access was tested.

**Progress:**21.5→21.5%, Medium confidence,78.5 remaining; original stable rows/weights and masters preserved. QA00–QA04 are unweighted preparation, not new implementation credit. The original Canvas/provider/CP01 proof and regression evidence remain unchanged.

**Changed paths:** new proposal; current scope/recovery links in root AGENTS, Blackout plan/handoff, blueprint and CP01 report. Markdown only. Operational risks: service entitlement/MFA from actual Safari; exact QA adapter/transitive-import isolation; private build handoff/credential scope; revocation of already-delivered bytes impossible; trusted-JS same-origin storage limit; native keyboard/glass/VoiceOver still untested. Proposed mitigations, phase gates, operational estimates and owner decisions are in the proposal.

**Git:** `docs/lumen-blackout-phase1-20261019`, source base/latest implemented CP01 `c9153fd75ba16ebf70908f5d8c092cb540b9aa58`. QA00 local/pushed revision is this containing documentation commit (resolve `git log -1 --format=%H -- docs/blackout/PRIVATE_IPHONE_QA_PROPOSAL.md`); remote equality is checked after push and the separate live checkpoint records the exact SHA. Latest observed main `655438f0ec8d2e3594595252af4a99e6c58627a0`; latest separately previously verified deployed runtime `677bc51f39fbf8fcf66bc91f846b71a4912bb306`, deployment39447533639. No fresh production verification, merge or deployment. Separate live-context commit is verified/reported independently, not merged into this workstream/main.

**Superseded by QA01 above.** (Was: STOP for owner/ChatGPT review of this proposal.) Recommend separately authorizing QA01 local-only adapters, gate contracts and isolation tests first; no service provisioning in that slice. QA02/QA03 hosting/access/publication and CP02 product work each need explicit authorization. No new owner decision is inferred from delivery.

## Previous — verified CP01; stop for owner/ChatGPT review

Read [CP01 implementation, commands, failures, limits and device preparation](CP01_FOUNDATION.md), [machine evidence](cp01/evidence.json) and the [accepted blueprint](CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md). The owner explicitly authorized CP01 only after accepting the blueprint. This supersedes the prior blueprint-only stop, not the remaining phase/release boundaries.

**Implemented:** export existing App/Sidebar/ChatView/Composer props; type-only `WorkspacePresentation` composition contract; positive/negative compile cases; `[data-lumen-canvas-foundation]` custom-property adapter, loaded only by explicit tests; canonical ordinary/approved-preview regression coverage and production-graph/guard audits. Production source changes erase at compilation. No new runtime composition/expansion state, navigation, provider/routing/auth/credential/storage/billing owner, dependency, network permission, schema, build/CI pipeline or entry point. Existing proof/bootstrap/guard functionality is unchanged. App's existing guest-preview support remains canonical; no new test authentication was introduced.

**Verified now:** baseline/final typecheck + all80 unit files; proof TypeScript; production build audit (2556 modules,174 artifacts byte-identical to baseline,5 negative import controls and output markers);12 Chromium141/Linux WebKit26.0 cases at1440×960/390×844/320×568;4 preview-boundary checks per engine;6 existing Chromium suites (usage-draft, chat-menu, selection-boundaries, model-picker-accessibility, incognito, account-isolation);3 ordinary default invocation cases; desktop/phone baseline/final screenshot byte equality. Both committed ordinary-App captures were visually inspected. All final tests pass without automatic retries. No physical-iPhone/live-provider/full emulator-suite result is claimed.

**Failure/evidence provenance:** watched missing exported-type and missing-token assertions fail before implementation, then pass; deliberate textarea replacement causes the preservation test to fail. Initial browser setup/fixture-workflow assumptions and the proof-test-discovery issue were diagnosed/corrected and recorded; no runtime behavior or failing assertion was relaxed. Host WebKit dependencies were unavailable, resolved using the official matching Playwright container with read-only source mount. New proof-only boundary checks live at `tests/security/canvas-preview-isolation.cjs`, outside ordinary built-app discovery. Existing Vite dynamic-import/outDir notices remain documented.

**Review:** one independent read-only review found no Important/Critical issues; personally reran foundation unit/compile and syntax/diff checks and independently compared all174 hashes. Browser matrix was not independently rerun. Subsequent self-review caught the explicit-server test discovery issue; reproduced failure, moved that test, reran both engines/default invocation/full unit suite. No deferred reviewer minors. New Send/Stop checks cancel before response delivery; account boundary check reloads between accounts. Partial-stream retention, live auth transitions, physical keyboard/touch/IME/undo/VoiceOver and CP02 composition are not claimed.

**Progress:** no new weighted credit: CP01 is a verified unweighted foundation subset, not any complete B03/B07 acceptance group. B02.3 remains the sole +3-point approval decision already scored at21.5%; all other weights/fractions and original master bytes preserved. Higher visual-polish feedback on live context `3a0bf755da9b27577a237b906649fb127ef4ac70` was read/preserved; it applies later, not as an expansion of CP01.

**Git/state:** branch `docs/lumen-blackout-phase1-20261019`, draft [PR #34](https://github.com/Seifonyx/Lumen/pull/34), base `df54edf244ccadf6886f0608f230631fe3b52dee`. The CP01 source/doc revision is this containing milestone commit (resolve `git log -1 --format=%H -- docs/blackout/CP01_FOUNDATION.md`); exact local/pushed equality is verified at delivery and the separate live checkpoint records its full SHA. No unfamiliar WIP was reset; other worktrees were untouched. Separate context worktree was fast-forwarded through the concurrent reviewer/owner updates before editing; current read base `3a0bf755…`. Re-read its remote before pushing; never overwrite new status. Final owned test servers are stopped; raw logs/duplicate captures/build outputs remain outside Git in `/tmp/lumen-cp01/`.

**Production:** latest observed merged main `655438f0ec8d2e3594595252af4a99e6c58627a0`; latest separately previously verified deployed runtime `677bc51f39fbf8fcf66bc91f846b71a4912bb306`, deployment39447533639. No new main commit, production verification, merge or deployment. Ordinary emitted files/screenshots are identical; Canvas has not been migrated.

**Changed files:** production type-only preparation in `src/App.tsx`, `src/components/{Sidebar,ChatView,Composer}.tsx`, new type map `src/lib/workspace-presentation.ts`; inactive `src/styles/canvas.css`; new compile/unit/browser/security tests in `tests/types/`, `tests/unit/canvas-foundation.test.mjs`, `tests/e2e/canvas-integration.cjs`, `tests/security/`; CP01 note and2 curated ordinary captures/machine evidence; current AGENTS/blueprint/plan/handoff scope updates. Separate live branch updates only `CURRENT_STATUS.md`. Both masters, routing/auth/storage/runtime behavior and approved Canvas proof source are preserved.

**Exact next action: STOP after CP01 synchronization for owner and ChatGPT review.** CP02 requires separate authorization and a safe approved physical-device test path. Current remote Linux has no attached USB/Mac tooling; localhost on an iPhone is not this computer. No guard, host, tunnel, auth domain or preview delivery change was made. Reviewers can reproduce using the explicit loopback commands in CP01_FOUNDATION.md; do not use real keys for layout tests.

## Previous — blueprint delivered; stop for owner review

Read [Canvas production-integration blueprint](CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md) and the [current plan/ledger](IMPLEMENTATION_PLAN.md). The owner confirmed Gate 1 approval after the final Canvas sidebar-spacing review and explicitly switched from Claude Code to Codex to finish this **planning/documentation-only** assignment. The separate live checkpoint at `c003f575e02bc299d79298fa1fab8313ac7f830c` already recorded that approval; its agent-switch uncertainty is superseded by the current owner instruction. No production implementation, preview exposure/host allowance/security change, merge or deployment was authorized or performed. Do not infer Gate 2 or release approval.

### Recovery and preserved work

- Available root worktree was clean at `41bae00d449466f3f77b001e66963a8147a9d7e3`; inspected status, recent/remote history, full changed-file range, diffs, untracked paths, worktrees and available partial-blueprint filenames before changes. Explicitly fetched both branches and fast-forwarded safely to verified PR #34 head `bb29ffe3073e2509cdb9ee718af4afee1b1b4b3a`. No local uncommitted/untracked blueprint was present. **Claude's separate six-minute interrupted local work is inaccessible here**; do not claim its contents or tests were recovered. No reset/discard/overwrite occurred.
- All approved Canvas proof, ComposerChrome, provider-intelligence/quality, regressions and historical artifacts are retained unchanged. Existing unrelated worktrees—including `/workspace/Lumen-preview-test` with prior test-only auth WIP—are untouched. No screenshots were regenerated and no runtime file was changed.
- Gate decision evidence: current owner handoff instruction; live context `c003f575…`; source `bb29ffe…`; [sidebar feedback/test record](workspace-proofs/proposals/SIDEBAR.md). B02.3 is the existing weight-3 approval task and now earns 1; this does not certify every B02.1/B02.2 deliverable. Historical 18.5% and pending-gate statements below retain their dated meaning.

### Blueprint content and architectural decisions

Canonical owner map covers App/Sidebar/ChatView/Composer, same-node expanded writing, actual ModelPicker/UsageMeter, Routing Center/provider/settings/Layout owners, Projects, storage/auth/account/session boundaries, permissions and accessibility. Preview observers/portals, duplicate navigation state, proof-only preferences and simplified gesture handlers are not production integration patterns. Keep the approved Canvas appearance; do not revive rejected Workspace/Focus or confuse it with the document/code Canvas feature.

CP01–CP06 are unweighted proposed children of B03–B08, **not implementation authorization**: characterization/seams/scoped tokens → canonical composer/writing sheet with early physical-iPhone validation → navigation/reading/projects → Routing Center/formal Gate 2 package → explicitly authorized integration/remaining screens/hardening/Gate 3 → separately authorized exact-head release/rollback/live checks. Preserve existing F01–F38 dispositions; new infrastructure/OAuth/logging/permission/cost capabilities remain separate decisions. No production schema migration is planned for visual foundation.

**First recommended implementation slice:** CP01 contract characterization/component seams and scoped Canvas tokens in the isolated synthetic integration harness, default production entry/output unchanged. Determine a safe physical-iPhone test path before CP02; ordinary iPhone Safari cannot reach a computer's localhost merely by naming it. Current guard stays intact; any exposure/host/auth configuration change requires separate explicit authorization. Physical device remains unverified.

### Verification and limitations for this milestone

Documentation verification: link targets and referenced canonical source/test paths, existing weighted sum (100 total / 21.5 earned), required CP00–CP06 and F01–F38 coverage, preserved master hashes, docs-only changed-file scope, whitespace/diff review and remote-ref checks. Results: all 98 local Markdown link targets resolve; all 23 explicit existing source/test/workflow paths resolve (2 proposed files are labelled); all CP00–CP06 and F01–F38 dispositions are covered; weighted total/earned points and unchanged non-B02.3 fractions pass; both masters/amendment/Continuum bytes are preserved; exactly 5 authorized Markdown paths changed; `git diff --check` passes. The initial source-path validator flagged the intentionally proposed test file; corrected the validator to distinguish proposed from existing files and reran successfully. Remote synchronization is verified after commits, not inferred from these checks. No product browser/unit/type/build suite was rerun for Markdown changes; all prior runtime passes below are historical reports, not fresh Codex verification. No new performance, physical-iPhone or live-provider result is claimed.

Remaining risks: same-textarea/focus/IME/undo and viewport integration; canonical body search/current/empty/archived/Incognito parity versus proof filters; account-scoped UI preferences; early device/VoiceOver/glass/keyboard validation; multi-theme/large-text/font loading; existing 22 static-audit findings; unselected B05 feature decisions. Detailed acceptance and reversible steps are in the blueprint.

### Git, synchronization and production

- Coding branch: `docs/lumen-blackout-phase1-20261019`; draft [PR #34](https://github.com/Seifonyx/Lumen/pull/34), open/unmerged. Recovered local/pushed source base `bb29ffe3073e2509cdb9ee718af4afee1b1b4b3a`. Blueprint documentation revision is the containing commit (resolve `git log -1 --format=%H -- docs/blackout/CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md`); final branch head resolves with `git rev-parse HEAD` and must match `git ls-remote origin refs/heads/docs/lumen-blackout-phase1-20261019`. A file cannot embed its own commit hash.
- Public-safe live checkpoint is updated on **separate branch** `docs/lumen-live-context`, isolated worktree `/workspace/Lumen-live-context-blueprint-20261021`, base `c003f575e02bc299d79298fa1fab8313ac7f830c`. Never merge this documentation branch into production or copy private conversation/credentials into it. Final exact workstream and live-context SHAs are verified from remote refs and reported at delivery; latest live status records the pushed blueprint revision.
- Latest observed merged main: `655438f0ec8d2e3594595252af4a99e6c58627a0` (documentation). Latest **previously verified deployed runtime**: `677bc51f39fbf8fcf66bc91f846b71a4912bb306`, deployment39447533639. No new production verification, source change, merge or deployment in this session.
- Changed files: this handoff, Blackout plan, new blueprint, root AGENTS current approval/scope correction and information-architecture current-decision banner; separate live branch status update. Original masters, preview/source/runtime files, dependencies, CI and hosting/security configurations are unchanged.

**Exact next action: STOP after documentation synchronization and owner review of the blueprint.** Wait for a separately scoped implementation instruction; recommend CP01 only. Do not automatically begin B03/B04, invoke preview/deploy workflows or request automatic Gate 2 approval.

## Historical checkpoint records

The following entries describe earlier work and approvals at that time. Their stop boundaries and pending Gate 1 statements are superseded only by the current explicitly scoped owner decision above; test history and implementation evidence are preserved.

## Previous — Canvas sidebar spacing & hierarchy (21 October 2026)

Owner feedback on the sidebar: larger, more spacious primary navigation closer to the reference. CSS-only refinement: iPhone primary rows 52px/58px pitch, 18.5px labels, 24px icons aligned with the mark, inset separator; compact 44px secondary tree; short-height (≤700px) variant; restrained desktop; no sticky-heading band; no touch hover residue; section toggles 44px. Record: [SIDEBAR.md follow-up](workspace-proofs/proposals/SIDEBAR.md); images `proposals/sidebar/spacing/`. Chromium (5 iPhone sizes incl. 320×568/393×640, desktop) and WebKit pass. **Exact next action: STOP for owner review.** Gate1 NOT APPROVED. 18.5% unchanged.

## Previous — Canvas navigation completeness & sidebar refinement (21 October 2026)

Owner-selected Canvas sidebar refined from the owner's iPhone sidebar reference (layout principles only; Lumen identity kept). New `proposals/CanvasNav.tsx`: header (mark, search, close/collapse), destination rows, hairline separator, **collapsible Projects / each folder / Conversations** (chevrons, `aria-expanded`, inert folds, per-account remembered state, open-chat marker), restored per-chat actions (rename, pin, move, archive, side by side, share/export, delete with confirm; ⋯/right-click on desktop, long press on iPhone), account footer, desktop collapse via production's `.app.sidebar-collapsed` + ⌘⇧S. Record, tests, limits and the physical-iPhone recommendation: [proposals/SIDEBAR.md](workspace-proofs/proposals/SIDEBAR.md); images in `proposals/sidebar/`. `nav-check.cjs` passes in Chromium 1440/393/320/430 and WebKit 393/1440; regressions pass. No physical iPhone. **Exact next action: STOP for owner review.** Gate1 NOT APPROVED. 18.5% unchanged.

## Previous — Canvas final design refinement (21 October 2026)

Owner selected **A · Canvas** (borrowing Desk's project context) for one polish pass — not Gate1 approval. Only `proposals/ProposalChrome.tsx` and `proposals/canvas.css` changed: project brief + 5-chat fold + date groups + sticky sections, re-homed All chats / Ask your chats / New project, 24px question→answer gap, calmer engaged composer, 90%-tint iPhone glass, sheet rise + swipe-down, title/top-bar fixes. Record, nav audit (per-row chat menu still NOT re-homed), tests and limits: [proposals/CANVAS_POLISH.md](workspace-proofs/proposals/CANVAS_POLISH.md); before/after in `proposals/polish/`. Chromium 1440/393/320/430 + WebKit 393 pass (0 axe); regressions pass. No physical iPhone. **Exact next action: STOP for owner review.** Gate1 NOT APPROVED. 18.5% unchanged.

## Previous — Gate1 product-experience reconsideration (21 October 2026)

Owner verdict: the consolidated Workspace + Focus architecture is **not accepted** (reading/writing less comfortable, composer messy, navigation fragmented, iPhone glass lost). Two opt-in design proofs were built over the real App: `?proposal=canvas` (A: one navigation tree with projects as folders, one-row glass capsule composer, writing sheet) and `?proposal=desk` (B: spaces rail + list / iPhone push navigation, docked composer with route line, page mode). Read [proposals/PROPOSALS.md](workspace-proofs/proposals/PROPOSALS.md) and the offline [review](workspace-proofs/proposals/review.html). Contracts (same textarea/draft/selection/focus across expand, real picker/usage, one intercepted Send/Stop) pass in Chromium desktop/iPhone and WebKit iPhone; 0 axe violations. No production change, no selection. **Exact next action: STOP for the owner to choose a direction.** Gate1 NOT APPROVED. 18.5% unchanged.

## Previous — Gate1 final verification (21 October 2026)

Verification only, at `1d1e0f7e02df4849949bdddbd880e8956fe25bd7`. Record: [workspace-proofs/FINAL_VERIFICATION.md](workspace-proofs/FINAL_VERIFICATION.md). WebKit ran in the official `mcr.microsoft.com/playwright:v1.56.1-noble` image (WebKit 26.0, build 2215) via Docker with `--network host`, because the container's Playwright CDN is blocked. All 8 required WebKit cases plus 2 short-height supplements pass; the 10 Chromium cases were re-run at the same SHA and pass (20 cases, 354 axe states, 0 violations, one intercepted Send/Stop each, 0 real calls). The portable review and evidence were rebuilt (`sourceBase` 1d1e0f7) and pass the checker in both engines. Physical-iPhone checklist written; it is **blocked** because `bootstrap.ts` renders only on hostname `localhost` — a test-only host allowance needs owner approval. Gate1 NOT APPROVED; no merge/deploy. **18.5% unchanged. Exact next action: STOP for owner review.**

## Previous — Gate1 flagship quality pass (21 October 2026)

User [quality-pass brief](GATE1_QUALITY_PASS_2026-10-21.md) continues PR #34 from `41bae00` (consolidation implementation `5c9ff0f`). Read [record, before/after and limits](workspace-proofs/QUALITY_PASS.md). Opt-in preview only; no `src/`, dependency or production entry change.

Changes: desktop type hierarchy (34px title over 25px answer heading, 66ch measure, one section-label system); quieter 272px intelligence rail with conversation/draft context split; accurate Workspace/Focus/Routing mode identity in sidebar edition, desktop top-bar pill and phone wordmark; compose and ⓘ phone icons, 320px toolbar fit; honest usage share (`usage-share.js` + `UsageShareLabels.tsx`: "<1%"/">99%", spoken text, minimum arc) without changing canonical UsageMeter data.

Verification (Chromium only): consolidated 1440×960/390×844/320×844/390×480/320×480 and retained Index/Studio 1440/390 + Index 320×480 + Studio 390×480 pass — 11 cases, 195 axe states, 0 violations/page errors/overflow, one intercepted Send/Stop each. Phone reading geometry identical before/after. New assertions (mode identity, toolbar fit, usage label) were red on `41bae00`, green now. Proof tsc, `npm test`, `vite build` pass. **Not run:** Linux WebKit (not installable here), strict premium audit (tool absent), portable review rebuild. Raw evidence: `/home/user/.lumen-verification/gate1-quality-2026-10-21/` (outside Git, this container only).

**18.5→18.5%, Medium confidence; 81.5 weighted points remain.** Implementation commit `e20673adae392b2bc2f46b9a422150759cf0ee6e`; the docs-only follow-up records it — resolve the final HEAD with Git and confirm the remote ref.

**Exact next action: STOP for owner review.** Gate1 NOT APPROVED; no merge/deploy/production integration. Before any approval request: WebKit matrix run and physical-iPhone check of toolbar icons, Focus and keyboard.

## Previous scoped work — Gate1 flagship consolidation

User [consolidation brief](GATE1_CONSOLIDATION_2026-10-20.md) authorizes only this continuation from clean synchronized `4ff2ad77cecbc37f4f52423f74877738497f45ea`. Read [implementation/verification](workspace-proofs/CONSOLIDATION.md), [portable review](workspace-proofs/consolidation-review.html) and [machine evidence](workspace-proofs/consolidation-evidence.json). Previous flagship/provider slices, shared ComposerChrome and their review artifacts remain preserved.

One opt-in preview (`?proposal=consolidated`) combines Index's reading shell with optional reversible desktop Focus writing beside the response and dedicated phone writing. Mobile uses one toolbar, a compact title and progressive original-brief disclosure. Prominent history/native search/new conversation/Projects/Routing Center and recent shortcuts remain reachable. Each composer layer owns its padding; disclaimer/divider/editor are contained. The picker/UsageMeter chip now consistently shows conversation-only estimates; Focus labels draft estimates separately. Provider engineering and production sources/dependencies are untouched.

**Previous18.5→current18.5%, Medium confidence;81.5 weighted points remain.** Stable baseline v1 unchanged, no approval or B03/B04 integration credit; Model Picker98.5% unchanged. Seven proposal cases/124 axe states and the retained11-case baseline/194 states pass:18 cases/318 scans with zero reported violations/page errors/overflow. Both offline review engines pass all16 images/comparisons, HTML/PNG downloads, dialog focus and4 further axe scans. Exact results/failure history are in CONSOLIDATION.md. Type/build pass;22 pre-existing strict-audit findings remain. No physical iPhone/live-provider/production verification is claimed. Synthetic24px safe-area and480px viewport tests are explicitly simulations.

Raw evidence: `/workspace/.lumen-verification/consolidation-2026-10-20/`; final test server5195 disables HMR/watch to avoid in-flight source reloads; restart it after any future source edit before testing, since its cache is intentionally frozen. Failed initial logs are retained in `attempts/`; source was frozen for final checks. Original dev preview5193 and artifact server5194 remain. Only16 curated frames are embedded, not a new historical PNG collection.

Branch `docs/lumen-blackout-phase1-20261019`, existing draft PR #34; **Verified implementation/artifact commit `5c9ff0f3e20e0127afb45d48eca4f8fe2dc4b696` is committed and safely pushed; local and remote feature hashes matched.** The containing handoff-only follow-up records synchronization; resolve its exact final HEAD with Git and confirm the remote ref before continuing. No implementation WIP or unpushed source remains. Latest merged main is still `655438f0ec8d2e3594595252af4a99e6c58627a0`; latest separately verified deployed runtime is still `677bc51f39fbf8fcf66bc91f846b71a4912bb306`. No Blackout visual merge/deployment or production integration.

**Exact next action: STOP after this consolidated exploratory proposal.** Review the16-image board and manual test sequences. Gate1 remains NOT APPROVED; no automatic approval request or B03/B04 migration. Future work needs the next explicitly scoped product direction. Earlier stop boundaries are historical and superseded only for this consolidation.

## Previous focused checkpoint — Flagship Workspace & Composer proposal

The user authorized [this bounded workspace/composer slice](FLAGSHIP_WORKSPACE_COMPOSER_2026-10-20.md) after provider quality. It supersedes the previous slice's stop only for this work. Base was clean/synchronized `6d5492e690ccea301db6f000bc9ee01766fd7e5c`. Read [implementation, failures and limits](workspace-proofs/FLAGSHIP_WORKSPACE.md), [portable offline review](workspace-proofs/workspace-review.html) and [machine evidence](workspace-proofs/workspace-evidence.json).

Index now has a working-document reading plane and keyboard-operable answer outline with selective route/context intelligence; Studio has independent sustained-writing/response panes and intentional full phone writing mode. A shared proof-only composer presentation preserves the real textarea/draft/selection/focus, reflects canonical tools and file state, and retains actual picker/usage/Send/Stop owners. Desktop/phone wordmark-first treatments remain provisional. Provider browser/quality work is preserved; no source runtime component, production design token or dependency changed.

**Previous18.5→current18.5%, Medium confidence;81.5 points remain.** Existing baseline fractions/weights are unchanged: this is refinement of partial B02.1/B02.2, not identity approval or B03/B04 integration. Model Picker stays98.5%. Eleven main cases pass194 axe state scans at1440×960/390×844 in Chromium/Linux WebKit plus320px/reduced-height cases. Two focused interaction cases check prefill, forward selection, tool state and reduced motion; eight rapid WebKit picker switches pass. Original matched baselines, proof TypeScript/build and self-contained review checks pass.22 prior strict-audit findings remain. Physical iPhone/live-provider behavior and full complex-state/theme/zoom coverage are not claimed. Failure history, including one intermediate in-flight-source WebKit draft assertion with unisolated cause, is retained in the implementation note.

Changed files: proof `ComposerChrome.tsx`, `main.tsx`, `workspace.css`; focused workflow/interaction checks; baseline output override; portable review builder/checker/artifact/evidence; current brief and documentation. Raw captures/logs/build/audit are outside Git in `/workspace/.lumen-verification/flagship-2026-10-20/`. Only26 curated captures are embedded, not a new PNG directory. Earlier provider-review.html is preserved.

Git: branch `docs/lumen-blackout-phase1-20261019`, existing draft PR #34. Verified proposal implementation/artifact commit **`327a1082baf6b9d27123a6af21bec6ca94462860`** is committed and safely pushed; local HEAD and the remote feature ref were confirmed identical. The containing final handoff-only revision records that fact; resolve its exact HEAD with Git and confirm remote synchronization before continuing. No implementation WIP remains. Latest merged main remains `655438f0ec8d2e3594595252af4a99e6c58627a0`; latest separately verified deployed runtime remains `677bc51f39fbf8fcf66bc91f846b71a4912bb306`. No Blackout merge/deploy is authorized by this slice; Gate1 remains unapproved.

**Exact next action: STOP at this reviewable flagship proposal.** Product owner can inspect the portable board and test sequences. Future implementation requires the next explicit scoped direction; do not automatically begin identity rollout, production integration or unrelated tasks. No automatic approval request. Preserve the source/progress/provider evidence and all existing gates.

## Previous focused checkpoint — Provider UX quality closure

The [quality-closure brief](PROVIDER_UX_QUALITY_CLOSURE_2026-10-20.md) continues PR #34 from verified clean local/remote `a2cff7b38025981650c58da3f86fc5d67e602904`. Read [current implementation/verification](workspace-proofs/PROVIDER_UX_QUALITY.md), [portable review](workspace-proofs/provider-review.html) and [machine evidence](workspace-proofs/provider-evidence.json). This supersedes the prior slice's current-state UI descriptions, not its historical evidence or approved scope.

All nine findings are addressed in the isolated proof: readable primary allowance row and wrapped phone sections; a focused Providers view; concise connection/discovery and earlier model actions; phone-only Back; distinct saved-key/enabled filters and visible-result selection; grounded conversation default or intentional empty detail; scoped model-action subscriptions/indexed membership and24-row model paging; browser-local discovery timestamps;12 clean presentation captures and4 separate keyboard-focus captures. Existing masked connection, selection/routing, drafts/account boundaries and production owners are preserved. Section switches reset scroll before paint; ordinary captures clear only harness focus/hover, not runtime focus styling.

**Previous18.5→current18.5%, Medium confidence.** Weights/fractions unchanged;81.5 weighted points remain and Model Picker98.5% is unaffected. Ten focused engine/viewport cases at1440/390 and additional320 checks pass60 axe state scans with zero reported violations/page errors/overflow. The1000-model Profiler confirms0 action commits across10 unrelated updates and1000 disabled actions/commits after key removal; model paging/long-name search/clear are exercised. Existing Index39018-state workflow, proof TypeScript, production build and portable offline review checks pass. The22 pre-existing strict-audit findings remain; no full compliance, physical iPhone or live-provider claim. Initial semantic/test-readiness/Profiler-boundary failures and the transient exec-server disconnect are explicitly recorded in the quality note.

Verified quality implementation/artifact commit **`a9e34834fae3af1e0b721badcb9e24e03327f9ce`**, committed and safely pushed to `docs/lumen-blackout-phase1-20261019`; exact local/remote hashes matched. This containing handoff/link-label follow-up is documentation-only; resolve its final commit with `git rev-parse HEAD` and confirm the remote ref. Base was a2cff7b; no uncommitted implementation or regenerated historical PNGs remain. Main remains `655438f0ec8d2e3594595252af4a99e6c58627a0`; latest separately verified runtime is `677bc51f39fbf8fcf66bc91f846b71a4912bb306`. No merge/deployment was attempted: Gate1 is unapproved. **Stop after this quality-closure slice** and await the next scoped review; do not automatically start identity or unrelated work.

## Prior focused checkpoint — Provider intelligence

The [execution packet](PROVIDER_INTELLIGENCE_PACKET_2026-10-20.md) is preserved verbatim (SHA256 `f71b15a549198aa7b83b34df2460683f3080ac4a016105913fee04d22274222d`). Its provider-browser/detail slice is implemented and locally verified in both isolated directions. **Previous18.5% → current18.5%, Medium confidence; no weight/fraction changes.** It strengthens the existing partial B02 deliverables without completing the brand/motion, physical-device or approval acceptance groups.81.5 weighted points remain; Model Picker98.5% is unchanged.

Read [provider implementation/evidence](workspace-proofs/PROVIDER_INTELLIGENCE.md), [portable visual review](workspace-proofs/provider-review.html) and [machine evidence](workspace-proofs/provider-evidence.json). Shared `ProviderBrowser.tsx` replaces four hardcoded rows with all32 configured provider definitions, separate saved-key/permission/discovery/inference states, provider-specific models and honest model/shared-pool usage. Canonical masked settings and selection remain authoritative. Index/Studio retain distinct navigation; phone has a dedicated Back/detail state. The Routing Center summary's quota contradiction is fixed.

Eight focused Chromium/WebKit desktop/phone cases passed with24 axe state scans; the existing Index390 workflow passed18 states, including saved Layout/fallback order, draft/Auto/manual selection, attachments and intercepted Send/Stop. Proof TypeScript and production build passed. The portable review embeds only eight curated captures and passed both engines' offline document-render/control/download/focus/accessibility checks. Strict audit still exits1 for the same22 existing `src` findings; no claim of full compliance. WebKit's two existing Firebase redirect-SDK script attempts per case are explicitly recorded and locally blocked; no real inference or unexpected external request was sent. Cloud direct file navigation is unsupported; exact saved HTML bytes were verified offline. See the evidence document for initial failures, corrections and boundaries.

The task is explicitly **complete only as this isolated slice**. Gate1 remains unapproved. No production integration/deployment and no automatic continuation into branding/motion or unrelated Blackout phases. Verified provider source/artifact commit **`311b396fa216c0addf6619bfc5bdb0040635edc2`**, safely pushed to `docs/lumen-blackout-phase1-20261019`; local and remote source hashes matched after push. This containing follow-up is documentation-only (resolve its final revision with `git rev-parse HEAD` and verify the remote ref). The base before this slice was `eff1d10dbea3ba6f7418488b617c6cfff5d343ee`; no uncommitted source or PNG collection is left behind. Production remains the separately verified runtime677bc51; main655438f is the later documentation merge.

## Read first

1. Exact full [master](MASTER_REQUIREMENTS.md), SHA-256 `f0bf08d5f4d7622e9366db4924f1601a6f4abc5f69a19a9c31d154cd45766fae`; now recovered, not missing.
2. [v1.1 phase amendment](BLACKOUT_V1_1_AMENDMENT.md) and exact [latest Continuum](PROJECT_CONTINUUM_2026-10-20.md), SHA-256 `01aaf9a710b8ddcd474170aad8575359338a73ab5a7655a8d70a3a72c3aec66e`.
3. Exact [first critical correction](DESIGN_COURSE_CORRECTION_2026-10-20.md), SHA-256 `b67ae76f7d0aeded9ab2984feb659ee027f4ebf6d4fe5c45672a3bc6d1793732`, and [Routing Center correction](ROUTING_CENTER_COURSE_CORRECTION_2026-10-20.md), SHA-256 `38e8f189697f3807b5ed245f0d645f7960467452599862afb08402acb4c55491`.
4. [Plan/weights/coverage](IMPLEMENTATION_PLAN.md), [architecture](INFORMATION_ARCHITECTURE.md), [current proof and exact verification](workspace-proofs/README.md), root AGENTS/PRODUCT/DESIGN/UX-CONTRACT and independent Model Picker requirements.

The root Model Picker master remains byte-preserved, blob `45abb59dc9cf8c3d06d8ce16370a732b2170f248`. All original requirements remain; these Blackout documents are a separate approved initiative. Do not revive cancelled/rejected PR28/30/32 or use their identities as approved defaults.

## Permanent progressive deployment policy

Evaluate each completed coherent milestone for independent release. Review the complete intended diff, tests/type/build/required exact-head CI, security/privacy/compatibility/regressions, migrations and unfinished dependencies; confirm deployment and normal reviewed-revert rollback procedures. Use the authorized protected merge workflow, verify actual production SHA/deployment and live behavior, record deployed versus undeployed work, then continue. Separate safe subsets from unfinished work. Never bypass protections, force-push, overwrite concurrent work, or equate a push/build/green subset with deployment.

Blackout's explicit aesthetic boundaries remain: Gate 1 before extensive identity implementation, Gate 2 core/flagship visual approval before major integration, Gate 3 final aesthetic approval. No experimental visual milestone is independently production-ready yet. Do not assume the whole project must finish before an unrelated safe functional fix can ship.

## Verified work and actual limitations

- Full source/requirements/Git recovery and immutable uploads, plus stable weighted scope mapping.
- Actual 9Router research:14 manifest images plus two pinned official images visually opened; one repeated hero. All 22 gallery links returned503. Ten selected actual images form the accessible local [reference board](reference-board.html). Dedicated current quota/request/mobile references remain a documented gap. Pinned source 0.5.104 and observed public release v0.5.35 are distinct from older screenshots.
- [38-feature matrix](FEATURE_MATRIX.md),20 pinned primary sources, native delivery/security/acceptance contracts. [Information architecture](INFORMATION_ARCHITECTURE.md) explicitly maps reference organization into both Workspace and Routing Center. No new gateway, unsupported OAuth, credential vault, cost source, private logging or compression service is authorized by analogy.
- Aperture/Relay/Fold are **rejected intermediate experiments**, retained only in `prototypes/` as history/tooling. The old recommendation is withdrawn.
- New **Index** and **Studio** actual-component proofs in `workspace-proofs/`: different navigation, conversation/drafting allocation, three-tier composer and Routing Center composition. Real existing controls handle Auto/manual/Layout, context, usage, policies, fallback order/permissions, masked connections and Send/Stop.
- Ten final cases /176 captured-state axe scans passed with zero violations/page errors/document overflow. Dark desktop/phone, light desktop, true-black phone and 320px Linux WebKit; matched normal-App baselines at 1440×960 and 390×844. Manual/reopened fixture isolation and external-request denial tested. See README/reports rather than extrapolating to untested states.
- Independent review caught and helped diagnose Studio mobile expansion: actual grid child `.conversation-area` created an implicit extra row. Root cause fixed; assertions include form/wrapper height and input/footer containment. Independent recheck measured714/694/532px at 390×844 and confirmed draft/conversation restoration. No remaining blocker found for this isolated architectural checkpoint.
- The scoped32-provider browser/detail proof is now verified; the old four-provider limitation is superseded. No final mark, complete motion/brand system, production provider-detail integration, physical iPhone keyboard/refraction or full product-state/theme/zoom/locale matrix is complete. Existing connection/usage/editor owners remain partly inherited. Do not describe these as finished branding or new 9Router integration capabilities.
- Strict premium static audit exited1 on 22 existing source patterns (15 textarea/local resize-evidence and 7 noValidate findings). Documented for B03/B07; not silently skipped or called compliant.

## Independent functional fix / Git and deployment state

- Development branch: `docs/lumen-blackout-phase1-20261019`, draft [PR #34](https://github.com/Seifonyx/Lumen/pull/34).
- Earlier provider-intelligence source/artifact commit: `311b396fa216c0addf6619bfc5bdb0040635edc2`, remotely synchronized; final handoff-only revision is the containing commit. Earlier research/proof artifact commit: `eda84a2`; main reconciliation checkpoint: `edb5838ac183037d70e00d3c13c2bb46f4804618`. The containing handoff revision is the final documentation commit (resolve with `git rev-parse HEAD`, since a file cannot embed its own commit hash). Final synchronization must confirm local HEAD equals the remote feature ref. The working tree is intended clean; no experimental product source imports were introduced. Draft PR #34 title/body now describe the actual studies and limitations rather than missing master requirements.
- Safe subset isolated into `fix/usage-draft-no-submit-20261020` in reused `/workspace/Lumen-release-ledger`; source `8a328bb`, pushed/reviewed head `d9422173f4d5d503164b15b54dd991265412abae`.
- **Latest merged main:** `655438f0ec8d2e3594595252af4a99e6c58627a0`, docs-only [PR #36](https://github.com/Seifonyx/Lumen/pull/36), production verification ledger. Normal merge; repository paths-ignore means no CI was scheduled for the two Markdown files. Diff reviewed, no runtime changes and no redundant deployment. Runtime remains677bc51 below. Both main documentation commits are incorporated into the feature branch.
- [PR #35](https://github.com/Seifonyx/Lumen/pull/35) **merged** to main `677bc51f39fbf8fcf66bc91f846b71a4912bb306` after all exact-head CI jobs passed, run 39444721821. Only five UsageMeter button types, meaningful regression and operational notes; no Blackout visual source.
- Original bug: opening usage with a draft default-submitted the composer. RED reproduction; pointer/Enter/draft/messages/network/focus checks passed in Chromium/WebKit 1440/390; independent reviewer reran all four. `npm test` and build passed, ordinary design regression passed. Manual test: type unsent text, open/close usage, confirm no send and draft remains.
- Production prior verified runtime: `1966348725a9cc6a3bfec0a283448a451aa9d6cd`, deploy 39257887973,18 matching live assets freshly checked20 October.
- **Latest verified deployed runtime:** `677bc51f39fbf8fcf66bc91f846b71a4912bb306`, [deploy39447533639](https://github.com/Seifonyx/Lumen/actions/runs/39447533639) succeeded20 October. All18 reviewed built assets matched live over system-CA-validated HTTPS. Hosted usage-draft regression passed Chromium and Linux WebKit at1440/390 (pointer and Enter, no send, draft/message/focus preservation). Chromium default cloud CA trust failed; hosted rerun narrowly pinned the existing environment proxy CA public key, with no broad TLS bypass. WebKit passed with `SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt`. This verifies synthetic isolated UI behavior on the hosted bundle, not real credentials/provider inference or physical iPhone. Raw results: `usage-fix-production-assets.json`, `usage-live-chromium-pinned.log`, `usage-live-webkit-trusted.log` in the evidence directory. Production URL:https://lumen-chat.web.app/ . No Blackout visual deployment.

## Environment and recoverability

Node22/deps/Chromium/WebKit already installed; onboarding reused existing setup, no new credentials/infrastructure. Current owned servers: ordinary reviewed dist 5190; Vite source/proof 5193; evidence/reference server 5194; older artifact server 5191. Commands in workspace-proofs/README.md. Local raw evidence/logs/cache: `/workspace/.lumen-verification/blackout-2026-10-20/`. No external screenshot pixels are committed; source/hash metadata and the board are persistent, cache can be retrieved through verified HTTPS if lost. Owned Lumen screenshots use synthetic data only.

Preserve other worktrees. `/workspace/Lumen-preview-test` branch `test/preview-auth-clock` contains prior uncommitted test-only auth bridge/clock/workflow WIP; it is isolated and was not released. Never reset/stash-pop/overwrite it blindly. Older release branches/backups remain. Main's latest operational notes may require reconciliation into this feature branch after the independent fix release; resolve conflicts preserving both records, not by discarding either.

## Historical QA00 stop boundary (superseded; for provenance only)

> **Not a current task assignment.** This STOP applied at the older QA00 planning checkpoint. Use the live checkpoint and latest explicit owner decision for active work.

**STOP after QA00 proposal/docs commit/push and separate live-checkpoint verification.** Await owner/ChatGPT proposal review and separately scoped authorization; QA01+ implementation/infrastructure and CP02 are not authorized. Preserve CP01, approved Canvas/provider work, ordinary production output and localhost proof. No preview exposure, auth/Firebase relaxation, merge/deployment or automatic Gate2 approval.
