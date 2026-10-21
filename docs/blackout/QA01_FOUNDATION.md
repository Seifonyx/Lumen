# QA01 — local private-testing foundation

21 October 2026. Owner explicitly authorized **QA01 only** after reviewing the [QA proposal](PRIVATE_IPHONE_QA_PROPOSAL.md). Source base `88c7baa3e1e1873ae0dfcf21119b37c6fb20c37f`. No QA02/QA03/CP02, remote service, real credential, publication workflow, merge/deployment or Gate 2 authorization. Implementation commit: see [AI_HANDOFF.md](AI_HANDOFF.md) and the live checkpoint (a file cannot contain its own commit hash).

## Agent handoff and recovery

Codex started QA01 and reached its usage limit; the owner made **Claude Code** the active agent for QA01 continuation only. Codex's partial ledger (live context recovered at `3cec0649ce448933e31b0b3ff4e89a2a7d7c180c`) recorded QA01-A *in progress* and B–D *not started*. That ledger reached Claude Code only as an uploaded copy; **none of Codex's in-progress QA01-A code was accessible**: the remote workstream ended at `88c7baa` (QA00 docs), this session's worktrees and `/tmp/lumen-qa01/` held no QA01 files, and no stash or other worktree contained them. QA01-A was therefore implemented afresh from the proposal; nothing is claimed as recovered. Codex's two recorded rulings were adopted unchanged:

- **Ruling (kept):** QA01 uses the existing ordinary application presentation, not a Canvas composer migration — CP02 remains excluded. Cost if wrong: Canvas presentation still needs its separately approved slice.
- **Ruling (kept):** local token verification uses platform WebCrypto RS256 with injected test trust keys; no JWKS fetch, no new dependency. Real Cloudflare trust/MFA/Worker-wide Access integration remains QA02. Cost if wrong: remote trust configuration is not yet verified and must not be deployed.

## Execution ledger

| Task | Interface and acceptance | State |
|---|---|---|
| QA01-A | `makeManifest`, `publish`, `revoke`, `createGate` over fake revision/CAS storage and synthetic RS256 keys; authenticated assets, expiry/revoke, reviewer/build/path/failure negatives, publish/revoke races | **Verified** — 13 gate + 8 control unit tests |
| QA01-B | Separate Vite QA entry; compile-time Firebase/sync/provider/SW adapters; canonical App/store/Composer/picker/usage/Incognito and fixtures reused; no production edits | **Verified** — Chromium + Linux WebKit browser contract |
| QA01-C | Production/QA graph audit with planted negative controls; unchanged ordinary output; commit-pinned manifest build/verify; no-publication contract | **Verified** — 8-check isolation audit, production output byte-identical |
| QA01-D | Type/unit/build, focused Chromium/WebKit, existing regressions, all-request capture and planted negatives, independent review, docs, push/context sync, stop | **Verified** — see results below |

## What was built

