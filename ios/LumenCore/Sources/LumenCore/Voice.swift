import Foundation

/// Dictation adds what you said to what you had already typed: one space between them, nothing doubled.
public enum DictationText {
    public static func merge(draft: String, dictated: String) -> String {
        let spoken = dictated.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !spoken.isEmpty else { return draft }
        guard let last = draft.last else { return spoken }
        return last.isWhitespace ? draft + spoken : draft + " " + spoken
    }
}

/// The words of a reply as they should be read aloud: no Markdown symbols, link text without the address,
/// tables read row by row, and code blocks announced rather than spelled out.
public enum SpeechText {
    public static func plain(_ markdown: String) -> String {
        var parts: [String] = []
        for block in MarkdownBlocks.parse(MemoryRules.hidingLines(markdown)) {
            switch block {
            case .heading(_, let text), .paragraph(let text), .quote(let text):
                parts.append(inline(text))
            case .list(_, let items):
                parts.append(items.map { inline($0.text) }.joined(separator: "\n"))
            case .code:
                parts.append("Code block.")
            case .table(let header, let rows):
                parts.append(([header] + rows).map { $0.map(inline).joined(separator: ", ") }.joined(separator: ".\n"))
            case .rule:
                continue
            }
        }
        return parts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: "\n\n")
    }

    static func inline(_ text: String) -> String {
        var result = text
        // Images and links keep their words only.
        result = result.replacing(/!?\[([^\]]*)\]\([^)]*\)/) { String($0.output.1) }
        result = result.replacing(/`([^`]*)`/) { String($0.output.1) }
        for marker in ["**", "__", "~~"] { result = result.replacingOccurrences(of: marker, with: "") }
        // Single-asterisk emphasis; underscores inside words (snake_case) are kept.
        result = result.replacing(/(^|[\s(])\*([^*\s][^*]*)\*/) { String($0.output.1) + String($0.output.2) }
        result = result.replacing(/(^|[\s(])_([^_\s][^_]*)_(?=$|[\s.,;:!?)])/) { String($0.output.1) + String($0.output.2) }
        return result
    }
}

/// What another app, Siri or a Shortcut asked Lumen to do. Links only ever fill in a new chat's message:
/// a web page must never be able to send something on your behalf (it would use your provider and its cost).
public enum LumenLink: Equatable, Sendable {
    case newChat(prompt: String?)

    public static let scheme = "lumen"
    /// Longer text is cut, so a link cannot flood the composer.
    public static let maxPromptLength = 20_000

    public init?(url: URL) {
        guard url.scheme?.lowercased() == Self.scheme,
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        let action = (components.host ?? components.path).lowercased().trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard ["new", "chat", "ask"].contains(action) else { return nil }
        let prompt = components.queryItems?.first { $0.name == "prompt" || $0.name == "q" }?.value
        self = .newChat(prompt: Self.clean(prompt))
    }

    public static func url(prompt: String?) -> URL {
        var components = URLComponents()
        components.scheme = scheme
        components.host = "new"
        if let prompt = clean(prompt) { components.queryItems = [URLQueryItem(name: "prompt", value: prompt)] }
        return components.url!
    }

    public static func clean(_ prompt: String?) -> String? {
        guard let text = prompt?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else { return nil }
        return String(text.prefix(maxPromptLength))
    }
}
