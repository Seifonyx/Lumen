# Lumen Adaptive Native — independent implementation ledger

> **APPROVED SCOPE AMENDMENT — Lumen Design Renaissance v1.0 (2026-10-19).** The full user-approved creative and implementation directive is preserved **unchanged** at [`LUMEN_DESIGN_RENAISSANCE_V1.md`](LUMEN_DESIGN_RENAISSANCE_V1.md); permanent execution is [`PROJECT_CONTINUUM.md`](../../PROJECT_CONTINUUM.md), full user's supplied v2 text [`PROJECT_CONTINUUM_V2_FULL.md`](PROJECT_CONTINUUM_V2_FULL.md). Every future agent must read **both in full** and recover this plan + [`ADAPTIVE_NATIVE_HANDOFF.md`](ADAPTIVE_NATIVE_HANDOFF.md). PRs #28 and #30 were visually rejected and are **closed unmerged**. This amendment demands a **substantial complete-screen transformation**, not a small polish of sheet opacity, wrapping or hover.


> **Project:** Lumen Adaptive Native (the new UX/visual initiative). Approved strategic direction: iOS Apple-quality tactility; desktop Linear/Raycast-level precision; Android/tablet-appropriate adaptation; all under Lumen's own identity. **Status:** baseline and design specification only, no redesigned runtime UI. Do NOT conflate this with the original Dynamic Model Picker implementation plan.

## Governance and non-regression obligations

