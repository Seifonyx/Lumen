# Phase 3 test environment and verification

2026-11-07. Owner explicitly approves a separate Spark-only `lumen-ios-test` Firebase project, Google Auth,
iOS/web clients and strict per-account Firestore. No production account/data/config, billing, app deployment,
PR merge or inference. The existing offline installation and Demo A/B namespaces remain unchanged.

## Actually provisioned and read back

- Firebase project `lumen-ios-test`, display Lumen iOS Test. Billing disabled, no billing link or upgrade.
- Web and iOS Firebase app registrations. iOS source bundle `io.github.seifonyx.lumen.demo`.
- Google Authentication enabled, web client and iOS client IDs verified against project number. iOS reversed-client
  callback scheme matches SDK output. Provider client secret stays in the managed service, never copied to source.
- `(default)` Firestore, `europe-west1`, Standard edition, `freeTier:true`. No paid storage/functions/hosting deployed.
- Deployed rules require Firebase Google provider plus admin-issued `lumenIosTest:true`, and exact auth UID matches
  `modelRouter/{uid}`. All other paths denied. Remote rules read back; unauthenticated real test request denied403.
- Provisioning used the Firebase plugin in an ignored, isolated admin directory, never production firebase.json.
  SDK metadata is an ignored private build input. No account password, provider key, signing material or OAuth token
  is committed, printed or uploaded. Auth provider readback redacts/omits its managed client secret.

Default IPA/build stays offline. `LUMEN_NATIVE_MODE=isolated-test` additionally requires explicit test configuration;
no silent Demo fallback. No new IPA installation or manual screenshots/testing requested in this round.

## Native implementation and evidence

GoogleSignIn10.1.0 uses its supported system-browser/AppAuth flow and Keychain session. Native bridge sends only a
short-lived ID credential and nonce to Firebase web in-memory auth, the sole Firebase session owner. Existing Google
credential exchange checks nonce/audience locally and still requires Firebase server signature/identity validation.
SDK compilation at5c7d0da passed in workflow42407184839; PR CI42407188368 passed32/32. No real OAuth success inferred
from compilation. The newest revision's exact-head results belong in PR141/live CURRENT_STATUS.

This revision addresses demonstrated defects:

1. Capacitor defaults can log resolved plugin payloads (`TO JS`). Native `loggingBehavior:none` disables that channel;
   regression protects it before real credentials can be exchanged. Existing controller diagnostic markers contain
   fixed text only; no authentication payload or URL is logged.
2. Native offline pending delete existed only in memory. Repro: delete offline, reload, reconnect: remote chat returns.
   Native real-service adapter now writes canonical `mr.sync.deletes.{uid}` JSON array before deferring a delete. No
   new schema/key. Queue stays until server ACK; pending records cannot resurrect.
3. Cache-first reconnect could overwrite newer server revision4 with offline revision3. Actual emulator diagnostics
   showed server downgrade. Native-only canonical sync adaptation waits for a non-cache initial snapshot, including
   its metadata confirmation, before conflict reconciliation and catch-up uploads. Latest server revision now wins.

Attachment-original cleanup keeps canonical best-effort behavior; deletion acknowledgment is not a guarantee
that every original-file cleanup operation succeeded.

Canonical cloud collections, message serialization, project/settings shape and production source remain unchanged.
Build patches fail closed if upstream method/snapshot contracts change. Default demo adapter is preserved.

## Automated coverage (synthetic only)

`node --experimental-strip-types --test native/tests/*.test.mjs`

`node native/scripts/browser-service.mjs` builds an ignored isolated-service bundle. Default inputs are explicitly
fictitious; local use can point LUMEN_NATIVE_SERVICE_CONFIG to verified test SDK metadata. Chromium/WebKit check
Login/reload, unsupported native bridge failure, no Demo fallback, retained existing Demo settings, no off-origin
requests. This proves fail-closed behavior, not successful Google sign-in. No screenshots are required.

