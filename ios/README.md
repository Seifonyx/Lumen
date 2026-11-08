# Native Lumen

Fresh SwiftUI iPhone app, iOS 26+. Bundle ID: `io.github.seifonyx.lumen`.
The main screen is chat; navigation lives in a sidebar. Phase 0 includes local draft restoration,
appearance settings and native screens. Account and AI connections begin in Phase 1.

The **Native iOS** workflow builds with Xcode 26.6, runs core and iPhone UI tests, exports simulator
screenshots and packages an unsigned device IPA. Its artifact contains the IPA, exact source/build metadata,
screenshots and logs. Successful native changes on main publish a versioned GitHub prerelease.
Increase `MARKETING_VERSION` in `project.yml` for each new release; build numbers come from Actions.

SideStore source: https://raw.githubusercontent.com/Seifonyx/Lumen/main/ios/sidestore-source.json

Add the source in SideStore or download `Lumen.ipa` from a `native-ios-v…` release and open it in SideStore.
This app has its own identity and source, separate from the legacy `.demo` IPA.

For local Mac builds: install Xcode 26.6 and XcodeGen, then run `bash ios/scripts/build.sh`.
`project.yml` generates the Xcode project. The source artwork is the existing `brand/crease/svg/` artwork.
The current task, verified build links and next steps are in [HANDOFF.md](../HANDOFF.md).
