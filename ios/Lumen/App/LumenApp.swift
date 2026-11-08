import SwiftUI
import LumenCore

@main @MainActor
struct LumenApp: App {
    @State private var composer = DraftState()
    @State private var engine = ChatEngine()
    @State private var auth = AuthEngine()
    @AppStorage("lumen.appearance") private var appearance = "system"

    private var preferredScheme: ColorScheme? {
        switch appearance {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }

    var body: some Scene {
        WindowGroup {
            RootView(composer: composer, engine: engine, auth: auth)
                .preferredColorScheme(preferredScheme)
                .tint(.primary)
        }
    }
}
