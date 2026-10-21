# QA02 revision — strict $0 private iPhone QA architecture

**21 October 2026 · research and planning only · source `ffcbb18aad520cdcd00b5030135ff4838a2b228d` · draft PR #34.** Owner decision: **budget is permanently $0** — no paid plan, upgrade, MFA add-on, CPU allowance, storage, domain, usage fee, payment-method enrolment or new billing activation. This revises [QA02A_PREFLIGHT.md](QA02A_PREFLIGHT.md) and the hosting part of the [QA proposal](PRIVATE_IPHONE_QA_PROPOSAL.md). Nothing was created, configured, deployed or paid for. Blackout ledger stays **21.5%, Medium confidence**.

## 1. Decision summary

**Cloudflare Access is unsuitable under the $0 rule:** Cloudflare's Zero Trust setup guide states onboarding requires *choosing a plan and entering payment details, which still applies to the Free plan* (you are not charged, but it is a payment-method enrolment). Its per-app MFA has **unknown plan availability**, and IdP-enforced MFA is documented only for Okta, Entra ID, generic OIDC and SAML (not the built-in Google login). R2 may also require a card. All are excluded.

**Recommended: one Cloudflare Worker on Workers Free + Workers Static Assets with the Worker run first for every request + a self-hosted passkey (Face ID) login inside that Worker.** No Access, no R2, no KV, no paid feature, no card. Workers Free requests are free; hitting a free limit returns an error (fails closed) rather than billing, **provided the account is on Workers Free and is never upgraded** (owner check O1).

**Condition:** this means Lumen owns its authentication. It is acceptable only with maintained libraries (`@simplewebauthn/server`, `jose`), an independent security review and the tests in §7. If those cannot be met, **no secure free remote option exists**, and testing continues locally (QA01 browser contracts in Chromium/WebKit) until a decision is made.

## 2. Facts, sources and unknowns

| Item | Documented (Cloudflare docs/changelog, via search summaries; direct fetch blocked in this session) | Account-specific unknown → owner check |
|---|---|---|
| Workers Free | 100,000 requests/day (account-wide, resets 00:00 UTC; excess → error 1027); 10 ms CPU per request (excess → 1102); by default users are on Workers Free; paid is a $5 minimum *only if you subscribe* | O1: account is on **Workers Free**, no Workers Paid subscription; current daily use (the provider relay shares the cap) |
| Static Assets | Asset requests are free when served directly; **20,000 files per Worker version and 25 MiB per file** on Free | — |
| Worker-first routing | `assets.run_worker_first = true` makes **every request invoke the Worker** before any asset; it then reads files with `env.ASSETS.fetch()`. Such requests count toward the 100k/day | Confirm on the canary that no path, preview or version URL serves an asset without the Worker (§7 A-tests) |
| Preview URLs | Follow `workers_dev` unless set; `preview_urls: false` disables them (Wrangler ≥ 4.44) | Confirm none exist after deploy |
| Zero Trust / Access | Free ≤ 50 users but **payment details required at onboarding** | Excluded (no check needed) |
| Billing | Budget alerts are informational and never cap spend | Not relied on |

Sources: Workers limits <https://developers.cloudflare.com/workers/platform/limits/>, pricing <https://developers.cloudflare.com/workers/platform/pricing/>, static-asset limits <https://developers.cloudflare.com/changelog/post/2025-09-02-increased-static-asset-limits/>, Worker-first routing <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/> and binding <https://docs.cloudflare.com/workers/static-assets/binding/>, preview defaults <https://developers.cloudflare.com/changelog/post/2025-10-23-preview-url-default-behavior/>, Zero Trust setup <https://developers.cloudflare.com/cloudflare-one/setup>, MFA requirements <https://developers.cloudflare.com/cloudflare-one/policies/access/mfa-requirements/>, budget alerts <https://developers.cloudflare.com/billing/manage/budget-alerts/>.

