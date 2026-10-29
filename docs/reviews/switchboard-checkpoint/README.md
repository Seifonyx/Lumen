# Router (formerly Prism): first visual checkpoint

**Checkpoint only; not a PR, merge or deployment.** Running Canvas app, synthetic profile (Gemini key listing one model, Groq key saved with discovery blocked, nothing else), all non-local traffic blocked, no inference, $0.

## Name

**Router** (owner's choice, 2026-10-29, from a shortlist after Switchboard was declined), with the descriptor "Models, providers & routing" and the existing routing icon. It says exactly what the area does: send each request to the right model and provider, fall back when one is busy, and show what happened. "Prism" described light rather than the work, and a marketed AI gateway already uses that name. "Router" is a generic word, so this is an in-app area name, not a cleared brand. Internal ids (`routing-center`, `prism` context values, `rc-` classes) are unchanged.

## Planned structure (to build after approval)

| Section | Holds | Comes from |
|---|---|---|
| Providers | Grid of every provider, status, connect and edit keys in place | Prism Providers + Settings → API keys (AI providers) |
| Models | Saved models, browse, availability, Auto exclusions | Prism Models + Settings → Models (saved/browse/removed) |
| Routing | Priority (balanced/quality/speed/cost), automatic switching, fallback order, preferred provider | Settings → Models |
| Layouts | Layouts | Prism Layouts + Settings → Models → Layouts |
| Usage | Recorded requests, limits, history | Prism Usage + Settings → Usage |
| Diagnostics | Latest outcome, request log, routing evidence | Prism Diagnostics |

Settings keeps account, appearance, chat, connectors (GitHub), personalization, memory, scheduled tasks and privacy, with one row that opens Router. Existing settings deep links (`keys`, `models`, `layouts`, `usage`) will redirect into the matching Router section so nothing becomes unreachable. Storage, key handling, routing logic and confirmations stay the same.

## In this checkpoint

- The name in the sidebar, rail, command palette, page header and accessible labels.
- Providers as one grouped grid (Connected · Free to start · Uses your provider credits) with neutral monograms, one-line status and a "Refresh model lists" action (the existing catalog refresh; it sends no message). A tile opens the provider as its own page with "All providers" and browser Back.
- Phones get the same groups as a single grouped list.

Groups come from the provider registry: the four built-in free tiers plus providers flagged `free`.

Fixture: [`tests/e2e/switchboard-experience.cjs`](../../../tests/e2e/switchboard-experience.cjs). axe WCAG A/AA, overflow, 44px phone targets, tile → detail → Back pass in Chromium and WebKit at 390 Light, 1440 Dark and 1440 Light.
