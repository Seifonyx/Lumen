# Private iPhone QA with GitHub Codespaces — implementation and session guide

**21 October 2026.** Owner authorized the QA-only Codespaces adapter and local verification ([feasibility](QA02_CODESPACES_FEASIBILITY.md)); the Cloudflare passkey/Durable Object Z1 stays paused. **No Codespace was created, no port forwarded, nothing deployed or paid for.** The served app is the **ordinary synthetic Lumen app from QA01**, not the Canvas design. Blackout progress unchanged: **21.5%, Medium confidence**.

## What was added

| File | Purpose |
|---|---|
| `scripts/qa/serve-codespace.mjs` | Serves one verified QA01 build through the unchanged QA01 gate. Refuses to start unless `CODESPACES=true` and the Codespace name and forwarding domain are well formed. Refuses a build that fails manifest/digest/commit/expiry verification. Binds **127.0.0.1** only. Accepts only the hosts `<codespace>-<port>.<forwarding domain>`, `localhost:<port>` and `127.0.0.1:<port>`. Generates a temporary RSA key pair at start, never stored. **Drops any identity header the browser sends** and signs its own 5-minute synthetic identity per request. Malformed requests → 400. |
| `server/private-qa/memory-storage.mjs` | The in-memory conditional-write store, moved from the test fixtures so the server and tests share one implementation (the fixtures re-export it). |
| `.devcontainer/devcontainer.json` | Node 22 image, 2-core minimum. `npm ci` on create. On start, a background job builds the synthetic review (`--hours 8`) and serves it on port 4173 (log: `/tmp/lumen-qa.log`). Forwards only 4173 and ignores other ports. **No visibility setting** — GitHub ports are private by default and nothing here makes them public. No secrets, Firebase or deployment. |
| `tests/unit/private-qa-codespace.test.mjs` | Runs in `npm test`/CI |
| `tests/security/private-qa-codespace-browser.mjs` | Explicit Chromium/WebKit smoke test against the real build |

Unchanged: `src/`, root entry, `vite.config.ts`, packages, Firebase config/rules, providers/relay, workflows, `public/`, and the localhost-only Canvas proof (asserted by the QA01 isolation audit).

## Verification (this session, local only)

| Check | Result |
|---|---|
| `npm test` | **84 unit files pass** (QA01's 83 + the new Codespaces file: 4 cases) |
| Refuses outside a Codespace | Pass — missing/false `CODESPACES`, missing or malformed name/domain |
| Refuses unverified builds | Pass — tampered file (digest mismatch), different commit, expired build |
| Hosts | Pass — forwarded host and loopback accepted. `evil.test`, another Codespace's host, a lookalike suffix and a host appended with `.evil.test` → 404 with no app bytes |
| Untrusted identity | Pass — a browser-supplied token from another key is discarded; the lease namespace stays the server's own reviewer |
| Expiry | Pass — at the build deadline, page and lease → 410 |
| Loopback, headers | Pass — bound to `127.0.0.1`; `private, no-store` and CSP present |
| Browser smoke (real build), Chromium and Linux WebKit, 390×844 and 1440×960 | Pass — the app loads behind the gate with a forged identity header present; synthetic reply streams; 0 external requests, 0 CSP violations, 0 blocked hosts, 0 refused Firebase calls, 0 page errors |
| QA01 isolation audit (with the pre-QA01 production baseline) | See the handoff for the run at the final commit |

Not executed: a real Codespace, GitHub's port proxy and sign-in, iPhone Safari.

## Before the first session: $0 checks (read-only, on github.com)

1. **No payment method:** Settings → *Billing and licensing* → *Payment information*. It must show **no card or PayPal**. If one is on file, **stop and tell me** — Codespaces usage beyond the free quota could then be charged, and this setup is not approved for that.
2. **Codespaces budget:** *Billing and licensing* → *Budgets and alerts*. Codespaces must not have a budget above $0. Do not create or raise one.
3. **Free quota:** *Billing and licensing* → *Usage* (filter Codespaces). Note core-hours and storage used this month. GitHub Free includes **120 core-hours and 15 GB-month**. A 2-core session uses 2 core-hours per hour. When the quota runs out with no payment method, GitHub **blocks** Codespaces until next month rather than charging.
4. **Account:** create the Codespace from **your own** personal account. Its usage counts against the creator's quota.
5. **Repository Codespaces secrets:** repository *Settings → Secrets and variables → Codespaces* should be empty. The QA build uses none.

## Session procedure (iPhone Safari, no Mac)

1. In Safari, sign in to github.com and open the repository → **Code** → **Codespaces** → **⋯ / New with options**. Choose branch `docs/lumen-blackout-phase1-20261019` and **2-core**, then **Create codespace**.
2. Wait for the editor to open. Setup installs packages and then builds; the first start takes several minutes.
3. **Verify the port is Private** before opening it: open the **Ports** panel and check that port 4173 is labelled "Lumen QA (must be Private)" and shows **Private** visibility. If it shows Public or Organization, **do not open it**: right-click → *Port Visibility → Private*, or delete the Codespace.
4. Open the forwarded address for 4173: the globe icon in Ports, or `https://<codespace-name>-4173.app.github.dev/b/<build>/`. The full link is printed in the terminal log: `cat /tmp/lumen-qa.log`. Sign in to GitHub if Safari asks.
5. Check the banner shows "Synthetic review · no live provider requests". Test with made-up content only.
6. **Teardown:** github.com → **Codespaces** list → **⋯ → Delete**. Do this every time; a stopped Codespace still uses storage quota. Optionally remove Safari's website data for `app.github.dev`.

Access ends when you delete or stop the Codespace, when GitHub's port cookie expires (3 hours), or when the build reaches its 8-hour expiry. At that point the app locks itself and reloads are refused.

## Remaining concerns

- **Private-port behaviour in iPhone Safari is unverified:** GitHub sign-in redirect, cookie retention under tracking prevention, and the 3-hour re-login.
- **The Codespaces editor on an iPhone may be awkward.** The Ports panel is needed once per session to confirm Private.
- **Port visibility is GitHub's setting.** The app cannot enforce it, so check it manually every session (step 3).
- **The forwarded hostname comes from GitHub's environment variables,** and we assume the Codespaces proxy preserves the `Host` header. If it rewrites `Host`, the gate returns 404 for everything. That fails closed and is fixed locally once observed.
- **Billing protection depends on having no payment method on file** (official rule: use is blocked, not billed). Any future card on the account changes that.
- **Physical-device items** — keyboard, glass, gestures, VoiceOver and Face ID — are still unverified until a real session.
