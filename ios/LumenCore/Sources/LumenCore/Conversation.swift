import Foundation

public struct Conversation: Identifiable, Codable, Sendable, Equatable {
    public let id: UUID
    public var title: String
    public var messages: [ChatMessage]
    public var selectedModelId: String?
    public let createdAt: Date
    public var updatedAt: Date

    public init(
        id: UUID = UUID(),
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
