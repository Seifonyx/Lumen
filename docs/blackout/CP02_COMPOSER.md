# CP02 — Canvas composer and writing sheet (flagged, off in production)

**22 October 2026.** Owner authorized two QA-only fixes and **CP02 only**, under the [integration blueprint](CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md) and its approval gates.

**Status:**
- Implemented and verified in Chromium and Linux WebKit; physical iPhone confirmation is **pending** (list below).
- **Not authorized:** CP03, merge, deployment, default production migration, Gate 2 approval, any paid service and a new Codespace.
- Blackout progress is unchanged at **21.5%, Medium confidence**: CP02 is an unweighted child milestone, and its device acceptance is open.

Code commit `e0196eb`, tests `ea3954c`. The evidence below was produced from the audited review build `ea3954c…-0-1`.

## What changed

| File | Role |
|---|---|
| `src/components/ComposerCanvas.tsx` | `useCanvasComposer` (details below) |
| `src/components/Composer.tsx` | Nine flagged seams (details below) |
| `src/lib/canvas-presentation.ts` | `export const CANVAS_COMPOSER = false;` — the single switch, compile-time |
| `src/styles/canvas-composer.css` | Canvas composer and sheet styles (details below) |
| `qa/iphone/adapters/canvas-presentation.ts` + `vite.qa.config.ts` | The synthetic review build replaces the flag with `true` and loads `canvas.css` + `canvas-composer.css` |
| `qa/iphone/qa.css` | The phone sheet starts below the review banner (`--canvas-sheet-offset-top`) |

**`useCanvasComposer`** holds a typed presentation state, `resting | engaged | expanded`:
- **engaged** = focus inside the form, text or attachments;
- **expanded** = explicit.

It reuses existing hooks:
- **`useFocusScope`** — nested focus ownership, Escape and Tab;
- **`useSheetDrag`** — cancellation- and velocity-aware swipe-down, phone widths only, from the header;
- **`viewport.ts`** — `kb-open` / `--vv-*` sizing with the keyboard.

Behaviour across states:
- Selection, direction, scroll and focus are saved on toggle and restored after.
- Expanded state resets when the account or chat changes.
- The resting height is held so the conversation does not move.

**`Composer.tsx` seams** — each folds to the exact ordinary expression:
- 3 prop spreads on the wrap, form and textarea;
- 3 ternaries: header + ChecksBar, meter + expand, scrim + VoiceMode;
- the hook call;
- an IME-safe Escape;
- collapse after sending.

Draft, attachments, tools, privacy checks, dispatch, Send/Stop, the model picker slot and the usage meter slot are untouched. There is no copied textarea, parallel text store or click delegation.

**`canvas-composer.css`** ports the approved Canvas proof's composer and sheet rules:
- **Scope:** everything sits under `.composer-wrap[data-lumen-canvas-composer]`, driven by `data-composer-state` rather than `:has()` or root flags.
- **Tokens:** from CP01 `canvas.css`.
- **Accessibility variants:** reduced-motion and reduced-transparency.
- **Shared-class overrides:** the header neutralises the production `.sheet-grab` bar style. It keeps the class so the existing drag hook treats it as a handle. The usage ring sits in the row instead of the box corner.

### Production stays unchanged

Rolldown folds the `false` constant and removes every guarded branch. The Canvas module, its icon and its strings never reach the ordinary output. One detail: an imported lucide icon survived tree-shaking, so the expand icon is inline SVG.

Verified:
- the ordinary build is **byte-identical to the pre-QA01 baseline (174 files)** in both the QA01 isolation audit and the CP01 graph check;
- CP02 sentinels are absent: `data-lumen-canvas-composer`, `data-composer-state`, `canvas-sheet-head`, `canvas-writing-scrim`, `Expand writing`, `canvas-writing-title`.

**Rollback:** keep the flag `false`, which is the current state. Or revert `e0196eb`: there are no data, storage or draft changes.

## Decisions for owner review (no redesign)

- **Send from the sheet collapses it** back to the conversation; Stop stays in the composer. The proof left the sheet open.
- **Desktop composer stays in the page flow.** It gets the floating glass capsule but does not overlay the reading column; that is reading-surface work for CP03.
- **Usage control is the canonical `UsageMeter`, unchanged.** The draft estimate ("N words · ~T tokens") is shown in the sheet header. The proof's context-token chip wording is CP04, per the blueprint.
- **At rest, expand and dictation are hidden** as in the proof; they appear while writing. Desktop focuses the message box on load, so it opens "engaged".
- **The review banner is dimmed (still visible) under the scrim** while the sheet is open.

