# Phase 1 implementation plan

The owner explicitly authorizes executing the bounded offline/synthetic foundation in this phase, without
routine design questions. Full feature inventory and reasoning: FEATURE_PARITY.md. No native visual redesign.

- Add failing native generation regression against Capacitor 8.6.0 template; fix SceneDelegate, validate
  idempotent preparation and launch the custom controller. Keep app ID/origin/UIDs/schema and lifecycle unchanged.
- Add pure synthetic response/stream module and unit tests for Study parsing, incremental events and cancellation.
  Wire only native transport. Do not enable embeddings/research/cloud/API credentials.
- Add browser/native persistence and parity checks. Exercise the real canonical stores through an optional
  native smoke entry; production artifacts exclude all native/test code. Upgrade checks use same sandbox/origin
  with reinstall-without-uninstall, never fake migration success.
- Add build metadata/source/storage compatibility checks, job-summary links and actionable failures. Verify
  standard public runner pricing, signing and refresh limits from primary sources.
- Keep current README as quick start; record integration/update design and prioritized blockers separately.
- Run native unit/config/TS/browser checks, npm run test:affected -- --run, both builds/budgets, remote iOS compile
  and actual native smoke, exact-head PR CI. Inspect screenshots before final claims. Update HANDOFF/live checkpoint.

Tests may intentionally change synthetic copy expectations but never weaken canonical behavior/security tests.
