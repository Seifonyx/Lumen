# QA02 amendment — passkey replay protection with Durable Objects (strict $0)

**21 October 2026 · planning and security design only · amends [QA02_ZERO_COST_ARCHITECTURE.md](QA02_ZERO_COST_ARCHITECTURE.md) at `28a64a5` · nothing created or deployed · Blackout 21.5%.**

## 1. Correction

The previous revision called stateless HMAC-signed challenge cookies "single use". **That was wrong.** A signed, expiring cookie can be presented again until it expires. Passkeys synced through iCloud report a signature counter of 0, so counters cannot detect replay either.

No stateless design gives atomic one-time consumption, enrolment that can happen only once, or revocation that takes effect for the very next request. Those need one strongly consistent writer.

Two earlier claims are also corrected:
- **Variable or secret changes are not globally immediate.** They create a new Worker version, which rolls out within seconds.
- **"Single-use enrolment" cannot rely on deleting a secret.** It must be an atomic state change.

## 2. Amended design

Everything from the $0 revision is kept: one Worker on Workers Free, Static Assets behind `run_worker_first: true`, `preview_urls: false`, no Access, R2 or KV, and QA01's synthetic build, headers and integrity sweep.

**Added: one SQLite-backed Durable Object instance, the "auth authority", addressed by a fixed name.** Every authentication decision goes through it:

| Table | Purpose |
|---|---|
| `state` (`enabled`, `enroll_open`, `enroll_code_hash`, `session_generation`) | Kill switch and enrolment gate |
| `challenges` (`id`, `purpose` login/enrol/admin, `expires_at`) | Each challenge is consumed with `DELETE … WHERE id=? AND expires_at>now RETURNING`; a second use finds nothing |
| `credentials` (`id`, `public_key`, `created_at`, `revoked_at`) | Allowed passkeys; enrolment inserts one only inside the same transaction that closes `enroll_open` |
| `sessions` (`id` = 256-bit random, `created_at`, `expires_at` ≤ 8 h, `generation`, `revoked_at`) | Opaque session IDs; the cookie holds only the ID |

**Why this is atomic:** one Durable Object instance processes its requests one at a time. Its SQLite storage applies each request's statements as a single transaction. Two concurrent replays of the same challenge, or two simultaneous enrolments, are therefore serialised: exactly one succeeds.

**Request flow:**
1. **Every request,** including each JS/CSS/font/fixture file:
   - `QA_ENABLED` variable check;
   - cookie `__Host-lumenqa=<id>` (`Secure; HttpOnly; SameSite=Strict; Path=/`);
   - Durable Object `checkSession(id)`, which checks `enabled`, not revoked, not expired and the generation;
   - QA01 registry, expiry and path checks;
   - `env.ASSETS.fetch()`.
   - If the Durable Object call fails, times out or hits the free quota, the request is **denied with 503** (fail closed).
2. **Login:** `begin` stores a challenge (2-minute expiry) and returns WebAuthn options. `finish` atomically consumes the challenge, then `@simplewebauthn/server` verifies with:
   - `expectedOrigin` = exactly `https://<worker host>`;
   - `expectedRPID` = exactly the host;
   - `requireUserVerification: true` (Face ID);
   - the credential matched against non-revoked `credentials`.

   On success it creates the session row and sets the cookie. Failures return a generic 401.
3. **Enrolment (once):**
   - The owner sets the secret `ENROLL_CODE` in the dashboard. The Durable Object stores only its hash on first use.
   - `/enroll` needs the code and an enrolment challenge.
   - One transaction inserts the credential, sets `enroll_open=false` and erases the code hash.
   - A second or concurrent enrolment fails. Re-opening needs a **new** code and `ENROLL_REOPEN=<code hash>`, set from the dashboard (owner-only).
4. **Revocation and emergency:**
   - An authenticated `/admin` action, which requires a **fresh** passkey assertion (a new admin challenge), can revoke all sessions (generation +1), revoke a credential, or set `enabled=false`.
   - It takes effect for every request that reaches the Durable Object check after the write commits.
   - Requests already past the check, and bytes already delivered, cannot be recalled.
   - Independent dashboard backstops: `QA_ENABLED=false` (new version, seconds), then deleting the Worker.

**Libraries:**
- `@simplewebauthn/server` documents Cloudflare Workers support. Pin the exact current release at implementation (13.3.x at time of writing), plus its lockfile, in `server/private-qa/` only.
- **`jose` is no longer needed.** Opaque, server-stored session IDs replace signed tokens, removing a dependency and key rotation. QA01's RS256 verifier stays as tested, unused code.

**Recovery and rotation:**
- A lost iPhone is normally covered because the passkey syncs through iCloud Keychain.
- Otherwise the owner revokes everything from the dashboard (`QA_ENABLED=false`), then re-opens enrolment with a new `ENROLL_CODE`.
- No long-lived signing keys exist. `ENROLL_CODE` is single-use by construction.
- The Cloudflare account login is the root of trust and must itself use strong MFA (owner action; free).

## 3. Budget

| Resource | Use | Workers Free / DO Free (documented) |
|---|---|---|
| Worker requests | ~50 per page load; ~10k/day heavy use | 100,000/day, shared with the relay |
| DO requests | 1 per Worker request (session check) + login/admin | 100,000/day |
| DO rows written | sessions/challenges: tens/day | 100,000/day |
| DO storage | KBs | 5 GB |
| CPU per asset request | cookie parse + JSON checks; DO call and asset fetch are I/O | 10 ms limit; target p99 < 3 ms |
| CPU per login | P-256 signature verification (WebCrypto) + CBOR/JSON parse in the library | target < 8 ms; **must be measured on Z2**, because local tools do not reproduce edge CPU accounting |

