import Foundation

public enum WebSyncError: Error, LocalizedError {
    case deleted, conflict, unsupported, invalid
    public var errorDescription: String? {
        switch self {
        case .deleted: "This chat was deleted on another device."
        case .conflict: "This chat changed on another device. Your new messages are saved on this iPhone; reopen the chat before continuing."
        case .unsupported: "This chat uses a history format this version cannot update."
        case .invalid: "The saved conversation could not be read."
        }
    }
}

public struct WebChatAppendPlan {
    public let metadata: [String: Any]
    public let messages: [String: [String: Any]]
}

/// The existing web schema. Mutations deliberately patch only fields owned by native chat.
public enum WebChatCodec {
    private static func date(_ value: Any?) -> Date {
        Date(timeIntervalSince1970: ((value as? NSNumber)?.doubleValue ?? Date().timeIntervalSince1970 * 1000) / 1000)
    }
    public static func revision(_ fields: [String: Any]) -> Double {
        (fields["rev"] as? NSNumber)?.doubleValue ?? (fields["updatedAt"] as? NSNumber)?.doubleValue ?? 0
    }
    public static func conversation(id: String, fields: [String: Any]) throws -> Conversation {
        guard fields["deleted"] as? Bool != true else { throw WebSyncError.deleted }
        var result = Conversation(id: id, title: fields["title"] as? String ?? "New conversation",
                                  selectedModelId: fields["model"] as? String,
                                  createdAt: date(fields["createdAt"]), updatedAt: date(fields["updatedAt"]))
        result.selectedProviderId = fields["nativeProvider"] as? String
        result.remoteMessageIDs = fields["ids"] as? [String]
        result.remoteRevision = revision(fields)
        result.historyLoaded = false
        result.archived = fields["archived"] as? Bool
        result.pinned = fields["pinned"] as? Bool
        return result
    }
    public static func message(id: String, fields: [String: Any]) throws -> ChatMessage {
        guard let rawRole = fields["role"] as? String, let role = MessageRole(rawValue: rawRole) else { throw WebSyncError.invalid }
        let status: MessageStatus
        switch fields["status"] as? String {
        case "streaming": status = .stopped // A web stream is not running inside this app.
        case "stopped": status = .stopped
        case "error": status = .error(fields["error"] as? String ?? "The reply could not finish.")
        default: status = .completed
        }
        return ChatMessage(id: id, role: role, content: fields["text"] as? String ?? "",
                           timestamp: date(fields["createdAt"]),
                           attachmentNames: (fields["files"] as? [[String: Any]])?.compactMap { $0["name"] as? String }, status: status)
    }
    public static func append(chat: Conversation, messageIDs: Set<String>, remote: [String: Any]?,
                              existingMessages: [String: [String: Any]]) throws -> WebChatAppendPlan {
        if remote?["deleted"] as? Bool == true { throw WebSyncError.deleted }
        if remote != nil, remote?["ids"] == nil, (remote?["count"] as? Int ?? 0) > 0 { throw WebSyncError.unsupported }
        var ids = remote?["ids"] as? [String] ?? []
        var writes: [String: [String: Any]] = [:]
        for message in chat.messages where messageIDs.contains(message.id) {
            if let existing = existingMessages[message.id] {
                guard existing["text"] as? String == message.content, ids.contains(message.id) else { throw WebSyncError.conflict }
                continue
            }
            guard !ids.contains(message.id) else { throw WebSyncError.conflict }
            let index = ids.count
            ids.append(message.id)
            let status: String
            switch message.status {
            case .completed: status = "done"
            case .stopped: status = "stopped"
            case .error: status = "error"
            default: throw WebSyncError.invalid // Never upload a partial assistant as a completed reply.
            }
            var fields: [String: Any] = ["id": message.id, "role": message.role.rawValue, "text": message.content,
                                        "createdAt": message.timestamp.timeIntervalSince1970 * 1000,
                                        "index": index, "status": status]
            if let model = chat.selectedModelId { fields["model"] = model }
            if case .error(let error) = message.status { fields["error"] = error }
            writes[message.id] = fields
        }
        let now = Date().timeIntervalSince1970 * 1000
        var metadata: [String: Any] = ["ids": ids, "count": ids.count, "updatedAt": now,
                                        "rev": max(now, ((remote?["rev"] as? NSNumber)?.doubleValue ?? 0) + 1)]
        if remote == nil {
            metadata["title"] = chat.title
            metadata["createdAt"] = chat.createdAt.timeIntervalSince1970 * 1000
            metadata["pinned"] = chat.pinned ?? false
            metadata["archived"] = chat.archived ?? false
            metadata["deleted"] = false
        }
        if let model = chat.selectedModelId { metadata["model"] = model }
        if let provider = chat.selectedProviderId { metadata["nativeProvider"] = provider }
        return WebChatAppendPlan(metadata: metadata, messages: writes)
    }
}
