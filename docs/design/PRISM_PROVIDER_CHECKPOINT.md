# Prism — provider checkpoint (CP2)

## Scope and design

Owner-authorized CP2 only, after verified CP1 Canvas release `db94c2326a3c35b9f28a5a1714020453ae927bca` (Deploy40164215741;187/187 live files matched). New branch `feat/phase4-prism-providers`. No merge/deploy, CP3 or network/storage/auth changes.

The directory should answer who is configured, what is blocked and what to do next. Keep existing list/detail/history and compact phone navigation. Prefer one factual status and next-step line over multiple badges. No arbitrary desktop detail selection: select an existing relevant route only, otherwise invite selection. Saved keys and enabled permissions remain distinct. Catalog success proves model-list retrieval only; no independent inference-connection status exists in the canonical data.

Provider detail prioritizes identity, exact blocker, one primary recovery, then models. Keep key/permission facts concise. Move secondary discovery timestamps, reply-test limitation and truthful unknown allowance into a disclosure without removing information. Preserve model-level eligibility/actions unchanged for CP3.

Connection Settings uses an account-bound presentation target in existing screen-history snapshots containing only provider ID/owner ID, validated against the canonical provider list, never credentials. The Canvas seam isolates target metadata from the ordinary graph; shared additive editor interfaces change ordinary asset hashes, while preserving its appearance and behavior. Existing key editor/save/permissions own every operation. Targeted settings show the requested provider open, with access back to the complete directory; browser/phone Back restores the provider screen.

Alternatives rejected: a new provider settings page would duplicate credential ownership; saving a persistent selected-provider field would introduce an unnecessary schema; status dashboards would crowd short phones. No new connectivity checks or live inference.

## Implementation and verification plan

- [ ] Extend provider presentation tests first: no key/disabled/unchecked/ready-empty/ready/auth/stale and typed failures; no green inference claim or raw error rendering. Implement shared presentation verdict used by directory/detail.
- [ ] Test provider-settings history target: canonical IDs only, restores exact settings visits, clears on cancellation and account mismatch. Add Canvas-only seam; existing KeysTab/ProviderConnections render selected provider directly with masked controls and original save.
- [ ] Recompose directory/detail using existing canonical data. Preserve filters/search/history and Models landing geometry. Add focused browser tests before UI behavior changes.
- [ ] Synthetic Chromium/WebKit Light/Dark320/390/430/1440: directory/detail/error/disabled/unchecked/empty/catalog-ready; settings target, Back/Forward, draft, masked secrets, search, accessibility, overflow. Capture curated before/after; no physical-iPhone claim.
- [ ] Typecheck/full units, ordinary/Canvas builds, budgets and isolation; exact-head CI. Review complete diff, update handoff/live status, push new draft PR and STOP for provider review.

## Review risks

No canonical inference-check result exists: UI must say so. Discovery refresh currently refreshes the canonical catalog, potentially all enabled providers; preserve behavior and accurately label it. Actual iPhone keyboard, edge gesture/PWA/VoiceOver remain device checks. No provider selection may leak to another account or hide the general directory permanently.
