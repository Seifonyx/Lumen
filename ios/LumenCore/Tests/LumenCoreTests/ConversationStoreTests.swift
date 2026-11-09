import Foundation
import Testing
@testable import LumenCore

@Suite @MainActor struct ConversationStoreTests {
    @Test func accountsHaveSeparateDurableHistoriesAndOutboxes() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileConversationStore(directory: directory)
        let chat = Conversation(id: "web-chat-id", messages: [ChatMessage(id: "web-message-id", role: .user, content: "Private")])
        let snapshot = ChatSnapshot(conversations: [chat], pendingMessages: [chat.id: [chat.messages[0].id]])
        try store.save(snapshot, accountID: "account/a")
        #expect(try store.load(accountID: "account/b").conversations.isEmpty)
        let reopened = try FileConversationStore(directory: directory).load(accountID: "account/a")
        #expect(reopened == snapshot)
        #expect(reopened.conversations.first?.id == "web-chat-id")
    }

    @Test func corruptCacheDoesNotSilentlyBecomeAnEmptyHistory() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileConversationStore(directory: directory)
        try store.save(ChatSnapshot(), accountID: "account")
        let file = try #require(FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil).first)
        try Data("damaged".utf8).write(to: file)
        #expect(throws: (any Error).self) { try store.load(accountID: "account") }
    }
}
