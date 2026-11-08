# Native Google sign-in: first physical-iPhone blocker

> **Newer owner direction (2026-11-08):** Codex has been asked to integrate and roll out the real Lumen Canvas native app rather than prolong the test-only RC. These diagnostic findings and the already implemented focused fix remain valid evidence; they are not a requirement for another prelaunch QA campaign. The owner's actual installed Google sign-in stage remains unverified until new device evidence is available. Do not bypass nonce, callback, bundle identity or Firebase account checks.

2026-11-08. PR141 remains draft; web deployment, Firebase access rules and installed signing identity are unchanged.

## Repeated AUTH_FIREBASE: verified API key policy rejection

The owner still sees AUTH_FIREBASE after the nonce handoff fix. The Sideloadly cached input matches that delivered
IPA by SHA256. Read-only project metadata shows its Firebase key is restricted to website referrers. A request with
an intentionally invalid synthetic Google token and no website referrer returns403 API_KEY_HTTP_REFERRER_BLOCKED
before token validation. This independently reproduces a real native-only configuration blocker; it is not a
claim to have obtained the owner's device error payload or successfully signed in.

The account build now uses the existing iOS registration's separate Firebase key. Its original iOS bundle allowlist
and API targets are retained, adding only the independently verified Sideloadly installed identity. Native fetch/XHR
adds X-Ios-Bundle-Identifier only on already allowed Firebase Auth/Firestore requests. Canonical web configuration
and browser-key restrictions are unchanged; no referrer spoofing, unrestricted key, auth-policy or database changes.
The build requires this native key to be distinct and bound to the approved signed bundle. Source bundle, OAuth
callback, signing equality, local token/nonce validation and Firebase credential exchange remain intact.

Backend checks with the native key reject a missing bundle header403, then reach INVALID_IDP_RESPONSE400 with the
correct header. Auth/Firestore preflights accept the native header from the WebView's opaque origin. All probes use
invalid synthetic credentials or OPTIONS; no account was authenticated/created and no user data was requested.
The actual browser SDK verifies platform-key selection, nonce-bearing exchange, fetch/XHR headers and static safe
policy errors in Chromium/WebKit with external traffic mocked/denied. Physical successful login remains unverified.

The earlier nonce omission was a separate proven code defect: GoogleAuthProvider.credential dropped rawNonce after
local validation. OAuthProvider google.com now retains idToken + rawNonce. That correction alone did not resolve
the physical report and is preserved rather than weakening nonce checks.

## Evidence and bounded fix

The owner reports the installed Lumen Test app launches but shows the old generic sign-in failure. This establishes
an actual failure, **not its stage**. No native device log or signed installed package is available here.

At the previous RC source, `watchNativeUser` immediately starts `RealSession.signIn(true)` while the Login button is
already visible. A controlled delayed restore reproduces a tap rejecting with “A sign-in is already in progress”,
with **zero interactive Google calls**. The actual Canvas Login/account coordinator reproducer exercises this boundary
in Chromium/WebKit using a synthetic native bridge. The fix waits for that startup restore before interactive login;
a successful restore satisfies the queued login, and cancel/logout invalidates it before a chooser can open.
This is a proven source defect. It is not proof that every owner failure, or this particular physical failure, was the race.

The UI now shows only fixed actionable classifications. It never displays arbitrary SDK/Firebase descriptions,
identity tokens, callback URLs/query values, account identifiers, credentials, or error causes. Cleanup failures no
longer overwrite the original stage error. No persistent diagnostic telemetry or credential logging was added.

## Authentication boundaries investigated

