# Phase4 phone sections and glass — review evidence

Owner's corrected scope: **sidebar unchanged; Library and Routing get feature-local top strips + bottom contextual Search; shared glass Back/ellipsis preserved.** No merge/deploy/Gate/next-phase permission.

## Revisions and review

- Parent reviewed source: `ad78d2f112c3f60d1469045e757e21dccf904a87` (23/23 prior CI, not proof for this increment).
- Implemented source: `764d2db49da31779f110b2550710a7e584f64789`, following `dba8f5cd5c93b58a9a55b1f09b7a64e64e83ce77`.
- [Portable self-contained visual review](../reviews/phone-sections/review.html):17 embedded actual-app captures, no external resources. Six direct Light/Dark phone PNGs sit beside it. Before images use ad78; after images use764d2db source. The final evidence commit changes documentation/images only.
- Draft PR52 remains unmerged. Final exact-head CI is reported on the PR and canonical `docs/lumen-live-context` checkpoint. `EXACT_HEAD.txt` in downloadable CI artifacts stamps GitHub's tested merge revision; it is not a deployment.

## Actual checks

| Check | Result/evidence |
|---|---|
| `npm test` | Typecheck and92 unit files pass. No test skipped or assertion weakened. |
| Ordinary +Canvas `npm run build` | Both pass.174 ordinary output files; shared component interface preparation changes generated hashes, so byte equality toad78 is **not claimed**. |
| `iphone-glass-navigation.cjs` |8/8 Chromium +8/8 Linux WebKit:320×568,390×844,430×932,1440×960, Light/Dark. Original sidebar, tab/section scrolling, active state, library search/item/menu/return, provider→Settings→Back, model filtering, query/draft preservation, overflow, axe, simulated keyboard heights/insets, larger text, Reduce Motion and Chromium-emulated Reduce Transparency. |
| Breakpoint regression |390→1000→390 Library transition preserves query and usable controls; failed before reactive media subscription, now passes in both engines. |
| Existing navigation journey |4/4 Chromium widths; canonical history/drafts, documents, Photos, assistant editing. |
| Existing provider flow |8/8 Chromium cases:145-model synthetic inventory, paging/filtering, cached discovery failure, provider scopes, keyboard/axe, discovery-only GETs (no inference). |
| Gated Routing contract |Chromium390/320/1440:10 checks each, pass; real Layout editor, usage, diagnostics and navigation preserved. |
| Gated Canvas screens |Chromium390/1440 Light/Dark:9 checks each, pass. |
| QA01 isolation |8/8 including planted module/output/network controls; clean synthetic build at764d2db:166 files, audited graph. No publishing, production identity/data or live provider traffic. |
| CP01 ordinary graph |2571 modules;174 artifact hashes;12 negative controls pass. No claim of baseline byte equality. |
| Independent review |No Critical/security/auth/provider-selection finding; breakpoint and stale-test issues corrected. Rendered WebKit review exposed duplicate native search clear; authored input chrome/cancel suppression and one real clear action now verified. |
| Strict premium audit |25 inherited findings, same identities asad78; zero introduced. Existing form/textarea issues are not declared fixed. |
| Performance budget |Growth12.0KB JS gz /12.25 limit,15.4KB CSS /16; lazy RC8.9KB /9; Canvas source CSS18.5KB /18.5. Parent11.9/14.3/8.7/17.3. Explicit small breakpoint/material cost; no fabricated speed gain. |

Normal presentation captures blur incidental keyboard focus; a separate keyboard-focus capture is retained in CI. New browser suites run once per engine in the existing shell-browser jobs and preserve screenshots on successful runs as well as failures. Required broader CI is distinct from these local results.

## Corrected issues and boundaries

The rejected drawer changes never reached GitHub. `git diff ad78d2f -- src/components/SidebarCanvas.tsx` is empty. The phone strip cannot move a button during a tap's focus phase; keyboard focus still reveals its target. Library uses proper manual-activation tabs linked to one panel. Routing uses destination buttons and canonical history, with Layouts retaining the policies ID/editor. Provider details hide section shortcuts and show their own Back/title/actions. Portals relocate existing search inputs; there is no fabricated global search. Overview/Layouts/Usage/Diagnostics have no unsupported search field.

Search stays within the screen's visible-height layout, with safe-area padding. Knowledge Library's existing passage search remains distinct from the bottom file-name filter. Desktop retains its type selector and Routing split view. No authentication, provider-network, routing algorithm, persistent schema or account boundary was changed.

## Owner test actions

1. Open the sidebar: confirm upper Search, original tree and footer; search an archived chat and clear the query.
2. Open Library; swipe categories to Generated images/Searchable and back to Documents. Search a document, open its menu/editor and return; check query, category and draft survive.
3. Open Routing→Providers; search Google, open it, tap•••→Connection settings, then Back twice. Check it returns through provider detail to the filtered provider list.
4. Switch Models/Layout/Usage/Diagnostics. Model and provider search should have clear scopes; unrelated sections should not show a fake search.
5. On a real iPhone, open Search with the keyboard, rotate the device, swipe the strip and use Back; test larger text, Reduce Motion/Transparency and VoiceOver.

## Genuine gaps

Physical iPhone Safari keyboard/dictation, installed PWA, VoiceOver, hardware edge gestures and OS accessibility preferences remain unverified. Linux engines and visualViewport simulation do not prove them. An inherited Linux WebKit history-branch/reload engine crash is separately documented by the existing static-page reproduction; do not claim that combined refresh scenario passed. Owner visual acceptance remains pending. Phases1–3 are shipped; later Phase4 slices andPhase5 remain; no overall percentage is defined.
