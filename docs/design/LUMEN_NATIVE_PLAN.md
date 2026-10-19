# Lumen Native — design-overhaul execution plan (v1 proposal)

**Status:** approved direction ("Refined Lumen Native"), visual concept pending review. **Branch:** `design/lumen-native-concepts-v1`. **Base:** production-source `main` at `bb78ed6ac3591491eece1a1a268a2090827f016f` (PR27 docs-only main). **Release:** none; specification and static concept only.

## Authorization and project boundary

On 2026-10-19 the user chose **Refined Lumen Native**, described as a clean, minimal, premium design with restrained glass, excellent typography and native-feeling behavior. This authorizes a visual specification and initial concept exploration **but not a wholesale redesign release before visual approval**. Preserve `DESIGN.md` and its Eclipse mark/lime signal identity, `PRODUCT.md`, `UX-CONTRACT.md`, privacy controls, user preferences, feature behavior and original Model Picker master requirements.

Treat **PROJECT_CONTINUUM.md v2.0** and the progressive verified deployment policy as continuing engineering *process* for this new independent design project. Do **not** add its scope or weights to the Model Picker overhaul: the last Model Picker progress checkpoint remains **98.5% medium confidence**, with its separate hosted acceptance gate intact. This document is the distinct Lumen Native progress ledger, replacing no existing one.

## Scope and non-goals

In: app shell, sidebar, chat/welcome/composer/message presentation, common controls, navigation, surfaces and themes, desktop/tablet/phone layouts, feature hubs (Tools, Library, Projects, Study), Canvas/Compare, Settings/Model Picker, accessibility and motion quality. Preserve all existing affordances: BYOK/provider opt-in, draft and account isolation, data persistence, consent/fallback selection, project contexts, attachment flows, native phone composer geometry and incognito. Do not add new AI requests, inferred billing, third-party visual dependencies or a new CSS framework merely for appearance.

Out: provider/routing refactors, removing features, rewriting gesture infrastructure without a demonstrated need, cloning another app's exact UI, fake iOS device certification, or claiming production before the final hosted acceptance. Open questions such as native pinch zoom must be settled with accessibility/real-browser evidence, not by changing core behavior in a speculative visual PR.

## Baseline findings from repository (source-only audit)

- `DESIGN.md` documents **Switchboard**, Geist, cool neutrals, lime `--signal` for *live* states only, three themes and a distinct Eclipse logo. Keep the brand; Refined Lumen Native is an evolutionary art direction, not a reset.
- Runtime entry `src/main.tsx` imports **`src/app.css` and `src/glass.css`**. `src/app.css` contains the main layered rules and Identity tokens; `src/glass.css` is device-conditional via `src/lib/glass.ts`, with slow-frame fallback and reduced-transparency protections. Some prose in `PRODUCT.md` still mentions `workspace.css`/`design.css`, which are **not loaded by current `src/main.tsx`**. Confirm any historical references before editing docs.
- Key real components: `App.tsx`, `Sidebar.tsx`, `ChatView.tsx`, `Composer.tsx`, `MessageThread.tsx`, `HubPage.tsx`, `CollectionPage.tsx`, `ProjectsPage.tsx`, `ToolsPage.tsx`, `SettingsModal.tsx`, `ModelPicker.tsx`. Prefer component/slot/token changes rather than duplicating navigation or data owners.
- Native-feeling iOS treatment exists, including bottom sheet/tab gestures and press states; do not add global backdrop blur or perpetual motion. `src/lib/glass.ts` gates device capability/performance.
- **Potential product/accessibility discrepancy**: `PRODUCT.md` calls for native pinch zoom while `src/main.tsx` prevents Safari `gesturestart`/`gesturechange`; `src/app.css` limits gesture touch actions. Audit the actual user experience and WCAG implications before deciding a safe compatibility fix. Do not silently change touch interactions in concept work.
- Baseline screenshot/visual/a11y coverage already exists in `tests/e2e`, including helpers and Chromium/WebKit workflows, but **this planning session did not execute the existing app or capture live baseline screenshots**. Source-derived design diagnosis is not direct visual observation.

## Stable weighted scope — design v1 (100 points)

Use the Project Continuum fractions 0 / 0.25 / 0.5 / 0.75 / 1 (0 = no accepted output; 0.25 = evidenced independently useful subdeliverable; 0.5 = implementation or concepts with partial verification; 0.75 = locally tested + reviewed pending final CI/live/approval; 1 = all applicable acceptance criteria satisfied). Do not award implementation credit for static mockups.

