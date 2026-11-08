import Foundation

public struct UserProfile: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public var email: String
    public var displayName: String
    public var photoURL: String?
    public var idToken: String?

    public init(
        id: String,
        email: String,
        displayName: String,
        photoURL: String? = nil,
        idToken: String? = nil
    ) {
        self.id = id
        self.email = email
        self.displayName = displayName
        self.photoURL = photoURL
        self.idToken = idToken
    }
}
