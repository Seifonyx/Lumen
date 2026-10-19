# Lumen Adaptive Native — independent implementation ledger

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
