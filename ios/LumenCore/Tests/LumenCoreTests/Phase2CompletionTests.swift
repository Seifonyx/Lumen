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
        try await #require(restored.submit(prompt: "New question", apiKey: "fixture")).value
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
        try await #require(engine.submit(prompt: "A plain text follow-up", apiKey: "fixture")).value
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
        try await #require(engine.submit(prompt: "Follow up", apiKey: "fixture")).value
        let request = try #require(await client.requests.last)
        #expect(request.prefix(2).map(\.id) == ["first-system", "second-system"])
        #expect(request.last?.content == "Follow up")
    }

    @Test func oversizedLatestPromptOrAttachmentDoesNotEnterTheOutbox() async throws {
        for useAttachment in [false, true] {
            let client = Phase2ContextClient()
            let engine = ChatEngine(client: client, store: MemoryConversationStore(), attachmentStore: MemoryAttachmentStore())
            engine.selectModel(AIModel.defaults[0])
            let file = ChatAttachment(name: "notes.txt", kind: .text, mime: "text/plain", text: String(repeating: "a", count: 50_000))
            if useAttachment { try engine.storeAttachment(file) }
            let prompt = useAttachment ? "Review this" : String(repeating: "a", count: 49_000)
            let reply = engine.submit(prompt: prompt, attachmentIDs: useAttachment ? [file.id] : [], apiKey: "fixture")
            #expect(reply == nil)
            let messageCount = engine.currentConversation.messages.count
            #expect(messageCount == 0)
            #expect(engine.pendingMessages.isEmpty)
            #expect(engine.errorMessage == ContextWindowError.latestTurnTooLarge.errorDescription)
            await reply?.value
            #expect(await client.requests.isEmpty)
        }
    }

    @Test func oversizedEditLeavesOriginalConversationSelected() async throws {
        let original = Conversation(id: "original", messages: [
            ChatMessage(id: "question", role: .user, content: "Original question"),
            ChatMessage(role: .assistant, content: "Original answer")
        ])
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [original], selectedModel: AIModel.defaults[0],
                                                 selectedConversationID: original.id)
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store)
        let reply = engine.editAndResend(messageID: "question", text: String(repeating: "a", count: 49_000), apiKey: "fixture")
        #expect(reply == nil)
        #expect(engine.currentConversation.id == original.id)
        #expect(engine.currentConversation.messages.map(\.id) == original.messages.map(\.id))
        #expect(engine.pendingMessages.isEmpty)
        await reply?.value
        #expect(await client.requests.isEmpty)
    }

    @Test func attachmentOnlyHistoryDoesNotProduceAnEmptyProviderTurn() async throws {
        let pdf = ChatAttachment(id: "web-pdf", name: "report.pdf", kind: .unsupported, mime: "application/pdf")
        let chat = Conversation(id: "file-only", messages: [
            ChatMessage(id: "file-turn", role: .user, content: "", attachments: [pdf]),
            ChatMessage(role: .assistant, content: "Earlier summary")
        ])
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[4],
                                                 selectedConversationID: chat.id)
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store)
        try await #require(engine.submit(prompt: "Continue the summary", apiKey: "fixture")).value
        let request = try #require(await client.requests.last)
        #expect(request.allSatisfy { !$0.content.isEmpty || !($0.attachments ?? []).isEmpty })
        #expect(engine.contextOmittedAttachmentCount == 1)
        #expect(engine.currentConversation.messages.first?.content == "")
    }

    @Test func cachedWebHistoryWithAnUnsupportedFileRemainsUsableAfterRestart() async throws {
        let message = try WebChatCodec.message(id: "webp", fields: [
            "role": "user", "text": "Earlier question",
            "files": [["id": "webp-file", "name": "photo.webp", "mime": "image/webp", "size": 10]]
        ])
        #expect(message.attachments?.isEmpty == true)
        #expect(message.attachmentNames == ["photo.webp"])
        var chat = Conversation(id: "cached-web", messages: [message])
        chat.historyLoaded = true
        chat.remoteMessageIDs = [message.id]
        let store = MemoryConversationStore()
        let snapshot = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0], selectedConversationID: chat.id)
        store.accounts["device"] = try JSONDecoder().decode(ChatSnapshot.self, from: JSONEncoder().encode(snapshot))
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store)
        #expect(engine.currentConversation.historyLoaded == true)
        try await #require(engine.submit(prompt: "Follow up", apiKey: "fixture")).value
        #expect(await client.requests.last?.first?.content == "Earlier question")
        #expect(engine.contextOmittedAttachmentCount == 1)
    }

    @Test func assistantImageOnlyHistoryKeepsItsPlaceWithoutSendingAssistantImageBytes() async throws {
        let image = ChatAttachment(id: "generated-image", name: "result.jpg", kind: .image,
                                   mime: "image/jpeg", data: Data([0xff, 0xd8, 0xff, 0xd9]))
        let chat = Conversation(id: "generated", messages: [
            ChatMessage(role: .user, content: "Create an image"),
            ChatMessage(id: "generated-reply", role: .assistant, content: "", attachments: [image.metadata])
        ])
        let store = MemoryConversationStore(), files = MemoryAttachmentStore()
        try files.save(image, accountID: "device")
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0],
                                                 selectedConversationID: chat.id)
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store, attachmentStore: files)
        try await #require(engine.submit(prompt: "Describe the result", apiKey: "fixture")).value
        let request = try #require(await client.requests.last)
        let previous = try #require(request.first { $0.id == "generated-reply" })
        #expect(previous.role == .assistant)
        #expect(previous.content == "[Earlier attachment unavailable.]")
        #expect(previous.attachments == nil)
        #expect(engine.contextOmittedAttachmentCount == 1)
    }

    @Test func unavailableImagesDoNotConsumeTheImageBudgetOrDiscardEarlierText() async throws {
        let missing = (0..<4).map { ChatAttachment(id: "missing-\($0)", name: "missing.jpg", kind: .image, mime: "image/jpeg") }
        let chat = Conversation(id: "images", messages: [
            ChatMessage(role: .user, content: "Keep this earlier question", attachments: missing),
            ChatMessage(role: .assistant, content: "Earlier answer")
        ])
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0],
                                                 selectedConversationID: chat.id)
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store, attachmentStore: MemoryAttachmentStore())
        let fresh = ChatAttachment(id: "new-image", name: "new.jpg", kind: .image, mime: "image/jpeg", data: Data([0xff, 0xd8, 0xff, 0xd9]))
        try engine.storeAttachment(fresh)
        try await #require(engine.submit(prompt: "Compare this image", attachmentIDs: [fresh.id], apiKey: "fixture")).value
        let request = try #require(await client.requests.last)
        #expect(request.first?.content == "Keep this earlier question")
        #expect(request.first?.attachments == nil)
        #expect(request.last?.attachments?.first?.data == fresh.data)
        #expect(engine.contextOmittedAttachmentCount == 4)
    }

    @Test func latestRefreshMakesMiddleGapLoadableAndBlocksIncompleteRevision() throws {
        let ids = (0..<121).map { "m\($0)" }
        func message(_ id: String) -> ChatMessage { ChatMessage(id: id, role: .user, content: id) }
        var chat = Conversation(id: "long", messages: ids.prefix(60).map(message))
        chat.remoteMessageIDs = Array(ids.prefix(60))
        chat.historyLoaded = true
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0],
                                                 selectedConversationID: chat.id)
        let engine = ChatEngine(client: Phase2ContextClient(), store: store)
        #expect(engine.applyRemotePage(chatID: chat.id, messages: ids.suffix(60).map(message), orderedIDs: ids,
                                      ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 2, reset: true))
        #expect(engine.hasOlderMessages(chatID: chat.id))
        #expect(engine.editAndResend(messageID: "m120", text: "Updated", apiKey: "fixture") == nil)
        #expect(engine.currentConversation.id == chat.id)
        let gap = try HistoryPaging.pageIDs(orderedIDs: ids, loadedIDs: engine.currentConversation.messages.map(\.id), older: true)
        #expect(gap == ["m60"])
        #expect(engine.applyRemotePage(chatID: chat.id, messages: gap.map(message), orderedIDs: ids,
                                      ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 2, reset: false))
        #expect(!engine.hasOlderMessages(chatID: chat.id))
        #expect(engine.currentConversation.messages.map(\.id) == ids)
    }

    @Test func freshSystemInstructionsReplacePreviouslyPagedCopies() async throws {
        let stale = ChatMessage(id: "system", role: .system, content: "Old instructions")
        let latest = ChatMessage(id: "question", role: .user, content: "Earlier question")
        var chat = Conversation(id: "instruction-refresh", messages: [stale, latest])
        chat.remoteMessageIDs = [stale.id, latest.id]
        chat.historyLoaded = true
        let store = MemoryConversationStore()
        store.accounts["device"] = ChatSnapshot(conversations: [chat], selectedModel: AIModel.defaults[0],
                                                 selectedConversationID: chat.id)
        let client = Phase2ContextClient()
        let engine = ChatEngine(client: client, store: store)
        let fresh = ChatMessage(id: stale.id, role: .system, content: "Fresh instructions")
        #expect(engine.applyRemotePage(chatID: chat.id, messages: [latest], orderedIDs: [fresh.id, latest.id],
                                      ticket: try #require(engine.historyLoadTicket(chatID: chat.id)), revision: 2, reset: true,
                                      systemMessages: [fresh]))
        #expect(engine.currentConversation.messages.first?.content == "Fresh instructions")
        try await #require(engine.submit(prompt: "Follow up", apiKey: "fixture")).value
        let request = try #require(await client.requests.last)
        #expect(request.first?.content == "Fresh instructions")
    }
}
