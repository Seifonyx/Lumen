# Lumen iOS — Phase 0 native foundation

This Phase 0 branch is based on `experiment/ios-sideload` PR #141 rather than `main`, to preserve the owner-confirmed working Google sign-in and bundle identity. It introduces a SwiftUI Home/Workspace navigation shell. The **existing** protected `DemoViewController` still handles Canvas, GoogleSignIn, Firebase and provider consent in the Workspace tab; there is no new login or database.

## Expected build and device behavior

- Native SwiftUI `TabView` and `NavigationStack`; iOS 26+ uses Apple's real Liquid Glass controls through `.buttonStyle(.glass)` and `.glassProminent`. No CSS imitation.
- Home has native branded launch controls; Workspace retains the existing Lumen experience, including its known OpenRouter-only restriction and the unresolved missing cloud conversations. **These are not presented as fixed in Phase 0.**
- The app still identifies as `io.github.seifonyx.lumen.demo`, retains the same URL callback route and protected authentication controller, and remains an **unsigned SideStore-signable IPA**.
- CI builds a **synthetic offline smoke build only**. Artifacts from this branch are not the connected owner release and **must not** be published into the public SideStore source.
- Simulator smoke selects Workspace for the existing functional test, then restarts into the Home tab and captures `native-home.png`. Real-device sign-in and upgrade compatibility require the owner's device confirmation using a privately configured build.
- The next account-connected workflow must produce a new private IPA with strictly controlled config, validate auth/key restrictions, and increment marketing/build versions before any update via SideStore. A release must separately pass public artifact-content review.

## Known remaining Phase 0 gates

1. Confirm macOS CI compiles the SwiftUI-generated source and review `native-home.png`; fix any actual compiler/runtime issues.
2. Run existing account-connected private workflow on reviewed code with only previously approved secrets. Verify login, callback and same-app overwrite on iPhone; never uninstall the working Lumen as a workaround.
3. Run public IPA-content/privacy review and publish a correctly versioned release. Only then can `sidestore-source.json` list Lumen (currently `apps: []`).
4. Phase 1 implements the native conversation list with canonical cloud history rather than copying any user data into this source branch.

No production website deployment, Firebase rules, public signup or paid services are part of this phase.
