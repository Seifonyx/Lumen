import Foundation

/// One file or photo in the Library: a view of what is in the chats, never a second store (as on the web).
public struct LibraryEntry: Identifiable, Sendable, Equatable {
    public enum Kind: String, CaseIterable, Sendable, Identifiable {
        case all = "All", photos = "Photos", files = "Files", generated = "From replies"
        public var id: Self { self }
    }
    public var id: String { chatID + "/" + file.id }
    public let file: ChatAttachment
    public let kind: Kind
    public let chatID: String
    public let chatTitle: String
    public let projectID: String?
    public let date: Date
}

public enum LibraryIndex {
    /// Every file and photo in these chats, once per chat, newest first. Versions of a chat share their files,
    /// so each file appears once for its conversation.
    public static func items(in conversations: [Conversation]) -> [LibraryEntry] {
        var items: [LibraryEntry] = []
        var seen = Set<String>()
        for chat in conversations {
            let conversation = chat.lineageRootID ?? chat.id
            for message in chat.messages where message.role != .system {
                for file in message.attachments ?? [] where seen.insert(conversation + "/" + file.id).inserted {
                    let kind: LibraryEntry.Kind = message.role == .assistant ? .generated : file.kind == .image ? .photos : .files
                    items.append(LibraryEntry(file: file, kind: kind, chatID: chat.id, chatTitle: chat.title,
                                             projectID: chat.projectId, date: message.timestamp))
                }
            }
        }
        return items.sorted { $0.date == $1.date ? $0.id < $1.id : $0.date > $1.date }
    }

    /// Items of one kind whose name or chat title contains the query (ignoring case and accents).
    public static func filter(_ items: [LibraryEntry], kind: LibraryEntry.Kind, query: String) -> [LibraryEntry] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return items.filter { item in
            (kind == .all || item.kind == kind) && (needle.isEmpty
                || item.file.name.range(of: needle, options: [.caseInsensitive, .diacriticInsensitive]) != nil
                || item.chatTitle.range(of: needle, options: [.caseInsensitive, .diacriticInsensitive]) != nil)
        }
    }
}
