# Lumen native iPhone app — current delivery and historic demo guide

> **Owner direction (2026-11-08):** Codex is integrating the *actual existing Lumen Canvas product* into the native iPhone app for usable private rollout now, followed by incremental fixes and updates. The previously isolated test app is a stepping stone, **not the target product**. The assignment is not a claim that the real-app connection or production login already works. See the live [execution checkpoint](../docs/lumen-context/CURRENT_STATUS.md) on `docs/lumen-live-context`, not this older branch's historical examples.

**Last verified native build:** PR #141's connected test RC/sign-in fix at `13ffc52`: compiled, encrypted and delivered privately; automated auth/Canvas browser contracts and exact-head CI passed. Owner's physical screenshot shows Lumen Test launched but Google sign-in failed; the repair addresses a reproduced startup restore/login race, not independently verified success on the installed iPhone. Existing user data, signing identity and demo namespaces must be preserved.

**Launch requirements:** reuse canonical Canvas navigation, projects, drafts, real AI/model routing, user-scoped credentials, streaming and Stop; preserve account isolation and privacy. Build an actual private iPhone candidate with an unchanged compatible bundle/signing identity wherever feasible. Do not uninstall the prior app to troubleshoot. No secrets in IPA/source/artifacts, no paid services or paid fallback. Do not claim a build, merge, Firebase Hosting deploy and iPhone installation are the same event.

**After launch:** secure OTA delivery for compatible React/CSS/web assets, then verified native UIKit/SwiftUI Liquid Glass improvements and regular bug fixes; Swift/plugins/entitlements/signing still require a new IPA.

## Historical offline-demo build / signing instructions

The instructions below describe the **old offline demo artifact**, not the active connected-release candidate or new real-app rollout. Use the dedicated encrypted connected-iPhone workflow for the native release and its private delivery process.

## Offline demo download and update (historical reference)

