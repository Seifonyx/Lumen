# Phase 3 implementation plan

Owner authorizes real auth/cloud/provider integration development, isolated test services only, $0.
Baseline2e39d07; PR141 stays draft/unmerged. Owner reports Phase2 overwrite/data/accounts/stream/background/
keyboard/exports passed on iPhone; VoiceOver and new real-service/native changes are not verified.

App-first 2026-11-07: native Chromium/WebKit reply/Router/draft/account regression passes. Production Canvas
synthetic loopback preview shows existing Library/Projects/provider setup, external requests denied. No live
production account/database/inference used. Connected project metadata contains no designated isolated Lumen
Firebase project; do not repurpose unrelated projects or production. This is an external activation dependency.

Decision: retain one canonical Firebase web session (inMemoryPersistence); supported GoogleSignIn iOS SDK owns
Google/Keychain state and system-browser PKCE/state/nonce verification. A constrained Capacitor bridge transfers
short-lived ID credential in memory only, never refresh tokens. No native Firebase session or cloud schema fork.

1. Fail-closed build manifest and network policy: offline-demo default; isolated-test requires complete approved
   nonproduction configuration, exact stable bundle/callback/client ownership. Production-connected mode rejected.
   Tests reject missing/production config, arbitrary hosts, unapproved provider requests and credential fields.
2. Native GoogleSignIn SDK plugin: sign-in/restore/logout/revoke/cancel with generation guards; exact scheme URL
   forwarding, SDK nonce/PKCE/state and Keychain persistence. No SDK initialization/network in offline mode.
   Swift Package via generated Capacitor SPM seam, not pbxproj changes. Build on free GitHub macOS runner.
3. Isolated service bundle: reuse canonical account-settings and ChatSync implementations through checked build
   patches; replace web popup/redirect with native SDK, Firebase persistence memory-only, keep provider keys out of
   disk, guard logout/restoration/account callbacks, no Demo fallback. Separate Login and native lifecycle owner.
   Demo bundle retains all old namespaces/behavior. No private user fixtures/config in public artifacts.
4. Real transport uses canonical routing/eligibility/streaming. Test allowlist denies all inference by default;
   missing independently verified zero-cost provider path is reported. Controlled mocks prove streaming/cancel.
   Existing production BYOK uses private Firestore settings and browser-local key cache, not a server-secret broker:
   native mode must not inherit plaintext key persistence. No invented paid relay or infrastructure.
5. Browser/emulator tests for canonical cloud/account lifecycle and controlled auth/transport; native device/Simulator
   compile/smoke, ordinary/Canvas isolation, affected checks/budgets, exact-head CI. Real OAuth/cloud/inference remain
   explicitly unverified without the designated test service/client/authorized test identity.
6. Update parity, exact missing-config/setup checklist, same-identity Windows overwrite guide, branch handoff/PR and
   conflict-safe live status. Deliver next safe unsigned IPA. No merge/deploy, billing or executable-code updates.

Primary implementation sources: GoogleSignIn10.1.0 headers and integration guide, Firebase web memory persistence
and Google credential exchange documentation. Dependencies pinned; no account/OAuth/Firestore console mutation.
