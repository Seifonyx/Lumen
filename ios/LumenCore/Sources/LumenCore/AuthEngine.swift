import Foundation
import Observation

/// The platform adapter owns authentication and secure token storage.
@MainActor public protocol AuthClient: AnyObject {
    var currentUser: UserProfile? { get }
    func restoreSession() async throws -> UserProfile?
    func signIn() async throws -> UserProfile
    func signOut() throws
    func userChanges() -> AsyncStream<UserProfile?>
}

@MainActor @Observable public final class AuthEngine {
    public private(set) var currentUser: UserProfile?
    public private(set) var isLoading = false
    /// The saved session has been restored (or found missing): the account is known.
    public private(set) var hasRestored = false
    public var errorMessage: String?
    public var isSignedIn: Bool { currentUser != nil }
    @ObservationIgnored private let client: any AuthClient
    @ObservationIgnored private var listener: Task<Void, Never>?
    @ObservationIgnored private var operation = UUID()
    @ObservationIgnored private var started = false

    public init(client: any AuthClient) { self.client = client }

    public func start() async {
        guard !started else { return }
        started = true
        let changes = client.userChanges()
        listener = Task { [weak self] in
            for await user in changes {
                guard !Task.isCancelled else { return }
                self?.currentUser = user
            }
        }
        let ticket = operation
        defer { hasRestored = true }
        do {
            let user = try await client.restoreSession()
            guard operation == ticket else { return }
            currentUser = user
        } catch {
            guard operation == ticket else { return }
            errorMessage = "Your session could not be restored. Sign in again."
        }
    }

    public func signIn() async {
        guard !isLoading else { return }
        let ticket = UUID()
        operation = ticket
        isLoading = true
        errorMessage = nil
        do {
            let user = try await client.signIn()
            guard operation == ticket else { return }
            currentUser = user
        } catch is CancellationError {
            // Closing Google's sheet is a normal user action.
        } catch {
            guard operation == ticket else { return }
            errorMessage = "Google sign-in could not finish. Check your connection and try again."
        }
        if operation == ticket { isLoading = false }
    }

    public func signOut() {
        operation = UUID()
        isLoading = false
        errorMessage = nil
        do {
            try client.signOut()
            currentUser = nil
        } catch { errorMessage = "Sign-out could not finish. Please try again." }
    }

    deinit { listener?.cancel() }
}
