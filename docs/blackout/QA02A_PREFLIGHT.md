# QA02-A — Cloudflare readiness preflight (private iPhone QA)

**21 October 2026 · planning/documentation only · source `7f13482c1a1d75095afd2ced327e1cccbeca5eb6` (QA01 accepted; exact-head CI run 39652612955 passed all three jobs) · draft PR #34.** Owner authorized **QA02-A only**: capability, security, cost and readiness assessment. **Nothing was created, enrolled, configured, deployed, paid for or exposed.** Blackout ledger stays **21.5%, Medium confidence**.

## 1. What could and could not be verified here

| Item | Result |
|---|---|
| Cloudflare account access from this session | **None.** No Cloudflare token, account ID, Wrangler login or dashboard session exists in this environment (checked by variable *names* only). The provider relay's deploy workflow reads repository secrets this session cannot and must not read. **No account capability is claimed from Lumen's existing Cloudflare tooling.** |
| Official documentation | Direct fetches of `developers.cloudflare.com` are refused by this session's network policy. Facts below come from web-search summaries of Cloudflare's own docs/changelog (sources in §10), marked **Doc** when they cite developers.cloudflare.com or cloudflare.com and **3rd** when only third-party sites said it. Every **Doc** item is still to be confirmed on the owner's live dashboard (§3). |
| Lumen source | Read directly at `7f13482` (gate, control plane, QA build, relay config/workflow, store/settings persistence). |

## 2. Capability matrix

| Capability needed | What the docs say | Confidence | Owner must confirm |
|---|---|---|---|
| **Cloudflare Access for one reviewer** | Zero Trust Free: up to **50 users at $0**, 24 h logs; Pay-as-you-go **$7/user/month**, no cap | Doc (plan page) + 3rd | Zero Trust organisation exists/can be created on the **Free** plan without a card; seat count used |
| **Per-app MFA (Face ID / passkey / TOTP)** | *Independent MFA* (changelog 15 Apr 2026): MFA at organisation → application → policy level (policy wins); WebAuthn incl. **Face ID/Touch ID**, multiple keys; **one TOTP app per user**; must be enabled at organisation level first; Apr 2026 added AAGUID restrictions/AMR matching | Doc | **Whether independent MFA is included in the Free plan** (no source states plan availability). If not, alternatives in §5 |
| **Worker-wide Access** | “One-click Access for Workers” (3 Oct 2025): *Workers & Pages → Worker → Settings → Domains & Routes → Enable Cloudflare Access* protects the **workers.dev route and Preview URLs**; since 3 Dec 2025 all preview URLs share one account-wide “Cloudflare Workers Preview URLs” policy | Doc (changelog) | Exact hostnames covered (main, version and alias previews); that the shared preview policy does not admit other people already allowed for other Workers |
| **Disable alternate routes** | Preview URLs follow the `workers_dev` setting unless set explicitly (Wrangler ≥ 4.44.0); making previews unreachable requires disabling the Worker's workers.dev subdomain or `preview_urls: false` | Doc | After setup: every alternate URL returns the Access login or 404, never content |
| **Dedicated Worker** | Workers Free: **100,000 requests/day** (account-wide, reset 00:00 UTC; over the cap → error **1027**), **10 ms CPU per request** (over → error **1102**); network/storage waits don't count; Workers Paid minimum **$5/month** | Doc | Account's current Workers plan and today's request use (the relay shares the same daily cap) |
| **Private R2** | Free tier (Standard): **10 GB-month, 1 M Class A, 10 M Class B ops/month**, free egress; above: $0.015/GB-month, $4.50/M A, $0.36/M B | Doc | **Whether enabling R2 requires adding a payment method** (sources conflict) — that step is a billing activation needing separate approval |
| **Bucket-scoped publishing credential** | R2 *Account API token* with **Object Read & Write limited to named buckets**; admin permissions are account-wide only | 3rd (consistent) | That the token UI offers bucket restriction on this account |
| **Worker-code deployment credential** | Existing relay uses a token with “Edit Cloudflare Workers”; no source shows a token restricted to **one** Worker | Unverified — assume **account-wide** | Treat Worker deployment as an owner-performed action, or use a separate Cloudflare account for QA |
| **Spend alerts** | *Budget alerts* (Apr 2026): account-wide dollar thresholds for usage products (Workers, R2), **email only, processed daily, never pause or cap usage**; default $10 alert being rolled out for eligible pay-as-you-go accounts; per-product *usage notifications* are separate | Doc | Alert recipient set; understand alerts are **not** a hard cap |

