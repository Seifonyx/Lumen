# Gate1 final verification — consolidated Workspace + Focus

21 October 2026. Verification only: no design, implementation, production or dependency change. **Gate1 NOT APPROVED; no merge or deployment.**

- **Verified source:** branch `docs/lumen-blackout-phase1-20261019`, HEAD **`1d1e0f7e02df4849949bdddbd880e8956fe25bd7`**. That's the quality pass `e20673a` plus its docs. Local, remote and `refs/pull/34/head` all matched, with a clean tree.
- **What this record changes:** a rebuilt portable review and its evidence, plus one optional `BLACKOUT_SOURCE` variable in the review builder. Before that change, the builder always stamped the old base `4ff2ad77`.

## How WebKit was made available

The cloud container has only Chromium, and the network policy blocks Playwright's browser CDN, so `npx playwright install webkit` cannot work. I did not retry it.

The container does have Docker, and the Microsoft Container Registry is reachable. So the matrix ran inside the official image **`mcr.microsoft.com/playwright:v1.56.1-noble`**:
- Digest `sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a`.
- Its Playwright version matches the repository's pinned `playwright@1.56.1`. It ships WebKit build 2215 (WebKit 26.0) and Node 22.20.
- It ran with `--network host`, against the same frozen localhost Vite server (port 5195, `hmr:false`, `watch:null`).

This adds no repository dependency or CI change. Existing CI can't run this matrix:
- GitHub Actions works (Tests and Deploy ran on 20 October), but `tests.yml` ignores `docs/**`, which is everything PR #34 changes.
- `safari-check.yml` is a manual WebKit job for the production screenshot helpers, not these proofs.
- Running the matrix in CI would need new workflow configuration, which was out of scope.

## Results (all at `1d1e0f7`, dark theme, synthetic fixtures)

| Matrix | Engine | Cases | Result | Axe states / violations |
|---|---|---|---|---|
| Consolidated 1440×960, 390×844, 320×844 | WebKit | 3 | **pass** | 53 / 0 |
| Retained Index & Studio 1440×960 and 390×844; Studio 320×844 | WebKit | 5 | **pass** | 88 / 0 |
| Supplementary consolidated 390×480, 320×480 (short height) | WebKit | 2 | **pass** | 36 / 0 |
| Consolidated 1440×960, 390×844, 320×480, 390×480 | Chromium | 4 | **pass** | 71 / 0 |
| Retained Index & Studio 1440×960 and 390×844; Index 320×480; Studio 390×480 | Chromium | 6 | **pass** | 106 / 0 |
| Portable review checker (offline, 16 images, 2 axe scans each) | Chromium + WebKit | 2 | **pass** | 4 / 0 |

- **What every case recorded:** passed status, 0 page errors, 0 document overflow, exactly one intercepted synthetic Send/Stop, and 0 real provider calls. No assertion was weakened; the harnesses are identical to `1d1e0f7`.
- **Regressions:** none.
- **WebKit-only observation:** each WebKit case shows three aborted requests to `apis.google.com/js/api.js` (the Firebase Auth helper). They are blocked locally by the harness, never sent. The same three appear in the committed WebKit evidence from 20 October, so this is pre-existing, not a regression.
- **First-screen reading geometry:**
  - WebKit 390×844: paragraph y256–334, composer top 668, height 176.
  - WebKit 320×844: paragraph y287–365, composer top 652, height 192.
  - WebKit 320×480: paragraph y165–243, composer top 288, height 192 (≤42%).
  - Chromium matches to within 1px.
- **Portable review:** [consolidation-review.html](consolidation-review.html) and [consolidation-evidence.json](consolidation-evidence.json) were rebuilt from these reports (`sourceBase` now `1d1e0f7`). The builder refuses failed or incomplete inputs, and it accepted all 7 consolidated and 11 retained cases. Raw reports, logs and captures are outside Git in `/home/user/.lumen-verification/gate1-final-2026-10-21/`. That container is ephemeral, so the committed evidence JSON and review are the durable record.
- **Latest committed captures:** [quality-pass before/after pairs](quality-pass/), and the 16 frames embedded in the rebuilt review.

## Reproduce in a compatible environment

Any Linux host with Docker and access to `mcr.microsoft.com` works, as does a Mac/Linux machine where `npx playwright install webkit` can download.

```sh
git fetch origin docs/lumen-blackout-phase1-20261019 && git checkout 1d1e0f7e02df4849949bdddbd880e8956fe25bd7
npm ci
# Frozen test server (restart after any source edit):
node --input-type=module -e 'import {createServer} from "vite"; const s=await createServer({server:{host:"0.0.0.0",port:5195,strictPort:true,hmr:false,watch:null}}); await s.listen();' &
IMG=mcr.microsoft.com/playwright:v1.56.1-noble
wk(){ docker run --rm --network host --ipc=host -v "$PWD:$PWD" -w "$PWD" -e MR_WEBKIT=1 -e BLACKOUT_PORT=5195 \
  -e BLACKOUT_WIDTH=$2 -e BLACKOUT_HEIGHT=$3 -e BLACKOUT_DIRECTION=${4:-index} -e BLACKOUT_OUTPUT=$PWD/.verify/$1-$4-$2x$3 \
  $IMG node docs/blackout/workspace-proofs/$1; }
wk consolidation-check.cjs 1440 960; wk consolidation-check.cjs 390 844; wk consolidation-check.cjs 320 844
for d in index studio; do wk flagship-check.cjs 1440 960 $d; wk flagship-check.cjs 390 844 $d; done
wk flagship-check.cjs 320 844 studio
```

