import Foundation

@MainActor public protocol ChatDeletionBackend {
    func markDeleted(chatID: String) async throws
    /// Delete a bounded batch; return false only when no documents remain.
    func deleteMessageBatch(chatID: String) async throws -> Bool
    func deleteOriginalBatch(chatID: String) async throws -> Bool
}

public enum ChatDeletion {
    /// The caller keeps its durable deletion intent until every stage succeeds. Repeating is safe.
    @MainActor public static func run(chatID: String, backend: any ChatDeletionBackend) async throws {
        try Task.checkCancellation()
        try await backend.markDeleted(chatID: chatID)
        while true {
            try Task.checkCancellation()
            if try await !backend.deleteMessageBatch(chatID: chatID) { break }
        }
        while true {
            try Task.checkCancellation()
            if try await !backend.deleteOriginalBatch(chatID: chatID) { break }
        }
    }
}
