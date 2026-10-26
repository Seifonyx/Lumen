# Phase 5 Slice 1 review evidence

**Draft PR58 only. Stop for planner review; no merge, deployment or Slice 2.** All data is synthetic. Builds and browsers ran on loopback; no review site was published and no incremental spending was incurred. Overall completion percentage is not defined for the seven-phase program.

## Source provenance

| Evidence | Source |
|---|---|
| Before | Main `d78363466e6460ce63c8ec7ab7fe67a527f22f15`, built before product changes |
| After Library captures | `dbf150bdb40a7210e63ddb9206e7fead353bcb3e`, actual production Canvas build |
| Final code candidate | `57443d0` (full SHA in Git/PR); subsequent differences from the captures preserve pending composer files and stabilize a synthetic model-picker test. Library presentation source is unchanged. |
| Final delivery/CI | PR58 HEAD and the separately maintained [live checkpoint](https://github.com/Seifonyx/Lumen/blob/docs/lumen-live-context/docs/lumen-context/CURRENT_STATUS.md); exact-head CI uploads fresh browser evidence with `EXACT_HEAD.txt` |
| Fixture | `tests/e2e/library-experience.cjs`; shared SHA256 `6d3e2685f2e45800896353e84d150a8954df10a4b4084bf877aab5e7f85182e3` |

The four `results.json` files record source, fixture, engine and all eight viewport/theme cases. [captures.json](captures.json) hashes all 36 retained PNGs. These are screenshots of the implemented app, not mockups. Before and after use the same fixture. The original Library omits the reply's existing generated file block; the redesign discovers it through canonical Markdown/FileCard, hence five versus six chat items. Relative timestamps can advance between capture sessions.

## Before / after

Both engines have complete Light/Dark captures at 320×568, 390×844, 430×932 and 1440×960. Representative comparisons:

| View | Before | After |
|---|---|---|
| Phone Light, 320 | [Chromium](before/chromium/320-light-library.png) | [Chromium](after/chromium/320-light-library.png) |
| Phone Dark, 390 | [WebKit](before/webkit/390-dark-library.png) | [WebKit](after/webkit/390-dark-library.png) |
| Phone Light, 430 | [WebKit](before/webkit/430-light-library.png) | [WebKit](after/webkit/430-light-library.png) |
| Desktop Light | [Chromium](before/chromium/1440-light-library.png) | [Chromium](after/chromium/1440-light-library.png) |
| Desktop Dark | [WebKit](before/webkit/1440-dark-library.png) | [WebKit](after/webkit/1440-dark-library.png) |

Also inspect the [unavailable-original error](after/webkit/320-dark-unavailable.png) and [separate Knowledge workspace](after/chromium/1440-light-knowledge.png). Other captures are in their engine/theme directories.

Rendered review checked hierarchy, dense row readability, long filenames, separate action targets, all phone widths, Light/Dark, category scrolling, and original-file/Knowledge explanations. Fixes from inspection: desktop category visibility, readable file type labels instead of raw MIME strings, and detail-sheet padding. The one-pixel image is deliberately synthetic; it is not a broken production thumbnail.

## Behavior and verification

| Contract | Evidence |
|---|---|
| Whole-feature Exit | `feature-exit.cjs`: Prism provider detail, Library document, Tools editor and Tools Canvas; original chat/text/ready files and delayed multi-file selections; 320/390/430/1440 in Chromium/WebKit |
| History and editing | Real Back/Forward separately restores Library queries, source chat selection, file detail and generated preview, including Forward after Exit. Canvas instructions/proposals and save status survive replay; failed rename blocks Exit; discard confirmation can be declined. Unit direct-start/origin tests reject duplicate chat entries. |
| Library discovery/reuse | Eight cases per engine: name sorting, scoped no-match/reset, truthful metadata, explicit original failure, generated preview Back/Forward/Exit, file reuse without changing text or duplicating attachments, separate Knowledge, axe, overflow and forced colors. Pure adapter tests cover project/query/sort/duplicates/private context. |
| Accessibility | 168 full-app scans across Light/Dark/Black and desktop/phone, plus Library matrices; keyboard focus/traps, labels, 44px phone controls, reduced-motion/glass and simulated keyboard/viewport regressions. Model-picker fixture uses keyboard opening and date-only TTL expiry plus real focus refresh; no error assertion was removed. |
| Privacy/compatibility | Incognito and attachment-motion regressions pass; same-account reads stay in their original draft and departed private/account reads are rejected. Original Office bytes are not cached from incognito. Ordinary/Canvas builds, QA graph/output and 9-check isolation audit, plus ordinary graph negative controls. No schema/auth/provider/routing/network permission changes. |
| Shared regressions | Chromium CP03 shell (12 checks per viewport), CP04 Prism (10), CP05 screens (9 desktop/10 phone, both themes/four widths), and focused provider/model/layout/navigation suites. CI runs these contracts in both engines and ordinary/Canvas emulator suites. |

Full unit suite and type checks pass. Windows baseline test fixes normalize paths/line endings without removing assertions. QA's reviewed network allowlist is unchanged: a pure language-label module separates Markdown from executable runner code, and QA pins worker-disabled runner source to its existing audited chunk name. Exact-head CI remains the required final operational gate; consult PR58/live for its actual result, not an older run.

## Performance and limitations for planner review

Measured same-source build comparison: ordinary startup **467.6 KB JS / 60.4 KB CSS gz**, Canvas **480.8 / 75.7 KB**. Canvas growth is **13.2 KB JS / 15.3 KB CSS**; lazy Prism **7.7 KB**. The existing startup-JS cap is explicitly revised **12.25→13.5 KB** for feature-origin tracking and draft-file safety; the lazy Library CSS is newly included in the source audit (**20.1 KB**, cap **21 KB**). Startup-CSS 16 KB and lazy-Prism 9 KB caps remain. This bounded cost requires planner review; no speed improvement is claimed.

Physical iPhone/PWA, actual Safari edge gestures, VoiceOver, dictation/IME and Dynamic Type are unverified. Synthetic WebKit and viewport/keyboard checks are supporting evidence. No real account/provider traffic, paid services, production deployment or new storage synchronization was tested or introduced. Knowledge originals/indexes remain on the original device; a downloaded export is not a tracked independent synchronized file.