Without Docker, use `MR_WEBKIT=1 BLACKOUT_PORT=5195 … node docs/blackout/workspace-proofs/<check>.cjs` after `npx playwright install --with-deps webkit`. The Chromium cases are the same commands without `MR_WEBKIT`, run on the host.

To rebuild the review, put all 18 reports in the layout `build-consolidation-review.cjs` reads (root, `short/`, `retained/`). Then run `BLACKOUT_OUTPUT=<dir> BLACKOUT_SOURCE=<sha> node docs/blackout/workspace-proofs/build-consolidation-review.cjs`, then `check-consolidation-review.cjs` (and again with `MR_WEBKIT=1`).

## Physical-iPhone manual checklist

**Precondition (currently blocking):** the guarded preview renders only when the page's hostname is `localhost` (`bootstrap.ts` line 23). An iPhone opening the dev server over the network sees "Design proofs run only on localhost…", so this checklist cannot be run on a physical device as-is.
- The iOS Simulator on a Mac can open `http://localhost:5195/...`, but it is not a physical device.
- Running on hardware needs an owner-approved, test-only host allowance, for example one explicit private hostname. That change is not made here.

Use a fresh Safari profile and the synthetic fixture (`/docs/blackout/workspace-proofs/?proposal=consolidated&fixture=1`), never real credentials. Test in portrait, and also landscape where noted, on a notched iPhone with the latest iOS. Record the device, iOS and Safari versions for each item.

1. **First screen:** on load, the first answer paragraph is visible above the composer; the composer is under about 42% of the screen. Safari's toolbar collapsing on scroll doesn't hide the answer or the composer.
2. **Navigation:**
   - ☰ opens history; search, Projects, Library and Tools are reachable; closing it returns to the same scroll position.
   - Compose ✎ starts a new conversation.
   - The route icon opens Routing Center, and "← Workspace" returns.
   - ⓘ opens Conversation intelligence, and it closes by swipe or by its own control.
   - Each icon's meaning is clear without guessing; note any that aren't.
3. **Mode identity:** the toolbar reads "Workspace" while reading, "Focus" in expanded writing and "Routing" in Routing Center. No state shows the wrong name.
4. **Workspace → Focus → Workspace:**
   - Type a multi-paragraph draft, select a phrase, tap expand, then collapse.
   - The draft text, cursor and selection are unchanged, and the response returns to its previous scroll position.
   - Repeat with an external keyboard and Escape, if available.
5. **Keyboard:**
   - With the keyboard open, the composer stays above it, and the text and actions (Send, model, usage) remain visible and tappable.
   - No layout jump when the keyboard opens or closes, or on rotation.
   - Dictation and the predictive bar don't cover the input.
6. **Safe areas:** nothing sits under the notch or Dynamic Island or behind the home indicator, in both orientations. The composer's bottom padding clears the home indicator.
7. **Composer scrolling:**
   - A long draft scrolls inside the editor only; the page doesn't scroll behind it.
   - Momentum scrolling and the rubber-band edge feel native.
   - In Focus, the editor fills the space without a double scrollbar.
8. **Draft preservation:**
   - Open history, search, start a new conversation, then return: the original unsent draft is intact.
   - Lock the phone, switch apps, and reload the page: the draft persists as it does today.
9. **Model and usage access:**
   - Open the model picker and switch Auto, manual and Layout; the route caption updates.
   - Open Usage: "This chat" reads "<1%" for the fixture (not 0%); the allowance shows "unknown" with its note; Compact controls are reachable; the sheet closes by swipe and by ✕.
10. **Attachments and tools:** attach and remove a photo/file; toggle Search and Research; Send then Stop. The preview refuses external requests by design, so expect the preview-unavailable reply, not a live answer.
11. **Accessibility:**
    - VoiceOver reads the toolbar buttons by name (Open chats, New conversation, Routing Center, Conversation intelligence) and announces the usage meter as less than 1%.
    - Text Size at the largest setting doesn't clip the toolbar or composer.

## Gate 1 blocker review

**Verified in simulated Chromium and WebKit, both engines:**
- The full functional workflow: reading, history, search, new conversation, Focus in both directions, independent desktop scrolling, draft/selection continuity, picker, usage, attachments, Search/Research, Routing Center, Send/Stop.
- First-screen reading geometry.
- 44px phone targets and toolbar fit at 320px.
- Accurate mode naming.
- The honest usage label.
- Zero automated WCAG-tagged violations, page errors and overflow.

**Known, verified, non-blocking:**
- The desktop "Your brief" block reserves about 40px for its hover actions.
- The consolidated shell is still proof portals and overlays, not canonical components.
- Production `CompactNote.tsx` still rounds small shares to 0%; only the preview corrects it.
- WebKit's aborted Firebase Auth helper requests (pre-existing).

**Untested (unknown, not passed):**
- Physical iPhone behaviour: keyboard and visualViewport, safe areas, touch, momentum scroll, Safari toolbar, VoiceOver. These are blocked by the localhost-only preview guard described above.
- Light/black themes for the consolidated proposal.
- 200% zoom, Dynamic Type, localization and RTL.
- Streaming, long virtualized history, Canvas/Compare, error and account states.
- Live providers, auth and quota.
- The strict premium static audit: its tool is absent here, so the 22 pre-existing findings are not re-verified.

**Gate-level:** automated evidence is complete for the defined Chromium + WebKit matrix. Gate1 still requires the owner's explicit identity/visual approval. The physical-device evidence it calls for can't be collected until a test-only host allowance is approved.

## Readiness

Ready for **owner review** of the rebuilt portable review and this record. Not ready to claim physical-iPhone or full-state coverage. Recommended next decision: approve or decline a test-only host allowance so the checklist above can run on hardware. Progress stays **18.5% (Medium confidence)**. Stop here.
