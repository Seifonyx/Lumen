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
    case stopped
    case error(String)
}

public struct ChatMessage: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public let role: MessageRole
    public var content: String
    public let timestamp: Date
    public var attachments: [ChatAttachment]?
    public var attachmentNames: [String]?
    public var status: MessageStatus
    public var sourceMessageID: String?

    public init(
        id: String = UUID().uuidString,
        role: MessageRole,
        content: String,
        timestamp: Date = Date(),
        attachmentNames: [String]? = nil,
        status: MessageStatus = .completed,
        sourceMessageID: String? = nil,
        attachments: [ChatAttachment]? = nil
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.attachments = attachments
        self.attachmentNames = attachmentNames ?? attachments?.map(\.name)
        self.status = status
        self.sourceMessageID = sourceMessageID
    }
}
