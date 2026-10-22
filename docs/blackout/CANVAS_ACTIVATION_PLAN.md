# Canvas production activation and rollback plan

**Status: a plan for future review. Nothing is activated.** Production output stays byte-identical to the baseline, and the Canvas flags are off in the ordinary build. Each step below needs the owner's explicit authorization, which has not been given: Gate 3, merge, activation, deployment and any public exposure. Budget: $0. The steps use only the existing Firebase Hosting site and the manual GitHub `deploy.yml` workflow.

## What activation is

The Canvas presentation (CP02 composer, CP03 shell, CP04 Routing Center and CP05 screens) is wired through one switch module, `src/lib/canvas-presentation.ts`. Today the ordinary build gets `false`, `false` and `null`. The QA review build swaps in `qa/iphone/adapters/canvas-presentation.ts`, which turns everything on and loads the five Canvas stylesheets.

Activation would be **one small, reviewable commit**:

1. In `src/lib/canvas-presentation.ts`:
   - set `CANVAS_COMPOSER = true` and `CANVAS_SHELL = true`;
   - set `RoutingCenter = lazy(() => import('../components/RoutingCenter'))`;
   - import `canvas.css`, `canvas-composer.css`, `canvas-shell.css`, `canvas-routing.css` and `canvas-screens.css`, the same way the QA adapter does.
2. Retire the QA replacement for this module in `vite.qa.config.ts`, so QA and production run the same switch.
3. Turn the guards around:
   - `tests/unit/canvas-composer.test.mjs` asserts the flags are **on**.
   - `tests/security/private-qa-isolation.mjs` and `canvas-build-isolation.mjs` stop requiring Canvas to be absent. They keep the account, privacy and network checks, and keep the scoping checks.
   - Regenerate the baseline used by the byte-identity check.

Data, storage keys, providers, routing, permissions and drafts are untouched. There is no schema change and no migration. Turning it on and turning it off are both pure presentation changes.

**Cost:** about 68 KB of CSS before compression, roughly 12 KB gzip, added to the main stylesheet. The Routing Center loads as a lazy chunk, only when opened. Measure first load against the current build before release.

## Before activation (checklist)

- [ ] **Gate 3:** the owner's final aesthetic review of the integrated whole (desktop and iPhone), plus the open items in `CANVAS_REFINEMENT_BACKLOG.md` they want fixed first.
- [ ] **Physical iPhone and VoiceOver pass** on the activated build, served through the private Codespace review (port stays Private):
  - composer and writing sheet, keyboard and safe areas;
  - navigation drawer and swipes;
  - Routing Center;
  - Settings, and the text-size setting;
  - Study, Assistants, Compare, document Canvas;
  - light, dark and true black.
- [ ] **Full suites green at the exact activation head:**
  - `npm test`;
  - the CI e2e suites;
  - CP02 to CP05 contracts in Chromium and WebKit;
  - QA browser and isolation contracts;
  - the Safari check workflow.
- [ ] **Account isolation re-checked with two accounts:** drafts, chats, projects, keys, and the Routing Center closing when the account changes.
- [ ] **Performance:** first-load CSS and JS size and time-to-composer compared with the current production build; no regression beyond the CSS cost above.
- [ ] **Merge** through the protected workflow with exact-head CI; the merge SHA is recorded.

## Activation (when authorized)

1. **Record the current live release first:** the Firebase Hosting version name for `lumen-chat` (Hosting → Release history) and the commit it was built from. This is the rollback target.
2. Merge the activation commit, then run the manual **Deploy** workflow (`.github/workflows/deploy.yml`) from the merged SHA.
3. **Live smoke check:**
   - sign in, draft a message, reload, and confirm the draft is kept;
   - open the model picker and the Routing Center, then "Use model", and confirm the confirmation and the draft;
   - open Settings, then the theme setting (light, dark, true black);
   - open a project from its brief;
   - send and stop one synthetic message, on the owner's account only;
   - repeat on the iPhone.
4. Record the deployed version, its SHA and the smoke-check results in the live checkpoint, kept separate from the merge record.

## Rollback

Presentation only, so rollback never touches user data.

| Situation | Action | Time |
|---|---|---|
| Visual or interaction problem found live | **Firebase Hosting rollback** to the recorded previous version: Console → Hosting → Release history → Rollback, or re-release that version through the Hosting API. No rebuild needed. | Minutes |
| Then, in the repository | Revert the activation commit with a normal reviewed `git revert` (no force push), so `main` matches what is live. Rerun `npm test` and the byte-identity check against the old baseline. | Same day |
| Problem limited to one area (for example, the Routing Center) | Revert only the matching switch: set `RoutingCenter = null`, or `CANVAS_COMPOSER = false`. The switches were designed to be independent, but only the all-on and all-off combinations are tested today. Test the partial combination before relying on it. Redeploy through the workflow. | One deploy |
| **Severe issue:** an account or privacy leak, an unauthorized send, a broken Stop, or a lost draft | **Roll back at once** (first row), stop all further rollout, and investigate before anything else. A rollback cannot undo requests already sent, so these are blocked before release by the contracts above. | Immediate |

**After any rollback, verify:**
- the live asset hashes match the recorded version;
- sign-in still works;
- drafts and chats are intact for two accounts;
- the model picker works and one Send/Stop works.

Record the event in the live checkpoint.

## What stays in place until rollback is proven

- The ordinary presentation code path: the alternative branch of every flagged ternary, and `Sidebar`'s ordinary tree.
- The QA adapter.

Both stay until the activated build has been live and stable and the owner approves removing them. Two competing permanent shells are not kept beyond that.
