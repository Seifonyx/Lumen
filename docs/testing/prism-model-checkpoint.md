# Phase4 Slice2 CP3 — model discovery & selection

## Scope / release

CP2 reviewed03ef74a merged via PR54 as **b619862707062cca75bd30f9678b9d4313f612fa**, owner-authorized. [Deploy40191019110](https://github.com/Seifonyx/Lumen/actions/runs/40191019110) explicitly Canvas: live Hosting and existing dev-channel steps succeeded; independent system-CA HTTPS comparison matched **187/187 hosted files**. Anonymous390px sign-in rendered with no runtime errors. Initial smoke locator expected “Sign in with Google”; actual existing label “Continue with Google” was used on the successful run. Browser proxy needed test-only ignoreHTTPSErrors; independent file fetch used normal TLS validation. No real account/inference. Rollback: prior Canvas db94c23 through the existing workflow.

CP3 is **draft only** on successor `feat/phase4-prism-models`, because merged PR54 cannot remain a draft. Owner delegated this sequencing decision after explicitly requesting merge/deploy. **No CP3 merge/deploy, new Gate, spending or later phase.** No overall program percentage is defined.

## What changed

- Provider aliases, canonical IDs and all-word search work consistently in Prism and the chat picker. Search is available with two model choices. Picker catalog lookups use a Map; existing Auto/manual/Layout/retry selection callbacks remain.
- Compact model identity/provider/selected state; actual capability and selection filters use the existing FilterMenu.24 rows per inventory page, search across the entire catalog, truthful empty/reset states and keyboard-accessible pagination.
- Model details progressively expose canonical ID, capability metadata, unchecked/cached provenance and unknown allowance. No invented context, capabilities, health, cost or quota.
- Typed selection presentation characterizes the existing CP2 manual gates. Precomputed sets avoid repeated inventory scans; fresh click-time checks remain authoritative. Send-time eligibility/scoring and fallback are unchanged.
- Use model checks account and conversation, calls canonical setChatModel, returns to the existing chat, confirms the choice and focuses the same mounted composer without changing its text, selection, undo, attachments or IME implementation.
- Query/filter/page use existing ephemeral account-scoped screen memory, separately keyed by conversation/provider; section Back restores discovery state without adding persistence or browser payloads. A real-browser regression reproduced the lost query before this correction.
- Existing Settings owners provide recovery. Current manual IDs absent from discovery get an unknown-metadata row and current-route recovery, rather than disappearing from Selected. Usable choices lead the default inventory to protect320px first-choice visibility; blocked current choices remain inspectable in the existing route disclosure and Selected filter. This deliberately favors the owner's stronger first-viewport requirement over moving a blocked long row ahead of every usable choice.
- Wide rows use compact columns; phones retain readable stacked rows. Five sections, contextual Search, glass Back, original sidebar and provider management remain.

## Evidence

Runtime commits **b8ec3472b5bd12c7cbcece058c435f543663e4fa** **2c1ecd20a06080aadc34dc3143f89c3ea6219acb** and final runtime **f8034665f3ed9f06f32f1c15d0f0fb089ad96d2d**. Curated [12-capture offline review](../reviews/prism-models/review.html) and [SHA256 provenance](../reviews/prism-models/provenance.json). Before captures use releasedb619862; after captures matchf803466's runtime files, source tree and built index. They were captured from the working tree matching that source commit. Full responsive matrices are CI artifacts. Final delivery SHA and exact-head CI are recorded in the PR and canonical live checkpoint to avoid a self-referential documentation/CI commit loop.

## Actual local validation

- `npm test`: typecheck and **95 unit files passed**. New unit characterization covers alias/token search, unchanged manual gates, permissions, absent/denied IDs, auth, unsupported streaming, unknown capabilities and saved-current fallback.
- `prism-model-discovery.cjs`: **8/8 per engine** at320×568,390×844,430×932,1440×960 ×Light/Dark. Tests include alias/provider search, capability/selection filters, reset,302-model inventory bounded to24 rows, long multilingual names, existing-conversation return, exact draft, text attachment, same textarea, backwards cursor/selection/focus, toast, picker keyboard activation and Auto/manual/saved Layout parity.320px geometry checks the complete first usable row/action above anchored Search without scrolling. No inference requests; catalog GETs intercepted.
- `prism-model-states.cjs`: **8/8 per engine** at320/1440 Light/Dark for unknown/unchecked declarations, non-streaming restriction, Settings recovery/Back/Forward, actual sign-out/Back isolation and second synthetic owner, plus a missing current ID with32 usable alternatives and Selected recovery.
- Existing provider containment: **24/24 per engine** at320/390/430 Light/Dark, Anthropic/Cloudflare,100%/150% text; masked key/checkbox/link/Save/All providers/unsaved/history/draft checks retained.
- Existing picker accessibility: **4/4 per engine**,390/1280 Light/Dark: axe, real interrupted-refresh fixture, field labels, validation, focus scope and keyboard operations.
- QA01 production/Canvas/private-build isolation: **8/8 audits passed**, graph/output/fixture/transport boundaries and planted negative controls. Ordinary graph audit: **174 artifacts,14 negative controls**; no QA/Prism ledger/Canvas UI leakage. Shared picker search changes ordinary hashes, so **no byte-equality-with-CP2 claim**.
- Ordinary and Canvas builds passed. Budgets **not raised**: startup JS growth12.2KB gz/12.25, CSS15.3/16, Routing Center lazy chunk7.9/9, Canvas CSS source18.5/18.5. New lazy PrismModels≈2.5KB gz is separately visible in the build report; no performance/latency benchmark claims.
- Committed private gated Routing Center: **3/3 viewports per engine,10 checks each**. Composer: **4/4 viewports per engine** including390×480 simulated keyboard height, undo, composition-safe Escape, same input/selection, attachments, synthetic Send/Stop and independent reviewers. Chromium15–17 and WebKit15–16 checks per viewport passed. Final exact-head CI is recorded in PR/live; inspect the linked run rather than infer success.

## Failures investigated / honest limits

Initial real-browser alias search returned zero models; missing-current recovery was also reproduced absent before the fix. Unit gate characterization failed red against a stub, then passed. First budget attempt counted stale files from an external build directory; clean `--emptyOutDir` removed this artifact. Actual startup overhead was reduced by separating pure search from lazy selection logic, and obsolete responsive row styles were replaced rather than accumulating overrides; limits stayed unchanged.

A states-test reload after history traversal hit the independently reproduced Linux WebKit1.56.1 page crash (`tests/e2e/helpers/webkit-history-reload.cjs`). It is not reported as a successful reload or physical Safari check. The account regression instead exercises actual Sign out, asserts Back cannot restore Prism, and opens another owner in a fresh tab. Initial test also incorrectly assumed direct model Settings had a General ancestor; it now follows the actual shared hierarchy. A Docker gated invocation initially lacked Git's safe-directory context; the rerun pins the actual expected source commit while still verifying every build-manifest file. No product assertion or security control was weakened.

Physical iPhone Safari/PWA, VoiceOver, OS Dynamic Type, dictation/physical IME and genuine provider connectivity remain **unverified**. Existing synthetic composer contracts cover undo, composition-safe Escape, selection, simulated keyboard and Send/Stop. Catalog capability facts/declared assumptions do not prove real inference. The ordinary presentation is build/isolation-tested and covered in CI; its intended selection behavior is preserved, its emitted bytes changed with shared search.

## Owner test steps

1. On320px/short phone, open Prism → Models: the first usable row and Use model action fit above Search. Search “Google AI Studio pro”; try Selectable, Reads images and Selected, then reset.
2. Write a multiline unsent draft, select a range and attach a text file in an existing conversation. Open Prism, Use another enabled model: return to that same chat, draft/file/range retained and model confirmation visible.
3. Open the chat picker: search provider plus model, use arrow keys/Enter or touch; switch Auto and a saved Layout. The draft remains.
4. Review unknown/missing/non-streaming synthetic states: inspect Model details, the current route disclosure and Settings recovery. Back/Forward returns correctly.
5. Recheck targeted Anthropic API Keys at320px with larger text: help/checkbox wrap; masked input, Save keys and All providers remain reachable. Do not enter real credentials in QA.

STOP for owner/planner final Slice2 review. Recommended next action: review the actual phone/desktop captures and physical-iPhone selection/keyboard behavior; do not release CP3 from passing CI alone.
