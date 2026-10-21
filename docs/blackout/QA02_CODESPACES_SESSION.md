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

## First real session — 21/22 October 2026 (owner-run)

- **$0 checks:** no payment method; Codespaces usage $0 this month (120 core-hours available); all budgets $0 with paid usage blocked; no Codespaces user secrets; idle timeout 30 min.
- **Created by the owner** from their own account on branch `docs/lumen-blackout-phase1-20261019` at `a42b8e4`, 2-core. The automatic start (`postStartCommand`) did not produce a log on first boot; the build and server were started manually with the documented commands. Build `a42b8e4…-0-1` passed verification (164 files, audit clean, 8-hour expiry).
- **Port 4173 shown as Private** in the Ports panel; it was the only forwarded port.
- **iPhone Safari:** GitHub sign-in for the private port worked; the synthetic app loaded with its banner. Owner reports keyboard, typing, model picker, Send, Stop, scrolling, navigation and rotation all working.
- **Observed issue (QA-only):** the synthetic-review banner overlaps the top of the page on iPhone. Follow-up: give the banner its own space or move it.
- **Teardown:** Codespace deleted; Codespaces list shows 0.
- Served app was the ordinary synthetic Lumen app, not the Canvas design (CP02 not started).

## Update — banner and automatic start fixes (22 October 2026)

**Banner:** the synthetic-review banner is now the page's first row. The app (`#root`) fills the space below it; the phone drawer and its scrim start below it; with the keyboard open, the app is pinned below it. The QA browser contract asserts in Chromium and Linux WebKit at 1440×960, 390×844, 320×568 and 390×480 that nothing of the app (container, header, sidebar/drawer, main) starts above the banner's bottom, both normally and with a simulated keyboard (measured gap 0 px, banner 32 px). The first run of that assertion caught the phone drawer overlapping, which is fixed.

**Automatic start:**
- **Cause:** `postStartCommand` started the server as an unsupervised background job. On the first session, no log existed when the terminal was opened, so it either had not run yet (setup was still installing packages) or the job did not survive.
- **Now:** `postAttachCommand` runs `bash scripts/qa/codespace-start.sh` in a visible terminal each time the editor attaches. This happens after `npm ci`. The script:
  - refuses outside a Codespace or on a checkout with uncommitted changes;
  - builds and audits the review;
  - serves it in the foreground of that terminal, logging every step with a time to `/tmp/lumen-qa.log`;
  - on later attaches, prints **Already running** with the link instead of starting a second copy.
- **Locally verified** with simulated Codespace variables: start, Already running with link, right host 200 / foreign host 404, refusal outside a Codespace, refusal with an uncommitted file.

| Message in the terminal / log | Meaning | What to do |
|---|---|---|
| `Lumen synthetic review ready … https://…-4173.app.github.dev/b/…/` | Running | Check Ports shows **Private**, then open the link on the iPhone |
| `Already running. Review link: …` | A previous attach already started it | Use that link |
| `FAILED: not running inside a GitHub Codespace.` | Started elsewhere | Only run it in the Codespace |
| `FAILED: the checkout has uncommitted changes …` | Files were edited in the Codespace | Discard the edits (Source Control → Discard), then run `bash scripts/qa/codespace-start.sh` |
| `FAILED: npm ci did not complete` / `the review build or its isolation audit failed` | Install or build problem | Send a screenshot of the terminal; don't change settings |
| `FAILED: the review server stopped` | The terminal was closed or the process ended | Run `bash scripts/qa/codespace-start.sh` again |
| No terminal or message after setup | The attach command did not run | Open a terminal (☰ → Terminal → New Terminal) and run `bash scripts/qa/codespace-start.sh` |

The session procedure is otherwise unchanged: confirm port 4173 is **Private** before opening the link, and delete the Codespace afterwards.

## Update — CP02 (22 October 2026)

From commit `e0196eb` on this branch, the synthetic review build shows the **CP02 Canvas composer and writing sheet** ([record](CP02_COMPOSER.md)); the rest of the app is the ordinary synthetic Lumen app. The session procedure, private port, $0 checks and teardown are unchanged. The physical-iPhone checklist is in the CP02 record. Creating the Codespace is an owner-only step after review.