| Stage | Evidence / retained contract |
|---|---|
| Installed identity | Unsigned RC and local Sideloadly cached input have matching approved bundle/config. Cache input is unsigned: it does **not** establish the final installed bundle ID or entitlements. Exact installed `signedBundleId` guard remains; mismatches now report `AUTH_SIGNING`, not a generic failure. Never change the installed identity/uninstall to troubleshoot. |
| Bridge/config/presentation | Native-only trusted capacitor localhost origin retained. Missing bridge, config, presenter and callback registration have distinct safe codes. No arbitrary web-supplied OAuth configuration. |
| Google chooser and callback | Pinned GoogleSignIn10.1.0/AppAuth own system-browser OAuth, state and PKCE. SDK source uses the reversed-client scheme and `/oauth2callback`, matching Lumen's existing exact callback filter. SceneDelegate routes recognized callbacks only to SDK and never to Canvas. No evidence of an incorrect callback path; filter not relaxed. |
| Google SDK / Keychain | Error codes are interpreted **only** in the Google error domain. Keychain(-2), cancellation(-5), policy(-6), network and unknown failures have fixed classifications. No-auth(-4) is signed-out restoration only. No evidence of missing installed signing entitlements; Keychain protection remains unchanged. |
| Token validation | Nonce shape/hash, issuer, exact configured server-client audience, time/expiry and token structure remain required. Distinct token/nonce/client/expired codes; no fallback token acceptance. Local parsing is not authentication: Firebase must still validate the signed credential. |
| Firebase exchange | Uses Firebase OAuthProvider google.com/signInWithCredential with the locally validated raw nonce and memory-only session. The account mode uses the approved existing project; isolated test mode remains separate. Native platform key/header avoids the reproduced website-referrer rejection. Mocked400/403 SDK tests preserve safe network/config/key-policy/credential/account-disabled classes; no successful physical exchange is claimed. |
| Account isolation | Firebase remains sole identity owner. No UI account published before validated exchange; canceled late work stays blocked, logout clears active account, and failed authentication never opens Demo or deletes Demo A/B data. |

## Safe visible codes

- `AUTH_SIGNING`, `AUTH_CONFIG`, `AUTH_CALLBACK_CONFIG`: a build/signing configuration issue; preserve installed data.
- `AUTH_BRIDGE`, `AUTH_ORIGIN`, `AUTH_PRESENTATION`: native sign-in cannot start from this context.
- `AUTH_BUSY`, `AUTH_CANCELED`: another attempt or cancellation; no account accepted.
- `AUTH_STORAGE`, `AUTH_GOOGLE_NETWORK`, `AUTH_GOOGLE_POLICY`, `AUTH_GOOGLE`: Google SDK did not deliver a usable credential.
- `AUTH_TOKEN`, `AUTH_NONCE`, `AUTH_TOKEN_CLIENT`, `AUTH_TOKEN_EXPIRED`: local credential security checks failed.
- `AUTH_FIREBASE_NETWORK`, `AUTH_FIREBASE_CONFIG`, `AUTH_FIREBASE_KEY_POLICY`, `AUTH_FIREBASE_CREDENTIAL`, `AUTH_ACCOUNT_DISABLED`, `AUTH_FIREBASE`: Google credential reached Firebase exchange, which failed. Key-policy errors show a fixed build-update action, never server descriptions or identifiers.
- `AUTH_SESSION`, `AUTH_UNKNOWN`: session clearing or otherwise unclassified failure. No diagnostic error detail exposed.

## Focused verification and delivery

`node --experimental-strip-types --test native/tests/auth-errors.test.mjs native/tests/real-session.test.mjs native/tests/google-token.test.mjs native/tests/plugin-bridge.test.mjs`

`node --experimental-strip-types native/scripts/browser-auth.mjs`

The browser test uses the actual packaged Canvas Login and native account coordinator with only an injected synthetic
Google bridge and a mocked Firebase credential rejection. All other external egress is denied. It covers delayed
restore, signing/storage/callback/cancel/nonce errors, platform key/header, two mock Firebase exchanges, redaction, no
Canvas account on failure and Demo disk preservation. It does not test a real Google chooser/callback, signed-app
Keychain or the owner's identity. Existing private connected build encrypts IPA delivery; install over the app with
the same Sideloadly Apple account/bundle settings, without uninstalling. Physical sign-in success remains unverified;
no repetitive/manual prelaunch checklist requested.

Sources: [Google iOS setup](https://developers.google.com/identity/sign-in/ios/start-integrating),
[SDK errors](https://developers.google.com/identity/sign-in/ios/reference/Enums/GIDSignInErrorCode),
[pinned callback/nonce/server-client implementation](https://github.com/google/GoogleSignIn-iOS/blob/10.1.0/GoogleSignIn/Sources/GIDSignIn.m),
[API key restrictions and iOS identity header](https://docs.cloud.google.com/docs/authentication/api-keys),
[Sideloadly overwrite guidance](https://sideloadly.io/faq.html).