| Path | Purpose |
|---|---|
| `server/private-qa/paths.mjs` | Build-ID, asset-path and MIME allowlist rules shared by builder and gate. Percent-escapes, empty/dot segments, hidden files and unlisted types are refused, never decoded. |
| `server/private-qa/access-jwt.mjs` | RS256-only token verification via WebCrypto; exact issuer, audience, `exp`/`nbf`/`iat`, lifetime cap, email claim; injected public keys; never throws (invalid = no identity). |
| `server/private-qa/control.mjs` | Strict registry schema; create-only registry; conditional (ETag) registry updates with re-read/re-apply and read-back; immutable manifests (commit, run, attempt, digests, types, fixture/lockfile digests, ≤72 h, ≤50 MB, ≤400 files, clean tree only); create-only publication that activates last; revocation tombstones so **revocation always wins** a publication race; max 3 active builds. |
| `server/private-qa/gate.mjs` | Request handler: method (GET/HEAD) → exact host → fetch-metadata (no cross-site embedding) → token → **registry read on every request** → reviewer → build (active, not revoked, not expired) → path → manifest digest pinned by registry → asset digest. `private, no-store`, CSP, `nosniff`, `no-referrer`, `noindex`, COOP/CORP, Permissions-Policy on every response; no ETag/Last-Modified, so no 304/partial reuse. `/__lease` returns an opaque per-reviewer-per-build namespace, never the identity. |
| `vite.qa.config.ts` | Separate QA build (root `qa/iphone`, relative base, no public dir, no source maps, no preload polyfill). Plugin replaces `src/lib/firebase.ts`, `src/lib/sync.ts`, `src/pwa/register.ts`; stubs `firebase/app|auth|firestore`; refuses any other Firebase package and any forbidden module; rewrites every `fetch(` in `src/` to the synthetic transport and every `new Worker(` to a clear disabled error; refuses `XMLHttpRequest`/`WebSocket`/`EventSource`/`sendBeacon`/`serviceWorker.register` in app source. |
| `qa/iphone/adapters/*` | `firebase.ts` (same exports; synthetic `preview-qa-<namespace>` account; key saving and Google sign-in refused), `firebase-sdk.ts` (inert refs; every read/write/listener/transaction refuses and is counted), `sync.ts` (no-op), `pwa-register.ts` (no SW), `transport.ts` (deterministic local Gemini catalogue/stream; same-origin GET, blob:, data:; everything else refused), `lease.ts` (start, 60 s, focus/visibility/pageshow and before each reply), `worker-disabled.ts`. |
| `qa/iphone/main.tsx`, `index.html`, `qa.css`, `fixtures/profile.ts` | Nothing runs until the lease confirms access; seeds the existing synthetic proof fixture per namespace; persistent “Synthetic review · no live provider requests · build · until” banner with a scoped Reset; lock overlay (stops replies, `inert` app) on expiry/revocation. The real `src/main` App mounts unchanged. |
| `scripts/qa/{audit,build,verify}.mjs` | Graph/output audits with a reasoned third-party allowlist; commit-pinned local build refusing dirty trees; verifier (digests, no extra files, exact commit, not expired). No network client, credential read or upload. |
| Tests | `tests/unit/private-qa-{gate,control}.test.mjs`, `tests/unit/private-qa-transport.test.ts` (run by `npm test` and CI); `tests/security/private-qa-{isolation,browser}.mjs` (explicit, slower); fixtures/loopback harness in `tests/security/`. |

`.gitignore` gains `dist-qa`. **No file under `src/`, `index.html`, `vite.config.ts`, `package*.json`, Firebase config/rules, the provider relay, `public/`, `.github/` or `docs/blackout/workspace-proofs/` changed** (asserted by the isolation audit against `88c7baa`).

## Verification results

Raw logs are outside Git in `/tmp/lumen-qa01/`. Concise machine evidence: [qa01/evidence.json](qa01/evidence.json).

| Check | Result |
|---|---|
| Baseline before edits: `npm test`, `npm run build` (separate outDir) | Pass; 174 production files recorded |
| `npm test` final (typecheck + unit) | **83 unit files pass** (80 existing + 3 new), including QA type-check of `qa/iphone` against the canonical modules it replaces |
| `tests/security/private-qa-isolation.mjs` with `QA01_BASELINE_DIST` and `QA_BUILD_DIR` | **8/8 checks pass**: production graph has no QA code and its **174 files are byte-identical to the pre-QA01 baseline**; QA graph 2,543 modules/164 files audited; 11 QA + 4 production planted-module controls and a missing-adapter control caught; 7 planted-output controls caught; 4 real planted builds refused (`firebase/storage`, Firebase config, proof bootstrap, SW source) plus `?raw` replacement; 5 primitive controls refused; rewrite checks; verifier rejects tampered/extra/wrong-commit/expired; guarded paths unchanged; tooling has no network client/credential read/publication workflow |
| `scripts/qa/build.mjs` | Builds only from a clean tree; manifest pins the full commit; refused the dirty tree during development (by design) |
| `tests/security/private-qa-browser.mjs`, **Chromium** 141 | **Pass** at 1440×960, 390×844, 320×568, 390×480 |
| Same, **Linux WebKit** 26.0 (official Playwright 1.56.1 container, read-only repo mount) | **Pass**, same four viewports |
| Per viewport, both engines | 0 requests leaving the review origin; 0 blocked app hosts; 0 refused Firebase calls; 0 CSP violations; 0 page errors; 0 service workers; 0 horizontal overflow; 0 axe (WCAG 2.1 A/AA) violations; draft + selection survive picker and usage; synthetic reply streams; real Stop ends a slow reply with exactly one partial reply |
| Planted negatives (both engines) | In-page `fetch`, `WebSocket`, image beacon and SW registration to `.invalid` hosts refused by CSP before the network; a deliberately CSP-bypassed control context **was caught** by the request detector |
| Access in browser | No identity → 401 with no app bytes; non-permitted identity → 403; second reviewer gets a different namespace and none of the first reviewer's draft (shared browser storage); removing a reviewer locks an open page on its next check and reload → 403; at expiry, the next reply is refused, the page locks, a fresh token gets 410 |
| Existing regressions, Chromium, ordinary build (identical bytes) | usage-draft, chat-menu, selection-boundaries, model-picker-accessibility, incognito, account-isolation — **all pass** |

