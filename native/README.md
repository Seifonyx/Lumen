# Lumen iOS sideload experiment

This branch builds **Lumen Demo**, a real Capacitor WKWebView application containing the current Canvas UI.
The bundle identifier is `io.github.seifonyx.lumen.demo`. The deployment target is iOS 16.
Its app icon and Light/Dark launch image reuse the approved Crease assets.

The application is an offline demonstration. Choose **Open Demo A** or **Open Demo B**.
Chats, drafts, projects and settings use the app's local per-profile stores. Sending produces a fixed local reply.
Sign out in Settings to switch demo profiles. Use sample text and files. No real account, key or inference is needed.

## Build and download on Windows

1. Open the PR's **Checks** or the repository's **Actions** page. Select **iOS unsigned demo IPA** and the latest successful run for `experiment/ios-sideload`.
2. Open that run's summary. Under **Artifacts**, download **Lumen-unsigned-IPA**. Extract the downloaded ZIP to obtain **Lumen.ipa** and **Lumen.json**.
3. The artifact expires after seven days. To rebuild this experimental branch, open a previous run and choose **Re-run all jobs**. A push to this exact branch also builds it. The workflow has `workflow_dispatch`, but GitHub only exposes **Run workflow** after the workflow exists on the default branch. This experiment is intentionally unmerged, so use the branch run's rerun action now.
4. Confirm the commit shown on the run matches the PR head. `Lumen.json` records the IPA SHA-256, device platform, architecture and minimum iOS version. In PowerShell, `Get-FileHash .\Lumen.ipa -Algorithm SHA256` verifies the download.

The workflow uses the standard `macos-26` public-repository runner, refuses private-repository execution, and has read-only repository permission. It uses no signing credentials, provisioning profiles or deployment steps. Node and Capacitor dependencies are installed from their lockfiles. Capacitor core, iOS and CLI are pinned to 8.6.0. Xcode's version is recorded in the logs. The iPhoneOS build and Simulator build have separate output directories.

## Install through Sideloadly

