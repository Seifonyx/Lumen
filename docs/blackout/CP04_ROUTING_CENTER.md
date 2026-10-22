# CP03 sidebar polish + CP04 Canvas Routing Center (flagged, off in production)

**22 October 2026.** The owner authorized the CP03 sidebar polish and **CP04** as one continuous assignment, under the lean workflow and the [integration blueprint](CANVAS_PRODUCTION_INTEGRATION_BLUEPRINT.md).

**Not authorized:** CP05, merge, deployment, production activation, spending and Gate 2 approval. Progress is unchanged at **21.5%**.

Commits:
- `8d2653e` — sidebar polish;
- `19ddfe6` — CP04;
- `3bb7773` — tests.

## Sidebar polish (CP03)

The Canvas tree's loose conversations are now **one clean list with no date headings**:
- pinned chats first, marked by their pin;
- then newest first;
- while searching, archived matches last.

Projects, search and row actions are unchanged. The CP03 contract now asserts no headings and pinned-first order. See [sidebar](cp04/sidebar-list.png).

## CP04 — Routing Center

`src/components/RoutingCenter.tsx` is the verified provider proof rebuilt as a canonical component in Canvas styling (`src/styles/canvas-routing.css`). It has six sections:

| Section | Content | Reuses |
|---|---|---|
| **Overview** | Catalog size, saved policies, allowance (stays **Unknown** when not reported), this conversation's route | `RouteWhy` |
| **Providers** | Filters, search and detail: connection, discovery, allowance, models, usage and provenance | `FilterMenu` |
| **Models** | Inventory with search | Eligibility gates |
| **Policies** | Layouts, plus editing and new | `LayoutEditor` |
| **Usage** | Usage and quotas | `UsageTab` |
| **Diagnostics** | Existing decision evidence only | `RouteWhy` |

**How it uses Lumen's real functionality:**
- **"Use model"** calls the canonical `setChatModel`, behind the same eligibility and account gates as the picker.
- **"Manage" / "Connect"** open Settings → Keys. Closing Settings returns to the Routing Center.
- **Unchanged:** the routing engine, discovery, credentials and permissions. No probes or logging are added.
- **Dropped:** the proof's DOM-observing bridges.

**How it opens and closes:**
- It opens from **Models & routing** in the Canvas tree and takes the main column's place.
- The chat stays mounted, so the draft and scroll position are kept.
- It closes on **Chat** (back), Escape, choosing a model, or another chat or account.
- Open/closed state lives in `src/lib/routing-center.ts` (presentation only).

**Production is unchanged.** The lazy loader lives only in the QA switch replacement; production's `canvas-presentation.ts` exports `RoutingCenter = null`. A dead `import()` in App would still have reshaped production's chunks, so it is avoided. The ordinary build is **byte-identical (174 files)**.

## Verification (milestone run, `3bb7773` build)

| Contract | Chromium | Linux WebKit |
|---|---|---|
| CP04 Routing Center (1440×960, 390×844, 320×568; 10 checks each) | Pass | Pass |
| CP03 shell (with the list-order check) | Pass | Pass |
| CP02 composer (4 sizes) | Pass | Pass |
| QA browser contract | Pass | Pass |

The CP04 checks are:
- opens with the draft kept;
- honest overview;
- provider filter, search and detail (phone push/back);
- "Use model" changes the conversation's model and keeps the draft;
- Layout editor (edit and new, cancelled; nothing saved);
- Usage and Diagnostics;
- Manage → Settings and back;
- closing: Back and Escape, plus another chat on desktop;
- second reviewer;
- axe, no overflow or CSP violation, zero external requests, no page errors.

Also passing:
- QA01 isolation audit 8/8;
- CP01 graph check: 174 hashes equal to baseline, CP04 sentinels absent;
- `npm test`.

Evidence: [desktop](cp04/desktop.png), [phone](cp04/phone.png), results in [cp04](cp04).

## For the owner (iPhone)

1. Start the Codespace. It updates and builds by itself.
2. Tap **Reset** if the projects are missing.
3. Open the menu → **Models & routing**.
4. Try:
   - Overview;
   - Providers → Google AI Studio → **Use model**: you're back in the chat with that model and your draft;
   - Policies → Edit;
   - Usage;
   - **Manage** (opens Settings; close it to return).

**Phone behaviour:** the Routing Center is full-screen. **Chat** (top left) returns to the conversation.

**Decision to confirm:** "Use model" returns straight to the chat. Staying in the Routing Center is the alternative.