Documented behaviour: exceeding a Free limit makes further operations fail; the Free plan has no overage billing. Hitting a limit therefore denies access and never charges. A Cloudflare changelog announced storage billing for SQLite Durable Objects from January 2026; the docs reviewed place this under Paid-plan pricing. **Free-plan behaviour must be confirmed on the owner's account (V3).** The "Duration" and "rows read" free figures were garbled in the retrieved table and must be read from the official page (V2).

## 4. Free-account verification (owner, no payment)

- **V1** Workers & Pages → Plans shows **Workers Free**, with no Paid subscription and no prompt to add a card.
- **V2** On the official Durable Objects pricing/limits page, read the Free-plan rows (requests, duration, rows, storage) and confirm SQLite-backed objects are available on Free.
- **V3** On Z2, the first deploy with a `new_sqlite_classes` migration must succeed **without any billing prompt**. If the dashboard or Wrangler asks for a payment method or plan change, **stop**: this design is then not available at $0, and testing stays local-only.
- **V4** Cloudflare account login itself uses strong MFA (free; required root of trust).
- **V5** After a week of Z3 use, Billable Usage shows $0 and the plan is unchanged.

A stateless alternative was evaluated and **rejected**: no signed-token scheme provides one-time challenges or immediate credential/session revocation, and accepting a replay window would weaken security. If V1–V3 fail, there is no secure free remote option; continue local-only testing.

## 5. Remaining risks

- **Lumen owns its authentication code.** This needs an independent security review before Z2.
- **The `workers.dev` login page is public** (it serves no app bytes). Brute force is irrelevant with passkeys, but quota exhaustion by others could deny service. That fails closed, never costs, but could block reviews for the rest of a day.
- **One global Durable Object** adds latency for distant regions (acceptable for one reviewer) and is a single point of failure, which also fails closed.
- **No recall of delivered bytes.** Same-origin trusted-JavaScript limits as documented in QA01.
- **Physical iPhone Safari passkey and Face ID behaviour** is unverified until Z3.

## 6. Exact Z1 scope (local only, after approval)

**New files under `server/private-qa/`:**
- `worker.mjs`: the Worker entry, which runs first on every request.
- `auth-do.mjs`: the Durable Object class and its SQL schema.
- `webauthn.mjs`: a thin wrapper over `@simplewebauthn/server`.
- `wrangler.jsonc`: no account ID, `preview_urls:false`, `run_worker_first:true`, a `new_sqlite_classes` migration. It is not deployed.
- `package.json` and lockfile: pinned `@simplewebauthn/server`, with `wrangler`/Miniflare as **dev-only** tools for local `workerd` tests.

**Other files:**
- `scripts/qa/assemble-site.mjs`: merges up to 3 verified builds into the asset directory and writes `registry.json`.
- The QA-only shared-preference swap in `qa/iphone/main.tsx`.

**Tests**, run locally in `workerd` via Miniflare, plus Chromium/WebKit with a CDP virtual authenticator where available:
- **Replay:** the same login assertion twice → second 401; the same challenge used for login and admin → refused; expired challenge → refused.
- **Concurrency:** 20 parallel `finish` calls with one challenge → exactly one session; 2 parallel enrolments → exactly one credential.
- **Enrolment:** wrong or missing code → 401. After enrolment, any further attempt → 403, even with the old code. Re-open needs a new code.
- **Verification:**
  - wrong origin, wrong RP ID, user-verification flag absent, unknown or revoked credential → 401;
  - forged, guessed, expired or old-generation session cookie → 401;
  - cookie without `__Host-` attributes is not accepted.
- **Failed storage:** the Durable Object throws, times out or is over quota (simulated) → 503 on every path, including assets.
- **Asset bypass:** every file type and path variant without a session → 401 with no bytes.
  - `run_worker_first` coverage asserted: every request in a full page load reaches the Worker handler.
  - Version/preview configuration asserted absent.
- **Revocation:**
  - revoke sessions → next request 401;
  - revoke a credential → its login fails;
  - `enabled=false` → 503;
  - `QA_ENABLED=false` → 503 without contacting the Durable Object.
- **Regression:** all QA01 contracts, isolation audit (production output byte-identical), `npm test`, and an independent review.

**Not in Z1:** any account, credential, deployment or remote endpoint.

## 7. Stop

Planning only. **STOP for owner and ChatGPT review.** Z1 needs explicit approval of the code scope and the pinned dependency; Z2 and later stay as in the $0 revision, with V1–V5 added.

Sources (search summaries; direct fetch blocked in this session):
- Durable Objects limits: <https://developers.cloudflare.com/durable-objects/platform/limits>
- Durable Objects pricing: <https://developers.cloudflare.com/durable-objects/platform/pricing>
- Durable Objects on the Free plan (changelog): <https://developers.cloudflare.com/changelog/post/2025-04-07-durable-objects-free-tier/>
- `@simplewebauthn/server` documentation: <https://jsr.io/@simplewebauthn/server/doc>
- `verifyAuthenticationResponse` options: <https://jsr.io/@simplewebauthn/server/doc/~/verifyAuthenticationResponse>
