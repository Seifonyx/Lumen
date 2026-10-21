# Lumen Blackout — implementation plan

Checkpoint: **21 October 2026, UTC — post-Gate 1 Canvas blueprint**. Baseline **v1** freezes the existing eight parent weights after recovery of the full master. This is a separate approved initiative; Model Picker remains **98.5%**, and cancelled Adaptive Native's historical 7.5% is not transferable credit.

## Current owner decision and scope

**Gate 1 APPROVED; Canvas (A) selected. Production implementation NOT authorized.** The owner confirmed approval after the final sidebar-spacing review and explicitly switched to Codex for a documentation-only production-integration blueprint. **Gates 2/3 pending; no production code, preview exposure/security relaxation, merge or deployment.** Current deliverable: [Canvas production-integration blueprint](CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md), unweighted CP00. CP01–CP06 describe proposed execution children, not authorization or completed implementation. The original full master is unchanged.

This current section and ledger supersede historical stop/approval statements below; historical evidence/estimates are preserved. Selected Canvas replaces the rejected consolidated Workspace/Focus proposal as the foundation. First recommended implementation slice is CP01 contract characterization/component seams/scoped tokens in the isolated harness, **only after a separately scoped owner instruction**. Stop after documentation delivery.

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
| B02.3 | Explicit identity decision; B02.1–2 | 3 | User selects or explicitly approves a specific identity, with refinement feedback recorded; owner formally approved Canvas after sidebar-spacing review, confirmed 21 October 2026 | 1 | 3 |
| B03 | Shared design-system foundation; B02.3 | 10 | Semantic light/dark/black tokens; shared components and original assets; accessible responsive/motion states; tested ownership and DESIGN.md integration | 0 | 0 |
| B04 | Interaction architecture, flagship and core shell/chat; B02.3, B03 | 19 | Purpose-built desktop/phone navigation and route controls; functional populated flagships; **Gate 2 before major integration**; chat/drafts/keyboard/model/gesture/Canvas recovery and regression evidence | 0 | 0 |
| B05 | Secure equivalent feature expansion; B02.3, B03, relevant B04 | 17 | Every F01–F38 disposition resolved; native provider/route/Layout/usage improvements integrated; conditional architecture/permissions explicitly decided; regression/privacy/cost evidence | 0 | 0 |
| B06 | Remaining screens; B03–5 as applicable | 11 | Settings/keys/Models/Layouts/Tools/Library/Projects; Study/Compare/Canvas/GitHub; complete responsive/multi-theme states; accessible usable cross-screen workflows | 0 | 0 |
| B07 | Hardening; incremental, final after B03–6 | 10 | Account/credentials/failure/migration regression; accessibility/keyboard/contrast; measured performance/cost; compatibility and physical-device gaps honestly resolved | 0 | 0 |
| B08 | Final aesthetic/release/production verification; B01–7 | 6 | Full final visual acceptance; exact-head CI/security review; protected merge/deploy/rollback verification; live tests and complete docs/handoff | 0 | 0 |
| | **Total** | **100** | **Current 21.5%, approximately 22%; remaining 78.5 weighted points** | | **21.5** |

**Previous synchronized 18.5% → current 21.5% (+3 points), Medium confidence.** The only changed fraction is B02.3: 0 → 1, weight 3, for the owner's explicit Canvas selection/Gate 1 approval and recorded refinement feedback. Evidence: live checkpoint `docs/lumen-live-context` at `c003f575e02bc299d79298fa1fab8313ac7f830c`, final source `bb29ffe3073e2509cdb9ee718af4afee1b1b4b3a`, [sidebar feedback record](workspace-proofs/proposals/SIDEBAR.md) and the owner's current handoff instruction. Existing weights and B01/B02.1/B02.2/B03–B08 fractions are unchanged. Blueprint work earns no implementation credit. Total weight 100; earned 21.5; remaining 78.5. Independent Model Picker remains 98.5%.

Historical baseline: the first committed 18.5% corrected an uncommitted 19.75% overestimate of rejected studies. Those research/tooling results and historical records remain preserved. Current approval resolves the design-selection decision only. B01.2 retains reference-coverage gaps; B02.1 retains integrated identity/theme/type/motion refinement; B02.2 retains physical iPhone, virtual keyboard and complex-state coverage. Gate 1 approval does not imply all B02 acceptance groups passed. Production B03–B08 remain unimplemented/zero credit, and Gates 2/3 remain pending.

## Requirements coverage