- Obey `PROJECT_CONTINUUM.md` v2.0 and its prior progressive verified deployment policy: verified phases, autonomous supported engineering work, exact GitHub state, stable earned weights, accurate handoff, explicit uncertainty, preserve all completed features and user data.
- Preserve `MASTER_REQUIREMENTS.md` without modifications. The Model Picker's separate checkpoint remains **98.5%** (medium confidence, P11-B hosted acceptance outstanding) unless its own acceptance evidence advances. Neither design progress nor model picker progress is transferable.
- The first `Refined Lumen Native` concept (draft PR **#28**, closed unmerged) is **rejected**; user explicitly called it generic, aesthetically worse and rushed. It is NOT a design baseline, should not be reopened, and earns **no** current-design credit.
- The user approved **Lumen Adaptive Native** strategy, not implementation screenshots. This design phase is autonomous, but any substantial visual modification awaits actual app side-by-side review and approval.
- Keep live/main untouched during baseline. The current production commit was earlier verified separately; do not infer live deployment for this design-only branch.

## Weighted task list — **new design project**, 100 fixed points

A phase earns 0, 0.25, 0.5, 0.75 or 1 of its weight for separately evidenced milestones. Weight is complexity + integration/risk, not aesthetic ambition or document length. Fractions mean: 0 no accepted work; .25 coherent independently useful evidence/subdeliverable; .5 validated partial phase; .75 validated/CI-reviewed work with remaining acceptance gate; 1 fully accepted, including actual browser/user release acceptance when scope requires it. For early planning tasks, completion follows their own listed acceptance; no implementation points for design documents.

| ID | Phase / workstream | Weight | Earned fraction | Weighted earned | Acceptance evidence required |
| --- | --- | ---: | ---: | ---: | --- |
| AN00 | Actual-app audit and complete baseline captures | 10 | 0.5 | 5 | Real verified WebKit baseline across first core screen families and source ownership audit (done partially); **remaining:** Settings/Tools/Projects/Library/Canvas/Compare, larger theme/state matrix, native iPhone observation and issue reproduction |
| AN01 | Art direction, distinctiveness and visual standards | 10 | 0.25 | 2.5 | Documented new approved strategic direction and quality standards (done); **remaining:** measured platform design system, matched detailed references and user aesthetic approval of high-fidelity concept |
| AN02 | iOS high-fidelity real-app proof and approval | 12 | 0 | 0 | Actual Lumen iOS screens: welcome, populated chat, model picker, Add sheet, hubs, three themes; real component preview, focus/keyboard/gesture checks, approved after before/after visual review |
| AN03 | Desktop high-fidelity real-app proof and approval | 12 | 0 | 0 | Actual Lumen desktop screens: chat, sidebar, composer, menu, one hub, density/keyboard, three themes; before/after review and approval |
| AN04 | Shared token & component architecture | 10 | 0 | 0 | Canonical semantic tokens, coherent component appearance, no duplicative CSS override pile, theme/contrast/a11y/unit visual checks |
| AN05 | iOS/Android/tablet responsive implementation | 12 | 0 | 0 | Approved responsive iOS surfaces and appropriate Android/tablet adaptations wired to actual app, keyboard/gestures/performance, browser tests |
| AN06 | Desktop workspace implementation | 12 | 0 | 0 | Approved app shell, chat reading/composer/navigation, commands and split-screen behavior verified, no regressions |
| AN07 | Feature workspaces and detailed states | 10 | 0 | 0 | Projects, Tools, Library, Canvas, Study, Compare, Settings/API keys/Model Picker states and error/offline/empty/partial behavior all consistent and tested |
| AN08 | Accessibility, cross-browser, full CI and progressive deployment | 12 | 0 | 0 | WCAG-oriented keyboard/contrast/reflow/zoom and motion checks, real browser screenshots, Chromium/WebKit CI, independent review, main/preview/prod evidence, physical device limits, rollback and final synced handoff |
| **TOTAL** | | **100** | | **7.5** | |

**New project completion:** **7.5/100 = ~7.5%**, **medium confidence in source/CI baseline, low confidence in ultimate visual acceptance**. This is not the rejected old concept's earlier "10%"; that separate draft was closed and is not carried over.

**Prior estimate:** none in this replacement initiative. **Change in this session:** 0 → 7.5, documented partial audit 5 points + visual standards 2.5 points. **Remaining:** 92.5 points. No partial credit for production UI coding, because no such changes were made.

## Phase schedule and independently releasable milestones

### Phase A — real evidence and native visual language (AN00–AN01)
- Review `docs/design/ADAPTIVE_NATIVE_BASELINE.md` and `ADAPTIVE_NATIVE_SPEC.md`.
- Preserve extractable screenshot evidence from GitHub run **39249464644**, artifact **12184798936**, `webkit-evidence` created 2026-10-19; 57 screenshots, original PR25 reviewed source. This artifact has a short retention window: extract before expiration or regenerate.
- Run existing `Safari visual check` manual workflow (`.github/workflows/safari-check.yml`) and/or targeted helpers on a current checkout. Capture all feature screens and themes. Audit textfit/contrast/compositing, generate a proper structured baseline manifest.
- Reproduce A01 (translucency readability), A02 (320px picker discoverability), A06 (pinch zoom) with browser/assistive inputs. If an issue does not reproduce, mark disproved rather than implementing a cosmetic "fix".
- Document 1:1 before-screenshots and platform-specific constraints.

### Phase B — high-fidelity flagship proofs (AN02–AN03)
- Create separate experiment branches from same verified source baseline (or sequential if shared files conflict), initially **not for merge**.
- **iOS proof:** actual existing `ChatView`, `Composer`, `ModelPicker`, `AttachSheet`, `HubPage`, with app screenshot states; not static throwaway HTML. Use screenshots from rendered real app, 390/320 and dark/light/black; sample error/loading/long label. Refine actual geometry/material/optical details under CI.
- **Desktop proof:** existing `Sidebar`, chat/message surfaces, top bar, menus and one feature hub; real screenshots at 1280/1440, light/dark/black; no dropped features or static copied design.
- Capture old/new at identical seed/device/theme. Share review sheet with fine detail and explain every meaningful change. Wait for user aesthetic sign-off before shipping substantial visual changes. **If rejected, keep main unchanged and revise proposal**, preserving the same task weights.

### Phase C — accessible shared system, staged runtime rollout (AN04–AN07)
- Migrate canonical identity tokens/shared semantic variables in small, correctly scoped PRs. Build a component appearance map that distinguishes iOS material from desktop solid treatment.
- Integrate approved iOS/mobile and desktop polish independently where safe; no giant CSS reset. Each PR includes exact screenshots and focused behavior coverage.
- Refine Tools/Library/Projects/Settings/Canvas/Study/Compare with their own real states and parity checks, avoiding generic cards.
- At each independently ready milestone: check type/build/unit, Playwright Chromium/WebKit, accessibility, low-end performance, privacy, account scope, error/feature states. Merge through normal workflow only on actual test+user review evidence; preview/production as approved, verify hosted parity and rollback.

### Phase D — real-world finish (AN08)
- Regression and aesthetic review across 320/375/390/430/768/899/1024/1280/1440/1918 and landscape; light/dark/true-black; 200% zoom; Arabic/RTL; dynamic text; dark glass and reduced-transparency; pointer, keyboard, reduced motion; error/offline/quota/permission states.
- Enforce accessibility and state parity without claiming certification absent proper assistive/device evidence.
- Final continuous integration and exact SHA deploy, production smoke, comprehensive documentation and user aesthetic acceptance. Close all defined high-value in-scope defects before 100%; never claim flawless-for-all-time.

## Implementation safety constraints

**Actual primary style owners:** `src/app.css`, `src/glass.css`, `src/lib/glass.ts`, interaction helpers; entry `src/main.tsx`. Do not invent `workspace.css` as an active stylesheet based on stale prose.

**UI owners:** `src/components/Sidebar.tsx`, `ChatView.tsx`, `Composer.tsx`, `MessageThread.tsx`, `ModelPicker.tsx`, `AttachSheet.tsx`, `HubPage.tsx`, `ToolsPage.tsx`, `CollectionPage.tsx`, `ProjectsPage.tsx`, `SettingsModal.tsx`, `CanvasPanel.tsx`, Study/Compare. Follow `UX-CONTRACT.md` as canonical interaction map.

**Testing:** `npm run typecheck`, `npm run build`, `npm run test:unit`, `npm run test:e2e -- <target>` and supported CI. Screenshot tools `tests/e2e/helpers/{shots,settings-shots,project-shots,more-shots,textfit}.cjs`, `BROWSER=webkit`; `tests/e2e/design.cjs`, `fit.cjs`, `native-feel.cjs`, `glass.cjs`, `gestures.cjs`, `accessibility.cjs` and focused regression files. Execute them after runtime changes, don't claim tests done because scripts exist.

**No surprise spending/security:** CI runs with seed fixtures, mocked model calls; no real paid provider traffic, no secrets in screenshots/repository, no public share of personal keys/conversations. Do not bypass branch protections, push live-preview mock content, force-push or merge an unreviewed visual change.

## Source-based checkpoint and handoff

**As of this PR:** baseline screenshot artifact successfully downloaded/examined in a temporary tool runtime and relevant screenshot filenames/document references recorded. GitHub content is docs-only; actual screenshot binaries are in CI artifact and transient generated user files, not committed into Git. The rejected mock is left only as closed historical PR #28. No current-app preview, dynamic gesture or zoom audit has run this session.

**Next agent's exact task:**
1. Fetch current main and this branch, compare SHA against this handoff, preserve any concurrent changes.
2. Run or request the manually triggered `Safari visual check` workflow on current main if needed, reuse existing screenshot scripts and synthetic seeding to capture **Settings, Tools, Projects, Library, Canvas, Compare** and missing theme/state matrix.
3. Reproduce A01/A02/A06 at exact source SHA in browser, measure computed styles and scroll/zoom semantics. Record pass/fail.
4. Start one narrowly scoped **real-app iOS** visual proof, preserve before screenshots; **do not merge** until aesthetic approval.
5. Update THIS design ledger/handoff after each verified milestone while leaving the original Model Picker docs intact.

Project goal is superior measurable quality, not a claim of absolute perfection or a license to erase real app functionality.

---

## Approved amendment ledger — Lumen Design Renaissance v1.0 (2026-10-19)

**Approval:** user supplied and approved `LUMEN DESIGN RENAISSANCE v1.0 — Master Autonomous Design & Implementation Prompt` and confirmed Project Continuum v2.0 as permanent operational protocol. The uploaded complete text is preserved at `docs/design/LUMEN_DESIGN_RENAISSANCE_V1.md`; the complete uploaded universal Project Continuum is at `docs/design/PROJECT_CONTINUUM_V2_FULL.md`, referenced from root `PROJECT_CONTINUUM.md`. Root `MASTER_REQUIREMENTS.md` retains original Model Picker authority and was not replaced.

**Scope interpretation:** Design Renaissance **strengthens** the already-approved Adaptive Native project across both iOS and desktop; all nine weighted categories (AN00–AN08) already include research, distinct visual directions, real component proofs, full-screen review, integrations, feature workspaces, accessibility and deployment. Therefore this is a **versioned acceptance/quality amendment (scope baseline v1.1)** within the *same* nine task IDs and 100 total weight; no scores or weights are reset or modified for merely receiving the brief. If later actual coverage uncovers a materially new effort outside those categories, request an explicit scope-baseline revision and disclose recalculation rather than silently changing percentages. **Progress at checkpoint stays 7.5/100 (7.5%), medium confidence for source/CI baseline but low for visual acceptance, +0 this documentation milestone.** Separate Dynamic Model Picker estimate remains **98.5%** until its own evidence changes.

### Exact requirements coverage map — audit statuses at each milestone

| Renaissance sections / approved requirement | Existing owner(s) | Current status | Acceptance and evidence still required |
|---|---|---|---|
| 0–1 mission, rejection history, continuity | AN00, AN01, handoff | Verified **documentation**, aesthetic unapproved | Preserve both full directives; exclude rejected PRs #28/#30 from implementation; recovery from Git and evidence |
| 2 research, ~10–15 primary references with meaningful product application | AN01 | In progress (13-source first-party dossier completed, not user-approved concept) | [Design Renaissance research](DESIGN_RENAISSANCE_RESEARCH.md) verified source links + live reference inspections where possible; use findings in real app changes |
| 3 distinct Lumen identity (Eclipse, signal, cool neutrals, routing) | AN01, AN04 | In progress (existing baseline/source; new art direction unapproved) | A cohesive, immediately recognizable full-screen composition, not a generic template or deleted capability |
| 4–5 iOS native-quality complete product | AN02, AN05 | Not started for **accepted** substantive redesign | Welcome, populated chat, composer, nav, sheets, model picker, project/tool hub and dense state as actual app, theme/keyboard/touch evidence |
| 6 desktop complete professional workspace | AN03, AN06 | Not started for accepted substantive redesign | Full workspace/navigation/reader/composer + actual dense feature surface; 1280/1440 screenshots and shortcut/keyboard evidence |
| 7 typography/materials/colors/motion | AN01, AN04, AN05, AN06 | In progress (existing rules audit only) | Shared semantic system; device-specific materials, native-like gestures, contrast/performance and 3 themes, no arbitrary new overrides |
| 8 materially distinct compositions | AN01, AN02, AN03 | In progress (research has 2 conceptual options/platform only) | **At least two** meaningful iOS/desktop compositions explored and evaluated by evidence before selection; real component high-fidelity proof |
| 9 full-screen before/after evidence | AN00, AN02, AN03, AN08 | In progress (baseline exists; PR30 images rejected as minor) | Exact same fixture/state/browser/viewport across complete welcome + populated chat + tools + overlays, downloadable originals and comparisons |
| 10 explicit aesthetic approval + 6-factor quality rubric | AN02, AN03, AN08 | Not started; approval **not granted** | User sees actual redesigned app, explicitly accepts style **before** any substantial visual production merge; score based on evidence only |
| 11 architecture/ownership, 12 all feature parity | AN04–AN08 | Existing contracts verified, redesign parity not started | No duplicate controls/data changes; keyboard/pointer/route/editor/privacy/credentials/regressions pass on real app |
| 13, 14 multi-state responsiveness/testing/staged phases | AN05–AN08 | Not started for new code | Cross-device/browser/theme/zoom/reduced-effect/long content scenarios, CI, preview isolation and exact SHA verification |
| 15–19 handoff, autonomy, failure-prevention, reporting | All AN tasks, `ADAPTIVE_NATIVE_HANDOFF.md` | In progress (persistent protocol auto-entry added) | Update plan/handoff **after every meaningful checkpoint**, source/progress/tests/proof artifacts/approvals/preview SHA, preserve next task for other agents |

### Stronger requirements for AN02 and AN03 (existing weights unchanged)

**AN02 — iOS 12 points:** do not award accepted concept/proof credit for changing only Add-sheet readability or picker labels. Require visibly transformed **real** iPhone welcome, **populated** conversation, composer and contextual controls, navigation/drawer, model picker, Add sheet, and one complete tool/feature hub; light/dark/black, 320/390/430 plus keyboard. Keep UX-contract behavior and non-glass fallback, inspect interaction; user aesthetic signoff before marking visually accepted. Rejected PR30 is not a starting design to polish.

**AN03 — desktop 12 points:** do not award accepted concept/proof credit for sidebar hover/focus. Require a composition-level new experience on real `Sidebar`, `ChatView`, `Composer`, contextual headers and one sophisticated workspace: full 1280/1440 workspace (welcome and rich actual conversation), selection/route controls, keyboard/search, dense tool/Canvas/Compare surface, command/popup and settings. Confirm every control remains accessible and the difference is visible without a changelog.

**AN08 — release 12 points:** required explicit aesthetic review before merge into `main` of **substantial visual changes**. Preview may be deployed from isolated, verified experiment branches only with proof that Firebase Hosting production and shared environments are untouched. If preview isolation cannot be verified, provide real screenshot and recording evidence instead. Physical iPhone claims remain unverified unless actual hardware evidence exists.

### Conflict and precedence log

1. **User's new visual ambition vs historic `DESIGN.md` language protecting the original phone welcome/composer geometry:** preserve the **functional behavior, visible product capabilities, safe areas, input, keyboard and accessibility**. Consider new visual layout on *review-only branches*. Any legacy *approved* fixed geometry cannot be silently discarded; design proposal + explicit user's visual approval resolves it. This is an **open creative-compatibility decision**, not license to ship an unapproved change.
2. **Product document zoom preference vs `src/main.tsx` touch/gesture cancellation:** source wins as implemented behavior, not as acceptance proof. Reproduce accessibility/gesture conflicts and resolve in a dedicated tested patch; do not silently remove sheet navigation or pinch zoom.
3. **Progressive release vs user approval gate:** docs, research and unrelated independently safe fixes may merge under existing authorization. Any *substantial design changes* require preview/real-app visual review and explicit user aesthetic approval **before production main merge and deploy**. Required CI alone is not approval. No undocumented exception.
4. **Prior conservative design proposal vs newly approved Renaissance:** PR28 and PR30 are specifically rejected and **closed unmerged**. Research/prototype on new isolated branches; any independently valuable tiny defect fixes belong to separate safe PRs and do not count as flagship Renaissance delivery.
5. **Absolute-best aspiration vs verifiable engineering:** pursue top practical standards but never claim future-proof perfection or skip security/privacy/performance for visuals. Security, data integrity, existing approved features and explicit user approval prevail. Record unresolved conflicts in this plan and handoff.

### Immediate next actions / stage gates

1. **Governance checkpoint:** exact full directives, `AGENTS.md`, root `PROJECT_CONTINUUM.md`/`DESIGN.md` additive pointers, design research, plan/handoff committed in a docs-only PR; verify file integrity and 100-point math. May merge docs-only as a safe continuum milestone (not a design deployment).
2. **Implementation checkpoint:** branch separately from latest main (not rejected PR30); build a **substantial real-component iOS transformation** plus a contrasting composition alternative; capture welcome + populated conversation + composer + sheets/hub, assess 320/390/430, tests + artifact.
3. **Desktop checkpoint:** build a comparably substantial desktop workspace, actual tool workspace and populated conversation on a separate safe branch; inspect before/after and functional parity.
4. **Visual acceptance checkpoint:** show full-resolution real app screens and, if safe, isolated preview; record explicit aesthetic decision. If rejected, redesign composition, not cosmetic tweaked margins. **No production visual merge before approval.**
5. Update plan/handoff after every meaningful verified milestone, preserve SHA, tests, screenshots and recovery instructions. Continue into AN04–AN08 only when their dependencies/approval allow.


## Active isolated Renaissance composition exploration — 2026-10-19 (unverified)

**Branch:** `design/renaissance-flagship-compositions`, starting from merged directive checkpoint `main eedf37df07bd1d63ce49525687e3641a4e74924d`. **PR:** #32 **draft, not accepted or released**. Existing user-approved directives remain authoritative, but no visual treatment on this branch has user acceptance.

**Two distinct full-screen hypotheses currently implemented in actual app CSS/React layout** (temporary, query-scoped, not production): `?renaissance=atelier` and `?renaissance=workbench`; no parameter leaves the baseline untouched. Atelier explores desktop inset paper stage + deep ink navigation and iPhone horizontal Eclipse/greeting lockup; Workbench explores more command-dense edge-to-edge desktop and iPhone bottom-weighted writing. They are **not** the rejected minor-opacity PR #30 experiments. Both are early working hypotheses; they may be revised/discarded after screenshots. Real components retain navigation, Model Picker, Add menu, chat history, rich messages and Library.

**Code:** `src/design-renaissance-exploration.css` and opt-in class in `src/main.tsx`; `tests/e2e/helpers/renaissance-shots.cjs` renders real app seeded synthetic fixtures at 320 light, 390 dark, 430 black, 1280 light, 1440 dark across current/Atelier/Workbench and six surface states; CI branch-only screenshot job appends to `.github/workflows/tests.yml`. No new npm dependency or API provider traffic. Demo file is **temporary** and must not become a permanent accumulated override layer.

**Status as of this checkpoint:** code authored and pushed, GitHub Actions run **39279893692** accepted but **queued** (no verified passing build, typecheck or screenshots at time of recording). **AN00–AN08 weighted fractions unchanged; earned 7.5/100.** AN01 concept exploration = implemented but unverified. AN02/AN03 are *not* earned, approved or complete. No production/preview deployed; source main unchanged by PR #32. Old baseline WebKit evidence remains source/provenance-limited. Investigate queued CI rather than silently reporting it as passing.

**Next exact gate:** obtain and inspect CI WebKit screenshot artifact and tests, compare each full-screen alternate against current Lumen and complex workspaces, inspect native/iOS fallback behavior and horizontal overflow. Reject/revise anything generic, inaccessible, cramped or less capable. Only then offer actual-app evidence for explicit user visual review. Do not merge PR #32 into main or deploy substantial visual changes to production absent the user's approval. Sync this plan/handoff after the next confirmed milestone.
