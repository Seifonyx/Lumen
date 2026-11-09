import Foundation

public struct Conversation: Identifiable, Codable, Sendable, Equatable {
    public let id: String
    public var title: String
    public var messages: [ChatMessage]
    public var selectedModelId: String?
    public var selectedProviderId: String?
    public var remoteMessageIDs: [String]?
    public var remoteRevision: Double?
    public var historyLoaded: Bool?
    public var archived: Bool?
    public var pinned: Bool?
    public var lineageRootID: String?
    public var parentConversationID: String?
    public var inheritedMessageIDs: Set<String>?
    public var revisionLabel: String?
    public let createdAt: Date
    public var updatedAt: Date

    public init(
        id: String = UUID().uuidString,
        title: String = "New conversation",
        messages: [ChatMessage] = [],
        selectedModelId: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.messages = messages
        self.selectedModelId = selectedModelId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public mutating func appendUserMessage(_ content: String) -> ChatMessage {
        let msg = ChatMessage(role: .user, content: content)
        messages.append(msg)
        updatedAt = Date()
        if title == "New conversation" || title.isEmpty {
            let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
            let snippet = trimmed.prefix(32)
            title = snippet.isEmpty ? "New conversation" : String(snippet)
        }
        return msg
    }
}
