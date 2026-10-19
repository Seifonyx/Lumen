# Lumen Adaptive Native — cross-agent operational handoff

> **LATEST CONTINUUM CONTINUATION (2026-10-19):** Uploaded `PROJECT CONTINUUM v2.0` was re-read and confirmed as the existing permanent repository protocol. Design Renaissance v1.0 remains the authoritative visual brief. PR #32 remains **draft, isolated and visually unapproved**, based on main `eedf37df07bd1d63ce49525687e3641a4e74924d`. This session strengthened `tests/e2e/helpers/renaissance-shots.cjs`: real saved Markdown document populates Library; checks equal model choices/layout choices/Add actions across unmodified and both experimental modes; verifies draft persistence. Static source inspection: 76 candidate CSS selector groups, all opt-in; braces balanced. **No browser build or screenshot evidence exists for these changes yet**: Actions runs `39279893692`, `39280152176`, `39281319451` are queued (cause unconfirmed). Newest pre-documentation source SHA `c6a3b1d9d9bf5d0014144e73338101aaa46ff325`; recheck branch HEAD after this documentation commit. Progress **7.5/100 unchanged** (low visual acceptance confidence), unrelated Model Picker **98.5/100 unchanged**. Next exact step: check actual queued-run progress, inspect real full-resolution CI screenshots (not synthetic mock art), fix defects, seek user aesthetic approval; never merge substantial visuals before that approval. CI queue is a verification blocker, not success or proof of visual failure.


> **CURRENT EXPERIMENT CHECKPOINT (2026-10-19, after Design Renaissance governance merged):** PR **#31** directive/docs merged into `main eedf37df07bd1d63ce49525687e3641a4e74924d`; original Model Picker requirements untouched. **PR #32**, draft branch `design/renaissance-flagship-compositions`, contains two opt-in **actual React UI** composition explorations (`?renaissance=atelier`, `?renaissance=workbench`) and branch-only WebKit screenshot suite. No aesthetic acceptance; no production merge/deploy. GitHub Actions run **39279893692** was *queued* at this checkpoint: no passing tests or captured new screens may be claimed until artifact inspection. Source changes: `src/main.tsx`, `src/design-renaissance-exploration.css`, `tests/e2e/helpers/renaissance-shots.cjs`, `.github/workflows/tests.yml`; plan/handoff documentation. See plan's latest Active isolated Renaissance section. Progress **unchanged 7.5/100, low visual-acceptance confidence**; Model Picker **98.5%** separate. **Next:** verify Actions actual results, recover screenshots, compare full-size real app, fix defects, require user aesthetic approval before main. Don't base new UI on rejected PRs #28/#30.


> **LATEST GOVERNANCE CHECKPOINT — 2026-10-19 / Design Renaissance v1.0**
> The user explicitly designated [`LUMEN_DESIGN_RENAISSANCE_V1.md`](LUMEN_DESIGN_RENAISSANCE_V1.md) as the authoritative **design scope and quality directive**, and [`PROJECT_CONTINUUM.md`](../../PROJECT_CONTINUUM.md) v2.0 as **permanent operational and cross-agent protocol** (full uploaded text at [`PROJECT_CONTINUUM_V2_FULL.md`](PROJECT_CONTINUUM_V2_FULL.md)). **Root `AGENTS.md`** directs every agent to read both directives completely. This is an approved additive amendment, not a replacement for original Model Picker `MASTER_REQUIREMENTS.md` or approved product functionality. **PR #28 and PR #30 both rejected as design outputs and closed unmerged. No substantial visual change may merge to production without user explicit aesthetic approval of the ACTUAL redesigned app.**
>
> **PROGRESS:** Adaptive Native/Design Renaissance **previous 7.5% → current 7.5% (+0.0 points)** on unchanged 100-point nine-task ledger; medium confidence in source + old screenshots, low aesthetic confidence (new experience not delivered). Model Picker separate **98.5%** unchanged. **CURRENT PHASE:** AN01 research + direction (references added; actual visual work still pending); next AN02/AN03 contrasting substantial real-component proofs. **NEW EVIDENCE:** 13 first-party design references inspected, original full user directives preserved and coverage mapped in `ADAPTIVE_NATIVE_PLAN.md`; no runtime changes in governance branch. **APPROVAL:** none for new visuals.


**Date:** 2026-10-19. **Project:** distinct Lumen UX/visual-overhaul initiative. **Approved strategy:** "Lumen Adaptive Native": native-feeling iOS + refined Linear/Raycast-caliber desktop + appropriate Android/tablet, all within the same Lumen design DNA. **Execution policy:** Project Continuum v2.0, progressive verified deployment, all inherited security/reliability constraints.

## Last/current estimates

| Program | Status | Current estimated completion | Evidence/confidence |
|---|---|---:|---|
| **Adaptive Native (this new initiative)** | Baseline and specification committed as docs only | **7.5/100 (~7.5%)** | Medium for source/CI screenshots, low for visual approval |
| **Dynamic Model Picker (existing program)** | separate original implementation, hosted signoff pending | **98.5/100** | Medium per original `AI_HANDOFF.md`, unchanged |

