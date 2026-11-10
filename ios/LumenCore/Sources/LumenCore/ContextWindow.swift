import Foundation

public enum ContextWindowError: Error, LocalizedError, Sendable {
    case latestTurnTooLarge
    public var errorDescription: String? { "The latest message and its files are too large for this reply. Shorten the message or split the attachments." }
}

public struct ContextWindow: Sendable {
    public let messages: [ChatMessage]
    public let omittedCount: Int
    public static func select(messages: [ChatMessage], maximumMessages: Int = 40, maximumTextBytes: Int = 48_000, maximumImages: Int = 4) throws -> ContextWindow {
        let system = messages.filter { $0.role == .system }
        var turns: [[ChatMessage]] = []
        for message in messages where message.role != .system {
            if message.role == .user || turns.isEmpty { turns.append([message]) }
            else { turns[turns.count - 1].append(message) }
        }
        func bytes(_ values: [ChatMessage]) -> Int { values.reduce(0) { $0 + $1.content.utf8.count + ($1.attachments ?? []).reduce(0) { $0 + ($1.text?.utf8.count ?? 0) } } }
        func photos(_ values: [ChatMessage]) -> Int { values.flatMap { $0.attachments ?? [] }.filter { $0.kind == .image }.count }
        var chosen: [ChatMessage] = [], used = bytes(system), count = system.count, images = photos(system)
        guard used <= maximumTextBytes else { throw ContextWindowError.latestTurnTooLarge }
        for turn in turns.reversed() {
            let fits = used + bytes(turn) <= maximumTextBytes && count + turn.count <= maximumMessages && images + photos(turn) <= maximumImages
            if !fits {
                if chosen.isEmpty { throw ContextWindowError.latestTurnTooLarge }
                break
            }
            chosen.insert(contentsOf: turn, at: 0); used += bytes(turn); count += turn.count; images += photos(turn)
        }
        let selected = system + chosen
        return ContextWindow(messages: selected, omittedCount: messages.count - selected.count)
    }
}
