import Foundation
import UIKit
import FirebaseCore
import FirebaseAuth
import GoogleSignIn
import LumenCore

struct FirebaseClientConfiguration: Decodable {
    let webClientID: String
    let clients: [[String: String]]

    static func configure() -> FirebaseClientConfiguration {
        guard let url = Bundle.main.url(forResource: "FirebaseClients", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let config = try? JSONDecoder().decode(Self.self, from: data),
              let client = config.clients.first(where: { $0["BUNDLE_ID"] == Bundle.main.bundleIdentifier }),
              let appID = client["GOOGLE_APP_ID"], let apiKey = client["API_KEY"],
              let clientID = client["CLIENT_ID"], let projectID = client["PROJECT_ID"] else {
            preconditionFailure("Missing Firebase configuration for this bundle identifier")
        }
        let options = FirebaseOptions(googleAppID: appID, gcmSenderID: "318861546094")
        options.apiKey = apiKey
        options.projectID = projectID
        options.clientID = clientID
        options.bundleID = client["BUNDLE_ID"]!
        options.storageBucket = "the-model-router.firebasestorage.app"
        FirebaseApp.configure(options: options)
        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID, serverClientID: config.webClientID)
        return config
    }
}

@MainActor final class FirebaseSession: AuthClient {
    private let auth: Auth
    private var handle: AuthStateDidChangeListenerHandle?
    private let changes: AsyncStream<UserProfile?>
    private let continuation: AsyncStream<UserProfile?>.Continuation
    private var operation: UUID?
    var currentUser: UserProfile? { Self.profile(auth.currentUser) }

    init(auth: Auth = Auth.auth()) {
        self.auth = auth
        (changes, continuation) = AsyncStream.makeStream(bufferingPolicy: .bufferingNewest(1))
        handle = auth.addStateDidChangeListener { [weak self] _, user in
            let profile = Self.profile(user)
            Task { @MainActor [weak self] in
                guard let self, self.operation == nil else { return }
                self.continuation.yield(profile)
            }
        }
    }

    private nonisolated static func profile(_ user: FirebaseAuth.User?) -> UserProfile? {
        guard let user else { return nil }
        return UserProfile(id: user.uid, email: user.email ?? "", displayName: user.displayName ?? "Lumen account", photoURL: user.photoURL?.absoluteString)
    }

    func restoreSession() async throws -> UserProfile? { currentUser }
    func userChanges() -> AsyncStream<UserProfile?> { changes }

    func signIn() async throws -> UserProfile {
        guard let window = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene })
            .flatMap(\.windows).first(where: \.isKeyWindow), var presenter = window.rootViewController else {
            throw CocoaError(.userCancelled)
        }
        while let presented = presenter.presentedViewController { presenter = presented }
        let ticket = UUID()
        operation = ticket
        defer { if operation == ticket { operation = nil } }
        let result: GIDSignInResult
        do { result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenter) }
        catch let error as NSError where error.code == GIDSignInErrorCode.canceled.rawValue { throw CancellationError() }
        guard operation == ticket, let token = result.user.idToken?.tokenString else { throw CancellationError() }
        let credential = GoogleAuthProvider.credential(withIDToken: token, accessToken: result.user.accessToken.tokenString)
        let signedIn = try await auth.signIn(with: credential)
        guard operation == ticket else {
            try? auth.signOut()
            throw CancellationError()
        }
        let user = Self.profile(signedIn.user)!
        continuation.yield(user)
        return user
    }

    func signOut() throws {
        operation = nil
        try auth.signOut()
        GIDSignIn.sharedInstance.signOut()
        continuation.yield(nil)
    }

    deinit {
        if let handle { auth.removeStateDidChangeListener(handle) }
        continuation.finish()
    }
}
