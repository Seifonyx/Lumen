# Prism — model discovery checkpoint (CP3)

## Authority and release boundary

Owner approved CP2 release and delegated the conflicting PR sequence. PR54 at03ef74a merged normally asb619862; Deploy40191019110 explicitly Canvas succeeded. Independent HTTPS comparison matched187/187 hosted files. CP3 uses successor `feat/phase4-prism-models`, based on this main, because a merged PR cannot remain a draft. CP3 implementation/review only: no merge/deploy, Gate, spending, live inference, auth/network/schema or eligibility/scoring changes.

## Chosen design and alternatives

Keep the established five-section Prism and anchored phone Search. A compact model ledger adds provider attribution, current selection, one existing FilterMenu for real capability/state criteria, bounded24-row pages and useful recovery actions. Search matches all words across canonical ID, model name and actual provider aliases. Current/selectable models lead in catalog order, without quality rankings. Unknown metadata remains unknown. Model IDs and less common details stay in progressive disclosure.

A new multi-filter dashboard would repeat the removed Overview and crowd320px. A virtualized infinite list adds focus/scroll complexity where the existing provider pagination works. Reuse pagination and compact controls instead. No new dependencies.

## Implementation sequence / acceptance

1. Regression-first shared search/presentation contracts: preserve the existing Use model gates, provider permission checks, canonical IDs; classify actionable blockers without claiming inference readiness. Unit tests cover aliases, unknown/disabled/unavailable, metadata and catalog scale.
2. Inventory/row composition: shared provider inventory row and bounded main inventory; selected marker, truthful capabilities and one filter. First complete usable row/action above contextual Search at320×568. Lazy model inventory keeps startup and Routing Center controlled.
3. Chat picker: reuse alias-aware search and truthful capability wording; preserve its existing preference-selection/retry semantics, Auto and Layout behavior. No routing gate edits.
4. Use model: fresh account/conversation checks, canonical setChatModel, close Prism, existing success toast and focus same mounted composer; never rewrite value, cursor, attachments or IME state.
5. Browser matrix:320/390/430/1440 Light/Dark Chromium/WebKit; provider alias search, filters, selected row,300-model catalog, unavailable recovery, draft/attachment/selection/focus, Auto/manual/Layout, keyboard/axe and first-row geometry. Existing CP2 containment, private gated account/composer, build isolation and budgets retained. Final exact-head CI; curated provenance-bearing captures.

## Review focus / known limits

- Browsing capability flags are catalog facts/declared assumptions, never a successful inference test.
- Model restrictions/unknown context must remain visible; recovery must use existing Settings owners.
- Large-catalog paging must reset on filtering without losing focus or hiding current selection.
- Account changes must close Prism and prevent stale actions/focus crossing owners.
- Physical Safari, PWA, IME/dictation and VoiceOver need owner/device verification; simulated tests do not prove them.

Stop for final Slice2 owner/planner review. No unrelated Slice3/Phase5 work.