1. On Windows, download the free Windows build from [Sideloadly](https://sideloadly.io/). Install the Apple device support, iTunes and iCloud components its Windows setup instructions require. Use its linked supported installers if it reports missing Apple components.
2. Connect the iPhone by USB. Unlock it and accept **Trust This Computer**. Open Sideloadly and select the connected iPhone.
3. Drag the extracted **Lumen.ipa** into Sideloadly. Choose normal **Apple ID Sideload** installation. Leave tweak injection and bundle modification options off.
4. Enter a free Apple Account in Sideloadly on this PC. Press **Start**, then complete password and two-factor prompts locally. No Apple Account details belong in GitHub, repository files, workflow inputs or this app.
5. After installation, on iPhone open **Settings â†’ General â†’ VPN & Device Management**, select the developer entry for that Apple Account, and trust it.
6. If iOS requires Developer Mode, enable **Settings â†’ Privacy & Security â†’ Developer Mode**, restart the phone and confirm. The option may appear only after the first developer app installation.
7. Open **Lumen Demo**. The first screen states that real sign-in is unavailable. Choose Demo A, send a sample message, open Router/Library/Projects, then sign out and open Demo B to check separation.
8. Test Airplane Mode launch. The packaged UI and local synthetic reply should work without a website connection.

Sideloadly signs the unsigned IPA locally. Free Personal Team provisioning expires after seven days. Before expiry, reconnect to the same PC and re-sign/reinstall the same IPA with the same Apple Account and bundle settings. Sideloadly's optional refresh daemon can automate this when its required device connection is available. Keep the existing installed app when refreshing to preserve local demo data. If the signature expires, refresh from Windows before opening it again. Removing the app deletes its local demo data.

[Apple's Personal Team limits](https://developer.apple.com/help/account/basics/about-your-developer-account/) and [Sideloadly's free account and refresh support](https://sideloadly.io/) describe the signing conditions. Windows signing and physical installation remain owner validation steps.

## Isolation and capability limits

- The production Canvas and ordinary build configurations and their dependencies are untouched. All Capacitor packages live under `native/` with a separate lockfile.
- `native/vite.config.ts` selects the canonical Canvas module, replaces auth/sync/PWA/device/login at build time, and rewrites application requests to a local synthetic transport. It reuses the existing stateless no-cloud SDK/sync/worker adapters, but imports no private QA fixtures, gate, lease or QA entry.
- The IPA contains only bundled hashed assets, fonts and public demonstration code. It loads `capacitor://localhost`, with no remote server URL. Firebase configuration and SDK code are excluded.
- CSP restricts connections to packaged assets. Before the first document loads, WKWebView installs content rules blocking HTTP(S)/WS(S) traffic. Native navigation delegates reject external destinations and popups. The built-in native HTTP bridge is replaced by a local rejection for every method; disabling Capacitor fetch patching alone would not block direct native RPC calls. No permission descriptions for camera, microphone or photos are added, and media capture requests are denied.
- Safe areas remain owned by the existing viewport-fit and CSS layout. Native UIKit owns the status bar. The PWA-only status-bar sampling workaround is excluded. Keyboard sizing uses the canonical visualViewport handler, with no extra keyboard plugin.
- No service worker is emitted or registered. Offline availability comes from the IPA, and updating requires a new sideload. The production PWA's update mechanism is unchanged.
- Local app-owned navigation is used, as in the existing installed PWA. Native WKWebView edge history is disabled to avoid competing gesture owners.
- Document/file exports up to 10 MB open the native share sheet through a narrow local download bridge. Choose Save to Files there. This does not require photo-library permission. Share sheet usability and large/native file-picker workflows need physical testing.
- Local imported files, document editing and the canonical UI remain available. Model discovery/replies are synthetic. Web research, sync, GitHub operations, embeddings, voice capture, Python/code execution and remote workers are unavailable. Worker creation fails visibly. Packaging a worker file does not establish that WKWebView supports its custom-scheme execution.
- Simulator smoke uses programmatic actions in the real WKWebView. It records launch, a synthetic reply, Router, Library, Settings and profile separation, and captures application views. It does not establish hardware touch, keyboard/IME, physical safe areas, VoiceOver, background lifecycle or Sideloadly installation.
- The browser smoke separately checks Chromium/WebKit with external requests blocked. No real provider request is permitted.

## Protected authentication plan â€” approval required before implementation

Current `src/lib/firebase.ts` uses Google web popup/redirect auth and same-site hosting assumptions.
Google prohibits embedded WKWebView OAuth. The demo substitutes a local account adapter and never opens that flow.
Changing a user agent would not make it a supported integration. [Google OAuth policy](https://developers.google.com/identity/protocols/oauth2/policies#disallowed_user_agents)

The proposed next integration requires owner approval for all of these items.

1. Decide the permanent bundle identifier and verify what Sideloadly actually signs on the owner's device. If it rewrites the identifier, native OAuth registration must match the installed application.
2. Register the iOS application in the existing Firebase project or an approved separate test project, and create its iOS Google OAuth client. Obtain the matching `GoogleService-Info.plist` and reversed-client-ID URL scheme. No client secret, certificate, profile or Apple Account credential is committed.
3. Add a reviewed native GoogleSignIn iOS SDK bridge using the system authentication session. Handle the reversed-client-ID callback in the application scene and bridge only the resulting Google token to the existing Firebase credential sign-in owner. Decide explicitly whether Firebase session ownership is web or native to avoid two divergent sessions.
4. Review allowed redirect/domain configuration, the existing invite-only authorization, logout, revocation, account switching, incognito and per-account persistence. Approve the exact network allowlist required to replace the demo's default-deny mode.
5. Test with an approved test account and signing identity, first outside production. Confirm real request/pricing consent before enabling provider use.

This experiment makes none of those production changes. [Firebase's native Google sign-in guide](https://firebase.google.com/docs/auth/ios/google-signin) documents the native SDK and URL-scheme requirements.

## Local checks

From the repository root on Windows, install root dependencies and then run these commands.

```powershell
npm ci
npm ci --prefix native --ignore-scripts
node native/scripts/build.mjs
node native/scripts/browser-smoke.mjs
npm run test:affected -- --run
```

On the macOS runner, `prepare-ios.mjs` generates/syncs the project. `build-ipa.sh` compiles the device application,
packages Payload/Lumen.app, and validates Mach-O platform/architecture and bundled assets. `simulator-smoke.sh`
builds independently for Simulator, launches it, and waits for the app's smoke report. A compiled IPA can be uploaded
even if Simulator smoke fails. Check both the job result and the evidence artifact before interpreting it as verified.
