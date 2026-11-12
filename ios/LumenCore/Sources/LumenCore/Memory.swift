import Foundation

/// A short fact Lumen remembers about the user, shared by every device: the web keeps them all in one document,
/// `modelRouter/{uid}/memory/all`, as a map of id → memory. A memory with a project goes only to that project's chats.
public struct Memory: Identifiable, Sendable, Equatable {
    public let id: String
    public var text: String
    public var createdAt: Double
    public var updatedAt: Double
    /// "chat" (saved by a model during a chat) or "manual" (added by the user).
    public var source: String
    public var projectID: String?
    public var chatID: String?

    public init(id: String = UUID().uuidString, text: String, createdAt: Double, updatedAt: Double,
                source: String = "manual", projectID: String? = nil, chatID: String? = nil) {
        self.id = id; self.text = text; self.createdAt = createdAt; self.updatedAt = updatedAt
        self.source = source; self.projectID = projectID; self.chatID = chatID
    }

    /// The memory as the web stores it.
    public var fields: [String: Any] {
        var fields: [String: Any] = ["id": id, "text": text, "createdAt": createdAt, "updatedAt": updatedAt, "source": source]
        if let projectID { fields["projectId"] = projectID }
        if let chatID { fields["chatId"] = chatID }
        return fields
    }
}

/// The user's personalization from the account settings, with the web's defaults for anything not set yet.
public struct Personalization: Sendable, Equatable {
    public var memory = true
    public var memoryAuto = true
    public var aboutMe = ""
    public var customInstructions = ""
    public init() {}

    public init(settings: [String: Any]?) {
        memory = settings?["memory"] as? Bool ?? true
        memoryAuto = settings?["memoryAuto"] as? Bool ?? true
        aboutMe = settings?["aboutMe"] as? String ?? ""
        customInstructions = settings?["customInstructions"] as? String ?? ""
    }

    /// The settings snapshot with these values, everything else kept.
    public func apply(to settings: [String: Any]?) -> [String: Any] {
        var settings = settings ?? [:]
        settings["memory"] = memory
        settings["memoryAuto"] = memoryAuto
        settings["aboutMe"] = String(aboutMe.prefix(MemoryRules.maximumAboutCharacters))
        settings["customInstructions"] = customInstructions
        return settings
    }
}

/// The web's memory rules (src/lib/memory.ts), so a chat on the iPhone remembers and forgets exactly as on the web.
public enum MemoryRules {
    public static let maximumMemories = 200
    public static let maximumMemoryCharacters = 500
    public static let maximumAboutCharacters = 2000
    static let promptBudget = 8_000

    /// The memories in the web's document, newest first; empty or malformed entries are skipped.
    public static func memories(from document: [String: Any]?) -> [Memory] {
        guard let items = document?["items"] as? [String: Any] else { return [] }
        return items.compactMap { key, value -> Memory? in
            guard let fields = value as? [String: Any], let text = fields["text"] as? String,
                  !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
            func number(_ name: String) -> Double { (fields[name] as? NSNumber)?.doubleValue ?? 0 }
            return Memory(id: fields["id"] as? String ?? key, text: text, createdAt: number("createdAt"), updatedAt: number("updatedAt"),
                          source: fields["source"] as? String ?? "manual", projectID: fields["projectId"] as? String,
                          chatID: fields["chatId"] as? String)
        }.sorted { $0.updatedAt == $1.updatedAt ? $0.id < $1.id : $0.updatedAt > $1.updatedAt }
    }

    public static func clip(_ text: String) -> String {
        String(text.split(whereSeparator: \.isWhitespace).joined(separator: " ").prefix(maximumMemoryCharacters))
    }

    private static func normalized(_ text: String) -> String {
        let scalars = text.lowercased().unicodeScalars.map { CharacterSet.letters.contains($0) || CharacterSet.decimalDigits.contains($0) ? Character($0) : " " }
        return String(scalars).split(separator: " ").joined(separator: " ")
    }

    /// True if the two texts say (nearly) the same thing.
    public static func same(_ a: String, _ b: String) -> Bool {
        let x = normalized(a), y = normalized(b)
        guard !x.isEmpty, !y.isEmpty else { return false }
        if x == y || x.contains(y) || y.contains(x) { return true }
        let wx = Set(x.split(separator: " ")), wy = Set(y.split(separator: " "))
        return Double(wx.intersection(wy).count) / Double(max(wx.count, wy.count)) >= 0.75
    }

