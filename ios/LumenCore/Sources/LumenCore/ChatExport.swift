import Foundation

/// A chat as Markdown, in the web's export format (src/lib/chat-export.ts), so an export from the iPhone reads the
/// same as one from the web.
public enum ChatExport {
    /// Escapes Markdown in a one-line value (a title, a file name, a model).
    static func inline(_ value: String) -> String {
        var result = ""
        for character in value.replacingOccurrences(of: #"[\r\n]+"#, with: " ", options: .regularExpression) {
            if "\\`*_[]<>#".contains(character) { result.append("\\") }
            result.append(character)
        }
        return result
    }

    /// The web's short model name: a web model ID is "provider:model"; a native one is the model alone.
    static func shortModel(_ id: String) -> String {
        id.contains(":") ? id.split(separator: ":", omittingEmptySubsequences: false).dropFirst().joined(separator: ":") : id
    }

    public static func markdown(_ chat: Conversation) -> String {
        var lines = ["# " + inline(chat.title), ""]
        for message in chat.messages where message.role != .system {
            if message.role == .user { lines.append("## You") }
            else { lines.append("## Assistant" + (message.modelID.map { " · " + inline(shortModel($0)) } ?? "")) }
            lines.append("")
            let names = message.attachments?.map(\.name) ?? message.attachmentNames ?? []
            if !names.isEmpty { lines += ["Attachments: " + names.map(inline).joined(separator: ", "), ""] }
            if !message.content.isEmpty { lines += [message.content, ""] }
            if case .error(let error) = message.status { lines += ["Error: " + inline(error), ""] }
            if message.status == .stopped || message.status == .streaming { lines += ["_Reply incomplete._", ""] }
        }
        return lines.joined(separator: "\n")
    }

    /// The web's safe file name: no path or reserved characters, at most 100 characters, "Chat" when empty.
    public static func fileName(for chat: Conversation) -> String {
        let cleaned = chat.title.replacingOccurrences(of: #"[\\/:*?"<>|\x{0000}-\x{001F}]+"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        return (cleaned.isEmpty ? "Chat" : String(cleaned.prefix(100))) + ".md"
    }
}
