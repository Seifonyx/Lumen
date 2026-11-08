import Foundation
import Testing
@testable import LumenCore

@MainActor private final class TestDeletionBackend: ChatDeletionBackend {
    var messages = 3
    var originals = 2
    var tombstoned = false
    var failNextOriginalBatch = true
    func markDeleted(chatID: String) async throws { tombstoned = true }
    func deleteMessageBatch(chatID: String) async throws -> Bool {
        guard messages > 0 else { return false }
        messages -= 1
        return true
    }
    func deleteOriginalBatch(chatID: String) async throws -> Bool {
        if failNextOriginalBatch { failNextOriginalBatch = false; throw URLError(.networkConnectionLost) }
        guard originals > 0 else { return false }
        originals -= 1
        return true
    }
}
@Suite @MainActor struct ChatDeletionTests {
    @Test func interruptedCleanupSurvivesRestartAndTheTombstoneListener() async throws {
        let store = MemoryConversationStore()
        let engine = ChatEngine(store: store)
        engine.switchAccount(to: "account")
        engine.applyRemoteMetadata(Conversation(id: "delete-chat", messages: [ChatMessage(role: .user, content: "Private")]))
        #expect(engine.deleteConversation(id: "delete-chat"))
        let backend = TestDeletionBackend()
        await #expect(throws: URLError.self) { try await ChatDeletion.run(chatID: "delete-chat", backend: backend) }
        #expect(backend.tombstoned)
        #expect(engine.pendingDeletions.contains("delete-chat"))
        let restored = ChatEngine(store: store)
        restored.switchAccount(to: "account")
        restored.applyRemoteDeletion(chatID: "delete-chat")
        #expect(restored.pendingDeletions.contains("delete-chat"))
        try await ChatDeletion.run(chatID: "delete-chat", backend: backend)
        restored.acknowledgeDeletion(chatID: "delete-chat")
        #expect(backend.messages == 0)
        #expect(backend.originals == 0)
        #expect(store.accounts["account"]?.pendingDeletions.isEmpty == true)
    }
    @Test func failedDurableDeleteKeepsTheVisibleChatAndDoesNotQueueCloudDeletion() {
        let store = MemoryConversationStore()
        let engine = ChatEngine(store: store)
        engine.applyRemoteMetadata(Conversation(id: "keep", messages: [ChatMessage(role: .user, content: "Keep")]))
        store.failWrites = true
        #expect(!engine.deleteConversation(id: "keep"))
        #expect(engine.savedConversations.contains { $0.id == "keep" })
        #expect(engine.pendingDeletions.isEmpty)
    }
}
