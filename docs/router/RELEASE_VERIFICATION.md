# Approved Router — local release verification

Application source: `f62ef6743fcd73df31e96731278c344334e5f029`, continuing PR99 from31ac69e. The approved UI was retained. This is the local checkpoint before exact-head CI and release; actual merge/deployment evidence belongs in PR99 and the live context, not an inferred release claim here.

## Changes and failure analysis

- Total Canvas source cap29.5→34KB explicitly authorized by the owner after measured cleanup/alternatives. All13 audit inputs remain; startup JS15.5KB, startup CSS20KB and lazy Router9KB are unchanged. [Rationale](CSS_BUDGET.md).
- Desktop Router H1 now names the current destination; phone H1 remains Router. Corrected obsolete contract expectations while retaining the H1 focus assertion. No missing accessible heading was established.
- Models is an always-searchable browser/detail experience. Inspect is browse state; explicit Use changes canonical selection and returns to Chat. Removed assumptions about direct Use buttons in the old list and an anchored bottom search. Contracts now exercise keyboard Inspect, detail focus, unchanged canonical selection, nested Back/Escape, explicit Use, composer focus, draft/selection/attachment preservation, actual44px targets and responsive geometry.
- Layout cancellation checks snapshot and compare all index IDs, preserving saved layouts and built-in recommendations rather than assuming one old direct-child card.
- A genuine desktop Layout-editor contrast defect was fixed with a scoped Canvas secondary-text token:4.46:1 before,9.34:1 Light /11.76:1 Dark after. Existing axe checks were retained unchanged; no suppression or threshold reduction.

## Fresh verification

`npm run test:affected -- --run` completed successfully on the application source above:

- Typecheck and full unit suite; Canvas and ordinary builds.
- Budgets: startup JS15.1/15.5KB, startup CSS19.3/20KB, lazy Router8.3/9KB, total CSS source33.0/34KB.
- All61 selected Canvas in-app files and20 ordinary-build files. `streaming.cjs` passed its existing isolated retry after its load-sensitive first attempt; no test or retry policy changed.
- Selected Chromium browser, composer, screen and Router contracts; none skipped for a dirty tree.

Additional verification:

- Updated phone suites:32 cases across Chromium/WebKit ×320/390/430/1440 ×Light/Dark, covering both Auto/Layout and scoped glass-navigation suites.
- Routing evidence/legacy Layout/refresh/account suite:8 cases across both engines ×320/1440 ×Light/Dark. Includes recorded source, saved alternative models, retained hidden Layouts, unsaved editor preservation after catalog refresh, and account change clearing.
- Desktop Activity:1440 Light/Dark in both engines. Exercises recorded outcomes, title privacy, filters, detail, export, Back/Forward, quota sources and accessibility.
- Router QA contract: all11 checks at1440/390/320 in both engines. Screen QA contract:1440/390 Light/Dark in both engines. Synthetic gated build verified against exact commit; external requests blocked.
- WebKit composer contract: all four viewports pass (1440/390/320 and short390). Fresh QA01 isolation audit passes all8 checks after adding the exact reviewed Models stylesheet to its historical file list. CP01 ordinary-build isolation now also rejects that stylesheet via POSIX and Windows/query-shaped negative controls (28 total). No graph, network, publication or protected-file assertion removed. Historical baseline byte equality was explicitly skipped locally, matching CI's existing option; ordinary rollback builds and functional suites pass independently.
- Independent read-only review found no critical/important functional, security or assertion-weakening blocker. One minor caption wording issue in Counted by Lumen remains: the table includes token/sync counters as accurately labelled rows, while its introductory sentence says requests. This was not used to change the approved composition or release criteria.

## Actual browser screenshots

[22 fresh Chromium captures and results](review/release/results.json), all horizontally contained with zero page errors. All five destinations at1440/390 in Light/Dark, plus Models320/1024. Source is recorded in the results. Representative Light/Dark desktop and phone captures were visually inspected, along with the corrected editor and populated Activity states.

- [Desktop Models Dark](review/release/1440-dark-models.png), [phone Models Light](review/release/390-light-models.png)
- [Desktop Routing Light](review/release/1440-light-routing.png), [phone Layouts Light](review/release/390-light-layouts.png)
- [Editor Light](review/release/1440-light-layout-editor.png), [Editor Dark](review/release/1440-dark-layout-editor.png)
- [Desktop WebKit Logs Dark](review/release/webkit-1440-dark-logs.png), [Quotas Light](review/release/webkit-1440-light-quotas.png)

Captures are actual local application renders using synthetic fixtures, not design mockups. The fixture named PRIVATE CHAT TITLE is synthetic test data. No real accounts, secrets, provider inference or incremental spending. Ordinary rollback retained; no protected authentication, account, network, transport, schema, permission or infrastructure changes.

Physical-iPhone gaps: Safari native edge gestures, VoiceOver, keyboard/IME, Dynamic Type, safe-area/PWA behavior remain device checks. Engine emulation is not physical-device certification.
