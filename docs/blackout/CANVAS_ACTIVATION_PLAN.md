# Canvas production activation and rollback plan

## Readiness review — 22 October 2026, after Gate 3

**Verdict: the design is ready, but the release path isn't yet.** Canvas has been verified only in the synthetic QA build. Lumen's CI has never run the Canvas presentation, and about two thirds of its e2e suites target the ordinary sidebar markup that activation replaces. Activation needs its own small, curated branch with a CI path for Canvas. It does not need more design work.

### Evidence reused (not re-run)
- CP02–CP05, Routing Center and QA browser contracts pass in Chromium and Linux WebKit at `c3b59d8`. QA01 isolation is 8/8. The ordinary production build is byte-identical to `main` `655438f`. `npm test` passes.
- The owner reviewed the QA build on a physical iPhone ("all looks good") and approved Gate 3.
- Exact-head GitHub CI at `eec9f68` (run 39803389600): type/build/unit passed. The WebKit job was cancelled twice in a row (here and at `fa44efe`) while `playwright install --with-deps webkit` hung past the job's 15-minute limit. That step took 30 s in the last green run (`b487eb1`, run 39775999964), so the hang is infrastructure, not a test failure. Neither CI job exercises Canvas.

### Release blockers, by severity
1. **CI never runs the Canvas presentation.** `tests.yml` builds the ordinary app, with the flags off. The CP02–CP05 contracts, QA isolation and byte-identity checks run only locally. A green PR therefore says nothing about Canvas.
2. **The existing e2e suites assume the ordinary shell.** By selector count, about 66 of 104 `tests/e2e` files reference ordinary-sidebar markup that `SidebarCanvas` doesn't render: `.chat-row`, `.sidebar-foot`, `.chat-list` and `.chat-open`. This is an estimate from source, not a run. Flipping the constants would break them, or would leave CI testing code that is no longer shipped. That includes the Firebase-emulator suites (`account-isolation`, `account-sync`, key and layout resilience), the only tests of account isolation against real auth.
3. **Account isolation, drafts and Send/Stop are verified for Canvas only with synthetic adapters.** No Canvas-mode run has used real Firebase auth (emulators). Two-account switching with the Canvas sidebar and Routing Center open has never run under emulators.
4. **PR #34 can't be merged as it stands.** It holds 709 files and 84 commits, mostly exploratory docs and proofs (641 files under `docs/blackout`), plus the paused Cloudflare passkey work (`server/private-qa`). Its own description says not to merge it wholesale.
5. **WebKit CI is unreliable at the install step.** Two consecutive cancellations. A protected merge needs a green exact-head WebKit job.
6. **Not yet verified on a physical device:** VoiceOver, an external or Bluetooth keyboard, IME and dictation, and the activated production build (as opposed to the QA build) on iPhone. The owner's review covered the QA build visually and interactively.

Not blockers: performance looks modest. The Canvas CSS is 70 KB of source, about 12–15 KB gzipped, against 61 KB gzipped of production CSS today. The Routing Center loads as a lazy chunk of about 6 KB gzipped. Measure both on the real activated build anyway.

### Corrections to this plan
- **"Merge the activation commit"** has to come from a new branch off `main`, not from PR #34. It carries only the runtime and test files: `src/` changes (5 Canvas stylesheets, `SidebarCanvas`, `ComposerCanvas`, `RoutingCenter`, `routing-center.ts`, flagged edits in `App`, `Sidebar`, `ChatView`, `Composer`), the contracts, and the QA harness the owner's iPhone review depends on (`qa/`, `scripts/qa/`, `vite.qa.config.ts`). It leaves out the proofs, the research docs and `server/private-qa`.
- **"Turn the guards around"** understates the test work. Either the ~66 suites get ported, or the switch becomes build-selectable (below) so they keep guarding the rollback path while Canvas gets its own CI.
- **The Hosting rollback "in minutes"** is true on the server only. Lumen's service worker never skips waiting on its own. Installed and open apps (iPhone home-screen PWAs in particular) keep running the cached Canvas build until they find the new worker (on return to the foreground, or every 30 minutes) and the user taps Reload. Plan for a tail of minutes to hours, not a single moment.
- **`deploy.yml` also updates the `dev` preview channel** (site `model-router`, 30-day expiry) from the same build. Deploying Canvas live also publishes it at the preview address. Fine, but it should be stated in the authorization.
- **The live smoke "send and stop one message on the owner's account"** is real inference on the owner's key. Keep it to one message, inside any free allowance.
- **Partial rollback** (one switch off) is untested, as the plan already says. Keep it out of the release sequence until it has a test.
- **The "Safari check workflow"** (`safari-check.yml`) is manual dispatch. Name who runs it and at which SHA.

