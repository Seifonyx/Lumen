# LUMEN BLACKOUT — PROVIDER UX QUALITY CLOSURE

Continue from draft PR #34, commit `a2cff7b38025981650c58da3f86fc5d67e602904`, after verifying the current branch and worktree.

This is a **focused correction pass**, not a redesign or a new feature phase.

Gate 1 remains unapproved. Do not merge or deploy experimental visual changes.

## Mission

Refine the implemented provider-intelligence experience in Index and Studio. Preserve the verified functionality while correcting the following source- and screenshot-review findings.

## Required changes

1. **Mobile overview:** Replace the crowded three-column routing statistics with a readable responsive arrangement. Give the most useful value visual priority. Never make important explanatory text depend on tiny font sizes.
2. **Mobile navigation:** Ensure Routing Center tabs are discoverable and usable without truncated labels or unclear horizontal navigation.
3. **Provider detail:** Improve the information hierarchy. Present connection and discovery state concisely, retain truthful quota provenance, and make model inventory/actions easier to reach. Avoid burying actions under repetitive explanations.
4. **Desktop navigation:** Remove or relocate the redundant "Back to providers" action when the provider list remains visible. Keep Back as an obvious phone control.
5. **Provider filters:** Correct the distinction between saved connections and explicitly enabled providers. Use labels consistent with the underlying state. Changing search or filters must not leave a misleading active detail selection for an invisible provider.
6. **Default provider:** Avoid selecting an arbitrary provider merely because it sorts first alphabetically. Prefer a relevant existing route/provider when grounded in application state, otherwise present an intentional selection state.
7. **Performance:** Inspect `ProofModelAction` and its unscoped Zustand subscription. Prevent avoidable full-store subscriptions across large model inventories. Validate with a representative large synthetic catalog without introducing unnecessary complexity.
8. **Localization:** Remove hardcoded Cairo timezone formatting from provider discovery timestamps. Respect the browser locale/timezone.
9. **Visual evidence:** Capture clean desktop and phone screenshots for Index and Studio, including the corrected overview, provider list and provider detail. Preserve accessible keyboard-focus styling, but separate keyboard-focus evidence from ordinary presentation captures.

## Constraints

- Reuse existing canonical provider, registry, usage, permission and model-selection owners.
- No fake quota, provider health, inference, or billing information.
- Preserve draft/model selection, masked credentials, account separation, and existing Routing Center functionality.
- No new dependencies or backend infrastructure.
- No new logo, brand redesign, or production CSS integration.
- Keep the change focused and reviewable. Do not regenerate hundreds of historical screenshots.

## Verification

Run focused browser checks for the corrected flows at 1440×960, 390×844, and an additional narrow phone width where practical.

Test filter/selection consistency, long provider and model lists, unknown limits, keyboard focus, draft preservation, and navigation.

Run relevant type/build checks and report any failures honestly. Do not claim physical iPhone or live-provider verification.

## Deliverable

Update the portable offline visual review with curated new screenshots.

Provide a concise completion report, exact commit, tests, remaining defects and review link.

Maintain the Blackout progress baseline unless its existing acceptance criteria genuinely justify a change.

**Stop after this quality-closure slice. Do not expand into identity or unrelated implementation work automatically.**