## 3. Architecture

```
iPhone Safari ──> lumen-qa-gate.<subdomain>.workers.dev  (only hostname; preview_urls:false)
                   Worker runs first on EVERY path
                   ├─ /login, /login/verify   passkey (WebAuthn) sign-in, no app bytes
                   ├─ /                       build list (after sign-in)
                   ├─ /b/<id>/__lease         lease JSON (QA01 contract)
                   └─ /b/<id>/<file>          registry + session checks → env.ASSETS.fetch()
Static Assets (immutable per deployment): /b/<build-id>/... for ≤ 3 builds, plus manifests
```

**Authentication (replaces Access):**
- Owner's **passkey in iCloud Keychain, unlocked by Face ID** — possession + biometric, phishing-resistant, bound to the exact workers.dev hostname. No password, no email code.
- Verification with **`@simplewebauthn/server`** (maintained, WebCrypto-based, Worker-compatible); exact pinned version, Worker package only.
- Allowed credentials (credential ID + public key, not secret) stored as a Worker variable; only those can sign in. User verification required.
- Challenges stateless: an HMAC-signed, 2-minute challenge cookie, single use per attempt.
- Session: an **HMAC-signed cookie via `jose`** (`HttpOnly; Secure; SameSite=Strict; Path=/`), 8 h maximum, bound to a session-generation number. The signing key is a Worker secret.
- The QA01 RS256 Access-token verifier is no longer used remotely. It stays as tested code, and is reused if Access becomes available later.
- **Enrolment, once:** deploy with a one-time random `ENROLL_CODE` secret (set by the owner in the dashboard). The owner opens `/enroll` in Safari, types the code and creates the passkey. The Worker shows the credential's public JSON; the owner pastes it into the `PASSKEYS` variable and deletes `ENROLL_CODE`. Enrolment is refused whenever `ENROLL_CODE` is unset.

**Authorisation and lifetime (no storage service):**
- The registry (build IDs, expiry, allowed passkeys, enabled flag) is **deployment configuration**: a JSON variable plus the manifests inside the assets.
- Expiry is checked against the clock on every request, with no redeploy.
- Revoke a build, sign everyone out (bump `SESSION_GENERATION`) or set `QA_ENABLED=false`: each is a variable/secret change creating a new Worker version within seconds.
- Emergency: disable the workers.dev route or delete the Worker in the dashboard.
- No KV/R2/D1 is needed. KV's free tier (eventually consistent ~60 s) is deliberately not used for revocation.

**Asset protection:**
- `run_worker_first: true` with no negative patterns: no file is served without the Worker's checks.
- Every response is `Cache-Control: private, no-store`, with QA01's CSP and headers and no ETag. Assets are fetched through the binding, never via a public route.
- `workers_dev: true` is the only origin: `preview_urls: false`, no custom domain or route.
- The login page contains no Lumen code. Unauthenticated requests get the login page only for `/`, and `401` with no body for every other path.

**Integrity without per-request hashing (CPU fix):**
- Static Assets are immutable within a deployment and uploaded content-addressed by Wrangler.
- The deploying job verifies every file against QA01's manifest **before** upload, and again after deploy by fetching each file through an authenticated test session.
- The Worker embeds each build's manifest digest and checks only the path and size against the manifest; it no longer hashes 1 MB files per request.
- A post-deploy integrity sweep is mandatory (test S5). Tampering would require a new deployment, which needs the deploy credential.

**Reviewer isolation:** one reviewer (the owner). The QA01 namespace becomes a hash of the passkey credential ID and the build ID. The shared-preference fix (§5) still applies across builds.

## 4. CPU and request budget

| Per request work | Expected CPU |
|---|---|
| Cookie HMAC verify (`jose`), clock/registry checks on in-memory JSON, path parse | well under 1 ms (WebCrypto HMAC is native) |
| `env.ASSETS.fetch()` | I/O, not counted as CPU |
| Passkey sign-in (ECDSA P-256 verify, CBOR parse) | a few ms, a few times a day |

