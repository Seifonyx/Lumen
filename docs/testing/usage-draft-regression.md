# Usage controls must not submit the composer

20 October 2026, Africa/Cairo. Independently releasable functional fix, with no Blackout visual assets.

With a draft typed in a populated chat, opening Context/Usage could submit it immediately. UsageMeter renders inside the composer form; its trigger and action buttons lacked an explicit button type. Native default submit behavior invoked the composer's sending path alongside the usage action. Phone sheets use a portal, but their trigger remains inside the form.

Five usage controls now declare `type="button"`; their own handlers remain authoritative. Routing, summaries, quotas, permissions and visuals are unchanged.

Regression: `tests/e2e/usage-draft.cjs` uses the normal application entry. It opens usage using pointer and Enter, closes it, and checks draft retention, unchanged message count, zero inference, focus restoration and browser errors at 1440px/390px. All provider requests are intercepted. The existing suite runner automatically discovers this test.

Evidence: before fix, exit 1 on `pointer: opening usage preserves the draft` (actual empty). After fix, Chromium and Linux WebKit both passed at 1440/390. Independent reviewer reran all four cases successfully and found no blocker. `npm test` passed typecheck and 17 unit groups /149 tests; production build passed with the existing ineffective dynamic-import warning for `src/lib/sync.ts`. Exact-head CI/merge/deployment are separate release gates tracked in the handoff; local results do not imply deployment.

Commands: `node tests/e2e/usage-draft.cjs`; repeat with `MR_WEBKIT=1`. Set `MR_TEST_URL` for an owned preview/dev URL (default localhost:5190). This environment uses Node 22 and `/workspace/.lumen-tools/browser-preload.cjs` only to select installed browser binaries.

Manual test: type a distinctive unsent sentence in an existing chat, open and close Context/Usage, then repeat using Enter from the usage button on desktop. The sentence must remain, no new message should appear, and no answer should start. Compact/summarize controls should perform only their explicitly requested operation.
