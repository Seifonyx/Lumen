import Foundation
import Observation

public protocol AuthClient: Sendable {
    func signInWithCustomToken(_ token: String) async throws -> UserProfile
}

public struct FirebaseAuthClient: AuthClient {
    private let apiKey: String
    private let urlSession: URLSession

    public init(
        apiKey: String = "AIzaSyA6rgzI585XESdkYGy3_Yz8tdun7rtbJZ8",
        urlSession: URLSession = .shared
    ) {
        self.apiKey = apiKey
        self.urlSession = urlSession
    }

    public func signInWithCustomToken(_ token: String) async throws -> UserProfile {
        let url = URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=\(apiKey)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "token": token,
            "returnSecureToken": true
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let finalRequest = request
        let session = self.urlSession

        let (data, response) = try await session.data(for: finalRequest)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw NSError(domain: "LumenCore.Auth", code: status, userInfo: [NSLocalizedDescriptionKey: "Authentication failed (\(status))"])
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let uid = json["localId"] as? String else {
            throw NSError(domain: "LumenCore.Auth", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid server response"])
        }

        let idToken = json["idToken"] as? String
        return UserProfile(id: uid, email: "", displayName: "Lumen User", idToken: idToken)
    }
}

@MainActor @Observable
public final class AuthEngine {
    public var currentUser: UserProfile?
    public var isLoading: Bool = false
    public var errorMessage: String?

    public var isSignedIn: Bool {
        currentUser != nil
    }

    @ObservationIgnored private let client: AuthClient
    @ObservationIgnored private let defaults: UserDefaults

    private static let userKey = "lumen.auth-user"

    public init(
        client: AuthClient = FirebaseAuthClient(),
        defaults: UserDefaults = .standard
    ) {
        self.client = client
        self.defaults = defaults
        loadPersistedUser()
    }

    public func signInPreview(email: String = "seif@lumen.app", name: String = "Seif") {
        let user = UserProfile(
            id: "preview-\(email.lowercased())",
            email: email,
            displayName: name
        )
        self.currentUser = user
        persistUser()
    }

    public func signOut() {
        self.currentUser = nil
        defaults.removeObject(forKey: Self.userKey)
    }

    private func persistUser() {
        if let user = currentUser, let data = try? JSONEncoder().encode(user) {
            defaults.set(data, forKey: Self.userKey)
        }
    }

    private func loadPersistedUser() {
        if let data = defaults.data(forKey: Self.userKey),
           let user = try? JSONDecoder().decode(UserProfile.self, from: data) {
            self.currentUser = user
        }
    }
}