Measured target on the canary: **p99 < 5 ms CPU**; any 1102 error blocks the rollout.

Requests: QA01 measured about **47–57 requests per page load**. 20 sessions × 10 loads ≈ 10,000 requests/day, about 10% of the free daily cap including relay headroom. Excess fails closed with a 1027 error. Build size is 7.7 MB and 164 files, so 3 builds stay far below 20,000 files.

## 5. Security controls carried forward

- **QA01 synthetic-only build unchanged:** no Firebase, sync, service worker or live providers; page-wide synthetic `fetch`; lease lock; banner; per-namespace fixtures.
- **Maintained libraries:** `@simplewebauthn/server` for passkeys and `jose` for session tokens, pinned with a lockfile in `server/private-qa/` only, never in the app's `package.json`.
- **Shared-preferences fix (QA-only):** in `qa/iphone/main.tsx`, swap the five device-wide keys (`mr.settings`, `mr.activeProject`, `mr.sidebarCollapsed`, `mr.canvasWidth`, `mr.sideWidth`) per namespace before the app loads. Browser test: A selects a project and theme, B starts clean, A is restored. No production change.
- **Login hardening:** login and verify endpoints accept only exact JSON shapes and bounded sizes. Failures return a generic 401. Cloudflare's per-IP limits are best-effort only; the security comes from the passkey, not rate limiting.
- **Deploy credential:** the owner deploys from the dashboard, or a GitHub Actions job uses a **new** token limited to Workers edit for that account (Cloudflare tokens cannot be restricted to one Worker — assumed). The relay token is never reused. Any workflow needs the separately approved default-branch tooling PR (QA03).

## 6. Build and version workflow (reusable)

1. `node scripts/qa/build.mjs --run <n>` produces a commit-pinned build and manifest (QA01).
2. A new `scripts/qa/assemble-site.mjs` (local only) merges up to 3 verified builds into `site/b/<id>/…`, writes `registry.json` (id, commit, expiry ≤ 72 h, manifest digest) and refuses expired, duplicate or unverified builds.
3. Deploy the Worker together with its assets (owner or approved job).
4. Run the post-deploy integrity sweep: every file is fetched through an authenticated session and compared with its manifest.
5. Send the owner the build ID and the checklist. The bookmark is always the same workers.dev URL.
6. Builds expire automatically. Revocation is a variable change, and teardown is deleting the Worker.

## 7. Stages and acceptance tests

| Stage | Scope | Approval needed | Exit |
|---|---|---|---|
| Z0 | Owner read-only checks O1–O4 (below) | none | Answers known |
| Z1 | Local code: Worker gate (passkey + session + registry + `run_worker_first` handler), site assembler, preference fix, tests in workerd/Miniflare + Chromium/WebKit virtual authenticator | **Code + 2 dependencies + independent review** | All tests below pass locally |
| Z2 | Deploy **deny-only** Worker (login page, everything else 401, enrolment off) | **Deployment** | A1–A6 |
| Z3 | Enrol passkey from the iPhone, deploy **canary** asset set (one static page, no Lumen code) | **Deployment + owner time** | A1–A12 on iPhone Safari and automated client |
| Z4 | Revocation, expiry and teardown rehearsal | **Teardown** | R1–R5 |
| Z5 | QA03: first synthetic Lumen build | **Separate QA03 authorization** | QA01 browser contract against the hosted URL + physical iPhone checklist |

**Negative tests:**
- **Authentication bypass:**
  - A1 no cookie → 401 / login only, no asset bytes, on `/b/*` paths of every file type;
  - A2 forged or altered cookie, wrong key, expired, older session generation → 401;
  - A3 replayed sign-in assertion or challenge → refused;
  - A4 enrolment refused when `ENROLL_CODE` is unset, or after a credential exists;
  - A5 non-GET/HEAD on assets → 405;
  - A6 cross-site subresource fetch → 403.
