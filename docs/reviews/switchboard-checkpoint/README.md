# Router (formerly Prism) and the slimmer Settings

**Draft for owner review ([PR #63](https://github.com/Seifonyx/Lumen/pull/63)). Not merged or deployed.** Captures come from the running Canvas app with a synthetic profile (Gemini key listing one model, a Groq key whose catalog request is blocked, nothing else), with every non-local request blocked: no inference, $0.

## Name

**Router** is the owner's choice (2026-10-29), picked from a shortlist after Switchboard was declined. It keeps the descriptor "Models, providers & routing" and the existing routing icon. "Router" is a generic word, so it is an in-app area name, not a cleared brand. Internal ids (`routing-center`, `prism` context values, `rc-` classes, `prism-*` test files) are unchanged.

## What Router holds (Canvas build)

| Section | Holds | Came from |
|---|---|---|
| Models | Current routing mode, catalog, Use model | Prism Models |
| Providers | Grouped grid (Connected · Free to start · Uses your provider credits) with provider marks and one status line; each provider's page holds its **key and connection** | Prism Providers + Settings → API keys |
| Routing (new) | Switch models automatically, Auto for new chats, priority, preferred provider, **fallback order**, model health, custom models | Settings → Models |
| Layouts | Layouts | Prism Layouts (Settings → Models → Layouts) |
| Usage | Recorded requests, limits, saved-chat history | Prism Usage + Settings → Usage |
| Diagnostics | Latest outcome, request log | Prism Diagnostics |

- **First run:** a new account with no provider key opens Router on Google AI Studio, with the existing welcome guide above its key field. "All providers" always reaches the grid.
- **Links into old Settings sections** (Tools "Set up", the model picker, model check, first run, the command palette) open the matching Router place in one history step. A request that reached Settings first (a first sign-in) hands off and replaces that history entry, so Back never loops.
- **Keys on a provider page:** unsaved edits survive Back/Forward for that account (in memory only). Saving writes only that provider's own fields (key, permission, and the endpoint, account ID or relay it uses), so a stale page can never overwrite another provider's key.
- **Provider marks:** monochrome, in Lumen's ink, quieter when not connected. Vendored from `@lobehub/icons-static-svg` 1.101.0 (MIT) and `simple-icons` 16.36.0 (CC0) for Scaleway and OVH, loaded in their own chunk with no runtime fetch. Licences are in [THIRD_PARTY_NOTICES.md](../../../THIRD_PARTY_NOTICES.md).

## Settings (Canvas)

The phone index puts the account first, then Connections (one **Router** row, plus Connectors), Personal (Personalization, Memory, Scheduled tasks) and Privacy & data. Each row states one true fact. API keys, Models (with Layouts) and Usage are gone from Settings. The ordinary build keeps today's Settings unchanged.

## Captures

- `after/`: 320, 390, 430 and 1440, Light and Dark. Covers the landing, providers (and the full list), a provider page, adding a key, and Routing.
- `before/`: main `532dbcf` at 390 Light, 1440 Dark and 1440 Light.
- Settings index: [`../settings-checkpoint/`](../settings-checkpoint/).

## Verification (agent-reported)

- **Fixtures** [`switchboard-experience`](../../../tests/e2e/switchboard-experience.cjs) and [`settings-experience`](../../../tests/e2e/settings-experience.cjs) run in Chromium and WebKit. They check axe WCAG A/AA, overflow, 44px phone targets, tile → page → Back, a synthetic key moving a provider to Connected, Routing, Tools Set up → Router → one Back, and Exit keeping the draft.
- **Router suites in Chromium and WebKit:** routing-providers, prism-provider-states, provider-settings-containment (including 150% text at 320px), prism-model-states, prism-auto-layouts, iphone-glass-navigation, feature-exit. In Chromium only: prism-model-discovery, prism-routing-states, prism-usage-diagnostics.
- **Contracts in Chromium:** CP03, CP04 and CP05, plus the browser and composer contracts.
- **Kept Canvas in-app suites:** run locally with the emulators.
- **Also passing:** unit tests, QA01 (8 checks), CP01 (26 negative controls).
- **Budget:** startup JS +12.5 KB, startup CSS +14.9 KB, Router chunk 7.9 KB, CSS source 21.6 of 22 KB.

## Known limits

- **Canvas coverage moved to the ordinary build:** 21 in-app suites that drive Settings → API keys, Models, Usage or Layouts directly no longer run on the Canvas build; they are listed in `tests/e2e/canvas-core.txt`. They still run in full on the ordinary build, and Router's suites cover the same shared editors on Canvas. Porting them to drive Router is follow-up work.
- **Physical devices:** iPhone, VoiceOver and Dynamic Type are unverified.
- **Desktop Settings:** desktop Canvas Settings keeps its side list, without the sections that moved.
