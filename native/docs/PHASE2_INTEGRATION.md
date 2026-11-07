# Phase 2: safe integration foundation

Baseline:653071d, draft PR141, 2026-11-07. This phase packages integration seams, not real services.
Production/ordinary builds and the installed demo identity are unchanged. No new dependency, permission,
URL registration, Firebase configuration, network host, database schema or data migration.

## Implemented and deliberately simulated

| Boundary | Implementation | What it proves / does not prove |
|---|---|---|
| Authentication | `integration/auth.ts`, native account/Login adapter | Random attempt/state, bounded completion, cancel/supersede, exact single-use synthetic callback, failure and expiry contracts; local A/B profiles only. No OAuth page or Google/Firebase sign-in |
| Session lifetime | `SessionLifetime`, account scope | Expiry clears selected identity and canonical UI, late work invalidated, resume checks wall time. Default demo session has no artificial expiry; local identity is public metadata, not a secure token |
| Account isolation | `integration/scope.ts` | Owner+generation leases invalidate prior requests/callbacks on logout/switch/background. Same UID on a later login does not revive an old lease |
| Conversations | `integration/sync.ts`, `demo/sync.ts` | Existing ChatSync-shaped callbacks, local canonical IndexedDB, guarded memory replica, replay/deletes and Incognito rejection. Replica/outbox are memory-only, not cross-device cloud sync or durable distributed conflict resolution |
| Projects/settings | `integration/settings.ts`, `demo/account.ts` | Local per-UID canonical records retained across logout. Deterministic account-scoped settings port rejects stale/wrong owner writes; no project cloud backend |
| Providers | `integration/provider.ts`, existing synthetic transport | Existing model selection, incremental template SSE, Stop, unavailable/retry, owner/background abort, cleanup. No real key, inference or provider request |
| Native lifecycle | `DemoViewController.swift`, `demo/lifecycle.ts` | Native background/foreground dispatch and browser visibility pause requests/sync. Active bool validated; no auth attempt canceled simply because a future system-browser UI backgrounds Canvas |
| Credential storage | `NativeSessionVault.swift`, `SecureSessionVault` contract | Inactive per-owner Keychain generic-password facility, WhenUnlockedThisDeviceOnly. Compiled in app, never called or bridged; no claim that credentials were stored/tested |
| Callbacks/deep links | AuthFlow exact callback contract | Synthetic state validation only. Unregistered demo callback, no external deep-link sign-in. SDK must own verified OAuth/PKCE/nonce before a completion is accepted |

### Evidence-driven data fix

Real UI reproduction: create project in Demo A, sign out, enter B, sign out, enter A: project absent. Native
`forgetLocalAccount` removed the only authoritative demo settings record. It now keeps sample account data;
session identity and canonical visible state still clear at logout. The same UI sequence now retains A's project
and does not show it in B. No production Firebase code changes.

### Lifecycle and offline semantics

Canonical React/store/IndexedDB remain the state owner. Backgrounding first invalidates leases and stops the
canonical stream; foreground checks session expiry, resumes scope and replays locally stored chats to the memory
replica. Browser/native WebView online/offline events separately pause synchronization; the local synthetic
provider adapter remains available offline; canonical composer intentionally keeps its offline send guard
and preserves the draft until connectivity returns. This phase does not change that product behavior. Pending synthetic deletes survive client stop/restart within the process, scoped by UID. This is a
simulation: no durable cloud outbox, cross-device delivery or production merge guarantee. Ending the app discards
its memory replica/settings mirror; canonical local chats/projects/drafts remain. Real cloud activation must reuse
canonical production conflict/deletion rules and durable retry contracts, not ship the demo replica as a backend.

Native UIKit events, page visibility and pageshow/pagehide can duplicate lifecycle notifications; scope changes
are idempotent and the canonical stream has one cancellation owner. Malformed bridge detail cannot resume work.
System-browser login must survive app backgrounding but never activate a stale/canceled login when returning.

## Exact protected activation proposal (not implemented)