- **Alternate URLs and assets:**
  - A7 version and preview URLs absent or refused;
  - A8 direct asset paths, `/assets/*`, `%2e%2e`, encoded and double-slash paths, unknown files → 401/404 without bytes;
  - A9 the Worker runs first on 100% of paths (a request counter across a full page load equals the request count).
- **Caching:**
  - A10 every response `private, no-store` without validators;
  - A11 after sign-out or revocation, Safari back/forward and a reload do not show cached app files.
- **Network isolation:** A12 the QA01 request-capture contract on the hosted canary and build: 0 external requests, CSP active, no service worker.
- **Expiry and revocation:**
  - R1 expiry passes → 410 on the next request with a valid session;
  - R2 build removed from the registry → 410;
  - R3 `SESSION_GENERATION` bump → existing cookie refused;
  - R4 `QA_ENABLED=false` → all 503;
  - R5 Worker deleted → hostname gone.
- **Compromised manifest:**
  - S1 assembler refuses a build whose files mismatch the manifest;
  - S2 registry digest mismatch → 503;
  - S3 a path not in the manifest → 404 even if present in assets;
  - S4 a build older than 72 h refused by the assembler and the Worker;
  - S5 post-deploy sweep detects any mismatch.
- **Budget:**
  - B1 CPU per request measured (p99 < 5 ms);
  - B2 Billable usage shows $0 and the plan is still Workers Free after a week of use.

Physical iPhone Safari verification (enrolment, Face ID sign-in, sign-out, revocation, the QA01 device checklist) remains required before the system is called ready.

## 8. Rollback and cleanup

Set `QA_ENABLED=false` (instant deny) → bump `SESSION_GENERATION` → remove the build entries → delete the Worker (removes the assets and the workers.dev route) → delete the passkey from iCloud Keychain → revoke the deploy token. Nothing in Lumen production, Firebase or the relay changes at any step.

## 9. Owner actions (no spending)

- **O1** Cloudflare dashboard → Workers & Pages → Plans: confirm **Workers Free** with no Workers Paid subscription. If it shows Paid, stop: this plan needs a separate decision.
- **O2** Note today's Workers request count (relay usage).
- **O3** Confirm the iPhone has iCloud Keychain passkeys enabled (Settings → Passwords) and Face ID on.
- **O4** Decide who deploys: you in the dashboard, or a new GitHub Actions token later. No token yet.

**Never add a payment method, start a trial, upgrade, enable R2 or create a Zero Trust organisation for this.** Report answers privately; don't post account details in GitHub.

## 10. Free alternatives compared

| Option | Why not chosen |
|---|---|
| Cloudflare Access (+ Pages or Worker) | Payment details required at Zero Trust onboarding; MFA plan availability unknown |
| R2 storage | May require a card to enable |
| Firebase Hosting / preview channels, GitHub Pages | Public files; an app login screen does not protect the assets |
| Vercel / Netlify password protection | Paid features |
| Google Cloud Run + IAP | Needs a billing account |
| Tailscale (free personal) | Needs an always-on host owned by you; you test from an iPhone only; Funnel is public |
| Secret/obscure URL | Rejected: not access control |
| **Local only (QA01 tests)** | Safe and free, but no physical-iPhone evidence. **This is the fallback if Z1 review or O1 fails.** |

## 11. Stop

Planning only. **STOP for owner and ChatGPT review.** Z0 needs only owner time; Z1 onwards each need the approval listed. Progress **21.5% → 21.5%, Medium confidence.**

> **Amended (21 October 2026):** stateless challenge cookies are not single-use; see [QA02_PASSKEY_AMENDMENT.md](QA02_PASSKEY_AMENDMENT.md) for the Durable Object design that replaces them and the corrected revocation claims.
