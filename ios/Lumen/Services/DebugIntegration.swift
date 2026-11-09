#if DEBUG && targetEnvironment(simulator)
import Foundation
import OSLog
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
import LumenCore

/// Simulator-only: exercises the real Firebase SDK against local emulators. Absent from Release.
@MainActor enum DebugIntegration {
    static var enabled: Bool { ProcessInfo.processInfo.arguments.contains("--lumen-integration") }
    static let providerURL = URL(string: "http://127.0.0.1:18081/v1")!
    static func configure() -> FirebaseClientConfiguration {
        let options = FirebaseOptions(googleAppID: "1:123456789:ios:0123456789abcdef", gcmSenderID: "123456789")
        options.projectID = "demo-lumen-native"
        options.apiKey = "fixture-api-key"
        options.bundleID = Bundle.main.bundleIdentifier!
        FirebaseApp.configure(options: options)
        Auth.auth().useEmulator(withHost: "127.0.0.1", port: 19099)
        let firestore = Firestore.firestore()
        firestore.useEmulator(withHost: "127.0.0.1", port: 18080)
        // SDK 13.1.1 changes the host only; the local emulator does not serve TLS.
        let settings = firestore.settings
        settings.isSSLEnabled = false
        firestore.settings = settings
        if ProcessInfo.processInfo.arguments.contains("--lumen-reset-qa") {
            let previousUID = Auth.auth().currentUser?.uid
            try? Auth.auth().signOut()
            UserDefaults(suiteName: "lumen.integration")?.removePersistentDomain(forName: "lumen.integration")
            try? FileManager.default.removeItem(at: directory())
            let keys = KeychainProviderKeys(service: "io.github.seifonyx.lumen.integration-keys")
            for provider in AIProviderID.allCases {
                for user in ["device", previousUID ?? ""] { try? keys.setKey(nil, providerID: provider.rawValue, accountID: user) }
            }
        }
        record("configured", fields: ["project": options.projectID ?? ""])
        return FirebaseClientConfiguration(webClientID: "fixture-client", clients: [])
    }
    static func credential() async throws -> AuthCredential {
        func base64(_ value: [String: Any]) throws -> String {
            try JSONSerialization.data(withJSONObject: value).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        }
        let token = try base64(["alg": "none", "typ": "JWT"]) + "." + base64([
            "sub": "fixture-native-user", "email": "seifeldingamal2021@gmail.com", "email_verified": true,
            "name": "Native QA", "iss": "https://accounts.google.com", "aud": "fixture-client"
        ]) + "."
        return GoogleAuthProvider.credential(withIDToken: token, accessToken: "fixture-access-token")
    }
    static func record(_ event: String, fields: [String: String]) {
        guard enabled else { return }
        // Only fixture counters/status codes; never tokens, keys, or message contents.
        Logger(subsystem: "io.github.seifonyx.lumen.qa", category: "fixture")
            .notice("\(event, privacy: .public) \(fields.description, privacy: .public)")
        let root = directory().deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let file = root.appendingPathComponent("IntegrationDiagnostics.json")
        var events = (try? Data(contentsOf: file)).flatMap { try? JSONDecoder().decode([[String: String]].self, from: $0) } ?? []
        events.append(fields.merging(["event": event]) { _, new in new })
        if let data = try? JSONEncoder().encode(Array(events.suffix(100))) { try? data.write(to: file, options: .atomic) }
    }
    static func directory() -> URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("IntegrationQA")
    }
}
#endif
