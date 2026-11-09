import Foundation
import Testing
@testable import LumenCore

private actor Phase2ContextClient: AIStreamingClient {
    var requests: [[ChatMessage]] = []
    func stream(messages: [ChatMessage], model: AIModel, apiKey: String) async throws -> AsyncThrowingStream<String, Error> {
        requests.append(messages)
        return AsyncThrowingStream { $0.yield("Test reply"); $0.finish() }
    }
}

@Suite @MainActor struct Phase2CompletionTests {
    @Test func metadataRefreshPreservesInheritedPrefixUntilAllBatchesAreAcknowledged() throws {
        let first = ChatMessage(id: "first", role: .user, content: "Earlier question")
        let second = ChatMessage(id: "second", role: .assistant, content: "Earlier answer")
        var child = Conversation(id: "child", messages: [first, second])
        child.parentConversationID = "parent"
        child.inheritedMessageIDs = ["first", "second"]
        child.remoteMessageIDs = ["first"]
        child.historyLoaded = true
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(
            conversations: [child], pendingMessages: ["child": ["first", "second"]])
        let engine = ChatEngine(store: store)
        engine.selectConversation(id: "child")
        var remote = Conversation(id: "child")
        remote.parentConversationID = "parent"
        remote.remoteMessageIDs = ["first"]
        remote.remoteRevision = 2
        engine.applyRemoteMetadata(remote)
        #expect(engine.currentConversation.inheritedMessageIDs == ["first", "second"])
        engine.acknowledge(chatID: "child", messageIDs: ["first"])

        // Simulate process death while the second inherited message is still queued.
        let saved = try #require(store.accounts["device"])
        store.accounts["device"] = try JSONDecoder().decode(ChatSnapshot.self, from: JSONEncoder().encode(saved))
        let restored = ChatEngine(store: store)
        let pending = try #require(restored.savedConversations.first(where: { $0.id == "child" }))
        #expect(pending.inheritedMessageIDs == ["first", "second"])
        #expect(restored.pendingMessages["child"] == ["second"])

        // The parent was deleted between the two fork batches. Never recreate the message
        // from local text without the parent's authoritative fields and attachments.
        #expect(throws: WebSyncError.self) {
            try WebChatCodec.append(chat: pending, messageIDs: ["second"],
                remote: ["ids": ["first"], "count": 1], existingMessages: [:],
                sourceMetadata: ["deleted": true])
        }
    }

    @Test func olderSystemInstructionSurvivesPagingAndRestartAndReachesProvider() async throws {
        let allIDs = ["initial-system"] + (0..<125).map { "message-\($0)" }
        var chat = Conversation(id: "long-chat")
        chat.remoteMessageIDs = allIDs
        chat.historyLoaded = false
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0])
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store)
        engine.selectConversation(id: chat.id)
        let newest = try HistoryPaging.pageIDs(orderedIDs: allIDs, loadedIDs: [], older: false)
        let visible = newest.map { ChatMessage(id: $0, role: .user, content: "Turn \($0)") }
        let instruction = ChatMessage(id: "initial-system", role: .system, content: "Use German.")

        #expect(!engine.applyRemotePage(chatID: chat.id, messages: visible, orderedIDs: allIDs,
            ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 1,
            reset: true, systemMessages: [ChatMessage(role: .system, content: "Unlisted")]))
        #expect(engine.applyRemotePage(chatID: chat.id, messages: visible, orderedIDs: allIDs,
            ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 1,
            reset: true, systemMessages: [instruction]))
        #expect(engine.currentConversation.messages.count == 60)
        #expect(!engine.currentConversation.messages.contains { $0.id == instruction.id })
        #expect(engine.hasOlderMessages(chatID: chat.id))

        let saved = try #require(store.accounts["device"])
        store.accounts["device"] = try JSONDecoder().decode(ChatSnapshot.self, from: JSONEncoder().encode(saved))
        let restored = ChatEngine(client: client, store: store)
        restored.selectConversation(id: chat.id)
        await try #require(restored.submit(prompt: "New question", apiKey: "fixture")).value
        let request = try #require(await client.requests.last)
        #expect(request.first?.id == instruction.id)
        #expect(request.filter { $0.id == instruction.id }.count == 1)
        #expect(request.last?.content == "New question")
        #expect(request.count <= 40)
    }
}