| Master sections | Maintained task/evidence | Current state |
|---|---|---|
| §§0–1 continuity/identity mission; §§14,16,18,20 autonomous/handoff | B01.1/B01.3; this plan and AI_HANDOFF.md, original sources | Verified checkpoint; recurring obligations remain |
| §§2–3 independent sources and reference library | B01.2; REFERENCE_REVIEW.md, REFERENCE_MANIFEST.md, REFERENCE_EVIDENCE.json | In progress; inaccessible gallery and coverage gaps explicit |
| §4 all 13 identity deliverables, §11 originality, §17 rejected failure modes | B02.1–3; IDENTITY_RESEARCH.md and workspace-proofs/review.html | Canvas foundation **approved at Gate 1**; remaining study/device criteria partial |
| §5 provider/route/usage/developer/efficiency/ops/account feature analysis | B01.4 then B05; FEATURE_MATRIX.md F01–F38 | Matrix verified; new capabilities unimplemented; conditional decisions remain |
| §6 credentials/privacy/architecture/claims; §12 preservation | B03–7, every F delivery contract | Existing safeguards preserved; new boundaries require explicit decisions |
| §7 desktop/iOS/tablet; §8 complete interface scope; master's phase 3 flagships | B03/B04/B06, Gate 2 | Canvas selected; CP00 blueprint maps canonical owners; production implementation unauthorized |
| §9 phase order and all 3 aesthetic gates | B01–8 per v1.1, retaining master flagship approval in B04 | Gate 1 approved; Gates 2/3 pending; no integration/release permission |
| §10 actual multi-device full-size evidence; §13 quality assurance | B02.2 then B03–8; capture harness/report/actual screenshots | Isolated proof checked; whole-app redesign/device acceptance pending |
| §15 progressive release; §19 completion | B08 plus each independently releasable milestone | PR #34 deliberately unmerged; no Blackout visual production deployment |

## Current integration roadmap — unweighted execution children

The [blueprint](CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md) supplies exact component owners, feature/security parity, dependencies, tests, early physical-iPhone checks, Gate 2 reviews and per-slice rollback. Stable task weights above remain authoritative.

| Child | Parent mapping | Current state / next condition |
|---|---|---|
| CP00 · post-Gate 1 blueprint | B02.3 decision record; no new weight | Documentation complete; doc validation and synchronization recorded in handoff; stop for owner review |
| CP01 · characterization/seams/tokens | B03/B07 | Not started; separate owner implementation authorization required |
| CP02 · canonical composer/writing sheet | B03/B04/B07 | Not started; CP01 + authorized physical-device access; early real-iPhone acceptance; Gate 2 checkpoint A |
| CP03 · navigation/reading/projects | B04/B06/B07 | Not started; CP02 evidence/review; Gate 2 checkpoint B |
| CP04 · Routing Center integration proof | B04/B05/B07 | Not started; preserve verified provider slice; combined formal Gate 2 review package, not automatic approval |
| CP05 · authorized integration/remaining screens/hardening | B03–B07 | Not started; explicit Gate 2 and integration permission, then Gate 3 final review |
| CP06 · approved release/production verification | B08 | Not started; applicable approvals, exact-head CI, release authorization and rollback prerequisites |

**Progressive release evaluation for this milestone:** CP00 is independently reviewable documentation, authorized for commit/push to PR #34 and the separate live-context branch only. It is **not authorized for merge/deployment**. No source subset is being released. Do not merge PR #34's historical experiments wholesale or infer release permission from earlier general authorization. Latest explicit owner boundaries control.

## Historical implementation/evidence checkpoints

All following percentages, gate states and stop instructions describe their dated milestone, not today's authorization. Preserve the provider and flagship work; no reruns or additional production credit are claimed by this blueprint.

## Independently released functional milestone

PR #35 fixed UsageMeter controls accidentally submitting unsent drafts, independently from Blackout. Exact-head CI39444721821 passed all three jobs; normal merge/main `677bc51f39fbf8fcf66bc91f846b71a4912bb306`; deploy39447533639 succeeded. All18 built assets match production, and hosted Chromium/WebKit regression passed at1440/390 using synthetic isolated accounts. Cloud TLS details and exact evidence are in the handoff. Docs-only PR #36 merged as655438f0ec8d2e3594595252af4a99e6c58627a0, with no runtime change/redeployment; latest verified runtime remains677bc51. Research/proof checkpoint eda84a2 is preserved on draft PR #34 and reconciled with main. No Blackout visual changes were deployed, and this separate functional fix earns no extra Blackout identity credit.

## Provider intelligence packet — verified isolated slice