The rejected static concept's old 10% is **not** carried forward. **This session delta for new initiative:** 0 → 7.5, baseline 5 points and art direction 2.5 points. **Remain:** 92.5. The formula and fixed 100-weight ledger live in `docs/design/ADAPTIVE_NATIVE_PLAN.md`. Update weights only on explicitly approved scope revision.

## Accurate source state

- Main verified at start: `bb78ed6ac3591491eece1a1a268a2090827f016f` (PR27 checkpoint). Never claim a different current main without checking fresh remote.
- Branch: `design/adaptive-native-baseline-20261019`, intentionally **docs-only**, created from exact main SHA.
- Files created: `docs/design/ADAPTIVE_NATIVE_BASELINE.md`, `ADAPTIVE_NATIVE_SPEC.md`, `ADAPTIVE_NATIVE_PLAN.md`, this handoff.
- Historic rejected mock: PR **#28** closed and **unmerged**. No future agent should mistake that for approved direction.
- Original product and model picker source, `DESIGN.md`, `PRODUCT.md`, `UX-CONTRACT.md`, `MASTER_REQUIREMENTS.md`, `IMPLEMENTATION_PLAN.md` and `AI_HANDOFF.md`: untouched by this design branch until any explicit synchronization pointer addition.
- No app stylesheet/component/test/asset/deploy/config changes. No preview or production deployment of new visuals. No UI code test runs required for docs-only change; don't report unrun tests as passed.

## Visual evidence acquired

- Successfully read GitHub PR25 CI/WebKit artifact `webkit-evidence` (artifact id `12184798936`, GitHub Actions run `39249464644`).
- ZIP held 57 screenshots, 49 under `.impeccable/review`; captured 2026-10-19 12:07–12:11 UTC with seeded test fixtures. Retention approximately seven days; don't assume always available.
- Inspected specifically real app `layout-webkit-1280-light-home.png`, `1280-light-sidebar.png`, `390-dark-home.png`, `390-dark-sidebar.png`, `390-dark-plus.png`, `390-dark-keyboard-model.png`, `320-light-keyboard-model.png`, `430-black-home.png` and verified the rest of screenshot manifest.
- Observations A01–A08 and their confidence/severity/reproduction gates in `ADAPTIVE_NATIVE_BASELINE.md`.
- A separately assembled **unchanged-image reference board** was created for user inspection in this chat's tool runtime (`/mnt/data/lumen-adaptive-audit/real-app-baseline-board.png`), **not committed** to GitHub. New agents should use original artifacts or re-run screenshots, not assume that ephemeral path exists.
- Actual Firebase live site could not be browsed from the tool runtime (DNS) and the public web reader couldn't access it. Screenshots are of CI test-seeded real application source, **not** a physical iPhone nor current live logged-in session.
- Existing `.github/workflows/safari-check.yml` is a manual WebKit screenshot workflow; no workflow dispatch was initiated in this session. No request for paid or high-frequency inference.

## Immediate next task

1. Re-check branch/main and diff, verify the PR checkpoint. Keep PR draft, don't deploy docs prototype or mark visual implementation done.
2. Run existing screenshot helpers/manual Safari screenshot workflow to fill gaps: Settings, Tool hub, Projects, Library, Canvas, Compare and populated conversation, at phone/tablet/desktop and all 3 appearances. Use seeded synthetic accounts only.
3. Reproduce suspected A01 glass readability, A02 320 model-picker discoverability, and A06 native zoom inconsistency before touching source. Check iOS reduced transparency and solid fallback; inspect actual computed CSS selectors.
4. Build **one meticulously crafted real-component iOS visual proof** on another isolated branch and capture before/after real screenshots, without merging to main. Then a separate desktop proof. User explicitly rejected a rushed, basic static HTML and expects a significantly more premium output.
5. Following actual approval and matching Chromium/WebKit tests, progress to approved incremental release steps. Sync this handoff and the stable weighted plan on every verified phase; keep original Model Picker percentage independent.

## Mandatory safety and quality notes

- "Best possible" is the user's quality ambition: strive for outstanding craft, evaluate evidence and iterate; do not promise no future room for improvement.
- No wholesale visual reset or deleted features. Branding/identity in `DESIGN.md`, UX canonical owners in `UX-CONTRACT.md`, privacy/BYOK/storage/routing protections and original staged-release policy all remain binding.
- Preserve actual iOS assets and native-feel gesture work. iOS web experience can feel native, but cannot claim identical underlying operating-system compositing/haptics to SwiftUI.
- Visual user approval gates apply to substantive UI design even when normal PR merges are otherwise authorized. Do not override an explicit rejection.
- Every blocker/uncertainty is written into plan and baseline. Do not invent completed screenshots, test results or deployments.

## Latest milestone: Design Renaissance approval + repository auto-entry (2026-10-19)

