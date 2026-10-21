# QA02 alternative — GitHub Codespaces private port (feasibility)

**21 October 2026 · planning only · nothing created, changed or paid for.** The owner paused the Cloudflare passkey/Durable Object Z1 work ([amendment](QA02_PASSKEY_AMENDMENT.md) kept on file) and asked whether a temporary Codespace with a **private** HTTPS forwarded port can show the QA01 synthetic build in iPhone Safari.

## Verdict

**Viable and much simpler, subject to three owner checks and one first-run Safari test.** It replaces the custom authentication, hosting and storage with GitHub's own sign-in and port proxy. The service is temporary: it exists only while the Codespace runs, which suits review sessions better than permanent hosting.

## Why it meets the requirements

| Requirement | How (GitHub docs, via search summaries; direct fetch blocked in this session) |
|---|---|
| $0, no payment method | **Included free usage:** GitHub Free personal accounts get **120 core-hours + 15 GB-month per month**. **Blocked, not billed:** when either runs out *and no payment method is on file, Codespaces use is blocked* until next month. Email warnings at 75/90/100%. A 2-core session of 1 hour = 2 core-hours, so about 60 hours/month. Stopped Codespaces still use storage, so delete after review. |
| No public port, GitHub auth | **Private by default:** ports are private, and private ports are reachable *only by the Codespace creator after GitHub sign-in*. **Session lifetime:** access is via an auth cookie lasting 3 hours. **Every file covered:** every request (HTML, JS, CSS, fonts, fixtures) goes through GitHub's proxy, so there is no asset bypass. **Never public:** we do not change port visibility. |
| No Firebase, providers or secrets | Unchanged QA01 build: Firebase, sync and service worker are replaced at build time, there is a synthetic transport and CSP, and no keys. No Codespaces secrets are defined. The Codespace's own GitHub token stays in the terminal and never reaches the page. |
| Production and Canvas proof unchanged | Only new QA files (below). `src/`, the production build and `docs/blackout/workspace-proofs/` (localhost guard) are not touched. |
| Revocation and expiry | **Ending a session:** stop or delete the Codespace, or let it idle-stop (default 30 minutes). The auth cookie expires after 3 hours. **Within the build:** the QA01 lease expiry still locks the app. **Access control:** only the creator's GitHub account can ever open the port. |

## Smallest QA-only change (for approval)

The QA01 build needs `./__lease` from a gate. Add **one script** plus **one dev-container file**:

1. **`scripts/qa/serve-codespace.mjs`** reuses QA01's tested `createGate` and `publish` with in-memory storage, a key pair generated at start-up, and a lifetime of at most 8 hours. It serves the verified build from `scripts/qa/build.mjs` and **adds the synthetic identity header itself**, because GitHub has already authenticated the visitor.
   - It listens on `127.0.0.1:4173` inside the container only.
   - It accepts only the hosts `localhost:4173` and `${CODESPACE_NAME}-4173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`.
   - It refuses to start outside a Codespace (`CODESPACES=true` required) or if the build fails verification against the current commit.
   - All QA01 gate checks stay on: paths, manifest and file digests, `no-store`, CSP, expiry.
   - The lease names a fixed synthetic reviewer namespace.
2. **`.devcontainer/devcontainer.json`** sets up a Node 22 image:
   - `postCreateCommand: npm ci`;
   - `postAttachCommand` runs the build and the serve script;
   - `forwardPorts: [4173]` with `portsAttributes` `visibility: "private"` and a label;
   - the smallest machine (2-core);
   - nothing that forwards other ports publicly.

**Tests before use:**
- The existing unit and isolation tests, with production output still byte-identical.
- A local run of the serve script proving it refuses without `CODESPACES`, refuses foreign `Host` headers and serves only verified files.
- The QA01 browser contract against `http://localhost:4173`.

## Owner steps (no spending)

1. **Check $0 safety:** github.com → Settings → Billing and licensing. Confirm **no payment method** is on file and the Codespaces budget is $0. **If a card is on file, stop** — usage could then be billable; we'd need a separate decision.
2. **Start a session from the iPhone:** in Safari, open the repo → Code → Codespaces → create on branch `docs/lumen-blackout-phase1-20261019` (2-core).
3. **Open the app:** wait for the build. Open the forwarded port 4173 from the Ports panel, or use `https://<codespace-name>-4173.app.github.dev/`, sign in to GitHub if asked, then open the build link.
4. **Finish:** test, then **delete** the Codespace (Codespaces list → … → Delete) to free storage.

## Unknowns to confirm on the first session

- That Safari keeps GitHub's port-auth cookie through the sign-in redirect (Intelligent Tracking Prevention). If it loops, try with "Prevent Cross-Site Tracking" unchanged first, then report — **we will not make the port public**.
- Whether the Codespaces web editor is usable enough on an iPhone to see the Ports panel. The predictable URL above avoids needing it.
- The real build time on a 2-core machine, and its quota use.
- Repository ownership: the Codespace bills the **creator's** personal free quota. The owner must create it from their own account.

## Compared with the paused Cloudflare plan

No custom authentication, Durable Objects, deployment, Cloudflare account or new dependency. The trade-offs are no permanent bookmark (each session has its own URL) and dependence on the free monthly quota. Physical-iPhone testing is still required.

Sources:
- Codespaces billing (included usage and blocking): <https://docs.github.com/en/billing/concepts/product-billing/github-codespaces>
- Included-usage troubleshooting: <https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-included-usage>
- Port forwarding: <https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace>
- Codespaces security: <https://docs.github.com/en/codespaces/reference/security-in-github-codespaces>

Progress unchanged: **21.5%, Medium confidence.** STOP for owner approval.