### Failures found and how they were handled

- **Path normalisation (gate test RED → understood):** `/b/A/%2e%2e/B/…` reached build B, and `\` became `/`. The URL standard resolves these before any code (Node `Request`, Workers) sees the path, so the raw form cannot be refused. The resolved path is authorised like any other, so it can only reach files the same reviewer may fetch directly; the test now asserts that (a reviewer not permitted on A gets 404 through the trick). Encoded slashes and every other escape remain refused.
- **Third-party network primitives:** pdf.js, the PowerPoint generator and KaTeX (method named `fetch`) contain `fetch(`/`XMLHttpRequest`; JSZip/xlsx/docx only *test for* `importScripts`. These are listed in a reasoned allowlist; any new chunk with a primitive fails the audit. Vite's modulepreload polyfill (its own `fetch`) was disabled, and the search-worker source was no longer emitted once `new Worker(new URL(…))` was neutralised.
- **Test bugs fixed (no product behaviour or assertion weakened):** wrong idle-button label; a Promise serialised inside `page.evaluate`; Chromium reports CSP-refused images as failed `csp` requests (now distinguished from requests that reached the network; the route proves none did); an identity token naturally expired with the build (401 before 410, then 410 proven with a fresh token); a transport test that matched text across stream frames; a planted `?raw` import that the plugin safely resolved to the adapter (control replaced; the safe behaviour is asserted); the tooling scan flagged the gate's `fetch` *method* and the auditor's own pattern strings.
- **Permissions-Policy:** Chromium warned about unrecognised `bluetooth`/`interest-cohort`; removed.

### Independent review

See the review section of the [handoff](AI_HANDOFF.md) for the findings and their disposition.

## Private CI artifact handoff (documented, not implemented)

QA01 adds no workflow, secret or upload. For QA03, after separate approval of the tooling PR, environment and credentials:

1. **Build job (no secrets):** check out an approved same-repository full SHA with `persist-credentials: false`; inside the pinned Playwright/Node container with no host sockets or credentials, run `npm ci`, `npm test`, `node scripts/qa/build.mjs --out OUT --run $RUN_ID --attempt $RUN_ATTEMPT`, `node tests/security/private-qa-isolation.mjs` and `node scripts/qa/verify.mjs --out OUT --commit $SHA`. Only `OUT` leaves the container; the container is destroyed.
2. **Hand-off:** never `upload-artifact` the site (public repository); public logs/summary may carry only the build ID, manifest digest and pass/fail. A trusted host step (reviewed, pinned tooling; no checked-out scripts executed) receives a short-lived credential limited to the **staging** bucket, validates archive paths/sizes/digests against `manifest.json` and uploads it.
3. **Publisher job (environment-approved):** a fresh job that never executes build output reads the staging object, re-verifies every digest against the manifest, then calls the same `publish()` logic against the serving bucket (create-only prefix, then conditional registry activation). Staging objects expire within one day and are not servable.
4. If scoped staging credentials cannot be established, use the proposal's operator-mediated manual publication instead. Exact runner/token mechanism and vendor token scoping remain QA02/QA03 decisions; nothing here asserts a vendor capability.

## Limits (not claimed)

- No physical iPhone, hosted Access/MFA, real JWKS, R2 consistency, Worker CPU limit, `workers.dev` alias or cleanup scheduling was tested; all are QA02/QA03.
- WebKit is Linux WebKit in Docker, not Safari on iOS; keyboard, glass, gestures and VoiceOver remain physical-device items.
- Same-origin builds share browser storage by design; namespaces separate canonical keys, but all admitted JavaScript is trusted reviewed code (documented limit in the proposal).
- Third-party chunks in the allowlist keep their network code; it is unreachable from Lumen's local-bytes usage and blocked by CSP, not removed.
- Searchable-knowledge indexing, code running and other external tools are disabled with honest messages, not simulated.
- The ordinary production app, Firebase, the relay and the localhost Canvas proof are unchanged.

## Progress

QA01 is unweighted preparation: **21.5% → 21.5%, Medium confidence; 78.5 remaining.** No acceptance group of B03–B08 is completed by local QA tooling. Stop after QA01 for owner and ChatGPT review; QA02 (service/access/spend), QA03 (publication/tooling) and CP02 each need separate authorization.
