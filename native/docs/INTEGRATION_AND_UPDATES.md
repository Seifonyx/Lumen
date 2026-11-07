# Real integration and update architecture

2026-11-07. No endpoint, remote executable update, auth configuration, permission, Keychain plugin or provider
integration is activated by Phase 1. The React/Canvas application remains the product; native SwiftUI/UIKit
improvements come after functional parity. See FEATURE_PARITY.md for actual packaged/blocked features.

## Real-account foundation: explicit approvals before implementation

The current demo aliases out Firebase SDK/config and uses local preview UIDs. Never rename/migrate those UIDs into
real cloud accounts. Preserve their local databases as separate sample data; real Firebase UIDs use separate stores.
The existing invite-only authorization is not replaced by possession of a Google token.

Phase2 synthetic-only groundwork is now implemented; see [PHASE2_INTEGRATION.md](PHASE2_INTEGRATION.md).
The following **real integration activation** remains a separate approval, not an installation prerequisite:

1. Verify the actual identifier signed by Sideloadly. Keep `io.github.seifonyx.lumen.demo` for compatible demo upgrades;
   changing the installed identifier/team/origin can create another sandbox. Do not delete the working installation.
   Owner decides whether real-account testing shares this identifier or uses a separate isolated application.
2. Approve a test Firebase iOS app/Google iOS client and exact callback scheme matching that installed identity.
   Approve any authorized-domain/provider-console changes individually. No Apple ID/signing secrets enter CI.
3. Add the supported GoogleSignIn iOS SDK and its system-browser authentication flow. Never run Google's OAuth
   authorization page inside WKWebView or spoof the user agent. Route the exact reversed-client-ID callback via
   SceneDelegateProxy/AppDelegate, validate callback/state through the SDK, and reject arbitrary application URLs.
4. Prefer keeping the existing web Firebase/Firestore integration as the only Firebase session owner. Native
   GoogleSignIn owns its Google session in the platform's supported credential storage. Review a design using
   Firebase web `inMemoryPersistence`; restore the Google session through the SDK, refresh its tokens if needed,
   then pass a short-lived Google credential into canonical `signInWithCredential`. This avoids adding a second
   independent native Firebase session or persisting Firebase refresh tokens in custom JavaScript storage.
   This proposed combination still needs a capability spike in WKWebView, SDK persistence review and owner approval.
   If it cannot meet restore/revocation/security requirements, stop and compare a native Firebase/Firestore bridge;
   do not silently create two divergent authentication owners.
5. Bridge only typed, main-frame, expected-origin messages. Tokens stay out of URLs, logs, DOM, analytics, chat
   records and exports. No refresh token is manually copied into localStorage. JavaScript still receives an
   authenticated Firebase session and usable in-memory credentials: this is not immunity from an XSS compromise.
6. Bind every asynchronous callback to account UID + auth generation. On logout/switch, abort streaming, helper
   requests, indexing, uploads and work; clear web/native sessions and cached account UI before loading another UID.
   Existing `store.ts`, db/sync/resume and Incognito ownership remain canonical. Test canceled/late OAuth callbacks,
   revoked credentials, denied invites, offline restore, expired sessions and A->B->A, including app termination.
7. Provider keys: preserve saved versus enabled/verified and paid-request consent. Choose the precise approved
   storage policy before implementation: existing per-account Firestore keys under current rules versus native
   per-UID Keychain storage. Those are not equivalent (cloud availability versus device security). No schema or
   secret-migration change is implied. The JS inference path needs keys in memory, so minimize lifetime and keep
   them out of bridge diagnostics/downloads. Never enable a paid-capable provider simply because a key is saved.
8. Networking: approve only required Firebase/Google hosts first, followed by a separate provider/relay allowlist
   and real-inference/consent ticket. Current egress remains deny-by-default; don't turn on CapacitorHttp globally.
   Check custom-scheme CORS, header handling, streaming fetch, cancellation/timeouts, redirects, TLS, suspension and
   network loss per provider. Prefer the canonical web fetch path when it works. Add narrow native transport only
   if evidenced necessary; it must stream, propagate AbortSignal and never change canonical routing/permissions.
9. Files: canonical IndexedDB/account stores stay authoritative. Native imports use scoped access/copy and
   explicit picker cancellation; exports use temporary files + share sheet cleanup. No broad photo/microphone
   permission or filesystem exposure. Separate owner review for camera, voice, notification and deep-link abilities.

