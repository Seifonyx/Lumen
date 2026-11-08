import Foundation
import Testing
@testable import LumenCore

private struct MockAuthClient: AuthClient {
    func signInWithCustomToken(_ token: String) async throws -> UserProfile {
        UserProfile(id: "user-123", email: "test@example.com", displayName: "Test User")
    }
}

@Suite @MainActor
struct AuthEngineTests {
    private func withDefaults(_ body: (UserDefaults) async throws -> Void) async rethrows {
        let name = "LumenTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: name)!
        defer { defaults.removePersistentDomain(forName: name) }
        try await body(defaults)
    }

    @Test func previewSignInPersistsUser() async {
        await withDefaults { defaults in
            let engine = AuthEngine(client: MockAuthClient(), defaults: defaults)
            #expect(!engine.isSignedIn)
            #expect(engine.currentUser == nil)

            engine.signInPreview(email: "alex@example.com", name: "Alex")
            #expect(engine.isSignedIn)
            #expect(engine.currentUser?.email == "alex@example.com")
            #expect(engine.currentUser?.displayName == "Alex")

            let reloaded = AuthEngine(client: MockAuthClient(), defaults: defaults)
            #expect(reloaded.isSignedIn)
            #expect(reloaded.currentUser?.email == "alex@example.com")
        }
    }

    @Test func signOutClearsSession() async {
        await withDefaults { defaults in
            let engine = AuthEngine(client: MockAuthClient(), defaults: defaults)
            engine.signInPreview(email: "alex@example.com", name: "Alex")
            #expect(engine.isSignedIn)

            engine.signOut()
            #expect(!engine.isSignedIn)
            #expect(engine.currentUser == nil)

            let reloaded = AuthEngine(client: MockAuthClient(), defaults: defaults)
            #expect(!reloaded.isSignedIn)
        }
    }
}