[Exact scoped amendment](PROVIDER_INTELLIGENCE_PACKET_2026-10-20.md); [implementation/test record](workspace-proofs/PROVIDER_INTELLIGENCE.md); [portable review](workspace-proofs/provider-review.html). Unweighted child checkpoint **B02-PROVIDER** maps to B02.1 geometry/navigation and B02.2 real-component provider/configuration evidence; it adds no new task weight or duplicate credit. All32 provider definitions, desktop list/detail, phone detail/Back, account-scoped states, canonical masked settings/model selection, numeric/unknown/model/shared-pool usage and draft preservation are implemented in the isolated proofs. Eight focused engine/viewport cases and24 axe state scans passed; Index390 existing workflow18 states, proof TypeScript, production build and portable offline review also passed.22 existing strict-audit findings remain; real-provider/physical-device behavior is not claimed.

**Progress remains18.5→18.5%, Medium confidence.** This removes the provider-detail gap from the existing partial groups; original identity/motion, physical-device, complex-state and explicit approval criteria still prevent full credit. Weights/fractions unchanged. Source/review/test paths and actual failure history are in the evidence note. No production changes, merge or deployment; PR #34 remains draft. The scoped task explicitly ends at this checkpoint. Verified implementation/artifact commit `311b396fa216c0addf6619bfc5bdb0040635edc2` is pushed to the existing PR #34 branch; the containing handoff-only revision is resolved through Git. Latest main remains655438f, deployed runtime677bc51; no release was attempted because the visual approval gate is pending.

## Provider UX quality closure — isolated correction checkpoint

[Quality-closure brief](PROVIDER_UX_QUALITY_CLOSURE_2026-10-20.md), [Q01–Q09 implementation/verification map](workspace-proofs/PROVIDER_UX_QUALITY.md), [portable review](workspace-proofs/provider-review.html). This corrects the existing unweighted B02-PROVIDER checkpoint; no new phase, weight or duplicated credit. Responsive overview/navigation/detail, saved-versus-enabled filters/visible selection, grounded default, scoped model-action subscriptions with1000-model validation, browser-local timestamps and separate presentation/focus evidence are verified. Ten focused cases/60 axe scans, the existing18-state workspace flow, proof typecheck/build and offline review pass;22 existing strict-audit findings remain.

**18.5→18.5%, Medium confidence; all baseline weights/fractions unchanged.** The remaining identity, physical-device/complex-state and approval acceptance groups are not complete. No production integration/merge/deployment: Gate1 is unapproved. Keep PR #34 draft and stop after this slice. Verified quality source/artifact commit `a9e34834fae3af1e0b721badcb9e24e03327f9ce` is committed/pushed and remote synchronization was confirmed. The containing final handoff/link-label update is documentation-only. Exact state and remaining scope are recorded in the handoff.

## Flagship Workspace & Composer — isolated proposal checkpoint

[Scoped user amendment](FLAGSHIP_WORKSPACE_COMPOSER_2026-10-20.md), [architecture/verification/limits](workspace-proofs/FLAGSHIP_WORKSPACE.md), [portable offline review](workspace-proofs/workspace-review.html). Unweighted refinement **B02-WORKSPACE** maps to existing B02.1/B02.2; no new scope weight or duplicate credit. The explicit workspace brief supersedes the prior provider stop boundary only for this proposal.

| Deliverable | Status / evidence |
|---|---|
| Distinct Index/Studio composition | Verified isolated proof: document/outline/intelligence margin versus independent drafting/response panes |
| Unified real three-layer composer | Verified: canonical context/tool/file owners; same textarea and draft/selection/focus; real picker/usage/Send/Stop |
| Phone writing and navigation | Verified in Linux engine/viewport tests, including320px and simulated480px keyboard space; physical iPhone remains unverified |
| Curated actual visual review |26 embedded desktop/phone frames, six states per direction plus two original comparisons; separate provider quality board preserved |
| Regression and accessibility |11 main cases/194 axe scans; two focused motion/prefill/selection cases and eight rapid WebKit picker switches; type/build and offline review checks |
| Production integration / approval |Not started; Gate1 remains NOT APPROVED, no merge/deploy |

**18.5→18.5%, Medium confidence;81.5 remaining.** Stable baseline v1 unchanged. Optical/composition refinements do not complete the entire B02.1 identity/motion acceptance group; physical/complex-state B02.2 evidence remains incomplete and B02.3 explicit approval remains0. No production B03/B04 credit is awarded.22 pre-existing strict-audit findings remain. Verified source/artifact commit `327a1082baf6b9d27123a6af21bec6ca94462860` is safely pushed with matching remote SHA; the containing follow-up records synchronization only. See the handoff for exact main/deployed state and the implementation note for actual failure history and manual test sequences.

## Gate1 flagship consolidation — isolated proposal

