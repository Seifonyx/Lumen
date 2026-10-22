# Hosted Model Picker acceptance — 22 October 2026

This is the P11-B hosted acceptance record. It checks the live site `https://lumen-chat.web.app` against the reviewed production build. It was run by Claude Code from a cloud environment that allows that host. No code, deployment, Firebase setting or provider account was changed.

## What was tested

| Item | Value |
|---|---|
| Production runtime under test | `677bc51f39fbf8fcf66bc91f846b71a4912bb306` (PR #35 merge, Deploy `39447533639`). `main` at `655438f` differs from it only in `AI_HANDOFF.md` and `IMPLEMENTATION_PLAN.md`. This includes all PR25 Model Picker runtime work. |
| Build | `npm ci` then `npm run build` at `677bc51` (Vite, 174 output files) |
| Hosted origin | `https://lumen-chat.web.app/`, fetched through the session's HTTPS proxy with normal CA verification (no TLS bypass) |
| Data | Synthetic guest profiles (`preview-*` uids in local storage). Firestore requests are aborted and provider/auth endpoints are mocked by the suites. No real account, key, provider inference or production data was used. |
| Spending | $0 |

## 1. Asset parity

Every file in `dist/` was fetched from the same path on the live site and compared by SHA-256.

**Result: 174 of 174 files are byte-identical**, including `index.html`, every hashed JS/CSS chunk, fonts, icons, the manifest and the service worker. This is wider than the 18 entry assets checked in earlier releases.

## 2. Hosted browser suites

The existing isolated suites in `tests/e2e/` were copied to a scratch folder with `http://localhost:5190/` replaced by `https://lumen-chat.web.app/`. Nothing else in them changed. A small preload passed the session proxy to `chromium.launch`/`webkit.launch` and counted responses by host. Every run below received its pages and scripts from `lumen-chat.web.app` and none from `localhost`.

Chromium ran on the host (Playwright 1.56.1). WebKit ran in `mcr.microsoft.com/playwright:v1.56.1-noble` with `MR_WEBKIT=1` and `SSL_CERT_FILE` pointing at the proxy CA bundle. Suites that only have a Chromium mode were not run in WebKit.

| Suite | Covers (acceptance checklist row) | Chromium | WebKit |
|---|---|---|---|
| `catalog-lifecycle` | Dynamic catalog refresh and removal | 2 PASS | 2 PASS |
| `model-declarations` | Custom model declarations, unchecked labels, no probe on save | 2 PASS | 2 PASS |
| `removed-models` | Removed models cannot stay eligible | 1 PASS | Chromium-only |
| `model-health` | Catalog health and availability | 6 PASS | Chromium-only |
| `auto-intelligence` | Auto priorities (quality/speed/cost) and capabilities | 18 PASS | 18 PASS |
| `auto-explain` | Auto choice explanation | 2 PASS | Chromium-only |
| `layout` | Layout create/edit/delete and reload | 6 PASS | 6 PASS |
| `layout-builder` | Ordered assignments and requirements, phone fit | 8 PASS | 8 PASS |
| `layout-policies` | Fixed order, layout-only fallback, Auto exclusions | 10 PASS | 10 PASS |
| `model-picker-accessibility` | Picker search, keyboard, focus, labels, axe (390/1280, light/dark) | 4 PASS | 4 PASS |
| `smooth-chat` | Streaming chat, Stop, next message | 3 PASS | Chromium-only |
| `comparison-recovery` | Compare, Stop one slot, retry slot, synthesis of selected answers | 8 PASS | 8 PASS |
| `context-recovery` | Recovery under exhausted backups and context limits | 10 PASS | 10 PASS |
| `canvas` | Canvas editing and failure preservation | 4 PASS (see note) | Chromium-only |
| `deep-research` | Research within its original pool and budgets | 4 PASS | 4 PASS |
| `study` | Study helper with fixed layouts | 4 PASS | 4 PASS |
| `writing-tools` | Writing helper with fixed layouts | 2 PASS | 2 PASS |
| `tool-card-stability` | Held-press Study/Compare keep identity and release action | 2 PASS | 2 PASS |
| **Total** | | **18 suites, 96 checks** | **13 suites, 80 checks** |

**Note on Canvas:** the first Chromium run timed out after 30 s waiting for the hosted page's `load` event, before any test step ran. An immediate rerun passed all four widths (1280/1024/390/320). This was a network or page-load delay through the proxy, not an app assertion. It is recorded rather than counted as a clean first pass.

## Not covered by this run

- Suites that need the Firebase Auth/Firestore emulators (`key-save-resilience`, `layout-save-resilience`, `auto` and other authenticated offline/reconnect tests). Those can't run on the hosted origin, and their exact-head CI evidence stands.
- Real provider inference and answer quality.
- Physical iPhone rendering, VoiceOver and real Google sign-in.

## How to reproduce

```sh
git checkout 677bc51 && npm ci && npm run build
cd dist && for f in $(find . -type f | sed 's|^\./||'); do
  [ "$(sha256sum "$f" | cut -d' ' -f1)" = "$(curl -sS "https://lumen-chat.web.app/$f" | sha256sum | cut -d' ' -f1)" ] || echo "DIFF $f"; done
```

For the browser suites, copy each suite and `tests/e2e/helpers/` to a scratch folder, replace `http://localhost:5190/` with `https://lumen-chat.web.app/`, and run with `NODE_PATH=<repo>/node_modules`. If the environment uses an HTTPS proxy, preload a file that adds `proxy: {server: process.env.HTTPS_PROXY}` to `chromium.launch`/`webkit.launch`.