## 3. Owner-performed read-only checks (no changes)

Do these in the Cloudflare dashboard yourself; **do not paste account IDs, emails, tokens or screenshots containing them into GitHub.** Report each answer privately as yes/no/value. Menu names can differ slightly; stop if a page asks you to buy, enrol or add a card.

1. **Account & plan:** Workers & Pages → *Plans*: is it **Free** or **Paid**? Note today's requests (relay included).
2. **Zero Trust:** open *Zero Trust*. Is a team already set up? If it asks to choose a plan or add payment details, **stop** and tell me what it asks.
3. **Independent MFA availability:** Zero Trust → *Settings → Authentication* (or *Access settings*): is there an *Independent MFA* / *Multi-factor authentication* section, and is it offered on your plan? Don't turn it on yet.
4. **Login methods:** Zero Trust → *Settings → Authentication → Login methods*: which are listed (One-time PIN, Google…)?
5. **R2:** open *R2 Object Storage*. Does it show buckets, an *Enable* / *Purchase* screen, or ask for a payment method? Do not click enable.
6. **Billing:** *Manage Account → Billing*: is a payment method on file? Any budget alerts?
7. **Existing Workers:** list Worker names only (expected: the provider relay). Confirm none is called anything like `lumen-qa`.
8. **API tokens:** *My Profile → API Tokens* and *R2 → Manage API tokens*: list token **names and permission summaries only**. The relay's token must never be reused for QA.

## 4. Security decisions

### 4.1 JWT verification for the Internet-facing Worker — recommendation

