# LUMEN BLACKOUT — PROVIDER INTELLIGENCE EXECUTION PACKET

## Mission

Continue from the latest verified Lumen Blackout checkpoint.

Implement one focused, high-quality improvement to the existing isolated Index and Studio architectural proofs: **a complete, coherent provider browsing and detail experience inside the Routing Center.**

This assignment is intentionally narrow to preserve coding-agent usage.

Do not restart the project, generate unrelated identity concepts, or undertake broad refactoring.

**Mandatory Gate 1 remains NOT APPROVED. No production visual integration or deployment is authorized.**

## Source of truth

Inspect the current Git state and relevant Project Continuum requirements.

Then use these existing files as primary references:

- `docs/blackout/INFORMATION_ARCHITECTURE.md`
- `docs/blackout/FEATURE_MATRIX.md`
- `docs/blackout/REFERENCE_REVIEW.md`
- `docs/blackout/workspace-proofs/main.tsx`
- `docs/blackout/workspace-proofs/workspace.css`
- `docs/blackout/workspace-proofs/README.md`

Inspect existing production owners only as needed: provider connections, model registry, catalog state, UsageTab, ModelPicker, LayoutEditor, and relevant tests.

Use the already completed 9Router research. Do not repeat extensive competitive research.

## Specific problems to address

The current proof hardcodes four provider rows even though Lumen supports more provider configurations.

Provider management still lacks a sufficiently developed provider-specific detail experience.

Provider readiness, saved-key presence, discovery status, quota, and model availability need clearer separation.

The Routing Center quota summary contains unconditional copy indicating that remaining allowance is unreported, even when a numeric allowance may be shown.

Resolve these weaknesses without inventing data.

## Implementation specification

1. Replace the hardcoded four-provider overview with a data-driven provider list using existing account-scoped configuration and catalog sources. Include properly labeled unavailable or unconfigured providers when appropriate.

2. Introduce a provider-detail experience containing provider identity, saved connection state, catalog/discovery state, relevant model inventory, actual known usage/limits, and existing connection-management actions.

3. Ensure model selections use Lumen's existing routing and selection logic. Never bypass permission, eligibility, account isolation, or fallback constraints.

4. Distinguish clearly between a saved key, successful model discovery, and successful inference. Do not show fabricated healthy/online status.

5. Show quota and usage only when supported by existing data. Label estimates and unknowns accurately. Remove contradictory summary copy.

6. Create a strong desktop composition using a scannable provider list and readable detail area. On iPhone, use a dedicated detail state or existing appropriate navigation pattern with touch-friendly controls.

7. Apply the same shared functional experience to both Index and Studio while respecting their different navigation architectures. Avoid duplicating application logic.

8. Preserve the real composer, Auto/manual/Layouts, existing provider settings, routing policies, usage behavior, drafts, and all current workspace features.

9. Keep the implementation within the isolated Blackout proof architecture. Do not migrate proof-only portals or experimental CSS into production.

10. Keep the visual design restrained, legible, and coherent with the existing proposals. This task does not authorize choosing the final Lumen logo, typography system, or visual identity.

## Validation

Test provider browsing, detail opening and closing, model selection, navigation back to Workspace, draft preservation, unknown-quota handling, no-key states, and account safety.

Capture real desktop (1440×960) and phone (390×844) screenshots of the improved Routing Center and at least one provider-detail state for both Index and Studio.

Use synthetic fixture data clearly labeled as such. No real provider inference or unnecessary external requests.

Run focused tests and relevant build/type checks. Add or update regression checks where necessary. Do not run expensive full suites repeatedly without a reason.

## Deliverable

Provide an easily openable visual review, avoiding missing dependencies and dead local-only links.

Curate screenshots rather than committing another massive capture collection. Retain the reproducible test and evidence paths.

At completion, report concisely:

- What actually changed.
- Tests passed and failed.
- Known limitations.
- The exact Git state.
- Whether any implementation assumptions differed from the brief.
- What requires my visual review next.

Update existing Blackout plan/handoff progress strictly according to verifiable acceptance criteria. Do not manufacture progress credit or alter task weights.

**Stop at a clean checkpoint when this slice is complete. Do not autonomously expand into unrelated Blackout phases.**

Maintain Gate 1 as unapproved and leave the redesign isolated in draft PR #34 or its properly managed continuation.

## Quality standard

This must feel like a credible, first-class part of a serious multi-model application, not a dashboard assembled from decorative cards.

Prioritize information clarity, usable controls, integration, and excellent desktop/iPhone composition.

9Router remains the functional and organizational benchmark. Lumen must retain its own identity and security architecture.