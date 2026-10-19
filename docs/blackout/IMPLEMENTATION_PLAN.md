# Lumen Blackout — Phased implementation plan (draft recovery ledger)
**New workstream; not the cancelled earlier initiative.** Origin: Lumen Blackout v1.1 user amendment. Based on `main` `c4b55781f1046e8abd75966ecb6c565327a1d62a` as of 2026-10-19.
**Status:** Phase 1 in progress; source audit partial, user image-manifest parsed, Blackout master directive MISSING. No UI implementation, identity approval, merge or deployment.

## Scope authority and progress policy
Read `BLACKOUT_V1_1_AMENDMENT.md` exactly; read root `PROJECT_CONTINUUM.md`, full `PROJECT_CONTINUUM_V2_FULL.md`, `AGENTS.md`, `MASTER_REQUIREMENTS.md`, `PRODUCT.md`, `DESIGN.md` and existing root Model Picker ledger. The complete separate **BLACKOUT master directive is not yet in available sources**. Do not substitute cancelled project documents, invent master requirements or treat 9Router features as automatically authorized. Blackout's identity-first user approval supersedes generic timing preferences for this new scope.

**Task weights below are a provisional planning framework totaling 100, not a finalized scope baseline or a verified completion percentage.** Freeze/reweight only after full master recovered, differences reconciled, and user scope approved. Until then Blackout percentage = **not established**; do not use the cancelled visual workstream's 7.5% or reset the independent Model Picker's 98.5%. Credit only tested/accepted deliverables, never an unverified document or a design picture without user acceptance.

| ID | Phase | Provisional weight | Required acceptance / gates |
|---|---|---:|---|
| B01 | Source/references/requirements recovery | 10 | Source baseline, full master prompt, screenshot evidence, capability/security gap matrix, validated scope |
| B02 | Original Lumen identity creation | 17 | Multiple nontrivial monochrome concepts, real full-size desktop/mobile evidence, **explicit user identity approval** |
| B03 | Shared component design-system foundation | 10 | Semantic theme/tokens, accessible controls, responsive and motion tests |
| B04 | Core shell/chat/workspace transformation | 19 | Desktop+mobile functionality, matched complex screenshots, **explicit user core-visual approval before production integration** |
| B05 | Approved 9Router-inspired feature expansion | 17 | Approved feature-by-feature feasibility/security contract, implemented and integrated with tests |
| B06 | Remaining interfaces and visual parity | 11 | Settings/keys/Layouts/Tools/Library/Projects/Canvas/Study/Compare full visual/functional coverage |
| B07 | Security/performance/accessibility hardening | 10 | Targeted account/credentials/provider/recovery/latency/accessibility validation |
| B08 | Final polish/release/live verification | 6 | Complete multi-theme/device review, final user visual acceptance, safe CI/merge/deploy, rollback and live verification |
| | **Total** | **100** | **PROVISIONAL, not yet an earned percentage** |

## Recoverable milestone plan
| Milestone | Required verified deliverable | Current state |
|---|---|---|
| B01.1 | Check repo main/PRs, user v1.1 file, architecture and current product contracts | Source-verified; amendment preserved in repo branch |
| B01.2 | Inspect uploaded ZIP and actual observed external reference screens, source links and trust limits | Partially verified: all 36 source URLs preserved under `REFERENCE_MANIFEST.md`; one official screenshot fully opened plus five public screenshot previews visually examined; remaining references unverified |
| B01.3 | Reconcile full BLACKOUT master with user-approved scope and 9Router reference evidence | **Blocked: master prompt not present** |
| B01.4 | Verify current-app baseline across populated desktop/mobile states and complete security/feature comparison | In progress; prior real WebKit baseline inspected, new screenshot matrix not run |
| B02.1 | Define 3 truly different identity hypotheses (type, geometry, logo, controls, nav, light/dark/black) | Research hypotheses only; unapproved |
| B02.2 | Produce real-app prototypes on isolated branch, full-size matching mobile/desktop renders | Not started |
| B02.3 | User explicitly selects/refines/approves new identity | **Mandatory gate; not met** |
| B03–B08 | Execute only after B02.3 for extensive UI work, in independently verifiable milestones | Not authorized to cross gate |

## Task-specific verification and release controls
For each executable milestone: inspect actual source and acceptance contract, implement coherent change with unit/regression tests, run typecheck/build/appropriate Chromium+WebKit, inspect browser visuals and accessibility on real screens, note security/data implications, update this ledger and `AI_HANDOFF.md` (and root pointers), commit/push with SHA. Small non-visual, independently approved bug fixes follow progressive deployment rules; Blackout's major visual merges require all three aesthetic approvals at designated gates. Document observed pass/fail versus pending explicitly.

**Current release status:** no Blackout app-code changes; no Blackout visual approval; no preview or production deployment; no Blackout completion percentage. Historical independent Model Picker remains 98.5% as documented on main.
