# Router CSS consolidation checkpoint — 2026-11-03

Continued PR99 from `5cc77e6b5eb5c333b081be3e4f4f40901e067434`, with no newer implementation commits at takeover. Approved composition, all five destinations and ordinary rollback retained. No audit inputs, budget limits or execution semantics changed.

## Applied cleanup

Removed 48 earlier declarations whose same-selector properties are superseded later under the same or a broader condition, plus empty media blocks. This covers Router header/page rules, Activity phone overrides, phone navigation positioning, old glass/composer and reading overrides, and two small Library/Tools overrides. Retained sticky positioning, stacking, safe areas, touch targets, forced-colors and all live Provider-detail styles.

Audited `router-models.css`: its browser/detail, phone transitions and accessibility rules still support live elements. The older `.rc-model`, `.rc-use` and `.rc-model-details` rules remain in use in Provider details; removing them because Models gained a new browser would break another destination. No substantial unused Router region was established by component inspection and an independent read-only review.

## Measurements

All values use the existing audit's complete 13-file input, comment stripping, whitespace collapse and gzip. Experimental variants were measured privately and **not applied**.

| Variant | Audited KB gz | Decision |
|---|---:|---|
| Takeover source | 33.303 | Fails 29.5 cap |
| Applied overridden-declaration cleanup | 33.003 | Safe incremental saving; still fails by 3.503 |
| Full baseline minification, Lightning CSS, Safari 16 / Chrome 111 targets | 31.174 | Still fails; compact generated source alone does not solve the budget |
| Experimental common-scope nesting, then compiler minification | 30.150 | Still fails; also needs compatibility/source-contract validation before adoption |

The nesting experiment grouped consecutive rules under their existing single Canvas scope while retaining rule order and selector specificity. Its result is a sizing experiment, not verified production CSS or an assertion that all possible consolidation has been exhausted. A further shared-style refactor would need to recover at least 3.503 KB beyond the safe cleanup (about 10.6% of the remaining source audit). Removing live detail, responsive or accessibility rules to close that gap would compromise the approved experience. No such removal or budget adjustment is proposed in this commit.

## Verification and release status

`npm run test:affected -- --run`: typecheck, full unit suite, Canvas build and ordinary build pass. Startup JS growth 15.1/15.5 KB, startup CSS growth 19.3/20 KB, lazy Routing Center 8.3/9 KB pass. Complete CSS source **33.0/29.5 KB fails**. The runner stops there; this run does not execute affected browser/contracts. No test weakened.

Fresh actual Chromium captures compare takeover versus cleanup: all five destinations at 1440 and 390 px in Light/Dark, plus Models at 320 and 1024 px. All **22/22 pixel comparisons are identical**, all contained, zero page errors. Inspected representative desktop Routing Light and Activity Dark, desktop Models Light, phone Providers Light, Models Dark and Layouts Light. This verifies visual preservation of these states; it does not complete the outstanding recorded-source Routing / Activity interaction replays, WebKit contracts, account isolation suite or accessibility certification.

[Pixel parity and exact CSS hashes](review/css-cleanup/parity.json). Representative fresh after captures:

- [Desktop Routing Light](review/css-cleanup/1440-light-routing.png)
- [Desktop Activity Dark](review/css-cleanup/1440-dark-activity.png)
- [Phone Models Dark](review/css-cleanup/390-dark-models.png)
- [Phone Providers Light](review/css-cleanup/390-light-providers.png)

Reproduction: build the takeover and cleanup Canvas sources separately, serve each on loopback, run `tests/e2e/helpers/router-review.cjs` with `MR_TEST_URL`, `ROUTER_SOURCE` and `ROUTER_OUT`, then compare decoded screenshot pixels. Synthetic profiles only; external requests are blocked except the synthetic catalog fixture. No accounts, inference or incremental spending.

PR99 remains draft and blocked. No green exact-head release certification, merge or deployment. Physical Safari edge gestures, keyboard/IME, Dynamic Type and VoiceOver remain unverified. Continue from this branch; do not restart the approved UI.