| ID | Phase | Weight | Earned fraction | Earned work | Acceptance |
|---|---|---:|---:|---:|---|
| LN00 | Source + rendered baseline audit | 10 | 0.25 | 2.5 | Map source, screenshots light/dark/black at desktop 1440, tablet 768, phone 390/375/320; keyboard/motion/contrast/overflow findings |
| LN01 | Visual direction and concepts | 15 | 0.5 | 7.5 | User-approved desktop + phone concepts for welcome, active chat and at least one feature hub; inspect candidate concepts on both platforms |
| LN02 | Tokens/components | 15 | 0 | 0 | Unified documented semantic visual tokens and shared primitives applied, snapshots and theme checks |
| LN03 | Chat shell, composer and conversation | 25 | 0 | 0 | Responsive chat/new chat, sidebar, top bar, composer, messages, scroll, keyboard, routing status; behavior tests |
| LN04 | Feature workspaces | 15 | 0 | 0 | HubPage, Tools, Projects, Library, Study, Canvas, Compare surfaces consistently styled, tested |
| LN05 | Settings and detailed interactions | 10 | 0 | 0 | Models, keys, layouts, dialogs, sheets, errors, empty/loading/success states, focus semantics |
| LN06 | Cross-platform acceptance and progressive release | 10 | 0 | 0 | Full required CI, baseline snapshot comparison, keyboard/axe, motion, 3 themes, exact main/Deploy SHA, hosted acceptance, rollback |
| **Total** | | **100** | | **10** | |

**Current earned:** **10/100 = 10%**, low-to-medium confidence because screenshot baseline and visual user approval remain unverified. This is *design project progress only*. Previous design checkpoint: none. The +10 comes from actual code/document audit (LN00 partial) plus a detailed concept/specification package (LN01 partial); no production feature changes. Calculate from the unchanged table on every handoff.

## Milestone ordering and release policy

1. **Concept branch, no production code:** create `docs/design/LUMEN_NATIVE_SPEC.md`, `docs/design/LUMEN_NATIVE_CONCEPTS.md`, this plan, plus a self-contained nonfunctional concept HTML. Explicitly distinguish suggested tokens from active CSS. Seek design review/approval before changing runtime UI. Merge docs-only PR after acceptance if desired.
2. **Rendered baseline:** run existing screenshot helpers against current main for representative routes and all three themes, at desktop/phone widths, keyboard open/closed and an iOS-like/Android-like browser profile where supported. Check contrast, native zoom, RTL, reduced motion, legibility and touch targets; record actual images/diffs.
3. **Token & control foundation:** implement semantic tokens in a small isolated branch, preserving existing `--signal` meaning, all theme variants, and glass fallback; migrate primitives in reviewable groups. Require screenshots/a11y regression evidence.
4. **Core chat-first experience:** desktop and mobile sidebar/welcome/chat/composer/message shells, with interactions untouched and existing accessibility/motion policies respected. Stop if JS/click/focus/scroll logic changes inadvertently.
5. **Related feature hubs and complex screens:** HubPage, Projects, Library, Tools, Study, Canvas, Compare, Settings/Model Picker; independently releasable groups when tests and UX acceptance permit.
6. **Cross-browser hardening and shipping:** full CI, mobile 320/375/390/768, desktop 1024/1440, light/dark/black, forced glass, reduced motion/transparency, keyboard and synthetic-data security regression. Safely merge, deploy exact commit with existing manual Deploy workflow, verify published assets and hosted core behavior, preserve rollback SHA.

## Definition of done for *every* UI milestone

- No lost navigation paths, selectors, pressed buttons, drafts, attachments, keyboard actions, focus restoration, quota badges, privacy/billing disclosure or project context.
- No horizontal page scroll at 320px; text reflows at 200% zoom; all required pointer targets 44px on touch surfaces; color contrast meets WCAG AA for readable content and meaningful non-text UI; visible focus; labeled controls.
- Restful movement: 140–220ms routine fades/moves (illustrative, tunable on test), only restrained shared springs, `prefers-reduced-motion` static variant, no blur on full-screen body or under dense text; avoid FPS cost over the existing adaptive glass path.
- Representative desktop/phone screenshots peer-reviewed against approved concepts; regression check captures before/after pairs. Browser tests that pass do not by themselves prove premium aesthetics.
- Typecheck, build, focused e2e, and full PR Chromium + WebKit CI must succeed on the actual intended revision. User explicitly approves new visual treatment before merging substantial changes. Release/rollback via existing audited workflow, never force-push or bypass protections.

## Exact handoff for another agent

Start from this file, `docs/design/LUMEN_NATIVE_SPEC.md`, `docs/design/LUMEN_NATIVE_CONCEPTS.md`, `DESIGN.md`, `PRODUCT.md`, `UX-CONTRACT.md`, `PROJECT_CONTINUUM.md`, current `main`, `src/app.css`, `src/glass.css` and component owners. At this checkpoint only static design artifacts were authored; no app code or CSS runtime changed, no tests run, no deployment requested. **Next task is render-first baseline and user visual concept review**, then make a narrowly scoped first runtime milestone. Preserve Model Picker's separate 98.5% ledger.
