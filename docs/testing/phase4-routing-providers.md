# Phase 4, Slice 1 — Routing Center & Providers

Status: locally verified and ready for owner design review on `feat/phase4-routing-providers`; based on production main `871bc1a647f36550e6f66e527b1252ac84437506`. Owner permits draft review, not merge/deployment.

## Review 2: owner's second design review (Claude, 24 October 2026)

The owner judged review 1 a meaningful improvement but not approved. Six problems were named:
- Destinations fell below the first phone screen.
- The overview let history bury navigation and actions.
- Providers still felt like a settings list.
- The four-step connection panel took phone space and implied a setup sequence.
- Check connection and Connection settings competed.
- The desktop workspace read as merely a correct two-column settings screen.

**Structure chosen:**
- **Navigation:**
  - Phones get a floating dock with the four places you manage: Overview, Providers, Models and Policies. Its form follows the composer's floating capsule.
  - Usage and Diagnostics explain the route, so they open from the route panel as pages over the overview. A provider opens over the list.
  - The bar's leading control is the drawer button on a dock place, or Back on a page over it, never both. Chat stays at the end.
  - Computers get one sticky header line: title, six tabs and Chat.
  - Rejected alternatives:
    - A five-item dock: labels collide at 320 and at larger text.
    - A title-menu switcher: not discoverable enough.
    - A sideways tab strip: hides places.
- **Overview:**
  - The route is the lit, inverted panel (ink in Light, paper in Dark). It shows:
    - the mode
    - one sentence from real counts
    - what it can reach: Auto's enabled models, a Layout's models in order, or a chosen model's provider and context
    - two rows: Diagnostics (the last answer and why) and Usage (the allowance, or Unknown)
  - Then your providers as a ledger with Connect.
  - Then models and policies, with Manage models.
  - Recent answers come last, three of them, loaded with the other secondary panels.
- **Providers:**
  - Your providers form an editorial ledger: a light, the provider in display type, a verdict word with one fact, and the model count as a numeral.
  - Verdicts answer "can Lumen choose its models?": Available, Available from cache, Unavailable, Off, Not connected, Not listed yet.
  - Other providers are a field of name chips: eight shown, "Show all N" for the rest. All are shown when nothing is connected, or when you search or filter.
- **Provider detail:**
  - The verdict comes first.
  - One primary action only when something needs fixing: Add a key, Turn on in Settings, Replace key, or Refresh model list when the list is missing or old. Otherwise both actions stay quiet.
  - The typed guidance note appears only when attention is needed.
  - Four independent facts in one grid: Key · permission, Models (count and time listed), Replies ("Not tested by model listing") and Allowance.
  - Models come as rows that become columns (model, context, allowance, Use) when their container is wide.
  - "Check connection" is now "Refresh model list". Its result says the list was refreshed or not, and that no message was sent.
- **Desktop:** the header line is sticky. The provider shown first is one that works. Detail actions sit beside the verdict. Models read as a table.

**Budgets and guards:**
- No budget was raised. Canvas CSS source is 16.0/16 KB (16,357 of 16,384 B gz): `canvas-routing.css` was rewritten and consolidated.
- The Routing Center chunk is 8.8/9 KB: recent answers moved to the lazy extras chunk.
- Startup JS is 9.2/9.5 KB.
- The stylesheet guard (`canvas-composer.test.mjs`) now allows `@container`, still scoped, with no imports or fonts.
- `provider-presentation.ts` changes wording only: "refresh the model list" replaces "check again", and the reply label is now "Not tested by model listing". Its unit test was updated to match.

**Verification (local, synthetic only, $0):**
- `npm test` passes.
- The ordinary build is byte-identical to `main`.
- CP01 and QA01 isolation pass with the `main` baseline.
- `routing-providers.cjs` passes in Chromium, 8/8 (four sizes in Light and Dark). Added checks:
  - Usage and Diagnostics open from the route panel, and Back returns focus to the row that opened them.
  - The drawer button and Back never show together.
  - Verdicts, facts and the leading action: none for a working provider; Turn on in Settings for permission off; Replace key for a refused key.
  - At 320 with 150% synthetic text, the dock, route rows and ledger rows keep their words inside and stay 44pt tall. The dock's labels keep a fixed size, as a tab bar's do.
