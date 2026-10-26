# Prism Usage & Diagnostics — CP2 Design

## Scope

This checkpoint improves Prism's existing Usage and Diagnostics sections. It keeps the current providers, routing history, saved chats, usage counters, account boundaries, lazy Canvas presentation, and storage schemas as the only sources of truth.

## Information architecture

Usage answers three separate questions in this order:

1. **What Lumen recorded today?** App-maintained request and token counters, with temporary blocks shown separately. Absence of a block is described as such; it is not proof that a model or provider is available.
2. **What is in saved-chat history?** A 14-day reconstruction from this account's non-temporary chats on this device. Completed, failed, and stopped outcomes remain distinct. Deleted and Incognito chats are absent by construction.
3. **What limits are known?** Per-model and shared allowances appear only when the existing provider-derived usage record contains them. Unknown allowances and reset times remain explicitly unknown. Firebase free-plan guards are labeled as app sync protection rather than provider inference quota.

Diagnostics answers two questions:

1. **What happened most recently?** The latest recorded assistant request is presented as answered, rerouted, stopped, failed, or in progress. A completed model decision is shown only when the saved record supports it. Missing routing detail stays missing.
2. **What happened across recent requests?** A compact event ledger shows only outcome, recorded model, safe error category, and time. Chat titles remain hidden until explicitly enabled; prompts and response bodies never appear.

## Evidence contracts

- `usage.ts` remains the owner of app-recorded daily counters, temporary blocks, learned allowances, and known reset timestamps.
- `chat-records.ts` remains the pure adapter for saved-chat history. Only assistant messages with `status: done` count as completed answers. `stopped` and `error` are separate outcomes; `streaming` is current/in-progress evidence, not historical completion.
- Existing route metadata remains the sole explanation for reroutes and completed model decisions. The UI does not predict the next Auto choice.
- Temporary chats are excluded by the existing canonical temporary-chat predicate. Store account scoping remains unchanged.

## Interaction and presentation

- The first Usage viewport emphasizes app-recorded activity and source labels, then the saved-chat trend. Per-model details use progressive disclosure on short phones.
- Diagnostics leads with a single latest-outcome panel, followed by the request ledger. Completed-answer evidence is not duplicated in a second title-revealing list.
- Empty states explain which source has no evidence and avoid turning missing data into zero.
- Existing Prism section navigation, Back/Forward behavior, focus semantics, touch targets, and Light/Dark tokens are preserved.

## Security, privacy, and isolation

No prompts, responses, keys, new probes, telemetry, provider calls, schemas, or network permissions are introduced. Canvas-specific styles stay under the existing Canvas shell and lazy Prism bundle. All browser evidence uses synthetic accounts and intercepted/local fixtures.

## Verification

- Unit tests cover completed/stopped/failed/in-progress classification, unknown usage semantics, temporary chats, empty history, and account-scoped inputs.
- Chromium and WebKit cover 320×568, 390×844, 430×932, and 1440×960 in Light and Dark, including titles-hidden privacy, navigation, focus, empty data, and dense history.
- Typecheck, builds, budgets, isolation, and exact-head CI must pass before the draft PR is presented.

