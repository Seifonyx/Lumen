import Foundation

public enum MessageRole: String, Codable, Sendable {
    case user
    case assistant
    case system
}

public enum MessageStatus: Codable, Sendable, Equatable {
    case sending
    case streaming
    case completed
    case error(String)
}

public struct ChatMessage: Identifiable, Codable, Sendable, Equatable {
    public let id: UUID
    public let role: MessageRole
    public var content: String
    public let timestamp: Date
    public var status: MessageStatus

    public init(
        id: UUID = UUID(),
        role: MessageRole,
        content: String,
        timestamp: Date = Date(),
        status: MessageStatus = .completed
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.status = status
    }
}
