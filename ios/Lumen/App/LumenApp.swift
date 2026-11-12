import SwiftUI
import LumenCore
import GoogleSignIn

@main @MainActor struct LumenApp: App {
    @State private var runtime: LumenRuntime
    @AppStorage("lumen.appearance") private var appearance = "system"
    @Environment(\.scenePhase) private var scenePhase

    init() {
        _ = FirebaseClientConfiguration.configure()
        UserDefaults.standard.removeObject(forKey: "lumen.auth-user")
        _runtime = State(initialValue: LumenRuntime())
    }
    private var preferredScheme: ColorScheme? {
        switch appearance { case "light": .light; case "dark": .dark; default: nil }
    }
    /// Google's sign-in return, or a lumen:// link (from a Shortcut, a widget or another app) to start a chat.
    private func open(_ url: URL) {
        if GIDSignIn.sharedInstance.handle(url) { return }
        guard case .newChat(let prompt)? = LumenLink(url: url) else { return }
        var request = ComposerRequest(text: prompt)
        #if DEBUG && targetEnvironment(simulator)
        // UI tests stand in for Siri's Ask Lumen (which sends) with a link; real links never send.
        if DebugIntegration.enabled, URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.contains(where: { $0.name == "send" }) == true {
            request.send = true
        }
        #endif
        LumenRequests.shared.pending = request
    }

    var body: some Scene {
        WindowGroup {
            RootView(composer: runtime.composer, engine: runtime.engine, auth: runtime.auth,
                     connections: runtime.connections, sync: runtime.sync)
                .environment(runtime.dictation)
                .environment(runtime.readAloud)
                .environment(LumenRequests.shared)
                .preferredColorScheme(preferredScheme)
                .tint(LumenPalette.accent)
                .task { await runtime.start() }
                .onChange(of: runtime.auth.currentUser?.id) { _, _ in runtime.accountChanged() }
                .onChange(of: scenePhase) { _, phase in if phase == .active { runtime.sync.retry() } }
                .onOpenURL(perform: open)
        }
    }
}
