# Lumen Blackout — recovered source and architecture audit

Current checkpoint: **20 October 2026, Africa/Cairo**. Supersedes the 19 October missing-master/six-preview checkpoint. Source baseline main: `c4b55781f1046e8abd75966ecb6c565327a1d62a`. Draft continuation PR: [#34](https://github.com/Seifonyx/Lumen/pull/34).

## Authority recovery

The full Blackout master is now recovered and preserved **verbatim**, SHA-256 `f0bf08d5f4d7622e9366db4924f1601a6f4abc5f69a19a9c31d154cd45766fae`, in [MASTER_REQUIREMENTS.md](MASTER_REQUIREMENTS.md). Latest user Continuum is preserved verbatim, SHA-256 `01aaf9a710b8ddcd474170aad8575359338a73ab5a7655a8d70a3a72c3aec66e`, in [PROJECT_CONTINUUM_2026-10-20.md](PROJECT_CONTINUUM_2026-10-20.md). The existing [v1.1 amendment](BLACKOUT_V1_1_AMENDMENT.md) sets eight phases and explicit identity/core/final gates; all master requirements remain active. This recovery resolves PR34's original missing-master blocker. It does **not** provide aesthetic approval.

Root Model Picker `MASTER_REQUIREMENTS.md` remains unchanged (Git blob `45abb59dc9cf8c3d06d8ce16370a732b2170f248`). Its independent 98.5% ledger remains active. PR28/30 rejected generic/refinement experiments and cancelled Renaissance/Adaptive Native documents are historical evidence, not approved new identities.

## Reference evidence and prior ZIP provenance

The 19 October audit inspected the central directory of `9Router_UI_Reference_Pack(1).zip`, SHA-256 `f9839c759f0fb7ab5fe38e48e47f0ec2f58f8ef5eccd7f6b76bbd1a2b9ede24f`: five files (`README.txt`, `sources.json`, Python downloader, Windows/macOS launchers), **zero image pixels**. Its 36 distinct URLs are preserved in [REFERENCE_MANIFEST.md](REFERENCE_MANIFEST.md). The ZIP was not found/reopened in this continuation; prior inventory evidence is retained, not claimed as a new inspection. No downloader was executed.

Fresh retrieval/visual inspection: 14 manifest images plus two pinned official images; all 22 gallery CDN links returned 503, gallery HTML timed out. One hero image is duplicated. See [REFERENCE_REVIEW.md](REFERENCE_REVIEW.md) and machine-readable hashes/failures. Full external pixels remain outside Git; public screenshot permission is not assumed. Source-backed 38-feature comparison uses current pinned repository code, not only screenshots.

## Actual architecture and preservation contract

| Area | Current Lumen evidence / implications |
|---|---|
| Runtime | React 19/TypeScript/Vite static browser application; Firebase Auth/Firestore/Hosting. It is not an externally served gateway. |
| Providers | Browser adapters and explicitly configured relay paths; 32 configured AI providers; account/key-scoped discovery/registry; paid-provider opt-in remains authoritative. |
| Selection/recovery | Auto, manual models, custom Layouts, context eligibility, shared routing policy and bounded execution recovery already exist. Preserve fixed/manual assignments, task/capability constraints and explicit fallbacks. |
| Workspace | Chat/History/Projects/Library/Tools/Study/Compare/Canvas/GitHub workflow access must survive any redesign. Settings/keys and composer remain usable, not hidden for visual minimalism. |
| Privacy/state | Account-owned Firebase rules, local databases/session guards, incognito and Privacy Shield; no new prompt logging, credential export, secret-bearing screenshots, unknown proxy or cross-account metadata. |
| CI/deployment | Existing Tests workflow includes type/build/unit/progress plus Chromium emulator and WebKit jobs. Markdown/docs paths are ignored by automatic Tests triggers. Production deployment is an explicit workflow, not inferred from a PR push. |
| Visual owners | `DESIGN.md`, `UX-CONTRACT.md`, shared tokens/components remain production authority. Isolated `docs/blackout/prototypes` CSS is not imported into the app. Approval is required before promotion to those owners. |

## Runtime and Git evidence

- Main observed: `c4b55781f1046e8abd75966ecb6c565327a1d62a` (later changes are documentation).
- Latest verified runtime deployment: `1966348725a9cc6a3bfec0a283448a451aa9d6cd`, [successful deploy run 39257887973](https://github.com/Seifonyx/Lumen/actions/runs/39257887973).
- Production: https://lumen-chat.web.app/ . Fresh 20 October comparison found **18 live assets matching the reviewed local build**. This is asset parity, not a new hosted workflow test or a new deployment.
- App source/config/package/workflow diff from reviewed `1ca29f0f207e261267fbd80c8b39b31e1e0ad8e0` is zero; the new Blackout checkpoint modifies docs/review artifacts only.
- Independent preview-auth/clock test WIP remains in `/workspace/Lumen-preview-test`, branch `test/preview-auth-clock`; do not discard or accidentally release it.

## Verified proof and remaining risks

Real-component studies use synthetic guest state and mocked catalog responses; inference is blocked and counted. Actual screenshots cover populated chat, searchable picker/overlay, API keys, welcome and populated Library, with dark desktop/phone, light desktop, true-black phone and 320px Linux WebKit. Search no-results/restoration, picker Escape and draft preservation are exercised. All final captured states have zero document overflow and zero page errors; exact automated accessibility results and limits live in [prototypes/README.md](prototypes/README.md).

These are **identity proofs**, not a full transformed product. Real keyboard/touch/refraction on physical iPhone, streaming/error/slow/Canvas/Compare states and full wider locale/zoom matrix remain future acceptance work. Static premium audit flagged existing form/textarea source patterns; runtime checks do not erase those findings. Resolve actual ownership/validation issues during B03/B07 rather than silently weakening the audit or shipping unrelated app changes now.

Next: review the three distinct real-app identities and record the user's explicit Gate 1 decision. Continue B03 then interaction/flagship B04 only after that decision. Do not retry old gallery URLs or rebuild already verified routing simply to produce activity.

## 20 October independent production correction

Usage controls default-submitted the chat composer. PR #35 released the five explicit button types and focused regression through all required CI, main `677bc51f39fbf8fcf66bc91f846b71a4912bb306`, successful deploy39447533639. Eighteen live assets matched; hosted Chromium/WebKit1440/390 draft isolation passed with synthetic accounts. See AI_HANDOFF.md for TLS evidence and exact release ledger. No experimental Blackout visuals reached production.
