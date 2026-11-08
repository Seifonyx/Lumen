# Existing-account iPhone release

Owner authorized normal Lumen web accounts and cloud data on2026-11-08, superseding the test-only restriction.
This is a private Windows/Sideloadly release, not an App Store distribution or web deployment. No paid developer
membership, new hosting, billing activation or remote code updates.

## Release decision

Reuse the packaged React/Canvas app, native GoogleSignIn SDK and existing Firebase/ChatSync adapters. Add explicit
`account-connected` build mode pinned to the canonical web Firebase configuration and the existing project. Keep
`isolated-test` and `offline-demo` separate and fail closed on cross-mode/project configuration. The same installed
bundle, `io.github.seifonyx.lumen.demo`, and Capacitor origin are preserved. The app now displays **Lumen**.

An iOS registration and matching Google iOS client were added to the existing Lumen Firebase project. Existing
Google provider/server client reused; no rules, schema, web hosting, billing plan or account records changed.
Administrative tooling reads configuration metadata only. It never signs into the app or reads user documents.

## User behavior

Sign in with the same authorized Google account used on Lumen's web app. Firebase remains the identity owner,
so it resolves that provider identity in the existing project and uses the same private cloud document paths.
The existing invite/account access rules remain authoritative. Uninvited accounts receive the normal access denial.
There is no test-claim requirement and no manual UID mapping or artificial account impersonation.

Cloud conversations, settings and projects reuse canonical persistence. Drafts and account cancellation contracts
remain; pending unsent Files are memory-only as before. Local storage/session storage/IndexedDB for this backend
are namespaced separately from the older demo/test stores. No test cache is adopted into real accounts, even if UIDs
coincide. The original stores remain intact for rollback. No production data migration or destructive cleanup.

Router reuses the existing account's OpenRouter key through its private cloud field. Native free-only consent
is still required per device/account/key/project, with fresh free-account/key-limit/BYOK checks before chat.
Zero-price free text models, streaming, Stop and canonical errors are retained. Login never authorizes paid
requests automatically. Saved non-OpenRouter cloud key fields are neither overwritten nor deleted.

## Scope and honest remaining limits

This removes the separate test login/data barrier. It does not establish complete native service parity. The
native request guard still enables Firebase plus explicitly consented free OpenRouter text only. Paid providers,
remote research, image generation, embeddings and worker/CDN execution remain unavailable in this build; their UI
must not be treated as proof of native execution. These are future incremental compatibility work, not a reason
to activate unrestricted networking or paid fallback for this release. Preserve canonical web capabilities unchanged.

The original physical-iPhone Google failure's stage is still unknown. Startup restore/login ordering is fixed,
with safe signing/callback/Keychain/nonce/Firebase error codes preserved. A production iOS client does not itself
prove that Sideloadly signing, native callback or Keychain works on the owner's device. No success claim or manual
prelaunch checklist is substituted for that limitation.

## Build and installation

Workflow **iOS connected private IPA** (`ios-connected.yml`, connection `account-connected`), triggered manually or by `[account-ios]` pushes,
uses standard free macOS/Xcode, private SDK metadata in an Actions secret and the existing recipient public key.
Only encrypted delivery is uploaded. The private RSA key stays on the owner's Windows PC. Native test and offline
workflows/configuration remain separate; account-tagged pushes skip unnecessary offline builds.

Install the decrypted IPA in Sideloadly with the same Apple account and bundle options. Overwrite the current
installation; **do not uninstall, reset data or choose a new bundle identifier**. Free signing/refresh limitations
are unchanged. No web deployment or PR merge is necessary to install the native app.

## Verification

All QA uses synthetic identities, mocked Firebase credential rejection or loopback emulators. No real Google
sign-in, production conversation read/write, provider credential or live inference is used by automation. Focused
checks cover canonical build pinning, explicit mode approval, token/nonce checks, project/account consent isolation,
legacy-cache preservation, actual Chromium/WebKit Login and namespaced IndexedDB, plus existing native regressions.
Require native arm64 compile/package validation and green exact-head PR CI before delivering. Remaining physical
sign-in, sync, keyboard and VoiceOver behavior is unverified until normal device use supplies evidence.