## Verification (22 October 2026)

| Check | Result |
|---|---|
| `npm test` | Pass; typecheck plus all unit files, including the new `tests/unit/canvas-composer.test.mjs` (details below) |
| `tests/security/private-qa-canvas-composer.mjs`, Chromium | **Pass** at 1440×960 (15 checks) and 390×844, 320×568, 390×480 (17 each) |
| Same, Linux WebKit (Docker) | **Pass**: 15/16/16/16 checks. Touch drag is Chromium-only |
| `private-qa-browser.mjs` on the Canvas-on build | **Pass** in both engines: banner gap 0, draft/picker/usage/Send/Stop, namespaces, revocation, expiry, planted negatives, axe |
| `private-qa-codespace-browser.mjs` | **Pass** in both engines |
| `private-qa-isolation.mjs` | **8/8**, with the guard deliberately updated (details below) |
| `canvas-build-isolation.mjs` (CP01) | **Pass**: 2558 modules, 174 hashes equal to baseline, 7 negative controls, CP02 sentinels absent |

**`canvas-composer.test.mjs` asserts that:**
- the flag is off;
- only the QA build replaces it;
- the styles are scoped and load nothing;
- every flagged branch's alternative equals the ordinary expression.

**`private-qa-canvas-composer.mjs` covers:**
- the same mounted textarea across every state;
- selection and direction kept on expand and on collapse;
- one native undo history across expand and collapse;
- IME: a composing Escape does not collapse;
- nested model picker and usage dialogs own Escape first;
- Tab stays in the sheet;
- an attachment picked inside the sheet;
- Send collapses the sheet and Stop works;
- the draft is stored per account and chat and survives reload;
- a chat switch collapses the sheet and keeps per-chat drafts;
- Incognito stores nothing;
- the sheet sits below the banner and inside the viewport, with no overflow;
- with a simulated keyboard, the sheet fits above it;
- touch drag (Chromium): a short drag springs back, a cancelled drag restores, a flick dismisses and leaves no transform;
- a second reviewer is isolated;
- reduced motion: no animations;
- axe (WCAG 2.1 AA) on the expanded sheet;
- zero external requests, CSP violations or page errors.

**Isolation audit guard:** exactly the four CP02 `src` files may differ from `88c7baa`, and only with the flag still `false`. Production byte equality is still enforced.

Evidence: [desktop states](cp02/desktop-1440-states.png), [phone states](cp02/phone-states.png), per-engine screenshots and `cp02-results.json` in [cp02/chromium](cp02/chromium) and [cp02/webkit](cp02/webkit).

**Test-tooling note:** in WebKit, every Playwright screenshot inserts its own inline `<style>`, which the review CSP correctly refuses. The test records these separately as `screenshotToolingCsp`, and any other report fails the run. Without screenshots, there are zero.

**Undo granularity differs by engine:** Chromium undid the typed word one key per step (5 steps); WebKit undid it in 1. Both restore the pre-typing draft.

## Requires physical iPhone confirmation

Linux engines and simulation cannot prove these. They block promotion and must not be deferred.

1. **Keyboard with the sheet:**
   - opening "Expand writing" with the keyboard up;
   - the sheet sits above the real keyboard and does not jump during the keyboard animation;
   - the caret stays visible while typing long text.
2. **Swipe-down on the header:**
   - a slow short drag springs back;
   - a flick dismisses;
   - a drag interrupted by a system gesture or notification restores;
   - scrolling long text inside the sheet does not move the sheet.
3. **Glass and blur:**
   - the resting/engaged capsule over content;
   - the opaque sheet with no black flash on open, close or drag;
   - the scrim with no blur artefacts.
4. **IME and undo:**
   - Japanese/Chinese composition and dictation in the sheet;
   - shake-to-undo or three-finger undo across expand and collapse;
   - selection handles kept.
5. **VoiceOver:**
   - "Expand writing" is announced;
   - the sheet is announced as a dialog named after the chat title, with focus inside;
   - Done collapses and returns focus to the message box;
   - the background is not reachable.
6. **Safe areas and rotation:**
   - notch and home indicator in portrait and landscape;
   - the sheet starts below the review banner and the top bar.
7. **Nested controls from inside the sheet:**
   - model picker sheet, usage sheet, + attach sheet, photo/file picker;
   - each closes back to the sheet.
8. **Send/Stop from the sheet** on the synthetic transport: it collapses, and Stop works.

**Device route:** the existing private Codespaces route ([session guide](QA02_CODESPACES_SESSION.md)) now serves this Canvas composer automatically. That needs a **new Codespace, which only the owner may create after review**.
