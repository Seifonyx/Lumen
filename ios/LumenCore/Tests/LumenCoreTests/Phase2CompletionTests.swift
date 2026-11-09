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
    @Test func historicalPDFIsOmittedWithoutBlockingPlainTextReply() async throws {
        let store = MemoryConversationStore()
        let unsupported = ChatAttachment(id: "old-web-pdf", name: "report.pdf", kind: .unsupported,
                                         mime: "application/pdf")
        var chat = Conversation(id: "web-chat", messages: [
            ChatMessage(id: "old-question", role: .user, content: "Summarize earlier",
                        attachments: [unsupported]),
            ChatMessage(id: "old-answer", role: .assistant, content: "Earlier answer")
        ])
        chat.historyLoaded = true
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0],
                                                 selectedConversationID: chat.id)
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store)
        await try #require(engine.submit(prompt: "A plain text follow-up", apiKey: "fixture")).value
        let request = try #require(await client.requests.last)
        #expect(request.first?.content == "Summarize earlier")
        #expect(request.first?.attachments == nil)
        #expect(request.last?.content == "A plain text follow-up")
        #expect(engine.contextOmittedAttachmentCount == 1)
        #expect(engine.currentConversation.messages.first?.attachments?.first?.name == "report.pdf")
        #expect(throws: AttachmentError.self) { try engine.storeAttachment(unsupported) }
    }

    @Test func reselectingActiveChatCannotResurrectStreamingOutboxEntry() async throws {
        let store = MemoryConversationStore()
        let engine = ChatEngine(client: Phase2ContextClient(), store: store)
        engine.selectModel(AIModel.defaults[0])
        let running = try #require(engine.submit(prompt: "Stop on reselection", apiKey: "fixture"))
        let id = engine.currentConversation.id
        let response = try #require(engine.currentConversation.messages.last?.id)
        #expect(engine.isStreaming)
        #expect(engine.selectConversation(id: id))
        #expect(engine.currentConversation.messages.last?.status == .stopped)
        #expect(engine.pendingMessages[id]?.contains(response) == true)
        await running.value
        #expect(engine.savedConversations.first(where: { $0.id == id })?.messages.last?.status == .stopped)
        let snapshot = try #require(store.accounts["device"])
        store.accounts["device"] = try JSONDecoder().decode(ChatSnapshot.self, from: JSONEncoder().encode(snapshot))
        #expect(ChatEngine(store: store).savedConversations.first(where: { $0.id == id })?.messages.last?.status == .stopped)
    }

    @Test func refreshPreservesPreviouslyLoadedPagesButHonorsDeletedIDs() throws {
        let ids = (0..<145).map { "m\($0)" }
        var chat = Conversation(id: "paged-chat")
        chat.remoteMessageIDs = ids; chat.historyLoaded = false
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat])
        let engine = ChatEngine(store: store)
        engine.selectConversation(id: chat.id)
        let newest = Array(ids.suffix(60))
        #expect(engine.applyRemotePage(chatID: chat.id,
            messages: newest.map { ChatMessage(id: $0, role: .user, content: $0) },
            orderedIDs: ids, ticket: try #require(engine.historyLoadTicket(chatID: chat.id)),
            revision: 1, reset: true))
        let previous = Array(ids[25..<85])
        #expect(engine.applyRemotePage(chatID: chat.id,
            messages: previous.map { ChatMessage(id: $0, role: .user, content: $0) },
            orderedIDs: ids, ticket: try #require(engine.historyLoadTicket(chatID: chat.id)),
            revision: 1, reset: false))
        var remote = Conversation(id: chat.id)
        remote.remoteMessageIDs = ids.filter { $0 != "m30" }; remote.remoteRevision = 2
        engine.applyRemoteMetadata(remote)
        let authoritative = remote.remoteMessageIDs!
        #expect(engine.applyRemotePage(chatID: chat.id,
            messages: newest.map { ChatMessage(id: $0, role: .user, content: $0) },
            orderedIDs: authoritative, ticket: try #require(engine.historyLoadTicket(chatID: chat.id)),
            revision: 2, reset: true))
        #expect(engine.currentConversation.messages.first?.id == "m25")
        #expect(engine.currentConversation.messages.count == 119)
        #expect(!engine.currentConversation.messages.contains { $0.id == "m30" })
        #expect(engine.currentConversation.messages.last?.id == "m144")
    }

    @Test func historicalSystemMessagesUseAuthoritativeOrderNotQueryOrder() async throws {
        let ids = ["first-system", "old-question", "second-system", "latest-question"]
        var chat = Conversation(id: "instructions")
        chat.remoteMessageIDs = ids; chat.historyLoaded = false
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0])
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store)
        engine.selectConversation(id: chat.id)
        let instructionB = ChatMessage(id: "second-system", role: .system, content: "B")
        let instructionA = ChatMessage(id: "first-system", role: .system, content: "A")
        #expect(engine.applyRemotePage(chatID: chat.id,
            messages: [ChatMessage(id: "latest-question", role: .user, content: "Recent")],
            orderedIDs: ids, ticket: try #require(engine.historyLoadTicket(chatID: chat.id)),
            revision: 4, reset: true, systemMessages: [instructionB, instructionA]))
        await try #require(engine.submit(prompt: "Follow up", apiKey: "fixture")).value
        let request = try #require(await client.requests.last)
        #expect(request.prefix(2).map(\.id) == ["first-system", "second-system"])
        #expect(request.last?.content == "Follow up")
    }

}
