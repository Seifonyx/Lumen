import Foundation

public enum AttachmentError: Error, LocalizedError, Sendable {
    case invalid, tooLarge, unsupported, unavailable, modelCannotReadImages, tooMany
    public var errorDescription: String? {
        switch self {
        case .invalid: "This attachment could not be read. Choose a valid image or UTF-8 text file."
        case .tooLarge: "Use an image under 600 KB after resizing, or text under 60 KB. Split larger documents before attaching."
        case .unsupported: "This file type cannot be used here yet. Attach an image, UTF-8 text, or a PDF with selectable text."
        case .unavailable: "An attachment is unavailable on this iPhone. Reconnect and reopen the chat, or attach the file again."
        case .modelCannotReadImages: "This model does not support image input. Choose a supported vision model before sending."
        case .tooMany: "Attach up to four files per message."
        }
    }
}

public struct ChatAttachment: Identifiable, Codable, Sendable, Equatable {
    public enum Kind: String, Codable, Sendable { case image, text, unsupported }
    public let id: String
    public let name: String
    public let kind: Kind
    public let mime: String
    public let size: Int
    public var text: String?
    /// Hydrated only for a provider request or an explicit protected original file. Never encoded in chat snapshots.
    public var data: Data?
    private enum CodingKeys: String, CodingKey { case id, name, kind, mime, size, text }
    public init(id: String = UUID().uuidString, name: String, kind: Kind, mime: String, text: String? = nil, data: Data? = nil, size: Int? = nil) {
        self.id = id; self.name = name; self.kind = kind; self.mime = mime; self.text = text; self.data = data
        self.size = size ?? data?.count ?? text?.utf8.count ?? 0
    }
    public static func validID(_ id: String) -> Bool {
        !id.isEmpty && id.count <= 128 && id != "." && id != ".." && id.unicodeScalars.allSatisfy { CharacterSet.alphanumerics.contains($0) || "_-.".contains(Character($0)) }
    }
    public func validate(requireContent: Bool = true) throws {
        guard Self.validID(id), !name.isEmpty, name.count <= 160, !name.contains("/"), !name.contains("\\"),
              !name.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains), size >= 0 else { throw AttachmentError.invalid }
        switch kind {
        case .text:
            if requireContent && (text?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false) { throw AttachmentError.unavailable }
            if (text?.utf8.count ?? 0) > 60_000 { throw AttachmentError.tooLarge }
        case .image:
            guard ["image/jpeg", "image/png"].contains(mime) else { throw AttachmentError.unsupported }
            guard size <= 600_000, (data?.count ?? 0) <= 600_000 else { throw AttachmentError.tooLarge }
            if requireContent {
                guard let data else { throw AttachmentError.unavailable }
                let prefix = Array(data.prefix(8))
                guard mime == "image/jpeg" ? prefix.starts(with: [0xff,0xd8,0xff]) : prefix == [137,80,78,71,13,10,26,10] else { throw AttachmentError.invalid }
            }
        case .unsupported: if requireContent { throw AttachmentError.unsupported }
        }
    }
    public var metadata: ChatAttachment { var copy = self; copy.data = nil; return copy }
    public var webFields: [String: Any] {
        var fields: [String: Any] = ["id": id, "name": name, "kind": kind.rawValue, "mime": mime, "size": size, "stored": true]
        if let text { fields["text"] = text }
        return fields
    }
    public static func web(_ fields: [String: Any]) -> ChatAttachment? {
        guard let id = fields["id"] as? String, let name = fields["name"] as? String else { return nil }
        let mime = fields["mime"] as? String ?? "application/octet-stream"
        let text = fields["text"] as? String
        let kind: Kind = mime.hasPrefix("image/") ? .image : text != nil ? .text : .unsupported
        let attachment = ChatAttachment(id: id, name: name, kind: kind, mime: mime, text: text, size: fields["size"] as? Int ?? 0)
        return (try? attachment.validate(requireContent: false)) != nil ? attachment : nil
    }
}

public extension AIModel {
    var supportsImages: Bool {
        let id = id.lowercased()
        switch providerId {
        case "gemini": return id.hasPrefix("gemini-") && !id.contains("embedding") && !id.contains("tts")
        case "anthropic": return id.hasPrefix("claude-3") || id.hasPrefix("claude-sonnet-4") || id.hasPrefix("claude-opus-4") || id.hasPrefix("claude-haiku-4")
        case "openai": return id.hasPrefix("gpt-4o") || id.hasPrefix("gpt-4.1") || id.hasPrefix("gpt-5") || id == "o3" || id == "o4-mini"
        case "groq": return id.contains("llama-4") && (id.contains("scout") || id.contains("maverick"))
        default: return false
        }
    }
}
