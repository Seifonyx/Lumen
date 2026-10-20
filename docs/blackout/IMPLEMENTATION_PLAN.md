# Lumen Blackout — implementation plan

Checkpoint: **20 October 2026, Africa/Cairo**. Baseline **v1** freezes the existing eight parent weights after recovery of the full master. This is a separate approved initiative; Model Picker remains **98.5%**, and cancelled Adaptive Native's historical 7.5% is not transferable credit.

## Authority and permanent release policy

Read [MASTER_REQUIREMENTS.md](MASTER_REQUIREMENTS.md) in full, followed by [BLACKOUT_V1_1_AMENDMENT.md](BLACKOUT_V1_1_AMENDMENT.md) and [PROJECT_CONTINUUM_2026-10-20.md](PROJECT_CONTINUUM_2026-10-20.md). Original root Model Picker requirements remain intact. The latest [design correction](DESIGN_COURSE_CORRECTION_2026-10-20.md) and [Routing Center correction](ROUTING_CENTER_COURSE_CORRECTION_2026-10-20.md) supersede acceptance assumptions about the rejected first studies. Both AI Workspace and Routing Center must be demonstrated in each alternative before another approval request. The later v1.1 amendment uses eight phases; the master's interaction-architecture/flagship requirements are retained in B04, with its visual approval before major integration.

**Progressive Verified Deployment Policy — permanent unless the user changes it.** Evaluate every coherent milestone for independent release. Review the exact diff, tests, type checks, builds, required CI, compatibility/migrations, security/privacy/regression risks and unfinished dependencies. Confirm deployment/rollback procedures. Merge only through the authorized protected workflow, verify the production-branch SHA and actual deployment, smoke-test live behavior, record merge/deployment/evidence/outstanding tasks, then continue. Separate safe subsets where practical; never accidentally release unfinished work, bypass protections, force-push or treat a pushed branch/local build as deployment. Keep local, committed, pushed, merged, deployed and production-verified states separate. Overall project completion is not a prerequisite for releasing an independently safe milestone.

**Blackout aesthetic exceptions are explicit user requirements:** Gate 1 identity approval before extensive implementation; Gate 2 core visual/interaction approval before major visual production integration; Gate 3 final aesthetic acceptance before declaring completion. PR #34 contains experiments and stays draft/unmerged. A docs-only release would not constitute a Blackout UI deployment. Latest main and verified production SHA are recorded separately in the handoff.

## Stable scoring baseline v1

Formula: **100 × Σ(weight × earned fraction) / Σ(weights)**. Total = **100**. Fraction 0 = no verified deliverable; .25/.5/.75 = one/two/three of four documented acceptance groups verified; 1 = every group passed. Implemented/unverified work earns no verification credit. User-approval tasks earn 0 until an explicit recorded decision. Parent fractions derive from children, never count both. Weights change only for a documented scope change/calculation defect with a new baseline version. Approved architectural decisions may resolve conditional requirements but must preserve their legitimate benefits and explain exclusions.

