import Foundation

public struct ChatMetadataPatch: Codable, Sendable, Equatable {
    public let id: String
    public var title: String?
    public var pinned: Bool?
    public var archived: Bool?
    public init(title: String? = nil, pinned: Bool? = nil, archived: Bool? = nil) {
        id = UUID().uuidString; self.title = title; self.pinned = pinned; self.archived = archived
    }
    public func apply(to chat: inout Conversation) {
        if let title { chat.title = title }
        if let pinned { chat.pinned = pinned }
        if let archived { chat.archived = archived }
    }
}

public enum HistoryScope: String, CaseIterable, Identifiable, Sendable {
    case active = "Chats", pinned = "Pinned", archived = "Archived"
    public var id: Self { self }
    func contains(_ chat: Conversation) -> Bool {
        switch self {
        case .active: chat.archived != true
        case .pinned: chat.archived != true && chat.pinned == true
        case .archived: chat.archived == true
        }
    }
}

public struct ConversationSearchResult: Identifiable, Sendable {
    public var id: String { conversation.lineageRootID ?? conversation.id }
    public let conversation: Conversation
    public let preview: String?
}

public enum ConversationSearch {
    public static func results(query: String, scope: HistoryScope, conversations: [Conversation], visible: [Conversation]) -> [ConversationSearchResult] {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if query.isEmpty {
            return visible.filter(scope.contains).map { ConversationSearchResult(conversation: $0, preview: $0.messages.last?.content) }
        }
        func folded(_ value: String) -> String { value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current) }
        let needle = folded(query)
        var found: [String: (ConversationSearchResult, Int)] = [:]
        for chat in conversations.sorted(by: { $0.updatedAt > $1.updatedAt }) where scope.contains(chat) {
            let titleMatch = folded(chat.title).contains(needle)
            let message = chat.messages.first { folded($0.content).contains(needle) }
            guard titleMatch || message != nil else { continue }
            let root = chat.lineageRootID ?? chat.id, score = titleMatch ? 2 : 1
            if let existing = found[root], existing.1 >= score { continue }
            let preview = message.map { textPreview($0.content, query: query) }
            found[root] = (ConversationSearchResult(conversation: chat, preview: preview), score)
        }
        return found.values.map(\.0).sorted {
            ($0.conversation.pinned == true) == ($1.conversation.pinned == true)
                ? $0.conversation.updatedAt > $1.conversation.updatedAt : $0.conversation.pinned == true
        }
    }
    private static func textPreview(_ text: String, query: String) -> String {
        let match = text.range(of: query, options: [.caseInsensitive, .diacriticInsensitive])?.lowerBound ?? text.startIndex
        let start = text.index(match, offsetBy: -40, limitedBy: text.startIndex) ?? text.startIndex
        let end = text.index(start, offsetBy: 160, limitedBy: text.endIndex) ?? text.endIndex
        return (start == text.startIndex ? "" : "…") + String(text[start..<end]) + (end == text.endIndex ? "" : "…")
    }
}
