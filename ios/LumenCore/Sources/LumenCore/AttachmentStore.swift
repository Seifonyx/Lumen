import Foundation

@MainActor public protocol AttachmentStore {
    func load(id: String, accountID: String) throws -> ChatAttachment
    func save(_ attachment: ChatAttachment, accountID: String) throws
    func prune(keeping ids: Set<String>, accountID: String) throws
}

@MainActor public final class FileAttachmentStore: AttachmentStore {
    private let directory: URL
    private struct Original: Codable { let attachment: ChatAttachment; let data: Data? }
    public init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Lumen/Attachments", isDirectory: true)
    }
    private func folder(_ account: String) -> URL {
        let name = Data(account.utf8).base64EncodedString().replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "=", with: "")
        return directory.appendingPathComponent(name, isDirectory: true)
    }
    public func load(id: String, accountID: String) throws -> ChatAttachment {
        guard ChatAttachment.validID(id) else { throw AttachmentError.invalid }
        let original = try JSONDecoder().decode(Original.self, from: Data(contentsOf: folder(accountID).appendingPathComponent(id + ".json")))
        var file = original.attachment; file.data = original.data
        guard file.id == id else { throw AttachmentError.invalid }
        try file.validate()
        return file
    }
    public func save(_ attachment: ChatAttachment, accountID: String) throws {
        try attachment.validate()
        let root = folder(accountID), file = root.appendingPathComponent(attachment.id + ".json")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let data = try JSONEncoder().encode(Original(attachment: attachment.metadata, data: attachment.data))
        #if os(iOS)
        try data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: file, options: .atomic)
        #endif
        try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: file.path)
        var url = directory, values = URLResourceValues(); values.isExcludedFromBackup = true
        try url.setResourceValues(values)
    }
    public func prune(keeping ids: Set<String>, accountID: String) throws {
        let root = folder(accountID)
        guard FileManager.default.fileExists(atPath: root.path) else { return }
        for file in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) where file.pathExtension == "json" {
            let id = file.deletingPathExtension().lastPathComponent
            if !ids.contains(id) { try FileManager.default.removeItem(at: file) }
        }
    }

}
