import Foundation

public struct ChatDraft: Codable, Equatable, Sendable, Identifiable {
    public var id: String { conversationID }
    public let conversationID: String
    public var text: String
    public var attachmentIDs: [String]
    public var updatedAt: Date
    public var hasContent: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !attachmentIDs.isEmpty }
    public init(conversationID: String, text: String = "", attachmentIDs: [String] = [], updatedAt: Date = Date()) {
        self.conversationID = conversationID; self.text = text; self.attachmentIDs = attachmentIDs; self.updatedAt = updatedAt
    }
}

@MainActor public protocol DraftStore {
    func load(accountID: String) throws -> [String: ChatDraft]
    func save(_ drafts: [String: ChatDraft], accountID: String) throws
}

@MainActor public final class FileDraftStore: DraftStore {
    private let directory: URL
    public init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Lumen/Drafts", isDirectory: true)
    }
    private func file(_ accountID: String) -> URL {
        let name = Data(accountID.utf8).base64EncodedString().replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "=", with: "")
        return directory.appendingPathComponent(name + ".json")
    }
    public func load(accountID: String) throws -> [String: ChatDraft] {
        let url = file(accountID)
        guard FileManager.default.fileExists(atPath: url.path) else { return [:] }
        return try JSONDecoder().decode([String: ChatDraft].self, from: Data(contentsOf: url))
    }
    public func save(_ drafts: [String: ChatDraft], accountID: String) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let data = try JSONEncoder().encode(drafts)
        #if os(iOS)
        try data.write(to: file(accountID), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: file(accountID), options: .atomic)
        #endif
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file(accountID).path)
        var url = directory, values = URLResourceValues(); values.isExcludedFromBackup = true
        try url.setResourceValues(values)
    }
}