**Approved:** full uploaded source `LUMEN DESIGN RENAISSANCE v1.0` (1,187 lines in supplied text, stored full as `docs/design/LUMEN_DESIGN_RENAISSANCE_V1.md`) and permanent `PROJECT CONTINUUM v2.0` (679 logical lines, stored full as `docs/design/PROJECT_CONTINUUM_V2_FULL.md` and still active in root `PROJECT_CONTINUUM.md`). Source upload normalization may change CRLF to LF; wording/sections/requirements must remain intact. Original design/product/Model Picker instructions remain readable and unoverwritten. Do not mistake the newly approved directive for acceptance of any actual aesthetic candidate.

**Exact workstream and remote checkpoint at start:** main `c8755a6c0cb7fce853683808bb80deac6fc066f4` (docs-only PR #29). Rejected **PR #30** head `849598c15862f1be1ecb84b436c195d4d80356df`: closed **unmerged** in this session; its opt-in styles are archival experimental history and must not be revived as the substantial overhaul. PR #28 also closed/unmerged. Governance branch `docs/design-renaissance-v1-directive` created from the exact main SHA. This checkpoint's GitHub commits are additive documentation only and are listed in PR once created. Final merged and deployed SHA must be verified and added by the next handoff after status changes; don't present baseline main as newly deployed.

**Files in this governance change:** `AGENTS.md`; full `docs/design/LUMEN_DESIGN_RENAISSANCE_V1.md`; full `docs/design/PROJECT_CONTINUUM_V2_FULL.md`; `docs/design/DESIGN_RENAISSANCE_RESEARCH.md`; append-only pointers in `PROJECT_CONTINUUM.md`, `DESIGN.md`; versioned map, review gate and conflict log in `docs/design/ADAPTIVE_NATIVE_PLAN.md`; this existing handoff; and a short discoverability note in root Model Picker ledger/handoff if not already present. `MASTER_REQUIREMENTS.md` not touched. Check exact PR changed-file list before merge.

**Source/research evidence:** 13 primary-source materials from Apple iOS/macOS HIG, Apple Materials/Liquid Glass adoption, Linear 2025–2026 writing, Raycast 2026 product/engineering writing, Things features, web.dev performance and Playwright screenshot documentation. See `docs/design/DESIGN_RENAISSANCE_RESEARCH.md` for specific *inspected* URLs, design principles, Lumen applications, anti-copy warnings and feasibility. This is a documented bounded research step; **not a tested design**.

**Existing visual evidence:** PR25 old real-app WebKit screenshots in CI run `39249464644` / artifact `12184798936`; exploratory PR30 screenshots in later Actions artifacts may remain available for negative comparison, **but that aesthetic was rejected**. No new real-app design capture, hosted preview or physical device evaluation was completed in the governance milestone.

**Conflict resolution:** if the original phone welcome/composer geometry in `DESIGN.md` and the larger Renaissance composition requirement conflict, preserve behavior, visible feature access, keyboard/safe-area and user data; explore visual variants on isolated branches and resolve only with explicit user aesthetic approval. Older `PRODUCT.md` zoom preference conflicts with current gesture suppression: log and test separately before changing. Security/credentials/data/account isolation, all previously approved features, branch protections and explicit approval always prevail. Unresolved creative compatibility remains open, not secretly decided.

**Verification / limitations:** compared full source directives to GitHub saved content, nine stable design phase weights must equal 100 with 7.5 earned; reviewed docs-only Git diff, no app typecheck/build/browser test executed for docs-only PR (do not claim runtime validation). Source-generated reference dossier is not implementation evidence. The current runner does not have a local git checkout / public GitHub DNS, so GitHub connector operations and separate CI builds are required for actual runtime changes. If CI artifact/source limitations block images, document and continue safe work.

**Exact next task for the next agent (do not stop at this handoff):**
1. Inspect main, open PRs and exact branch SHA; read root `AGENTS.md` and **both complete directives**, existing product docs, this handoff/plan.
2. Start AN02/AN03 **composition-level alternatives** in a NEW isolated implementation branch from latest main — do not base on rejected PR30, and do not merge unapproved UI. Prioritize new iOS full welcome/chat/composer/nav/sheets/hub composition and desktop full workspace/sidebar/reading/composer/complex tool layout, preserving controls.
3. Use real Lumen React components/state and synthetic data. Capture matching before/after 320/390/430 and 1280/1440; light/dark/true-black and populated, complex interaction states. Add regression tests and run required type/build/unit/Chromium/WebKit.
4. Conduct critical visual review; collect actual-app screenshots and optional *isolated verified* preview. Ask the user for explicit aesthetic approval at the first substantive checkpoint; if rejected, change composition/art direction rather than CSS tweaks.
5. At each meaningful milestone synchronize `ADAPTIVE_NATIVE_PLAN.md` and `ADAPTIVE_NATIVE_HANDOFF.md`, verify stable weighted math, exact pushed/main/deployed refs, tests, artifacts, unresolved conflicts and next task. Keep Model Picker progress independent and historical master requirements immutable.

**Release:** the user authorizes routine docs and independently verified unrelated fixes according to root CONTINUUM; **no substantial visual changes into `main` or live until explicit user approval of actual redesigned Lumen**. Isolated preview must not overwrite shared environments. Do not infer approval from CI or an agent score.
