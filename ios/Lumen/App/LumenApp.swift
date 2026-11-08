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
    var body: some Scene {
        WindowGroup {
            RootView(composer: runtime.composer, engine: runtime.engine, auth: runtime.auth,
                     connections: runtime.connections, sync: runtime.sync)
                .preferredColorScheme(preferredScheme)
                .tint(.primary)
                .task { await runtime.start() }
                .onChange(of: runtime.auth.currentUser?.id) { _, _ in runtime.accountChanged() }
                .onChange(of: scenePhase) { _, phase in if phase == .active { runtime.sync.retry() } }
                .onOpenURL { _ = GIDSignIn.sharedInstance.handle($0) }
        }
    }
}