| ID | Scope / dependencies | Weight | Acceptance and verification | Earned fraction | Earned points |
|---|---|---:|---|---:|---:|
| B01.1 | Source/repository/runtime recovery | 3 | Authority files; actual Git/PR history; architecture/security contracts; exact production/asset evidence | 1 | 3 |
| B01.2 | Independent primary-source and screenshot research; B01.1 | 3 | Genuine 9Router visual review; pinned functionality/release sources; other product principles; full requested screen coverage or resolved evidence gaps | .75 | 2.25 |
| B01.3 | Full master recovery and scope mapping; B01.1 | 1 | Exact original uploads; amendment precedence; all master sections mapped; separate baseline frozen | 1 | 1 |
| B01.4 | Native capability/security matrix and populated baseline; B01.1–3 | 3 | 38 identified contracts; concrete native/security/acceptance proposals; matched current desktop/phone baseline; no inference/privacy transfer | 1 | 3 |
| B02.1 | Two or three original two-experience identity studies; B01 | 5 | Positioning/mark/type; geometry/nav/materials; theme/status/accessibility; refined visual/motion/small-icon review | .5 | 2.5 |
| B02.2 | Actual-component identity proof; B02.1 | 9 | Matched desktop/phone real components; chat/expanded input/picker/context and Routing Center/provider/policy/usage evidence; light/dark/black/narrow WebKit; complete dynamic/complex-state and physical-device evidence | .75 | 6.75 |
| B02.3 | Explicit identity decision; B02.1–2 | 3 | User selects or explicitly approves a specific identity, with refinement feedback recorded | 0 | 0 |
| B03 | Shared design-system foundation; B02.3 | 10 | Semantic light/dark/black tokens; shared components and original assets; accessible responsive/motion states; tested ownership and DESIGN.md integration | 0 | 0 |
| B04 | Interaction architecture, flagship and core shell/chat; B02.3, B03 | 19 | Purpose-built desktop/phone navigation and route controls; functional populated flagships; **Gate 2 before major integration**; chat/drafts/keyboard/model/gesture/Canvas recovery and regression evidence | 0 | 0 |
| B05 | Secure equivalent feature expansion; B02.3, B03, relevant B04 | 17 | Every F01–F38 disposition resolved; native provider/route/Layout/usage improvements integrated; conditional architecture/permissions explicitly decided; regression/privacy/cost evidence | 0 | 0 |
| B06 | Remaining screens; B03–5 as applicable | 11 | Settings/keys/Models/Layouts/Tools/Library/Projects; Study/Compare/Canvas/GitHub; complete responsive/multi-theme states; accessible usable cross-screen workflows | 0 | 0 |
| B07 | Hardening; incremental, final after B03–6 | 10 | Account/credentials/failure/migration regression; accessibility/keyboard/contrast; measured performance/cost; compatibility and physical-device gaps honestly resolved | 0 | 0 |
| B08 | Final aesthetic/release/production verification; B01–7 | 6 | Full final visual acceptance; exact-head CI/security review; protected merge/deploy/rollback verification; live tests and complete docs/handoff | 0 | 0 |
| | **Total** | **100** | **Current 18.5%, approximately 19%; remaining 81.5 weighted points** | | **18.5** |

The previous committed checkpoint deliberately had **no Blackout percentage** because the master was missing. An interim uncommitted 19.75% draft overcredited the first visual studies; the user rejected their architecture. We preserved B01 research/tooling, reduced B02.1 to .5 for unfinished identity/mark/motion, and award B02.2 .75 only for the new verified two-experience proof. Current 18.5% is the first synchronized baseline; the weights are unchanged. This is an evidence/acceptance correction, not a restart or a change to another initiative's progress. Confidence **Medium**: strong repository/source/rendered-test evidence, but user aesthetic acceptance and most product implementation remain ahead. B01.2 retains missing quota/request-detail/current mobile reference coverage. B02.1 retains final original mark, optical/type refinement, final integrated identity refinement and real interaction motion (the focused provider-detail proof is separately verified below). Retired Aperture/Relay/Fold are not current identity candidates. B02.2 is an identity study, not production-ready end-to-end redesign; physical iPhone behavior, virtual keyboard and complex streaming/Canvas/comparison states remain unverified.

## Requirements coverage

| Master sections | Maintained task/evidence | Current state |
|---|---|---|
| §§0–1 continuity/identity mission; §§14,16,18,20 autonomous/handoff | B01.1/B01.3; this plan and AI_HANDOFF.md, original sources | Verified checkpoint; recurring obligations remain |
| §§2–3 independent sources and reference library | B01.2; REFERENCE_REVIEW.md, REFERENCE_MANIFEST.md, REFERENCE_EVIDENCE.json | In progress; inaccessible gallery and coverage gaps explicit |
| §4 all 13 identity deliverables, §11 originality, §17 rejected failure modes | B02.1–3; IDENTITY_RESEARCH.md and workspace-proofs/review.html | Studies implemented/partially verified; **identity approval pending** |
| §5 provider/route/usage/developer/efficiency/ops/account feature analysis | B01.4 then B05; FEATURE_MATRIX.md F01–F38 | Matrix verified; new capabilities unimplemented; conditional decisions remain |
| §6 credentials/privacy/architecture/claims; §12 preservation | B03–7, every F delivery contract | Existing safeguards preserved; new boundaries require explicit decisions |
| §7 desktop/iOS/tablet; §8 complete interface scope; master's phase 3 flagships | B03/B04/B06, Gate 2 | Prototype evidence only; interaction architecture not finalized before Gate 1 |
| §9 phase order and all 3 aesthetic gates | B01–8 per v1.1, retaining master flagship approval in B04 | Gate 1 pending; Gates 2/3 not reached |
| §10 actual multi-device full-size evidence; §13 quality assurance | B02.2 then B03–8; capture harness/report/actual screenshots | Isolated proof checked; whole-app redesign/device acceptance pending |
| §15 progressive release; §19 completion | B08 plus each independently releasable milestone | PR #34 deliberately unmerged; no Blackout visual production deployment |