- CP04 passes in Chromium, 3/3. Every place, including Usage and Diagnostics on phones, is on the first screen and at least 44pt at 1440, 390 and 320×568.
- The CP01, CP02, CP03 and CP05 contracts pass.
- 8 in-app suites pass on Canvas: app-feel, gestures, glass, native-feel, sheet-drag, sidebar, hub-actions and routing-providers.
- WebKit runs in CI.

**Evidence:**
- `rc-shots.cjs` captured both review 1 (`c19b2ab`) and review 2 at the same sizes and states.
- The "larger text" state now adds 125% page zoom, what Safari's text-size control does; it is not Dynamic Type.

**Limits and tradeoffs:**
- Usage and Diagnostics are one step further on phones: through the route panel, not the dock.
- At 125% zoom on a 320 phone (an effective 256 px), the dock's labels nearly touch.
- The inverted route panel is the one strong surface; everything else stays quiet by design.
- Not verified: physical iPhone, VoiceOver and Dynamic Type.

## Redesign after the owner's design reassessment (Claude, 24 October 2026)

The owner judged the first slice-1 design underwhelming (three iPhone screens: Overview, Providers, Google AI Studio). This redesign builds on Codex's engineering in PR #50 (branch `feat/phase4-routing-providers`, untouched) on `claude/lucid-dijkstra-541bbi`; `provider-presentation.ts`, its unit tests and every canonical owner are unchanged. Draft review only: no merge, deployment or owner acceptance.

**Critique of the reviewed design:**
- Three stacked titles before content on phones.
- Two prominent buttons to the same destination.
- A hero reading "Send a message" while recorded answers existed.
- Provider state said three times per row (badge, facts, sentence).
- The same disclaimer repeated on every screen.
- Mono uppercase labels everywhere.
- Absences shown as headline numbers.
- Generic letter tiles.
- Grey-on-grey fills.
- A selected tab that read as a hole in Dark.
- Double borders on desktop.

**Directions considered:**
- (A) A refined persistent section switcher.
- (B) "Map and pages", chosen. The phone overview is the map and each section opens as a page with Back. Computers get a quiet underline tab row.

B was chosen for:
- hierarchy, since there is one title per screen
- iPhone usability: no sideways strip or 3 × 2 grid, and 44pt rows
- space, since the first screen answers the main question

**What changed:**
- **Overview:**
  - The route in large type, with one sentence built from real counts.
  - "In this chat, X answered last" with its recorded reason.
  - Recent answers, as a trail of the latest recorded answers across saved chats.
  - Your connections, then section rows with their state on phones or "At a glance" on computers.
  - Absent data stays "Unknown".
- **Providers:**
  - Inset grouped list: your connections first, the rest folded under Explore providers.
  - One status vocabulary: a light (ready, cached, failed, off) and one line of words.
  - Search, filter, empty state and fold are unchanged in behaviour.
- **Provider detail:**
  - Header and status line.
  - One primary action where a fix is needed (Connection settings → Settings → Keys); Check connection beside it.
  - A connection path: Key, Permission, Model discovery, then Replies, always "Not verified by discovery".
  - Then the typed recovery note, Request allowance, Models (24 per page, search above 24) and provenance.
- **Navigation:**
  - On phones the bar's back button reads "‹ Routing Center", or "‹ Providers" while a provider is open, and system Back follows the same order.
  - The h1 stays for assistive technology.
  - Focus moves to the new page's heading and returns to the row you came from.
  - Swipe-back to chat applies on the overview only.
- **CSS:** `canvas-routing.css` was rewritten and consolidated rather than layered: shared tokens, one pill rule, hover only on pointer devices, one vertical path layout for narrow panes. Canvas CSS source is 16.0/16 KB gz with no budget raised. The lazy Routing Center chunk is 8.6/9 KB.

**Verification (local, synthetic only, $0):**
- `npm test`: typecheck and all unit tests pass.
- The ordinary build is byte-identical to `main` (`diff -r`).
- `canvas-build-isolation.mjs` passes with baseline equality, and `private-qa-isolation.mjs` passes with the `main` baseline.
- `routing-providers.cjs`: Chromium 8/8 (4 sizes × Light/Dark). Updated for the new navigation; the contract is unchanged:
  - the bar's "Back to providers" on phones only
  - a four-step path
  - the five phone section rows stay inside their row at synthetic 150% text, 44pt tall
