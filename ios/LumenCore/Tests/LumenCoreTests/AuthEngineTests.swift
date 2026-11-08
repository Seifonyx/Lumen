import Foundation
import Testing
@testable import LumenCore

@MainActor private final class TestAuthClient: AuthClient {
    var currentUser: UserProfile?
    let authenticatedUser = UserProfile(id: "real-user-123", email: "alex@example.com", displayName: "Alex")
    var signInCalls = 0
    var shouldFail = false
    var holdSignIn = false
    var pending: CheckedContinuation<UserProfile, any Error>?
    let changes: AsyncStream<UserProfile?>
    let continuation: AsyncStream<UserProfile?>.Continuation

    init() {
        let pair = AsyncStream<UserProfile?>.makeStream()
        changes = pair.stream
        continuation = pair.continuation
    }
    func restoreSession() async throws -> UserProfile? { currentUser }
    func signIn() async throws -> UserProfile {
        signInCalls += 1
        if shouldFail { throw URLError(.notConnectedToInternet) }
        if holdSignIn { return try await withCheckedThrowingContinuation { pending = $0 } }
        currentUser = authenticatedUser
        return authenticatedUser
    }
    func signOut() throws { currentUser = nil }
    func userChanges() -> AsyncStream<UserProfile?> { changes }
    func emit(_ user: UserProfile?) { currentUser = user; continuation.yield(user) }
}

@Suite @MainActor struct AuthEngineTests {
    @Test func signInUsesTheAuthenticatedClientIdentity() async {
        let client = TestAuthClient()
        let auth = AuthEngine(client: client)
        #expect(!auth.isSignedIn)
        await auth.start()
        await auth.signIn()
        #expect(client.signInCalls == 1)
        #expect(auth.currentUser?.id == "real-user-123")
        #expect(auth.currentUser?.email == "alex@example.com")
        #expect(!auth.isLoading)
    }

    @Test func startupRestoresTheClientSession() async {
        let client = TestAuthClient()
        client.currentUser = client.authenticatedUser
        let auth = AuthEngine(client: client)
        #expect(!auth.isSignedIn)
        await auth.start()
        #expect(auth.currentUser == client.authenticatedUser)
    }

    @Test func failedSignInDoesNotInventAUser() async {
        let client = TestAuthClient()
        client.shouldFail = true
        let auth = AuthEngine(client: client)
        await auth.signIn()
        #expect(auth.currentUser == nil)
        #expect(!auth.isLoading)
        #expect(auth.errorMessage != nil)
    }

    @Test func signOutDropsALateSignInResult() async throws {
        let client = TestAuthClient()
        client.holdSignIn = true
        let auth = AuthEngine(client: client)
        let signIn = Task { await auth.signIn() }
        let deadline = ContinuousClock.now.advanced(by: .seconds(3))
        while client.pending == nil, ContinuousClock.now < deadline { await Task.yield() }
        try #require(client.pending != nil)
        auth.signOut()
        client.pending?.resume(returning: client.authenticatedUser)
        await signIn.value
        #expect(!auth.isSignedIn)
        #expect(!auth.isLoading)
    }

    @Test func backendSignOutClearsTheVisibleSession() async throws {
        let client = TestAuthClient()
        client.currentUser = client.authenticatedUser
        let auth = AuthEngine(client: client)
        await auth.start()
        client.emit(nil)
        let deadline = ContinuousClock.now.advanced(by: .seconds(3))
        while auth.isSignedIn, ContinuousClock.now < deadline { await Task.yield() }
        #expect(!auth.isSignedIn)
    }
}
