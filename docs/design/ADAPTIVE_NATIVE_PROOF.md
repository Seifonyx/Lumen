# Adaptive Native — Real app proof #1 (unapproved visual experiment)

**Status:** experimental, awaiting automated render and user aesthetic approval. **Branch:** `design/adaptive-native-real-component-proof`; base `main c8755a6c0cb7fce853683808bb80deac6fc066f4`. **Scope:** actual app component CSS, not a replacement HTML mockup. **No merge or production deploy** before before/after review.

## Why this proof is different from rejected V1

- Applies to the **actual running Lumen React UI**: existing `ChatView`, `Composer`, `Sidebar`, `AttachSheet` and `ModelPicker`. Does not substitute fake controls or invent missing app features.
- Gated by **`?native-proof=1`** on `html`; the branch's default app remains visually unchanged. To inspect iOS glass support in a WebKit fixture: use `?glass&native-proof=1`; compare the same build using `?glass`. On desktop use `?native-proof=1` vs no flag.
- Experiment CSS lives in temporary `src/adaptive-native-proof.css`, imported after existing styles only on this review branch. **Not** an accepted new CSS architecture. If approved, integrate the best rules into canonical `src/app.css` and `src/glass.css`, remove the flag and experiment file in a separate validated PR.
- Does not change provider keys, models, Auto, routing, pricing, network calls, state, authentication, database, saved data, chat text, gesture handlers or existing controls.

## Detailed changes actually proposed

| Surface | Source-level intervention | Visual goal | Verification |
|---|---|---|---|
| iOS Add sheet | Preserve original float/rim and blur but make sheet **text-bearing layer** opaque enough for content; discreetly darken scrim; group backgrounds use stronger solid tone | Background greeting and art no longer interfere with labels when overlay sits above them | Original screenshot `layout-webkit-390-dark-plus.png` vs identical state `webkit-adaptive-390-dark-after-add.png`; inspect light/dark/black |
| iOS model picker | Apply same legible material and status list treatment without changing any selection semantics | Trustworthy foreground text over underlying UI | `webkit-adaptive-390-dark-before/after-picker.png` (filenames as captured by test) |
| 320px model layouts | Convert two-column forced grid into one column only `max-width:359px` and make item labels wrap | Full name and availability label visible with normal scroll, all existing layouts remain reachable | `webkit-adaptive-320-light-before/after-picker.png`, check actual scroll/accessibility/option count |
| Desktop sidebar | Restrained active row's functional lime signal, subtle hover/background, quiet search focus | More intentional precision without discarding existing hierarchy | `webkit-adaptive-1280-light-before/after-welcome.png`, real active-chat state still needs later capture |
| Desktop composer | Consistent existing `--layer-shadow` on keyboard focus | Polished focal element without glassifying entire desktop | `webkit-adaptive-1280-light-before/after-desktop-focused.png` |

## Capture/test implementation and limits

- `tests/e2e/helpers/adaptive-proof-shots.cjs`: Playwright **WebKit** captures real app at iPhone 320 light, 390 dark, 430 black and desktop 1280 light/dark, both **before and after in the SAME source build** with identical fixture and appearance; welcome, actual model picker, actual Add sheet and desktop composer focus. Asserts no page overflow, model layouts remain available and capture of horizontally clipped 320 options; writes a JSON diagnostic manifest.
- `.github/workflows/tests.yml`: an extra experimental screenshot step runs **only on PR head branch** `design/adaptive-native-real-component-proof`, after an existing successful WebKit build. Existing `webkit-evidence` upload collects the screenshots and diagnostic file. Normal tests and other PRs are unaffected.
- This PR must first pass typecheck/build/unit, existing Chromium/WebKit tests and capture step; **none has been independently executed in the local tool container as of authoring this doc** (private repository not locally mountable and git public host DNS failed). Use CI evidence, investigate and fix failure, then review screenshots. Screenshot may reveal unexpected material/touch effects; do not assume this design is aesthetically better until it is viewed.
- This is only the **first narrow proof**, not full AN02/AN03 approval. Proof still needs real populated conversation, feature hub, settings, RTL, reduced transparency, physical iPhone/Android, adaptive tablet and desktop split-panel views; no 100% claim.
- Use **no third-party dependencies**, no new network requests, user credentials, app-owned data or paid inference for screenshots.

## Exact next actions

1. Trigger PR CI through normal opening of this isolated branch, then fetch `webkit-evidence` from successful run; inspect before/after screenshots and JSON diagnostics.
2. If screenshots show new problems or tests fail, **correct the experiment**; do not merge. Compare actual sheets at 320/390 and both desktop variations side by side, including computed style metrics.
3. Create a concise visual review board containing the *actual app* before/after, clearly labeled. Ask the user whether the real design change is an improvement, not just whether it looks different.
4. Only after approval implement best proven treatments into canonical original styles, remove experiment CSS/flag/test-job, add focused regression assertions and rerun full PR CI. Preview deployment can then be considered for a verified implementation PR, before production.