- CP04 `private-qa-routing-center.mjs`: Chromium 3/3, 10 checks per viewport. Updated as follows:
  - six tabs on computers, five 44pt rows plus the overview on phones
  - path steps instead of the old facts list
  - a status line without "No key saved / permission off" for the enabled provider
- CP01/CP02/CP03/CP05 browser, composer, shell and screens QA contracts pass in Chromium.
- In-app suites pass on the Canvas build: app-feel, gestures, glass, native-feel, sheet-drag, sidebar and hub-actions.
- WebKit is not installed in this container; exact-head CI runs the same contracts in WebKit.

**Evidence:**
- `tests/e2e/helpers/rc-shots.cjs` captures the actual Canvas UI on synthetic accounts with intercepted transport.
- States: connected, empty, failed (401), stale (503 after ready) and dense (145 long model names, largest text).
- Sizes: iPhone 320×568, 390×844 and 430×932, laptop 1280×800 and desktop 1440×900, in Light and Dark.
- Screens: overview, providers, Google AI Studio detail and Anthropic (permission off).
- The same helper captured the before build (PR #50 head) at the same sizes.

**Not verified:**
- Physical iPhone Safari, VoiceOver and real Dynamic Type.
- Safe-area insets on a notched device.
- Live provider connectivity.
- Emulated touch in Chromium is not an iPhone.

**Tradeoffs:**
- On phones a section takes one extra tap from the overview, in exchange for a clear first screen.
- The desktop overview no longer lists every catalog count, since Models shows them.
- The route title can be long for a manual model with a long name; it wraps.

## What changed (first slice-1 design, Codex)

- The overview leads with the selected Auto/manual/Layout mode and recorded answer evidence, followed by provider discovery readiness. Counts are a secondary ledger. Unknown allowances stay unknown.
- Provider browsing separates saved connections from exploration and offers Needs attention. Selection and filters remain consistent. Detail separates key/permission, discovery and reply verification; safe typed recovery never renders raw provider error strings.
- Desktop keeps list/detail side by side; phone Back restores list focus. Phone headers are shorter, section names wrap at larger text sizes, search uses touch-sized controls, and the catalog retains existing pagination.
- Routing Center styles load with its existing lazy module, protecting initial startup budgets. Ordinary presentation and canonical selection, routing, permissions, credentials and network behavior are unchanged.

## Owners and changed files

`RoutingCenter.tsx` and `RoutingExtras.tsx` remain presentation adapters over `useStore`, `providerEnabled`, the canonical catalog/usage, `setChatModel`, Settings → Keys, `UsageTab`, `LayoutEditor` and `RouteWhy`. New `provider-presentation.ts` only converts typed discovery/setup facts into safe copy. `canvas-presentation.on.ts` relinquishes the eager RC stylesheet import to the lazy component; `canvas-routing.css` stays scoped. Regression coverage is in `provider-presentation.test.ts`, `routing-providers.cjs`, the existing CP04 QA contract and stylesheet ownership test. The new browser suite is included in `canvas-core.txt`.

## Verification ledger

Local checks run only on loopback with synthetic accounts and intercepted transport. No paid inference, production data, hosted QA, public ports, credentials or new dependencies.

- `npm test`: typecheck and all 90 unit-test files pass. The new helper covers saved/enabled/not-checked/ready/cached states and all six typed discovery failures. Independent review found and verified fixes for cached-state copy and the visible/accessibility label mismatch.
- `routing-providers.cjs`: Chromium 8/8 and Linux WebKit 8/8 pass. Four viewport sizes × Light/Dark; filter/selection consistency, permission off, auth failure clearing models, provider failure keeping cached models, 145-model pagination/search, unknown limits, only catalog GETs, preserved draft, keyboard focus, zero axe violations and overflow. At 320 px it additionally checks synthetic 150% text scaling. Matched baseline captures: 4/4.
- `private-qa-isolation.mjs` with `QA01_BASELINE_DIST`: 8/8 audit groups pass, including byte-identical ordinary output, Canvas/ordinary graphs excluding QA, synthetic-only QA graph and planted negative controls. `canvas-build-isolation.mjs` passes (2,570 ordinary graph modules, 174 artifact hashes, 12 negative controls).
- Both ordinary and Canvas builds pass. Budget unchanged: startup JS growth 9.1/9.5 KB gz; blocking CSS growth 13.1/16 KB; lazy Routing Center 8.1/9 KB; Canvas CSS source 15.9/16 KB. RC assets remain an existing lazy import rendered after App mounts; this change removes their CSS from the initial blocking stylesheet, not an on-open-only loading guarantee.
- Existing `private-qa-routing-center.mjs`: Chromium 3/3 and Linux WebKit 3/3, 10 flow checks per viewport, zero axe/CSP violations, no off-origin requests. Includes real model selection, Layout cancel, Usage/Diagnostics, connection settings and return, drafts, account separation, Back/Escape/history navigation. The committed synthetic QA build identifies source `6d2255a519a1d6e37189991909dc3541e037b9da`, 157 files and audited graph; no publication.
- Additional forced-glass Chromium checks: 390×844 Light/Dark, 2/2 pass. Motion is reduced in the new browser suite. Actual device Reduce Transparency/VoiceOver still needs the owner’s physical QA; existing solid Canvas tokens and reduced-transparency CSS remain unchanged.
- Initial CI at `358cc71` caught the missing reviewed-file declaration for the new presentation helper. The exact helper is now declared, required in the Canvas graph and forbidden in the ordinary graph, with a new planted negative control. Both strengthened audits pass with ordinary baseline equality. No guard or budget was removed.
- CI at `61b2d74` passed provider contracts, type/build/unit, isolation and ordinary suites, but found two timing assumptions: the attachment height baseline could be sampled before fonts settled (also reproduced on released source with delayed fonts), and WebKit could correctly lock on focus after the expiry clock advanced before draft preparation. Tests now wait for loaded fonts/committed layout and prepare Send before advancing the clock. Strict height equality, real post-expiry Send, no-reply/inert/401-or410/fresh-token410 assertions all remain. Independent review found no weakening. Application source is unchanged. Corrected attachment contracts pass Chromium 5/5 and WebKit 5/5; the corrected full WebKit private-QA browser contract passes all four viewports plus access, namespace, revocation and expiry checks.
- Exact-head full CI runs on the draft PR after this delivery commit. Its result must be read from the PR checks / canonical live checkpoint; local results above do not substitute for CI. No merge or deployment is permitted by those checks. Existing static/dynamic sync-import build warnings remain; no new dependency or budget increase.

## Review and limits

[Portable offline review](../reviews/phase4-routing-providers.html) (first slice-1 design; its "after" captures predate the redesign above, whose evidence is generated with `rc-shots.cjs`): download the single HTML file and open it locally. It embeds 16 curated screenshots, with no network resources: four matched before/after overview pairs and provider list/detail in desktop/phone Light/Dark. Click a capture to inspect original dimensions. Finite capture animations are completed for clean presentation; keyboard focus checks are separate. The before build is the released source above; captures are actual rendered UI, not mockups. Ordinary screenshots exclude keyboard focus; focus is exercised separately.

Physical iPhone keyboard/VoiceOver, actual Dynamic Type, safe-area device behavior and live-provider connectivity remain unverified. Automated larger text is synthetic; Linux WebKit is not physical Safari. Early device review still uses the separately authorized private QA process; this slice creates no hosting or access infrastructure.

Source checkpoint: `6d2255a519a1d6e37189991909dc3541e037b9da`. Subsequent delivery commits contain only capture stability, documentation/review evidence and strengthened isolation declarations; production source remains identical. Branch synchronization and exact final delivery SHA are recorded in the separate live checkpoint and PR, avoiding a self-referencing commit hash in this file.

Known design limits: phone provider details still scroll to reach deeper inventory; advanced model and routing sections retain their current presentation until the next slices. Canvas CSS is close to its existing 16 KB source budget, so later slices should replace/refactor rules instead of accumulating overrides. No known failing local checks remain.

Remaining Phase 4 work: Slice 2 (deep models/picker) and Slice 3 (Auto/policy/usage/diagnostics). Current overview preserves those existing sections without reopening their algorithms. No approval, merge or deployment is implied.

## Owner review steps

1. Open Models & routing: confirm the selected route is clear; browse Providers, Models and the other sections.
2. In Providers, compare Saved connections, Enabled providers and Needs attention; search a provider away and clear the search. Detail must not silently stay on an invisible provider.
3. Open a provider: check key/permission and catalog state separately; unknown allowance must stay unknown. Check connection refreshes model catalogs, not an AI reply.
4. Type a draft first, navigate through provider details and Back to chat; the draft must remain. On phone, use Back to providers; on desktop the list stays visible.