[Scoped amendment](GATE1_CONSOLIDATION_2026-10-20.md), [implementation/results/limits](workspace-proofs/CONSOLIDATION.md), [portable16-frame review](workspace-proofs/consolidation-review.html). This refines unweighted B02-WORKSPACE within existing B02.1/B02.2, preserving the original alternatives and provider-quality work. One Index-derived shell plus optional Focus writing replaces competing product directions in the new opt-in preview. Phone reading priority/progressive brief, composer balance, desktop containment, navigation and truthful chat-versus-draft estimates are corrected.

Proposal acceptance: first full response paragraph visible above a composer ≤42% of phone viewport; exact draft/selection/focus, independent desktop Focus scrolling, accessible history/search/new conversation/model/usage/provider/policy workflows; safe-area/keyboard-space simulations distinguished from physical device. Seven focused cases/124 axe scans supplement the retained11 cases/194 scans (318 workflow scans total, all pass); both offline engines pass16 images/control/download/focus checks and4 further scans. The original flagship assertions are retained; only an optional test-server port is added to the older harness. Exact results, failure history and screenshot hashes are recorded in the evidence.

**18.5→18.5%, Medium confidence; weights/fractions unchanged,81.5 remaining.** No B02.3 approval, B03/B04 production integration, final identity or physical/complete complex-state credit. Type/build pass;22 existing static findings remain. Verified source/artifact commit `5c9ff0f3e20e0127afb45d48eca4f8fe2dc4b696` is committed/pushed with matching local/remote hashes; the containing documentation-only follow-up records synchronization. PR #34 stays draft. No merge/deploy; preserve latest main/runtime separately in the handoff.

## Verification and next review

Historical consolidated-proposal review instructions; that architecture was later rejected. Current continuation uses the approved Canvas source, the blueprint and latest handoff above. Older workspace/provider boards retain their separate evidence. Production implementation remains unauthorized.

### Gate1 flagship quality pass — 21 October 2026

[Scoped brief](GATE1_QUALITY_PASS_2026-10-21.md), [record and before/after](workspace-proofs/QUALITY_PASS.md). Typography/hierarchy, intelligence rail, accurate Workspace/Focus/Routing mode identity, phone toolbar clarity and an honest usage share, all in the opt-in consolidated preview. Chromium matrix (11 cases, 195 axe states, 0 violations) passes; WebKit not run in this environment. Implementation commit `e20673adae392b2bc2f46b9a422150759cf0ee6e`.

**18.5→18.5%, Medium confidence; weights/fractions unchanged, 81.5 remaining.** Refines partial B02.1/B02.2; no B02.3 approval, B03/B04 integration or physical-device credit. Gate1 NOT APPROVED; stop for owner review.

### Gate1 final verification — 21 October 2026

[Record](workspace-proofs/FINAL_VERIFICATION.md). At `1d1e0f7`: WebKit (official Playwright 1.56.1 image) 8 required + 2 supplementary cases and Chromium 10 cases pass, 354 axe states, 0 violations; portable review rebuilt and checked in both engines. Physical-iPhone checklist prepared but blocked by the localhost-only preview guard pending an owner decision. **18.5→18.5%, Medium confidence.** Gate1 NOT APPROVED; stop for owner review.

### Gate1 product-experience reconsideration — 21 October 2026

Owner rejected the consolidated visual architecture. Two isolated directions (A Canvas, B Desk) built over the real App with production iPhone glass; [record](workspace-proofs/proposals/PROPOSALS.md), [review](workspace-proofs/proposals/review.html). Exploration only: **18.5→18.5%, Medium confidence**; no approval, selection or B03/B04 credit. Stop for owner choice.

### Canvas final design refinement — 21 October 2026

Owner selected A · Canvas; one polish pass in the opt-in preview. [Record](workspace-proofs/proposals/CANVAS_POLISH.md). Navigation (brief, groups, fold, re-homed AllChats/AskChats/New project), reading gap, composer and sheet polish; Chromium + WebKit pass. **18.5→18.5%, Medium confidence**; no approval or B03/B04 credit. Stop for owner review.

### Canvas navigation completeness & sidebar refinement — 21 October 2026

[Record](workspace-proofs/proposals/SIDEBAR.md). Reference-informed sidebar, collapsible Projects/folders/Conversations, restored row actions, account footer and desktop collapse in the opt-in Canvas preview; Chromium + WebKit pass. **18.5→18.5%, Medium confidence**; no approval or B03/B04 credit. Stop for owner review.

### Canvas sidebar spacing & hierarchy — 21 October 2026

CSS-only refinement of the Canvas sidebar per owner feedback ([record](workspace-proofs/proposals/SIDEBAR.md#follow-up--spacing--hierarchy-refinement-owner-feedback)). Chromium + WebKit pass. **18.5→18.5%, Medium confidence.** Stop for owner review.
