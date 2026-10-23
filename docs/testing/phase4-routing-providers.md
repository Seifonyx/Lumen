# Phase 4, Slice 1 — Routing Center & Providers

Status: implementation under final verification on `feat/phase4-routing-providers`; based on production main `871bc1a647f36550e6f66e527b1252ac84437506`. Owner permits draft review, not merge/deployment.

## What changed

- The overview leads with the selected Auto/manual/Layout mode and recorded answer evidence, followed by provider discovery readiness. Counts are a secondary ledger. Unknown allowances stay unknown.
- Provider browsing separates saved connections from exploration and offers Needs attention. Selection and filters remain consistent. Detail separates key/permission, discovery and reply verification; safe typed recovery never renders raw provider error strings.
- Desktop keeps list/detail side by side; phone Back restores list focus. Phone headers are shorter, section names wrap at larger text sizes, search uses touch-sized controls, and the catalog retains existing pagination.
- Routing Center styles load with its existing lazy module, protecting initial startup budgets. Ordinary presentation and canonical selection, routing, permissions, credentials and network behavior are unchanged.

## Owners and changed files

`RoutingCenter.tsx` and `RoutingExtras.tsx` remain presentation adapters over `useStore`, `providerEnabled`, the canonical catalog/usage, `setChatModel`, Settings → Keys, `UsageTab`, `LayoutEditor` and `RouteWhy`. New `provider-presentation.ts` only converts typed discovery/setup facts into safe copy. `canvas-presentation.on.ts` relinquishes the eager RC stylesheet import to the lazy component; `canvas-routing.css` stays scoped. Regression coverage is in `provider-presentation.test.ts`, `routing-providers.cjs`, the existing CP04 QA contract and stylesheet ownership test. The new browser suite is included in `canvas-core.txt`.

## Verification ledger

Local checks run only on loopback with synthetic accounts and intercepted transport. No paid inference, production data, hosted QA, public ports, credentials or new dependencies.

- `npm test`: typecheck and all 90 unit-test files pass. The new helper covers saved/enabled/not-checked/ready/cached states and all six typed discovery failures. Independent review found and verified fixes for cached-state copy and the visible/accessibility label mismatch.
- `routing-providers.cjs`: Chromium 8/8 and Linux WebKit 8/8 pass. Four viewport sizes × Light/Dark; filter/selection consistency, permission off, auth failure clearing models, provider failure keeping cached models, 145-model pagination/search, unknown limits, only catalog GETs, preserved draft, keyboard focus, zero axe violations and overflow. At 320 px it additionally checks synthetic 150% text scaling. Matched baseline captures: 4/4.
- `private-qa-isolation.mjs` with `QA01_BASELINE_DIST`: 8/8 audit groups pass, including byte-identical ordinary output, Canvas/ordinary graphs excluding QA, synthetic-only QA graph and planted negative controls. `canvas-build-isolation.mjs` passes (2,570 ordinary graph modules, 174 artifact hashes, 11 negative controls).
- Both ordinary and Canvas builds pass. Budget unchanged: startup JS growth 9.1/9.5 KB gz; blocking CSS growth 13.1/16 KB; lazy Routing Center 8.1/9 KB; Canvas CSS source 15.9/16 KB. RC assets remain an existing lazy import rendered after App mounts; this change removes their CSS from the initial blocking stylesheet, not an on-open-only loading guarantee.
- Existing committed QA Routing Center contracts and exact-head CI are checked after the clean source checkpoint; results will be added before delivery. Existing build warnings about static/dynamic sync imports remain; no new dependency or budget increase.

## Review and limits

Curated portable before/after review will be linked here. The before build is the released source above; captures are actual rendered UI, not mockups. Ordinary screenshots exclude keyboard focus; focus is exercised separately.

Physical iPhone keyboard/VoiceOver, actual Dynamic Type, safe-area device behavior and live-provider connectivity remain unverified. Automated larger text is synthetic; Linux WebKit is not physical Safari. Early device review still uses the separately authorized private QA process; this slice creates no hosting or access infrastructure.

Remaining Phase 4 work: Slice 2 (deep models/picker) and Slice 3 (Auto/policy/usage/diagnostics). Current overview preserves those existing sections without reopening their algorithms. No approval, merge or deployment is implied.

## Owner review steps

1. Open Models & routing: confirm the selected route is clear; browse Providers, Models and the other sections.
2. In Providers, compare Saved connections, Enabled providers and Needs attention; search a provider away and clear the search. Detail must not silently stay on an invisible provider.
3. Open a provider: check key/permission and catalog state separately; unknown allowance must stay unknown. Check connection refreshes model catalogs, not an AI reply.
4. Type a draft first, navigate through provider details and Back to chat; the draft must remain. On phone, use Back to providers; on desktop the list stays visible.