1. Owner chooses a separate authorized **test** Firebase/Google environment and whether it uses the same signed
   bundle ID or another app. Keep existing demo namespaces; never migrate synthetic identities into real users.
2. Approve GoogleSignIn iOS SDK, test iOS OAuth client, exact reversed-client callback and URL handling. Use its
   supported system-browser/session flow, no WKWebView login/user-agent trick. SDK verifies OAuth nonce/state/PKCE;
   typed completion guards supplement, not replace, that verification. Review invite/access denial separately.
3. Keep one Firebase session owner: first evaluate canonical Firebase web with in-memory persistence plus native
   Google session restoration. Native SDK/Keychain retain durable credentials; short-lived credentials cross only a
   minimal audited bridge. Never persist secrets in localStorage or chat/settings records. If incompatible, compare
   a single native Firebase bridge before adding any second independent session owner.
4. Approve native credential bridge/API, test logout/revocation/expiry/locked-device behavior, deletion of only the
   departing owner's credentials, process death, callback replay/cancel, and wrong-account callback rejection.
   Current vault is inactive and has no SDK hookup; a new dependency/config or entitlement requires review.
5. Approve access to test Firestore/storage and exact network allowlist only after auth/invite checks. Adapt existing
   canonical sync driver; retain production rules/schema. Test concurrent edits/deletes/offline drafts, stale
   callbacks after account switch, Incognito exclusion and recovery without real production data.
6. Approve provider egress and credential source separately. Reuse canonical routing/eligibility/consent/streaming,
   no provider tokens in ordinary web storage. Stage availability/errors/cancel/background and usage/cost facts with
   authorized test traffic and an explicit spending decision; this phase authorizes no real request, even free.
7. Real accounts require a separately reviewed build/flag and fail-closed adapter wiring. Never remove default-deny
   controls just to make login work. Re-run account, transport, artifact-secret and ordinary/PWA isolation gates.

None of these approvals is implied by receiving an IPA. No production endpoint, billing, schema, remote code update,
merge/deploy or native visual redesign is enabled. See INTEGRATION_AND_UPDATES.md for signed update/rollback design.

## Verification and owner handoff

Pure tests cover auth success/failure/cancel, callback target/state/replay, expiry, owner/background abort,
two-client synthetic merge/delete/reconnect, wrong-owner settings and stale-driver suppression. Chromium/WebKit
exercise actual Canvas replies/drafts, Stop, typed background/resume, attachments, export IPC and project A/B/A.
WKWebView smoke checks canonical app features, HTTP denial, project recovery, Incognito, expiry and lifecycle
messages; programmatic bridge events are not proof of actual iOS suspension. Exact-head CI/native results live in
GitHub Actions and the PR; successful compile alone is not native functionality verification.

Owner when back at PC:

1. Keep your installed app and important sample exports. Download matching Lumen-unsigned-IPA artifact.
2. Sideloadly overwrite using the **same Apple Account, signed bundle ID and options**. Do not uninstall/reset.
3. Confirm prior A/B sample chats/projects/drafts still exist and remain separate. Create a project, A→B→A,
   force-close/reopen, confirm persistence. New default demo login still stays signed in until logout.
4. Send a sample reply then press Home/switch apps mid-stream. Return: no late reply/bounce/wrong account. Retry,
   lock/unlock and repeat, including an unsent draft/attachment. No real accounts, keys or private files.
5. Check real keyboard/IME, safe areas, export share sheet, text size and VoiceOver. Report OS/Sideloadly version,
   steps and screenshot for failures; do not delete app data as a workaround.

Phase1 physical launch/keyboard/separation/reopen evidence is owner-reported. Phase2 physical overwrite,
background/lock, secure storage, real callbacks/auth/cloud/providers and VoiceOver are **not verified**.
The free GitHub macOS + Windows/Sideloadly process and seven-day signing refresh are unchanged; native binaries
still require reinstall/refresh. This phase neither adds spending nor promises automatic free binary updates.