**Use `jose` (panva/jose) for signature/JWKS handling, pinned to an exact reviewed version, as a dependency of the QA Worker package only** (`server/private-qa/package.json` with its own lockfile; never added to the app's `package.json`). This is the pattern Cloudflare documents for validating Access tokens in a Worker: `createRemoteJWKSet(new URL('<team>.cloudflareaccess.com/cdn-cgi/access/certs'))` + `jwtVerify(token, jwks, { issuer: '<team domain>', audience: '<application AUD>', algorithms: ['RS256'] })`, reading `Cf-Access-Jwt-Assertion`. jose handles `kid` lookup, key rotation, bounded JWKS refresh and JOSE edge cases that QA01's hand-written verifier would otherwise have to keep up with.

Keep QA01's **policy layer on top** (it is Lumen-specific, not cryptography): printable-ASCII email, required `iat`, ≤ 24 h lifetime, exact issuer/audience, deny on any error. Rework `server/private-qa/access-jwt.mjs` to call jose and keep its exported `verifyAccessJwt` contract, so every existing negative test (unsigned, forged key, wrong issuer/audience, expired, not-yet-valid, missing/non-ASCII email, Kelvin sign, weak key) runs unchanged against the jose path using `createLocalJWKSet` with the synthetic keys. Service tokens (no `email`) stay denied. Approval needed: the dependency (exact version + lockfile) and an independent review of the diff.

### 4.2 Shared device preferences (`mr.activeProject` and friends)

Production stores five preferences per device, not per account: `mr.settings`, `mr.activeProject`, `mr.sidebarCollapsed`, `mr.canvasWidth`, `mr.sideWidth` (`src/lib/settings.ts:3`, `src/store.ts:1032/1579`, `src/App.tsx:100`). On one review origin:

- `mr.activeProject` **does** carry over in the UI: fixture project IDs (`studio`, `trip`) are identical in every namespace, so reviewer B can open in the project reviewer A last selected.
- `mr.settings` holds the previous reviewer's settings (custom instructions, project briefs, theme). The canonical store replaces them with the account's own settings before the app renders (the loading skeleton shows meanwhile), so they are not displayed — but they stay in local storage and the theme may flash.

**Recommendation: a QA-only fix in `qa/iphone/main.tsx`, no production change.** Before importing the app, if the namespace differs from the last one recorded on this device, save these five keys under `mr.qa.device.<previous uid>.<key>`, then restore the current namespace's saved copies (or remove them so canonical defaults apply). Test: reviewer A selects a project and changes theme → reviewer B starts from fixture defaults → A gets its own state back. It matters only once real app builds are served, so schedule it as **QA02-B0 (local)** before QA03; not needed for a deny-only or canary Worker. Documented remaining limit: two reviewers in two tabs of the same browser at the same moment can still interleave these keys (unusual: one Access session per browser).

### 4.3 Worker CPU budget — new finding

QA01's gate re-hashes each served file with SHA-256 on every request. Several QA files are large (pdf.js worker ≈ 1.2 MB, markdown extras ≈ 0.37 MB), so a request could exceed the **Free plan's 10 ms CPU limit** (error 1102 — fails closed, but breaks the review). Options, to be measured on the canary before any app build:

1. Store each file's SHA-256 as an R2 checksum at upload, re-verified by the publisher, and have the gate compare R2's reported checksum instead of hashing on every read (integrity still pinned by the registry's manifest digest), or
2. Accept the **Workers Paid $5/month** plan (much larger CPU limit) — needs explicit spend approval.

Recommendation: option 1, with the canary measuring CPU per request for JWT verification, registry read and a large dummy file.

## 5. MFA and login options for iPhone Safari

| Option | How it works | Recommendation |
|---|---|---|
| **A. One-time PIN (email) + independent MFA with Face ID passkey** | Access emails a 10-minute code to the one allowed address, then asks for the passkey stored in iCloud Keychain | **Preferred** if independent MFA is available on the plan |
| **B. Google login + independent MFA (passkey)** | Same, with Google as the login method | Good if Google login is set up; adds an identity-provider configuration |
| **C. One-time PIN + TOTP** | Authenticator app code as the second factor | Fallback if passkeys fail on the device |
| **D. One-time PIN only** | Email code only | **Not acceptable** as the strong baseline; use only for a no-content deny/canary trial if the owner agrees |

Policy: **Allow** only the exact owner email; default deny; no *Everyone*, no email-domain rule, no *Bypass*, no service tokens. Session 8 h; require MFA at application level.

## 6. Proposed configuration (to be created only after approval)

| Resource | Setting |
|---|---|
| Worker | Name `lumen-qa-gate`; **new**, separate from the relay; `workers_dev: true` (only origin), `preview_urls: false`; no custom domain/route; no KV/D1/Durable Objects; observability off or metadata-only |
| Access | Application on the Worker's workers.dev host (one-click flow or self-hosted app), policy “Allow: owner email” + MFA; preview policy checked to be no broader |
| Worker secrets/vars | `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ALLOWED_HOST` — set by the owner in the dashboard (not committed) |
| R2 | Bucket `lumen-qa-serving` (private, **r2.dev public access off, no custom domain**), Worker binding only; later `lumen-qa-staging` with a 1-day lifecycle rule, plus 7-day retention rule on serving |
| Tokens | None for QA02 canary (owner deploys from the dashboard or with their own Wrangler login). Bucket-scoped tokens only in QA03 |
| Alerts | Budget alert at **$1** (and $5) to the owner; Workers/R2 usage notifications if offered |

## 7. Rollout plan — each step needs the approval shown

| Step | Action | Approval needed | Pass criteria |
|---|---|---|---|
| **0** | Owner runs §3 checks, reports privately | none (read-only) | Plan/MFA/R2/billing answers known |
| **1** | Local only: switch verifier to pinned `jose` + policy layer; add canary/deny Worker code and its local tests (Miniflare/workerd or node), CPU-light integrity per §4.3; QA02-B0 device-key fix | **Code-only approval** (dependency + review) | All QA01 tests + new ones pass; independent review |
| **2** | Create Zero Trust team / enable independent MFA / create Access app + owner-only policy | **Dashboard/security-config approval** (and plan/seat quote if not free) | Login page appears for the host; nothing deployed yet |
| **3** | Deploy **deny-only Worker** (always 403, no storage) on workers.dev, with Access in front | **Deployment approval** | §8 tests D1–D8 pass |
| **4** | Enable R2 (if a card is required → **billing approval**), create private serving bucket, bind; deploy canary Worker serving one static “Canary · no Lumen code” page through the full QA01 gate | **R2/billing + deployment approval** | §8 tests C1–C10 pass |
| **5** | Owner tests from **iPhone Safari**: login, MFA enrolment (Face ID), canary loads, logout, session revoke | owner time | Works from Safari without Mac/USB; screenshots kept private |
| **6** | Revocation and teardown rehearsal: revoke session, remove from policy, global disable, expire canary; then delete Worker, bucket objects, Access app (or keep disabled if QA03 is approved next) | **Teardown approval** (destructive) | Every URL denies; no objects left; alerts unchanged |
| **7** | QA03: tooling PR, staging bucket, scoped tokens, first versioned synthetic build | **Separate QA03 authorization** | Proposal QV03/QV05/QV09/QV10 |

## 8. Tests required before and at the canary

**Deny-only (D):** D1 no session → Access login, no Worker response body; D2 forged `Cf-Access-Jwt-Assertion` sent directly (bypassing login) → Worker denies; D3 wrong-audience/expired token → deny; D4 every alternate URL (version and alias preview, `*.workers.dev` variants) → login or 404; D5 non-GET/HEAD → 405; D6 MFA required: login without the second factor fails; D7 removed reviewer + revoked session → old cookie denied and new login refused; D8 response headers `private, no-store`, CSP, `noindex`.

**Canary (C):** C1 authorised Safari loads the canary; C2 registry disabled → 503; C3 registry missing/corrupt → deny (fail closed); C4 expiry passes → 410 on next request with the same session; C5 build revoked → 410 immediately; C6 R2 bucket not reachable by r2.dev/custom domain/presigned link; C7 tampered object → 503; C8 Worker CPU per request measured within the plan limit (JWT, registry read, large dummy file); C9 Free-plan daily cap behaviour understood (1027 fails closed) and relay traffic accounted for; C10 budget alert configured and Billable Usage shows $0.

## 9. Costs and owner actions

| Item | Expected cost | Owner action |
|---|---|---|
| Access (1 reviewer) | **$0** on Zero Trust Free (≤ 50 users) | Confirm plan; **if independent MFA needs Pay-as-you-go: $7/user/month** → explicit approval |
| Worker | **$0** on Workers Free if CPU fits (§4.3); otherwise **$5/month** Workers Paid | Approve only after canary measurement |
| R2 | **$0** within free tier (≈ 150 MB, low ops); payment method may be required to enable | Approve billing activation separately if asked for a card |
| Domain | $0 (workers.dev) | none |
| Alerts | $0 | Set budget alert; alerts never cap spend |

**Target: $0/month.** Worst realistic case with approvals: $5 (Workers Paid) + $7 (Access seat, only if MFA requires it) = **$12/month**. Nothing will be bought or enabled without a specific yes.

## 10. Rollback

Every step is reversible without touching Lumen production, Firebase or the relay: global registry disable (instant deny) → remove reviewer from Access policy and revoke sessions → disable workers.dev route / delete Worker → delete bucket objects then bucket → delete Access application and (if created only for this) the Zero Trust team → remove budget alert. Never delete the Access application while the Worker still serves content. Record each action and its read-back.

## 11. Sources (search summaries; direct fetch blocked in this session)

- Independent MFA: <https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/>, <https://developers.cloudflare.com/changelog/post/2026-04-15-independent-mfa/>, <https://developers.cloudflare.com/changelog/post/2026-04-23-independent-mfa-aaguid-amr/>
- One-click Access for Workers / previews: <https://developers.cloudflare.com/changelog/post/2025-10-03-one-click-access-for-workers/index.md>, <https://developers.cloudflare.com/changelog/post/2025-12-03-reusable-access-policies/>, <https://developers.cloudflare.com/changelog/post/2025-10-23-preview-url-default-behavior/>, <https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/>
- Access JWT validation (jose pattern): <https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/>
- Workers limits/pricing: <https://developers.cloudflare.com/workers/platform/limits/>
- R2 pricing: <https://developers.cloudflare.com/r2/pricing/>; tokens (third-party summaries): <https://simplebackups.com/docs/storage-providers/cloudflare-r2>
- Budget alerts: <https://developers.cloudflare.com/billing/manage/budget-alerts/>, <https://developers.cloudflare.com/changelog/post/2026-04-13-billable-usage-dashboard-and-budget-alerts/>
- Zero Trust plans: <https://www.cloudflare.com/plans/sase-zero-trust.md>, <https://costbench.com/software/business-vpn/cloudflare-zero-trust/free-plan/> (3rd)

## 12. Stop

QA02-A is complete as planning. **STOP for owner and ChatGPT review.** Step 0 needs only the owner's time; steps 1–7 each need the explicit approval listed. Progress **21.5% → 21.5%, Medium confidence** (QA work is unweighted).

> **Superseded on hosting and cost (21 October 2026):** the owner set a permanent $0 budget. See [QA02_ZERO_COST_ARCHITECTURE.md](QA02_ZERO_COST_ARCHITECTURE.md); the paid fallbacks, Access and R2 above no longer apply.