1. Open [iOS unsigned demo IPA runs](https://github.com/Seifonyx/Lumen/actions/workflows/ios-demo.yml).
   Choose the latest `experiment/ios-sideload` run matching PR141's head. Check native build/Simulator **and** browser
   job results. A downloadable IPA alone proves compilation, not successful runtime verification.
2. Under **Artifacts**, download **Lumen-unsigned-IPA**, unzip it and find `Lumen.ipa` plus `Lumen.json`.
   Metadata gives source commit, unsigned iPhoneOS arm64 architecture and SHA-256. On Windows:
   `Get-FileHash .\Lumen.ipa -Algorithm SHA256`. Artifacts expire after seven days; keep a local copy.
3. Open [Sideloadly for Windows](https://sideloadly.io/). Use the Apple iTunes/iCloud device components linked there.
   Connect the trusted/unlocked iPhone by USB. Load the IPA in normal Apple ID Sideload mode.
4. **For an upgrade, keep exactly the same Apple Account, signed bundle ID and Sideloadly bundle options as your
   working installation. Overwrite it. Do not uninstall/reset the app or choose a new identity.** Source bundle ID
   stays `io.github.seifonyx.lumen.demo`; confirm any Sideloadly-specific suffix/custom ID matches your installed one.
   Leave tweak injection off. Enter Apple credentials/2FA only locally in Sideloadly, never GitHub or Lumen.
5. First install only: trust the developer in iPhone Settings > General > VPN & Device Management. Enable
   Settings > Privacy & Security > Developer Mode if prompted, then restart/confirm. Existing installs keep their setup.
6. Launch Lumen Demo; check your prior sample chat/project, draft and A/B separation before creating new samples.
   Test Airplane Mode launch, typing, Stop, navigation, Study and Save to Files. New native upgrade/keyboard/VoiceOver
   and share-sheet acceptance still needs the physical iPhone. Report any failed overwrite without deleting app data.

`capacitor://localhost`, both demo UIDs and canonical local database/schema names are unchanged. Compatible overwrite
is intended to preserve the sandbox; changing signing identity, deleting/offloading/resetting or OS storage loss can
invalidate that expectation. Export important sample chats with the existing chat export where available first.
A browser same-origin update check is useful evidence, not proof of physical Sideloadly overwrite or recovery.

## Free signing and refresh

Free Personal Team signing lasts **seven days**, not indefinitely. Apple documents up to **3 apps per device**,
**3 registered devices** and **10 App IDs**, with periodic expiration/reprovisioning. Don't create new bundle IDs
for each build. [Apple limits](https://developer.apple.com/help/account/basics/about-your-developer-account/)

Enable Sideloadly's **automatic refresh** when sideloading. Its daemon must run on an awake Windows PC with internet
and the iPhone detected over USB or paired Wi-Fi. For Wi-Fi, initially use USB, enable iTunes > device > Summary >
Options > Sync with this iDevice over Wi-Fi, then Sync/Done. Use the same local network; an unlocked/awake device
may be needed for discovery. If refresh misses, connect USB and refresh manually before expiry. A sleeping/off PC,
isolated Wi-Fi/VPN/firewall or unavailable device can prevent it. If expired, re-sign from Windows; don't delete Lumen.
Update the daemon's cached IPA by sideloading the new IPA with the same Apple/bundle ID and refresh enabled.
Refresh re-signs the stored IPA; it does **not** automatically build/download the latest GitHub code or install native
changes without a new IPA. [Official Sideloadly FAQ](https://sideloadly.io/faq.html)

## Free builds, limits and failure recovery

The workflow uses standard **public-repository** macos-26 and Ubuntu runners, read-only contents permission,
locked dependencies, no Apple/signing secrets and no deployment. GitHub documents standard public runner compute
as free; larger runners are billed and are never selected. GitHub Free lists **500 MB shared artifact storage** and
**10 GB repository cache allowance**; don't assume unlimited retained files or account-wide spare capacity. Evidence
retention is short, IPAs are small and expire in seven days. Never enable billing/paid runners or raise storage limits.
If a free limit blocks uploads, keep the last local IPA and wait/clean up only explicitly approved expendable artifacts;
do not buy capacity. Public runner availability/queues are not a guaranteed service level.
[GitHub billing and limits](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

To rebuild, rerun a branch run in Actions or push to this exact branch. The workflow supports manual dispatch,
but GitHub exposes Run workflow only once a workflow is on the default branch. No merge is needed to rerun this
experiment's existing run. There is no schedule wasting free runner time. Native and browser jobs show individual
failed steps; the native summary distinguishes IPA compilation from Simulator pass. Download smoke evidence for
screenshots/report/logs. A failed boot is different from an app exception; don't claim both work from one artifact.

## Offline build safety and remaining gaps

- Canonical React/Canvas screens and local data owners are reused. Production PWA/ordinary builds stay unchanged.
- Native SceneDelegate now selects the custom guarded controller; runtime smoke must prove this, not just compile.
- CSP/WebKit rules deny external resources; native HTTP RPC rejects locally. No real Firebase SDK/config or keys.
- No service worker/remote executable updates. All JS/lazy chunks/fonts are bundled; updates currently need a new IPA.
- No camera/mic/photo permission or new native dependency. Native exports use a scoped <=10 MB blob/share bridge.
- Worker execution, semantic embeddings, external research/GitHub/image services, cloud sharing/sync, arbitrary
  iframe preview and real voice remain unavailable or require further native compatibility work. UI is retained.
- Protected native authentication/network/credential integration and future signed web updates are **design only**:
  [approval boundaries and next phase](docs/INTEGRATION_AND_UPDATES.md). Do not use real accounts or enter real keys.

## Developer checks (Windows, repository root)

```powershell
npm.cmd ci
npm.cmd ci --prefix native --ignore-scripts
node --experimental-strip-types --test native/tests/*.test.mjs
node native/scripts/build.mjs
node native/scripts/verify.mjs
node native/scripts/browser-smoke.mjs
node native/scripts/browser-foundation.mjs
npm.cmd run test:affected -- --run
```

`prepare-ios.mjs` generates ignored Xcode source on the macOS runner. It fails closed on an unrecognized scene
controller template and can be run repeatedly. `build-ipa.sh` validates the unsigned real-device app and embedded
frameworks. Simulator tests execute only with explicit smoke launch arguments and use public synthetic samples.