Reference checks: Google's [OAuth embedded user-agent policy](https://developers.google.com/identity/protocols/oauth2/policies#disallowed_user_agents),
[Firebase native Google sign-in](https://firebase.google.com/docs/auth/ios/google-signin),
[Firebase web persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence),
[Google iOS sign-in](https://developers.google.com/identity/sign-in/ios/start-integrating).
These describe primitives, not a verified Lumen integration. Native configuration, SDK dependencies, identity,
network allowlists, credential storage and approved test-account access all require explicit approval.

## Update classes

| Change | Delivery | Constraint |
|---|---|---|
| Current app HTML/CSS/JS/assets/fonts | Today: rebuilt IPA, signed and overwritten from Windows | Works offline, auditable source; simplest/free safe baseline |
| Eligible same-capability web fixes | Possible future signed compatible web bundle | Not implemented; separate policy/security/network approval |
| SwiftUI/UIKit, plugin/Capacitor ABI, permission/entitlement, URL scheme or native dependency | New IPA + Windows signing/install | A JS update cannot add native code or bypass seven-day signing |
| Data format/schema | Separate migration/recovery review, often new binary baseline | Rollback must remain readable; never erase owner demo data |
| Distribution beyond personal testing | Separate approved distribution program/policy review | No promise of App Store/TestFlight reach with a free personal sideload |

Sideloadly refresh re-signs an IPA; it is not a source-code build, a remote web bundle updater, or automatic
installation of every GitHub commit. Native updates always require a newly signed/installed IPA. Neither a web
bundle nor a refresh daemon can keep an expired binary valid without Apple's permitted reprovisioning process.

## Future compatible web updates: proposed threat model and protocol

Do not add an OTA dependency, public production endpoint or executable downloader in Phase 1. Continue shipping
bundled assets. If later authorized, prefer a small explicit verified-bundle subsystem over redirecting to a website.
Public GitHub artifacts/releases may be evaluated as a free distribution origin, with availability/rate/retention
limits; it would still be new app egress/distribution requiring approval, not guaranteed free infrastructure forever.

- Embed a trust public key in the binary. Keep its private signing key outside source and public artifacts, with a
  separately approved signer/key-rotation process. A checksum alone is not authenticity. Sign a canonical manifest
  with an established signature algorithm (for example Ed25519); verify manifest signature and every asset digest
  natively before loading. TLS is additional protection, not a substitute for the embedded trust root.
- Manifest binds bundle identity/channel, monotonically increasing release, source commit, archive hash/size,
  expiration/issue time, minimum iOS, exact native bridge ABI/Capacitor version, and readable storage-contract range.
  Reject unknown fields where they change security policy, wrong channels, incompatible ABI/data formats, stale
  signed replay and downgrade below the approved security floor. Define offline expiration/grace policy explicitly.
- Fetch into an inactive directory, enforce compressed/uncompressed size/file count, reject path traversal,
  symlinks/absolute names, unexpected executables and unlisted assets. Never point the WebView at partial downloads.
  Use content-addressed complete snapshots; hashed lazy chunks, fonts and worker assets must belong to one release.
- Activate atomically on a safe cold launch; reuse canonical update-hold requirements for in-flight work, unsent
  attachments and Incognito. No surprise mid-conversation reload. Keep the embedded fallback and last-known-good
  snapshot. Only acknowledge success after app bootstrap, compatible data open and a bounded health check.
  Crash/failure before acknowledgment reverts to the last compatible version; a bad network stays on bundled assets.
- Store release/health metadata separately from account/chat data. No migration in Phase 1. Future migrations need
  explicit versioned, idempotent, transactional, account-scoped steps with preflight backup and disk/quota handling.
  A rollback binary must be able to read the resulting data or activation is refused. Don't claim irreversible
  migrations can be undone by replacing JavaScript. Test power loss, full disk, corruption and interrupted upgrades.
- Updates must not expand bridge permissions, connect to new hosts, enable real accounts/paid requests or introduce
  features requiring new native abilities. Key revocation/rotation and emergency rollback need a documented threat
  model; a compromised distribution origin alone must not authorize executable changes.
- Preserve `capacitor://localhost`, installed identifier and sandbox for compatibility. Don't switch to a remote
  server URL or different scheme/host to implement updates: origin changes can strand IndexedDB/localStorage.

Apple's [App Review Guidelines 2.5.2](https://developer.apple.com/app-store/review/guidelines/#software-requirements)
restrict downloaded code that introduces/changes app features. Private personal testing is not App Store review,
but it is not permission to bypass signing or applicable Apple agreements. Future distribution must be checked
against its actual rules; approval of this architecture is not a policy-compliance guarantee. Keep binary delivery
as the reliable fallback and never promise App Store-equivalent automatic binary updates through free sideloading.

## Prioritized next phase

1. Owner: finish physical overwrite-upgrade acceptance on the same installed demo: chat/project/Study/draft intact, native
   share sheet, normal navigation, keyboard/IME and no wrong-account surfaces. Use sample files only; don't uninstall.
2. Approve and spike the exact Google/Firebase/Keychain/session/network design above, isolated from production.
   Require denied-invite/revocation/logout/late-callback and account switch tests before enabling real accounts.
3. Approve provider networking separately, then validate full model/provider/routing/stream/cancel/consent parity
   with authorized test credentials and spending boundaries. Phase 1 does not authorize even a free real request.
4. Resolve local worker/PDF/Knowledge/runner/frame gaps with packaged resources and isolation tests, then file import,
   native exports and advanced tools. No arbitrary frame/native bridge exposure as a parity shortcut.
5. Recheck every matrix row on the actual iPhone and complete privacy/accessibility/lifecycle tests. Only then design
   native SwiftUI/UIKit/Liquid Glass improvements within an approved new phase.
6. Consider the signed web-update subsystem only after storage/ABI contracts and distribution policy are stable.
   Free Windows binary signing/refresh remains required irrespective of web updates.