### Smallest safe activation implementation
1. **Branch `release/canvas-activation` from `main`.** Bring over only the runtime, test and QA-harness files listed above, with the docs kept to a short release note.
2. **Make the switch build-selectable.** `src/lib/canvas-presentation.ts` reads one build-time constant, for example `import.meta.env.VITE_LUMEN_CANVAS === '1'`, which Vite inlines so dead branches still fold away. With it on, the module imports the five stylesheets and lazy-loads `RoutingCenter`, as the QA adapter does now. The QA adapter then only sets the same constant (or is retired), so QA and production share one switch. Production builds set it to `1` in `deploy.yml`. The ordinary build remains reproducible with it off, and that is the rollback build.
3. **CI** (`tests.yml`):
   - Keep the existing jobs on the off build. They guard the rollback path and shared logic.
   - Add a Canvas job: build with the switch on and run the CP02–CP05, Routing Center and QA browser contracts in Chromium and WebKit, plus the isolation and byte-identity checks for the off build.
   - Port a core emulator subset to Canvas mode: account isolation, account sync, key-save and layout-save resilience, drafts, Send/Stop, attachments, model picker and selection policy.
   - Fix WebKit install reliability: cache the Playwright browsers, or use the Playwright container image already used locally (`mcr.microsoft.com/playwright:v1.56.1-noble`), and lift the 15-minute limit.
4. **Unit guard:** `canvas-composer.test.mjs` asserts the switch value per build, not a hard-coded off.
5. **Performance:** record first-load CSS/JS (raw and gzipped) and time-to-composer, on and off, at desktop and 390 px, in Chromium and WebKit. Fail on a regression beyond the Canvas CSS cost.

No data, storage, routing, provider, permission or auth changes. No new services and no spending.

### Remaining acceptance before deployment
- Green exact-head CI on the release branch, including the new Canvas job and WebKit.
- Owner physical-iPhone pass on the **activated** build, through the existing private Codespace (port Private, synthetic data): VoiceOver on the composer, navigation and Routing Center; an external keyboard (Tab, Escape, Enter to send); dictation; light, dark and true black.
- Two-account isolation run in Canvas mode against emulators: drafts, chats, projects, keys, and the Routing Center closing on account change.
- Performance comparison recorded.
- **Rollback rehearsal before going live:** confirm the previous Hosting version is listed under Release history for `lumen-chat` and record its ID. Confirm the off build reproduces today's production bytes.

### Release sequence and owner authorization
| Step | What happens | Owner authorization |
|---|---|---|
| 1. Activation implementation | Create the release branch, make the switch build-selectable, add the CI job, port tests, fix WebKit CI. Open a draft PR. | **Needed:** authorize activation implementation (code on an isolated branch; nothing deployed) |
| 2. Final validation | Green exact-head CI, owner iPhone, VoiceOver and keyboard pass on the activated QA build, perf and isolation evidence. | None beyond step 1; the owner performs the device pass |
| 3. Protected merge | Normal merge of the release PR to `main`, merge SHA recorded. | **Needed:** explicit merge approval |
| 4. Deployment | Record the current live Hosting version, run `deploy.yml` from the merge SHA (this also updates the `dev` preview), live smoke on desktop and iPhone, record the version, SHA and results. | **Needed:** explicit deploy approval, including the one live Send/Stop |
| 5. Stabilization | Watch for issues; roll back by Hosting release if severe. Remove the ordinary shell only after a stable period. | **Needed:** later approval to remove the legacy path |

---


**Status: Gate 3 approved by the owner on 2026-10-22. Nothing is activated; activation, merge and deployment are not authorized.** The readiness review below (same date) corrects this plan where they differ. Production output stays byte-identical to the baseline, and the Canvas flags are off in the ordinary build. Each step below needs the owner's explicit authorization, which has not been given: Gate 3, merge, activation, deployment and any public exposure. Budget: $0. The steps use only the existing Firebase Hosting site and the manual GitHub `deploy.yml` workflow.

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

- [x] **Gate 3:** approved by the owner on 2026-10-22 after physical-iPhone reviews.
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
