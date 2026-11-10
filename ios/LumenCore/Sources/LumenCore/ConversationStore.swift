import Foundation

public struct ChatSnapshot: Codable, Equatable, Sendable {
    public var conversations: [Conversation]
    public var selectedModel: AIModel?
    public var pendingMessages: [String: Set<String>]
    public var pendingDeletions: Set<String>
    public var selectedConversationID: String?
    public var pendingMetadata: [String: [ChatMetadataPatch]]?
    public init(conversations: [Conversation] = [], selectedModel: AIModel? = nil,
                pendingMessages: [String: Set<String>] = [:], pendingDeletions: Set<String> = [],
                pendingMetadata: [String: [ChatMetadataPatch]] = [:], selectedConversationID: String? = nil) {
        self.selectedConversationID = selectedConversationID
        self.conversations = conversations
        self.selectedModel = selectedModel
        self.pendingMessages = pendingMessages
        self.pendingDeletions = pendingDeletions
        self.pendingMetadata = pendingMetadata.isEmpty ? nil : pendingMetadata
    }
}

@MainActor public protocol ConversationStore {
    func load(accountID: String) throws -> ChatSnapshot
    func save(_ snapshot: ChatSnapshot, accountID: String) throws
}

/// Each account gets an atomic, protected file. Firebase credentials never enter this cache.
@MainActor public final class FileConversationStore: ConversationStore {
    private let directory: URL
    private let legacyDefaults: UserDefaults?
    public init(directory: URL? = nil, legacyDefaults: UserDefaults? = .standard) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Lumen/ChatCache", isDirectory: true)
        self.legacyDefaults = legacyDefaults
    }
    private func file(_ accountID: String) -> URL {
        let name = Data(accountID.utf8).base64EncodedString().replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "=", with: "")
        return directory.appendingPathComponent(name + ".json")
    }
    public func load(accountID: String) throws -> ChatSnapshot {
        let url = file(accountID)
        if FileManager.default.fileExists(atPath: url.path) {
            return try JSONDecoder().decode(ChatSnapshot.self, from: Data(contentsOf: url))
        }
        // Old global chats have no provable owner. Keep them only in the signed-out device space.
        if accountID == "device", let data = legacyDefaults?.data(forKey: "lumen.saved-conversations") {
            let chats = try JSONDecoder().decode([Conversation].self, from: data)
            let snapshot = ChatSnapshot(conversations: chats)
            try save(snapshot, accountID: accountID)
            legacyDefaults?.removeObject(forKey: "lumen.saved-conversations")
            return snapshot
        }
        return ChatSnapshot()
    }
    public func save(_ snapshot: ChatSnapshot, accountID: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true,
                                                attributes: [.posixPermissions: 0o700])
        let data = try JSONEncoder().encode(snapshot)
        #if os(iOS)
        try data.write(to: file(accountID), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: file(accountID), options: .atomic)
        #endif
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file(accountID).path)
        var url = directory
        var attributes = URLResourceValues()
        attributes.isExcludedFromBackup = true
        try url.setResourceValues(attributes)
    }
}