    private static let marker = #"\[\[\s*(remember\s+for\s+project|remember|forget)\s*:\s*([\s\S]*?)\]\]"#

    public struct Operations: Equatable, Sendable {
        public var text: String
        public var remember: [String] = []
        public var forget: [String] = []
        public var project: [String] = []
        public var isEmpty: Bool { remember.isEmpty && forget.isEmpty && project.isEmpty }
    }

    /// Splits a finished reply into the visible text and its memory changes.
    public static func operations(in reply: String) -> Operations {
        guard let regex = try? NSRegularExpression(pattern: marker, options: [.caseInsensitive]) else { return Operations(text: reply) }
        var result = Operations(text: "")
        let source = reply as NSString
        for match in regex.matches(in: reply, range: NSRange(location: 0, length: source.length)) {
            let kind = source.substring(with: match.range(at: 1)).lowercased()
            let body = clip(source.substring(with: match.range(at: 2)))
            guard !body.isEmpty else { continue }
            if kind == "remember" { result.remember.append(body) }
            else if kind == "forget" { result.forget.append(body) }
            else { result.project.append(body) }
        }
        let stripped = regex.stringByReplacingMatches(in: reply, range: NSRange(location: 0, length: source.length), withTemplate: "")
        result.text = collapseBlankLines(stripped).replacingOccurrences(of: #"\s+$"#, with: "", options: .regularExpression)
        return result
    }

    /// While a reply streams in, hides memory lines, including one that is only half written.
    public static func hidingLines(_ text: String) -> String {
        var visible = text.replacingOccurrences(of: marker, with: "", options: [.regularExpression, .caseInsensitive])
        let partial = #"\[(\[\s*(r|re|rem|reme|remem|rememb|remembe|remember(?:\s+(?:f|fo|for(?:\s+(?:p|pr|pro|proj|proje|projec|project)?)?)?)?|f|fo|for|forg|forge|forget)?(\s*:[^\]]*)?\]?)?$"#
        visible = visible.replacingOccurrences(of: partial, with: "", options: [.regularExpression, .caseInsensitive])
        return collapseBlankLines(visible)
    }

    private static func collapseBlankLines(_ text: String) -> String {
        text.replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
    }

    /// The memory section of the instructions sent to the model, word for word as on the web.
    public static func instructions(memories: [Memory], autoSave: Bool, projectID: String?, projectName: String?, aboutMe: String) -> String {
        var lines: [String] = []
        var size = 0
        let about = String(aboutMe.trimmingCharacters(in: .whitespacesAndNewlines).prefix(maximumAboutCharacters))
        for memory in memories where memory.projectID == nil || memory.projectID == projectID {
            if size + memory.text.count > promptBudget { break }
            lines.append("- " + memory.text + (memory.projectID != nil ? " (this project)" : ""))
            size += memory.text.count + 3
        }
        let known = lines.isEmpty ? "You have no saved memories about the user yet."
            : "What you remember about the user from earlier chats (use it naturally when relevant; don't recite it unless asked):\n" + lines.joined(separator: "\n")
        let aboutNote = about.isEmpty ? "" : "What the user wrote about themselves (keep it in mind; it's theirs to change, so don't save it as memories):\n" + about
        var projectNote = ""
        if let projectID, !projectID.isEmpty, let projectName, !projectName.isEmpty {
            projectNote = "This chat is in the user's project \"\(projectName)\". For facts that only matter to this project (its goals, people, decisions, conventions), use [[remember for project: …]] instead of [[remember: …]]; those are only shown in this project's chats."
        }
        let when = autoSave
            ? "Save a memory when the user asks you to remember something, or when they clearly state a lasting fact or preference that will help in future chats (their name, job, ongoing projects, or how they want answers). Only save what they say outright: never infer a preference from how they write (writing in a language, or asking one short question, is not a preference), and don't save one-off details, the topic of this chat, things already listed above, or what you said yourself."
            : "Save a memory only when the user explicitly asks you to remember something."
        return [
            "# Memory",
            aboutNote,
            known,
            "To save a memory, end your reply with a line [[remember: short fact in the third person, e.g. \"Prefers short answers\"]]. To remove one (when the user asks you to forget it, or it is no longer true), add [[forget: the memory as written above]]. To change a memory, forget the old one and remember the new one. These lines are hidden from the user; the app shows \"Memory updated\". " + when,
            projectNote,
            "Never save passwords, API keys, financial account details, health information, details about other people, or confidential work figures — even if asked; say you can't store that.",
        ].filter { !$0.isEmpty }.joined(separator: "\n")
    }
}
