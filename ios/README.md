# Native Lumen

SwiftUI iPhone app, iOS 26+. Bundle ID: `io.github.seifonyx.lumen`.
Chat is the main screen, with history and settings in a sidebar.

Phase 1 adds Google/Firebase sign-in, existing account history, streamed replies, Stop and saved chats.
Groq, Google Gemini, OpenAI and Anthropic use their own APIs and discovered model catalogs. Keys are
kept in account-scoped Keychain entries. Existing supported provider keys can load from the web account.
Chat files are protected, account-scoped and excluded from backups; a durable outbox retries cloud sync.
Native cloud writes preserve unrelated web chat/message fields. Projects, Library, attachments and
advanced routing remain later phases. New features go into native; the web app gets fixes only.

The **Native iOS** workflow uses Xcode 26.6 to build, test on two iPhones, export screenshots and package
an unsigned arm64 IPA. Each phone profile runs on its own Mac runner; a separate job verifies both
results and keeps the selected IPA paired with its own manifest before publishing. Successful native changes on main publish a versioned GitHub prerelease and
update the separate SideStore source. Increment `MARKETING_VERSION` in `project.yml` for each release;
build numbers come from Actions. Release notes are in `release-notes.json`.

SideStore source: https://raw.githubusercontent.com/Seifonyx/Lumen/main/ios/sidestore-source.json

Add the source in SideStore, or download `Lumen.ipa` from a `native-ios-v…` release and open it in SideStore.
The native identity is separate from the legacy `.demo` IPA. Firebase has clients for both the base bundle
and SideStore's current `M2WDSAZ2A5` suffix. `Resources/FirebaseClients.json` contains public app configuration,
not a service account. A different signing team requires its own Firebase iOS registration/configuration.

For local Mac checks, install Xcode 26.6, XcodeGen, Node 22 and Java 21, then run `bash ios/scripts/build.sh`.
`project.yml` generates the Xcode project. Simulator journeys use real Firebase SDKs against local Auth
and Firestore emulators with the existing rules, plus a local HTTP/SSE provider fixture. They test account
history, send, Stop, restoration, rejected keys and web schema preservation without live user data.
The fixture identity exists only in DEBUG simulator builds; packaging rejects fixture strings in Release.
Google's real account chooser and SideStore signing still need a physical iPhone check.

The source artwork is in `brand/crease/svg/`. Current work and verified results are in [HANDOFF.md](../HANDOFF.md).