## Independently released functional milestone

PR #35 fixed UsageMeter controls accidentally submitting unsent drafts, independently from Blackout. Exact-head CI39444721821 passed all three jobs; normal merge/main `677bc51f39fbf8fcf66bc91f846b71a4912bb306`; deploy39447533639 succeeded. All18 built assets match production, and hosted Chromium/WebKit regression passed at1440/390 using synthetic isolated accounts. Cloud TLS details and exact evidence are in the handoff. Docs-only PR #36 merged as655438f0ec8d2e3594595252af4a99e6c58627a0, with no runtime change/redeployment; latest verified runtime remains677bc51. Research/proof checkpoint eda84a2 is preserved on draft PR #34 and reconciled with main. No Blackout visual changes were deployed, and this separate functional fix earns no extra Blackout identity credit.

## Provider intelligence packet — verified isolated slice

[Exact scoped amendment](PROVIDER_INTELLIGENCE_PACKET_2026-10-20.md); [implementation/test record](workspace-proofs/PROVIDER_INTELLIGENCE.md); [portable review](workspace-proofs/provider-review.html). Unweighted child checkpoint **B02-PROVIDER** maps to B02.1 geometry/navigation and B02.2 real-component provider/configuration evidence; it adds no new task weight or duplicate credit. All32 provider definitions, desktop list/detail, phone detail/Back, account-scoped states, canonical masked settings/model selection, numeric/unknown/model/shared-pool usage and draft preservation are implemented in the isolated proofs. Eight focused engine/viewport cases and24 axe state scans passed; Index390 existing workflow18 states, proof TypeScript, production build and portable offline review also passed.22 existing strict-audit findings remain; real-provider/physical-device behavior is not claimed.

**Progress remains18.5→18.5%, Medium confidence.** This removes the provider-detail gap from the existing partial groups; original identity/motion, physical-device, complex-state and explicit approval criteria still prevent full credit. Weights/fractions unchanged. Source/review/test paths and actual failure history are in the evidence note. No production changes, merge or deployment; PR #34 remains draft. The scoped task explicitly ends at this checkpoint. Verified implementation/artifact commit `311b396fa216c0addf6619bfc5bdb0040635edc2` is pushed to the existing PR #34 branch; the containing handoff-only revision is resolved through Git. Latest main remains655438f, deployed runtime677bc51; no release was attempted because the visual approval gate is pending.

## Provider UX quality closure — isolated correction checkpoint

[Quality-closure brief](PROVIDER_UX_QUALITY_CLOSURE_2026-10-20.md), [Q01–Q09 implementation/verification map](workspace-proofs/PROVIDER_UX_QUALITY.md), [portable review](workspace-proofs/provider-review.html). This corrects the existing unweighted B02-PROVIDER checkpoint; no new phase, weight or duplicated credit. Responsive overview/navigation/detail, saved-versus-enabled filters/visible selection, grounded default, scoped model-action subscriptions with1000-model validation, browser-local timestamps and separate presentation/focus evidence are verified. Ten focused cases/60 axe scans, the existing18-state workspace flow, proof typecheck/build and offline review pass;22 existing strict-audit findings remain.

**18.5→18.5%, Medium confidence; all baseline weights/fractions unchanged.** The remaining identity, physical-device/complex-state and approval acceptance groups are not complete. No production integration/merge/deployment: Gate1 is unapproved. Keep PR #34 draft and stop after this slice. Exact source/push state and remaining scope are recorded in the handoff.

## Verification and next review

Use [PROVIDER_UX_QUALITY.md](workspace-proofs/PROVIDER_UX_QUALITY.md) for current checks/manual review and the earlier provider note for historical implementation commands. Review the12 ordinary overview/list/detail captures separately from4 keyboard-focus captures. There is no automatic transition into another Blackout phase; preserve the master and the original post-approval B03/B04 dependencies.