`node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --only auth,firestore --project demo-lumen-ios-test --config native/firebase-emulators.json "node native/scripts/browser-cloud.mjs"`

Cloud harness uses Auth/Firestore emulators bound to loopback and a demo-prefixed project only. Firebase Google
identity tokens and administrator claims are emulated. Actual canonical Firestore driver and native scope adapter
exercise two clients, server revisions, offline catch-up/conflicts, projects/settings, pending delete/restart/ACK,
Incognito exclusion, logout, anonymous/foreign UID/unapproved Google/password-provider denial. All browser egress
outside loopback aborted; no actual Google account, cloud document or inference used in this suite. Harness code is
not imported by packaged app entry and the native graph denies tests/fixtures. Native workflow runs these checks.

Local cloud tests failed on restart deletion and stale-cache conflict before fixes, pass Chromium/WebKit after.
Ordinary/Canvas affected checks and unchanged budgets, native type/config tests and exact-head CI remain required.

## App-client authorization: one supported, user-consented step

The owner explicitly approved a Google identity for this isolated project. Its verified Google subject is linked
in test Firebase with the administrator-issued test claim. That permission does not itself complete Google OAuth.
Administrative Firebase/CLI credentials must never be exchanged for an app session. The earlier administrative
credential exchange was rejected and is retired; native nonce/audience checks remain unchanged.

The test project's authorized domains now include localhost (existing Firebase domains retained). The reserved
Firebase auth handler is available without deploying an app or enabling billing. No production configuration changed.

Run from the repository on Windows:

```powershell
node native/scripts/authorize-test.mjs
```

The command uses ignored test SDK metadata and the already-approved identity's email metadata. It never loads
administrative credentials, passwords or client secrets. Open its printed `http://localhost:5213/<session>/` URL
in the Windows browser; click **Continue with Google**, select the approved identity and complete Google's consent.
This Google-owned account/consent interaction cannot be automated or replaced by administrative authorization.
Do not forward this private port, copy tokens, change user agents or use an iPhone for this step. The session
expires after20 minutes; rerun for a fresh link. Close the browser page and stop the command if interrupted.

Firebase's supported `signInWithPopup` flow owns OAuth handling; authentication is memory-only. After verifying
Google provider, exact approved identity, test-project audience and the server-issued claim, the page creates,
server-reads and deletes one uniquely named synthetic chat sample under its own UID. It does not read existing
settings, provider keys or production data. It signs out, destroys the Firebase app and reports only fixed status
booleans to loopback. Cloud operations have deadlines; stalled work terminates Firestore and signs out. Only a
random pending sample ID (no identity/token) is kept in sessionStorage for same-tab retry/reload cleanup after
approved sign-in. Keep that tab open if deletion is unconfirmed. The ignored report contains no identity or credentials. The helper is excluded from the IPA
module graph; it is never a WKWebView sign-in workaround or an alternative native session.

The report is a local browser self-report, not an authentication credential or server-side proof accepted by the
app. A successful run verifies this web app-client consent and cloud sample only. Native GoogleSignIn callback,
installed signing-bundle compatibility, Keychain restoration/revocation and physical iPhone remain separately
unverified. No manual device test is requested this round. No consent success is claimed before the user completes it.

`node native/scripts/test-authorization.mjs` checks Chromium/WebKit with all external traffic denied: opening the
page starts no sign-in/network and writes no localStorage. It also rejects wrong origin/session/Host and unexpected
result fields. Native tests, native typecheck, offline build verification and ordinary/Canvas affected checks remain
required; this synthetic test does not prove live OAuth.

Primary references: [Firebase Google popup sign-in](https://firebase.google.com/docs/auth/web/google-signin),
[in-memory persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence),
[custom Auth dependencies](https://firebase.google.com/docs/auth/web/custom-dependencies).

No real provider networking/inference, production-connected mode or executable updates enabled. No new spending.
