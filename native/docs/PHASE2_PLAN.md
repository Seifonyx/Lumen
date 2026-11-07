# iOS Phase 2: synthetic integration foundation

Owner authorizes implementation of isolated synthetic groundwork now; latest Phase1 IPA installation is not a gate.
Start653071d, PR141 experimental. No actual auth, cloud/schema, provider egress, spending, merge/deploy or new UI design.

App-first: re-ran current native bundle Chromium/WebKit reply/draft/account tests and production Canvas local preview
with external traffic denied. Interfaces are local: auth currently immediate UID selection; sync stub is a no-op.
Those are integration gaps, not proof of a production defect. Physical Phase1 upgrade remains untested by owner.

Approach: retain canonical React/store/IndexedDB/routing; add small native-only ports at existing account/sync/fetch
seams. A separate app state or rewritten production sync engine would duplicate ownership and is rejected.

Plan (test first):
1. AccountScope and AuthFlow: attempt/state/single-use callback/expiry/cancel guards; account/lifecycle AbortSignals;
   synthetic auth port; opaque credential-vault interface. Existing Demo UIDs/identity storage stay compatible.
2. AccountSync: guards the existing ChatSync-shaped driver, rejects temporary data and stale callbacks, pauses on
   offline/background/logout and replays canonical local state on resume. Deterministic memory replica is explicitly
   a simulation, not cloud durability or a replacement for production Firestore merge/schema. Scope projects/settings.
3. Provider port: wrap existing synthetic responses with account-owned cancellation, availability/errors and cleanup.
   Native app lifecycle events + browser visibility stop work safely; no new network path or inference code.
4. Native facilities: prepare inactive Keychain implementation and typed system-browser/callback contract. No Google/
   Firebase SDK, callback registration, credential bridge or actual session secrets. No entitlement/permission change.
5. Verify auth cancellation/expiry/stale callbacks; offline replay, data persistence and A/B/A project/chat isolation;
   streaming interruption/retry; native lifecycle bridge and unchanged default-deny policy. Run Phase1 regressions,
   affected checks/both builds/budgets, exact-head CI, iPhoneOS IPA and actual Simulator smoke. Inspect real screenshots.
6. Update matrix/integration proposal, owner test checklist, HANDOFF and conflict-safe live checkpoint.

Security boundaries: real SDK callbacks must be verified by the supported SDK before issuing a typed completion;
our synthetic callback gate is not a Google OAuth/PKCE implementation. Native Keychain facility is inactive until
approved native identity/session integration; synthetic identity metadata never masquerades as a secure token store.
A backend adapter and approved real test-account/credential access remain required for live sync/providers.
